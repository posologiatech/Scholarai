"""
Smoke test for the deterministic finding scan.

Run with: python remote-exec/test_datamind_scan.py

Like test_datamind_stats.py this is a plain script (no pytest in this repo) that
exits non-zero on failure. It checks the four things the scan lives or dies by:
that it finds a real effect planted in the data, that it does NOT report noise,
that its decision agrees with the reporting engine's, and that a scan of pure
noise stays quiet after the FDR correction.
"""
import os, sys, json, io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, pandas as pd
import datamind_stats as ds
import datamind_scan as scan

rng = np.random.default_rng(11)
fails = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok  {name}")
    else:
        fails.append(f"{name}: {detail}")


# A dataset with exactly one planted effect: 'pressao' differs by 'tratamento'.
n = 180
planted = pd.DataFrame({
    "tratamento": np.repeat(["placebo", "ativo"], n // 2),
    "pressao": np.concatenate([rng.normal(140, 10, n // 2), rng.normal(128, 10, n // 2)]),
    "idade": rng.normal(60, 12, n),
    "peso": rng.normal(75, 14, n),
    "sexo": rng.choice(["F", "M"], n),
    "prontuario": [f"P{i:04d}" for i in range(n)],
})

print("varredura com um efeito plantado:")
result = scan.scan({"planted.csv": planted})
findings = result["findings"]

check("achou pelo menos um resultado", len(findings) > 0, "nenhum achado")

top = findings[0] if findings else {}
check(
    "o efeito plantado vem primeiro",
    top.get("kind") == "comparison" and top.get("outcome") == "pressao"
    and top.get("group") == "tratamento",
    f"veio {top.get('kind')} {top.get('outcome')} x {top.get('group')}",
)
check("o achado e significativo apos FDR", bool(top.get("significant")), f"q={top.get('q')}")
check("carrega q alem de p", top.get("q") is not None and top.get("p") is not None)
check("carrega tamanho de efeito", top.get("effect") is not None and top.get("magnitude"))
check("carrega a regra que decidiu", bool(top.get("because")) and bool(top.get("test")))

# The identifier column must never become a grouping or an outcome.
touched = {f.get("group") for f in findings} | {f.get("outcome") for f in findings}
touched |= {f.get("var_a") for f in findings} | {f.get("var_b") for f in findings}
check("ignora a coluna identificadora", "prontuario" not in touched, "usou 'prontuario'")

# Columns the client-side profile flagged are honoured.
numeric, categorical = scan.classify_columns(planted, exclude=["idade"])
check("respeita a lista de exclusao", "idade" not in numeric, f"numericas: {numeric}")
check("classifica o grupo como categorica", "tratamento" in categorical, f"categoricas: {categorical}")
check("classifica o desfecho como numerica", "pressao" in numeric, f"numericas: {numeric}")

# --- the scan and the reporting engine must reach the same decision ---
print("concordancia com o motor de relatorio:")
buf, old = io.StringIO(), sys.stdout
sys.stdout = buf
reported = ds.compare_groups(planted, "pressao", "tratamento")
sys.stdout = old
screened = ds.screen_comparison(planted, "pressao", "tratamento")
check("mesmo teste escolhido", reported["test"] == screened["test"],
      f"{reported['test']} vs {screened['test']}")
check("mesmo p-valor", abs(reported["p"] - screened["p"]) < 1e-12,
      f"{reported['p']} vs {screened['p']}")

df_cat = pd.DataFrame({
    "sexo": rng.choice(["F", "M"], 200),
    "desfecho": rng.choice(["sim", "nao"], 200),
})
buf, old = io.StringIO(), sys.stdout
sys.stdout = buf
reported_assoc = ds.association(df_cat, "sexo", "desfecho")
sys.stdout = old
screened_assoc = ds.screen_association(df_cat, "sexo", "desfecho")
check("mesmo teste de associacao", reported_assoc["test"] == screened_assoc["test"],
      f"{reported_assoc['test']} vs {screened_assoc['test']}")
check("mesmo p-valor de associacao", abs(reported_assoc["p"] - screened_assoc["p"]) < 1e-12,
      f"{reported_assoc['p']} vs {screened_assoc['p']}")

# --- pure noise must stay quiet ---
print("varredura sobre ruido puro:")
noise = pd.DataFrame({f"v{i}": rng.normal(0, 1, 120) for i in range(8)})
noise["g1"] = rng.choice(["a", "b"], 120)
noise["g2"] = rng.choice(["x", "y", "z"], 120)
noise_result = scan.scan({"noise.csv": noise})
check("muitos testes foram realmente rodados", noise_result["totalTested"] > 20,
      f"rodou {noise_result['totalTested']}")
check("nenhum achado significativo no ruido", noise_result["totalSignificant"] == 0,
      f"{noise_result['totalSignificant']} falsos positivos")

# BH must be monotone and never below the raw p-value.
print("correcao de Benjamini-Hochberg:")
raw = [0.001, 0.01, 0.02, 0.2, 0.9]
adjusted = ds.benjamini_hochberg(raw)
check("q nunca menor que p", all(a >= p - 1e-12 for a, p in zip(adjusted, raw)), str(adjusted))
check("q monotono", all(adjusted[i] <= adjusted[i + 1] + 1e-12 for i in range(len(adjusted) - 1)),
      str(adjusted))
check("q do menor p e p*n/1", abs(adjusted[0] - 0.005) < 1e-9, str(adjusted))
check("lista vazia nao quebra", ds.benjamini_hochberg([]) == [])

# --- the payload the browser parses ---
print("payload:")
buf, old = io.StringIO(), sys.stdout
sys.stdout = buf
scan.run_scan({"planted.csv": planted})
sys.stdout = old
text = buf.getvalue()
check("emite os marcadores", "__DATAFINDINGS_START__" in text and "__DATAFINDINGS_END__" in text)
payload = text.split("__DATAFINDINGS_START__")[1].split("__DATAFINDINGS_END__")[0]
try:
    parsed = json.loads(payload)
    check("o payload e JSON valido", len(parsed["findings"]) > 0)
    check("sem NaN no JSON", "NaN" not in payload and "Infinity" not in payload)
except Exception as e:
    fails.append(f"payload: {e}")

# --- the browser path, which is the only one the scan actually runs on ---
# Pyodide exec's both files into one globals dict, with the scan indented inside
# the worker's try/except wrapper. `import datamind_stats` fails there, so this is
# the only place `_stat`'s globals() fallback is exercised.
print("caminho do navegador (exec em globals, sem import):")
browser_globals = {}
here = os.path.dirname(os.path.abspath(__file__))
stats_source = open(os.path.join(here, "datamind_stats.py"), encoding="utf-8").read()
scan_source = open(os.path.join(here, "datamind_scan.py"), encoding="utf-8").read()
wrapped = ("try:\n" + "\n".join("    " + line for line in scan_source.split("\n"))
           + "\nexcept Exception as _e:\n    raise\n")
exec(compile(stats_source, "datamind_stats", "exec"), browser_globals)
exec(compile(wrapped, "datamind_scan", "exec"), browser_globals)
buf, old = io.StringIO(), sys.stdout
sys.stdout = buf
browser_globals["run_scan"]({"planted.csv": planted})
sys.stdout = old
browser_text = buf.getvalue()
check("roda sem import do motor", "__DATAFINDINGS_START__" in browser_text, browser_text[:200])
browser_payload = json.loads(
    browser_text.split("__DATAFINDINGS_START__")[1].split("__DATAFINDINGS_END__")[0]
)
check("acha o mesmo efeito no navegador",
      browser_payload["findings"][0]["outcome"] == "pressao",
      str(browser_payload["findings"][:1]))

# A dataset too small to screen returns empty instead of raising.
tiny = pd.DataFrame({"a": [1.0, 2.0, 3.0], "b": ["x", "y", "x"]})
check("dataset minusculo nao quebra", scan.scan({"tiny.csv": tiny})["findings"] == [])

print()
if fails:
    print("FALHAS:")
    for f in fails:
        print(" -", f)
    sys.exit(1)
print("todos os cenarios passaram")
