"""
Smoke test for the deterministic test-selection engine.

Run with: python remote-exec/test_datamind_stats.py

There is no Python test runner wired into this repo, so this is a plain script that
exits non-zero on failure. It checks two things the engine lives or dies by: that
each branch of the rule table fires the test it claims to, and that the output of a
real run always carries the assumptions, the effect size and the interval.
"""
import os, sys, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, pandas as pd
import datamind_stats as ds

rng = np.random.default_rng(7)
fails = []

def run(name, fn):
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        out = fn()
    except Exception as e:
        sys.stdout = old
        fails.append(f"{name}: RAISED {type(e).__name__}: {e}")
        return None
    sys.stdout = old
    return out, buf.getvalue()

def expect(name, got, want):
    if got != want:
        fails.append(f"{name}: escolheu {got}, esperado {want}")
    else:
        print(f"  ok  {name:28s} -> {got}")

# --- rule table, pure ---
print("rule table:")
expect("2 indep normal homo", ds.choose_comparison_test(2, False, True, True)[0], "student_t")
expect("2 indep normal hetero", ds.choose_comparison_test(2, False, True, False)[0], "welch_t")
expect("2 indep nao-normal", ds.choose_comparison_test(2, False, False, True)[0], "mannwhitney")
expect("3 indep normal homo", ds.choose_comparison_test(3, False, True, True)[0], "anova")
expect("3 indep normal hetero", ds.choose_comparison_test(3, False, True, False)[0], "welch_anova")
expect("3 indep nao-normal", ds.choose_comparison_test(3, False, False, True)[0], "kruskal")
expect("2 pareado normal", ds.choose_comparison_test(2, True, True, True)[0], "paired_t")
expect("2 pareado nao-normal", ds.choose_comparison_test(2, True, False, True)[0], "wilcoxon")
expect("4 pareado", ds.choose_comparison_test(4, True, True, True)[0], "friedman")
expect("cat 2x2 esperado baixo", ds.choose_association_test("categorical", (2, 2), 3.1)[0], "fisher")
expect("cat 3x3 esperado baixo", ds.choose_association_test("categorical", (3, 3), 2.0)[0], "chi2_unreliable")
expect("cat esperado ok", ds.choose_association_test("categorical", (2, 3), 12.0)[0], "chi2")
expect("num normal", ds.choose_association_test("numeric", both_normal=True)[0], "pearson")
expect("num nao-normal", ds.choose_association_test("numeric", both_normal=False)[0], "spearman")

print("holm:")
adj = ds.holm([0.01, 0.04, 0.03])
if not (adj[0] <= adj[2] <= adj[1] and abs(adj[0] - 0.03) < 1e-9):
    fails.append(f"holm: {adj}")
else:
    print(f"  ok  monotonico e correto      -> {[round(a,4) for a in adj]}")

# --- end to end, real data ---
print("end to end:")

n = 120
df_t = pd.DataFrame({
    "idade": np.concatenate([rng.normal(60, 8, n), rng.normal(64, 8, n)]),
    "grupo": ["A"] * n + ["B"] * n,
})
out = run("student t", lambda: ds.compare_groups(df_t, "idade", "grupo"))
if out:
    res, text = out
    expect("2 grupos normais", res["test"], "student_t")
    for needle in ["Pressupostos verificados", "IC 95% da diferenca", "g de Hedges", "regra student_t"]:
        if needle not in text:
            fails.append(f"student t: saida sem '{needle}'")

df_skew = pd.DataFrame({
    "custo": np.concatenate([rng.exponential(5, 40), rng.exponential(9, 40)]),
    "grupo": ["A"] * 40 + ["B"] * 40,
})
out = run("mann-whitney", lambda: ds.compare_groups(df_skew, "custo", "grupo"))
if out:
    expect("2 grupos assimetricos", out[0]["test"], "mannwhitney")

df_k = pd.DataFrame({
    "escore": np.concatenate([rng.normal(10, 2, 60), rng.normal(12, 2, 60), rng.normal(15, 2, 60)]),
    "centro": ["X"] * 60 + ["Y"] * 60 + ["Z"] * 60,
})
out = run("anova", lambda: ds.compare_groups(df_k, "escore", "centro"))
if out:
    res, text = out
    expect("3 grupos normais", res["test"], "anova")
    if "Holm" not in text:
        fails.append("anova: post-hoc com Holm nao apareceu apesar de p<0.05")

df_pair = pd.DataFrame({"pre": rng.normal(100, 10, 80)})
df_pair["pos"] = df_pair["pre"] - rng.normal(5, 8, 80)
out = run("pareado", lambda: ds.compare_paired(df_pair, ["pre", "pos"]))
if out:
    res, text = out
    expect("2 medidas pareadas", res["test"], "paired_t")
    if "IC 95% da diferenca" not in text:
        fails.append("pareado: sem IC")

df_corr = pd.DataFrame({"peso": rng.normal(70, 12, 150)})
df_corr["imc"] = df_corr["peso"] * 0.3 + rng.normal(0, 3, 150)
out = run("correlacao", lambda: ds.association(df_corr, "peso", "imc"))
if out:
    res, text = out
    expect("duas numericas", res["test"], "pearson")
    if "IC 95% do coeficiente" not in text:
        fails.append("correlacao: sem IC")

df_cat = pd.DataFrame({
    "sexo": rng.choice(["F", "M"], 200),
    "desfecho": rng.choice(["sim", "nao"], 200),
})
out = run("qui-quadrado", lambda: ds.association(df_cat, "sexo", "desfecho"))
if out:
    res, text = out
    expect("duas categoricas", res["test"], "chi2")
    if "V de Cramer" not in text:
        fails.append("qui-quadrado: sem tamanho de efeito")

# --- refusals outside coverage ---
print("fora de cobertura:")
try:
    ds.association(df_t, "idade", "grupo")
    fails.append("numerica x categorica: deveria recusar")
except ds.NoRuleApplies as e:
    if "compare_groups" not in str(e):
        fails.append(f"numerica x categorica: mensagem sem a saida: {e}")
    else:
        print("  ok  numerica x categorica     -> recusa e aponta compare_groups")

try:
    ds.compare_groups(df_t, "idade", "inexistente")
    fails.append("coluna inexistente: deveria recusar")
except ds.NoRuleApplies:
    print("  ok  coluna inexistente        -> recusa")

df_tiny = pd.DataFrame({"y": [1.0, 2.0, 3.0, 4.0], "g": ["A", "A", "B", "C"]})
try:
    ds.compare_groups(df_tiny, "y", "g")
    fails.append("grupos minusculos: deveria recusar")
except ds.NoRuleApplies:
    print("  ok  grupos minusculos         -> recusa")

print()
if fails:
    print("FALHAS:")
    for f in fails:
        print(" -", f)
    sys.exit(1)
print("todos os cenarios passaram")
