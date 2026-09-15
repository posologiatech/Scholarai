"""
Deterministic statistical test selection for DataMind.

The model used to choose the test itself, from a prompt catalogue. That made the
single most consequential decision in an analysis a matter of generation luck: the
same dataset and the same question could get a Student t one day and a Mann-Whitney
the next, and nothing in the output said which assumptions had actually been checked.

Here the choice is a rule table applied to assumptions measured on the real data, so
it is reproducible and citable. Every run prints what was measured, which rule fired,
the test, an effect size and a confidence interval — none of which are optional.

The rules cover the common designs. Where no rule applies (repeated measures with
covariates, nested or clustered data, survival), these functions raise and the model
writes ordinary code instead: the engine's coverage is the boundary of what is
deterministic, and pretending otherwise would hand back a wrong test wearing the
authority of a rule.

This module is the single source of truth for both sandboxes: the home server
imports it directly, and the browser worker is handed this same file's source
(see src/hooks/usePyodide.ts).
"""

import math

import numpy as np
import pandas as pd
from scipy import stats

ALPHA = 0.05

# Below this a group says nothing usable about its own distribution, and every test
# below would be reporting noise.
MIN_GROUP_N = 3

# Shapiro-Wilk rejects trivial deviations once n is large, so past this size a
# symmetric distribution is treated as normal regardless of its p-value. Stated in
# the output rather than applied silently.
LARGE_SAMPLE_N = 50
MAX_ABS_SKEW = 1.0

# Shapiro's own ceiling; beyond it it is computed on a fixed head of the data, which
# is why the large-sample rule above carries the decision there.
SHAPIRO_MAX_N = 5000

_show_table = None


def set_renderer(show_table):
    """Lets each host inject its own table renderer (the UI one, not stdout)."""
    global _show_table
    _show_table = show_table


def _table(frame, title):
    if _show_table is not None:
        _show_table(frame, title)
    else:
        print(title)
        print(frame.to_string(index=False))


def _fmt(value, digits=4):
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return "—"
    return f"{value:.{digits}f}"


def _fmt_p(value):
    if value is None or not math.isfinite(value):
        return "—"
    return "<0.0001" if value < 0.0001 else f"{value:.4f}"


class NoRuleApplies(Exception):
    """Raised when the design falls outside the rule table's coverage."""


# --------------------------------------------------------------------------- #
# Assumption measurement
# --------------------------------------------------------------------------- #


def _normality(values, label):
    """Measures normality of one sample and says which rule decided it."""
    clean = pd.Series(values).dropna().astype(float)
    n = int(clean.size)
    skew = float(stats.skew(clean)) if n >= 3 else float("nan")

    shapiro_p = float("nan")
    if 3 <= n <= SHAPIRO_MAX_N:
        shapiro_p = float(stats.shapiro(clean)[1])
    elif n > SHAPIRO_MAX_N:
        shapiro_p = float(stats.shapiro(clean.iloc[:SHAPIRO_MAX_N])[1])

    if n >= LARGE_SAMPLE_N and math.isfinite(skew) and abs(skew) < MAX_ABS_SKEW:
        normal = True
        why = f"n={n} >= {LARGE_SAMPLE_N} e assimetria {skew:.2f} < {MAX_ABS_SKEW}"
    elif math.isfinite(shapiro_p):
        normal = shapiro_p > ALPHA
        why = f"Shapiro-Wilk p={_fmt_p(shapiro_p)}"
    else:
        normal = False
        why = f"n={n} pequeno demais para avaliar"

    return {
        "label": label,
        "n": n,
        "skew": skew,
        "shapiro_p": shapiro_p,
        "normal": bool(normal),
        "why": why,
    }


def _equal_variance(samples):
    """Brown-Forsythe (Levene centred on the median), robust to non-normality."""
    usable = [s for s in samples if len(s) >= 2]
    if len(usable) < 2:
        return {"p": float("nan"), "equal": False, "why": "grupos pequenos demais"}
    _, p = stats.levene(*usable, center="median")
    return {
        "p": float(p),
        "equal": bool(p > ALPHA),
        "why": f"Levene (mediana) p={_fmt_p(float(p))}",
    }


def _assumption_table(normalities, variance=None):
    rows = [
        {
            "Pressuposto": f"Normalidade - {item['label']}",
            "n": item["n"],
            "Estatistica": _fmt(item["shapiro_p"]) if math.isfinite(item["shapiro_p"]) else "—",
            "Criterio": item["why"],
            "Atendido": "sim" if item["normal"] else "nao",
        }
        for item in normalities
    ]
    if variance is not None:
        rows.append({
            "Pressuposto": "Homogeneidade de variancias",
            "n": sum(i["n"] for i in normalities),
            "Estatistica": _fmt(variance["p"]),
            "Criterio": variance["why"],
            "Atendido": "sim" if variance["equal"] else "nao",
        })
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------- #
# The rule table - pure functions, so the choice can be reasoned about and tested
# --------------------------------------------------------------------------- #


def choose_comparison_test(n_groups, paired, all_normal, equal_variance):
    """Picks the test for comparing a numeric outcome across groups."""
    if n_groups < 2:
        raise NoRuleApplies("comparacao exige pelo menos 2 grupos")

    if paired:
        if n_groups == 2:
            if all_normal:
                return ("paired_t", "Teste t pareado",
                        "2 medidas na mesma unidade e diferencas normais")
            return ("wilcoxon", "Wilcoxon pareado",
                    "2 medidas na mesma unidade e diferencas nao normais")
        return ("friedman", "Friedman",
                f"{n_groups} medidas repetidas na mesma unidade")

    if n_groups == 2:
        if not all_normal:
            return ("mannwhitney", "Mann-Whitney U",
                    "2 grupos independentes e pelo menos um nao normal")
        if equal_variance:
            return ("student_t", "Teste t de Student",
                    "2 grupos independentes, normais e com variancias homogeneas")
        return ("welch_t", "Teste t de Welch",
                "2 grupos independentes e normais, mas com variancias desiguais")

    if all_normal and equal_variance:
        return ("anova", "ANOVA one-way",
                f"{n_groups} grupos independentes, normais e homocedasticos")
    if all_normal:
        return ("welch_anova", "ANOVA de Welch",
                f"{n_groups} grupos independentes e normais, com variancias desiguais")
    return ("kruskal", "Kruskal-Wallis",
            f"{n_groups} grupos independentes com pelo menos um nao normal")


def choose_association_test(kind, table_shape=None, min_expected=None, both_normal=None):
    """Picks the test for the association between two variables."""
    if kind == "categorical":
        if min_expected is not None and min_expected < 5:
            if table_shape == (2, 2):
                return ("fisher", "Exato de Fisher",
                        f"tabela 2x2 com frequencia esperada minima {min_expected:.2f} < 5")
            return ("chi2_unreliable", "Qui-quadrado (aproximacao fragil)",
                    f"frequencia esperada minima {min_expected:.2f} < 5 em tabela maior que 2x2")
        return ("chi2", "Qui-quadrado de Pearson",
                "duas categoricas com frequencias esperadas suficientes")

    if kind == "numeric":
        if both_normal:
            return ("pearson", "Correlacao de Pearson",
                    "duas numericas, ambas com distribuicao normal")
        return ("spearman", "Correlacao de Spearman",
                "duas numericas com pelo menos uma nao normal")

    raise NoRuleApplies(
        "associacao entre uma numerica e uma categorica e uma comparacao de grupos: "
        "use compare_groups(df, outcome=<numerica>, group=<categorica>)"
    )


# --------------------------------------------------------------------------- #
# Effect sizes and corrections
# --------------------------------------------------------------------------- #


def holm(pvalues):
    """Holm-Bonferroni: uniformly better than Bonferroni and needs no independence."""
    order = sorted(range(len(pvalues)), key=lambda i: pvalues[i])
    adjusted = [0.0] * len(pvalues)
    running = 0.0
    for rank, idx in enumerate(order):
        running = max(running, min((len(pvalues) - rank) * pvalues[idx], 1.0))
        adjusted[idx] = running
    return adjusted


def _hedges_g(a, b):
    """Cohen's d and its small-sample correction."""
    n1, n2 = len(a), len(b)
    s1, s2 = a.std(ddof=1), b.std(ddof=1)
    pooled = math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2))
    d = (a.mean() - b.mean()) / pooled if pooled > 0 else float("nan")
    correction = 1 - (3 / (4 * (n1 + n2) - 9)) if (n1 + n2) > 3 else 1.0
    return float(d), float(d * correction)


def _diff_ci(a, b, equal_var):
    """CI of the mean difference, with Welch's df when the variances are not pooled."""
    n1, n2 = len(a), len(b)
    v1, v2 = a.var(ddof=1), b.var(ddof=1)
    diff = a.mean() - b.mean()
    if equal_var:
        pooled = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2)
        se = math.sqrt(pooled * (1 / n1 + 1 / n2))
        df = float(n1 + n2 - 2)
    else:
        se = math.sqrt(v1 / n1 + v2 / n2)
        df = (v1 / n1 + v2 / n2) ** 2 / (
            (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)
        )
    crit = stats.t.ppf(1 - ALPHA / 2, df)
    return float(diff), float(diff - crit * se), float(diff + crit * se), float(df)


def _magnitude(value, thresholds, labels):
    size = abs(value) if math.isfinite(value) else 0.0
    for limit, label in zip(thresholds, labels):
        if size < limit:
            return label
    return labels[-1]


def _d_label(d):
    return _magnitude(d, [0.2, 0.5, 0.8], ["desprezivel", "pequeno", "medio", "grande"])


def _r_label(r):
    return _magnitude(r, [0.1, 0.3, 0.5], ["desprezivel", "pequeno", "medio", "grande"])


def _fisher_ci(r, n):
    """CI for a correlation, via the Fisher z transform."""
    if n < 4 or abs(r) >= 1:
        return float("nan"), float("nan")
    z = np.arctanh(r)
    se = 1 / math.sqrt(n - 3)
    crit = stats.norm.ppf(1 - ALPHA / 2)
    return float(np.tanh(z - crit * se)), float(np.tanh(z + crit * se))


def _result_table(rows, title):
    _table(pd.DataFrame(rows, columns=["Metrica", "Valor"]), title)


def _decision(label, because, rule_id):
    print(f"Teste escolhido pela regra: {label}")
    print(f"Motivo: {because} (regra {rule_id})")


# --------------------------------------------------------------------------- #
# Runners
# --------------------------------------------------------------------------- #


def _welch_anova(samples):
    """Welch's F, which statsmodels does not provide."""
    k = len(samples)
    weights = [len(s) / s.var(ddof=1) for s in samples]
    total_w = sum(weights)
    mean_w = sum(w * s.mean() for w, s in zip(weights, samples)) / total_w
    numerator = sum(w * (s.mean() - mean_w) ** 2 for w, s in zip(weights, samples)) / (k - 1)
    tail = sum((1 - w / total_w) ** 2 / (len(s) - 1) for w, s in zip(weights, samples))
    denominator = 1 + (2 * (k - 2) / (k ** 2 - 1)) * tail
    f_stat = numerator / denominator
    df2 = 1 / ((3 / (k ** 2 - 1)) * tail)
    return float(f_stat), float(stats.f.sf(f_stat, k - 1, df2)), float(k - 1), float(df2)


def _pairwise(samples, levels, key):
    """
    Every pair, corrected with Holm.

    The correction is not optional: k groups means k(k-1)/2 chances of a false
    positive, and reporting raw p-values there is the most common way a real
    analysis overstates what it found.
    """
    pairs, raw = [], []
    for i in range(len(levels)):
        for j in range(i + 1, len(levels)):
            a, b = samples[i], samples[j]
            if key == "kruskal":
                stat, p = stats.mannwhitneyu(a, b, alternative="two-sided")
                effect = 1 - (2 * float(stat)) / (len(a) * len(b))
                effect_name = "r (rank-biserial)"
            else:
                stat, p = stats.ttest_ind(a, b, equal_var=(key == "anova"))
                _, effect = _hedges_g(a, b)
                effect_name = "g de Hedges"
            pairs.append({
                "Comparacao": f"{levels[i]} vs {levels[j]}",
                "n": len(a) + len(b),
                "Estatistica": _fmt(float(stat)),
                "p bruto": _fmt_p(float(p)),
                "Efeito": _fmt(float(effect)),
                "Medida do efeito": effect_name,
            })
            raw.append(float(p))

    for row, adjusted in zip(pairs, holm(raw)):
        row["p corrigido (Holm)"] = _fmt_p(adjusted)
        row["Significativo"] = "sim" if adjusted < ALPHA else "nao"
    return pd.DataFrame(pairs)


def _descriptives(levels, samples, outcome, group):
    return pd.DataFrame([
        {
            "Grupo": level,
            "n": len(s),
            "Media": _fmt(float(s.mean())),
            "Desvio padrao": _fmt(float(s.std(ddof=1))),
            "Mediana": _fmt(float(s.median())),
            "Min": _fmt(float(s.min())),
            "Max": _fmt(float(s.max())),
        }
        for level, s in zip(levels, samples)
    ])


def compare_groups(df, outcome, group, title=None):
    """
    Compares a numeric outcome across the levels of a categorical column.

    Measures the assumptions, applies the rule table, runs the chosen test and
    reports an effect size with its magnitude - plus a Holm-corrected post-hoc
    when there are more than two groups and the omnibus test is significant.
    """
    for column in (outcome, group):
        if column not in df.columns:
            raise NoRuleApplies(f"coluna '{column}' nao existe no dataframe")

    data = df[[outcome, group]].copy()
    data[outcome] = pd.to_numeric(data[outcome], errors="coerce")
    data = data.dropna()

    counts = data[group].astype(str).value_counts()
    levels = [str(level) for level in counts[counts >= MIN_GROUP_N].index]
    dropped = [str(level) for level in counts[counts < MIN_GROUP_N].index]
    if len(levels) < 2:
        raise NoRuleApplies(
            f"'{group}' tem menos de 2 grupos com pelo menos {MIN_GROUP_N} observacoes"
        )

    samples = [data.loc[data[group].astype(str) == level, outcome] for level in levels]

    print(title or f"Comparacao de {outcome} entre os grupos de {group}")
    if dropped:
        print(f"Grupos ignorados por terem menos de {MIN_GROUP_N} observacoes: {', '.join(dropped)}")
    missing = len(df) - len(data)
    if missing > 0:
        print(f"Linhas descartadas por ausencia em '{outcome}' ou '{group}': {missing} de {len(df)}")

    normalities = [_normality(s, f"{group}={level}") for s, level in zip(samples, levels)]
    variance = _equal_variance(samples)
    _table(_assumption_table(normalities, variance), "Pressupostos verificados")

    all_normal = all(item["normal"] for item in normalities)
    key, label, because = choose_comparison_test(
        len(levels), False, all_normal, variance["equal"]
    )
    _decision(label, because, key)
    _table(_descriptives(levels, samples, outcome, group),
           f"Descritivas de {outcome} por {group}")

    rows = [{"Metrica": "Teste aplicado", "Valor": label}]
    a = samples[0]
    b = samples[1] if len(samples) > 1 else None

    if key in ("student_t", "welch_t"):
        equal_var = key == "student_t"
        stat, p = stats.ttest_ind(a, b, equal_var=equal_var)
        diff, low, high, df_value = _diff_ci(a, b, equal_var)
        d, g = _hedges_g(a, b)
        rows += [
            {"Metrica": "t", "Valor": _fmt(float(stat))},
            {"Metrica": "graus de liberdade", "Valor": _fmt(df_value, 2)},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "Diferenca entre as medias", "Valor": _fmt(diff)},
            {"Metrica": "IC 95% da diferenca", "Valor": f"[{_fmt(low)}; {_fmt(high)}]"},
            {"Metrica": "d de Cohen", "Valor": _fmt(d)},
            {"Metrica": "g de Hedges", "Valor": _fmt(g)},
            {"Metrica": "Magnitude do efeito", "Valor": _d_label(g)},
        ]
        p_value = float(p)

    elif key == "mannwhitney":
        stat, p = stats.mannwhitneyu(a, b, alternative="two-sided")
        r_rb = 1 - (2 * float(stat)) / (len(a) * len(b))
        rows += [
            {"Metrica": "U", "Valor": _fmt(float(stat), 1)},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": f"Mediana {levels[0]}", "Valor": _fmt(float(a.median()))},
            {"Metrica": f"Mediana {levels[1]}", "Valor": _fmt(float(b.median()))},
            {"Metrica": "r (rank-biserial)", "Valor": _fmt(r_rb)},
            {"Metrica": "Magnitude do efeito", "Valor": _r_label(r_rb)},
        ]
        p_value = float(p)

    elif key in ("anova", "welch_anova"):
        if key == "anova":
            stat, p = stats.f_oneway(*samples)
            df1 = float(len(samples) - 1)
            df2 = float(sum(len(s) for s in samples) - len(samples))
        else:
            stat, p, df1, df2 = _welch_anova(samples)
        grand = pd.concat(samples)
        ss_between = sum(len(s) * (s.mean() - grand.mean()) ** 2 for s in samples)
        ss_total = float(((grand - grand.mean()) ** 2).sum())
        eta_sq = float(ss_between / ss_total) if ss_total > 0 else float("nan")
        rows += [
            {"Metrica": "F", "Valor": _fmt(float(stat))},
            {"Metrica": "graus de liberdade", "Valor": f"{_fmt(df1, 2)}; {_fmt(df2, 2)}"},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "eta quadrado", "Valor": _fmt(eta_sq)},
            {"Metrica": "Magnitude do efeito", "Valor": _magnitude(
                eta_sq, [0.01, 0.06, 0.14],
                ["desprezivel", "pequeno", "medio", "grande"])},
        ]
        p_value = float(p)

    else:
        stat, p = stats.kruskal(*samples)
        n_total = sum(len(s) for s in samples)
        epsilon_sq = (float(stat) - len(samples) + 1) / (n_total - len(samples))
        rows += [
            {"Metrica": "H", "Valor": _fmt(float(stat))},
            {"Metrica": "graus de liberdade", "Valor": str(len(samples) - 1)},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "epsilon quadrado", "Valor": _fmt(float(epsilon_sq))},
            {"Metrica": "Magnitude do efeito", "Valor": _magnitude(
                float(epsilon_sq), [0.01, 0.08, 0.26],
                ["desprezivel", "pequeno", "medio", "grande"])},
        ]
        p_value = float(p)

    rows.append({
        "Metrica": "Conclusao (alfa=0.05)",
        "Valor": "diferenca significativa" if p_value < ALPHA else "sem diferenca significativa",
    })
    _table(pd.DataFrame(rows), f"Resultado - {label}")

    if len(levels) > 2:
        if p_value < ALPHA:
            _table(_pairwise(samples, levels, key),
                   "Post-hoc par a par (p corrigido por Holm-Bonferroni)")
        else:
            print("Post-hoc nao executado: o teste global nao foi significativo, "
                  "entao comparar os pares so produziria achados por acaso.")

    return {"test": key, "label": label, "p": p_value, "n_groups": len(levels)}


def compare_paired(df, columns, title=None):
    """
    Compares two or more measurements taken on the same unit (pre/post columns).

    Same contract as compare_groups, for the repeated-measures case: the rule reads
    the distribution of the differences, not of the raw measurements.
    """
    columns = list(columns)
    if len(columns) < 2:
        raise NoRuleApplies("comparacao pareada exige pelo menos 2 colunas")
    for column in columns:
        if column not in df.columns:
            raise NoRuleApplies(f"coluna '{column}' nao existe no dataframe")

    data = df[columns].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < MIN_GROUP_N:
        raise NoRuleApplies(
            f"restaram {len(data)} unidades com todas as medidas preenchidas, "
            f"menos que o minimo de {MIN_GROUP_N}"
        )

    print(title or f"Comparacao pareada entre {', '.join(columns)}")
    discarded = len(df) - len(data)
    if discarded > 0:
        print(f"Unidades descartadas por medida ausente: {discarded} de {len(df)} "
              "(a analise pareada exige todas as medidas da mesma unidade)")

    samples = [data[column] for column in columns]

    if len(columns) == 2:
        differences = samples[0] - samples[1]
        normalities = [_normality(differences, "diferencas (par a par)")]
    else:
        normalities = [_normality(s, column) for s, column in zip(samples, columns)]
    _table(_assumption_table(normalities), "Pressupostos verificados")

    all_normal = all(item["normal"] for item in normalities)
    key, label, because = choose_comparison_test(len(columns), True, all_normal, True)
    _decision(label, because, key)
    _table(_descriptives(columns, samples, "medida", "coluna"), "Descritivas por medida")

    rows = [{"Metrica": "Teste aplicado", "Valor": label},
            {"Metrica": "n (pares completos)", "Valor": str(len(data))}]

    if key == "paired_t":
        stat, p = stats.ttest_rel(samples[0], samples[1])
        differences = samples[0] - samples[1]
        mean_diff = float(differences.mean())
        se = float(differences.std(ddof=1)) / math.sqrt(len(differences))
        crit = stats.t.ppf(1 - ALPHA / 2, len(differences) - 1)
        dz = mean_diff / float(differences.std(ddof=1)) if differences.std(ddof=1) > 0 else float("nan")
        rows += [
            {"Metrica": "t", "Valor": _fmt(float(stat))},
            {"Metrica": "graus de liberdade", "Valor": str(len(differences) - 1)},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "Diferenca media", "Valor": _fmt(mean_diff)},
            {"Metrica": "IC 95% da diferenca",
             "Valor": f"[{_fmt(mean_diff - crit * se)}; {_fmt(mean_diff + crit * se)}]"},
            {"Metrica": "dz de Cohen", "Valor": _fmt(dz)},
            {"Metrica": "Magnitude do efeito", "Valor": _d_label(dz)},
        ]
        p_value = float(p)

    elif key == "wilcoxon":
        stat, p = stats.wilcoxon(samples[0], samples[1])
        differences = samples[0] - samples[1]
        nonzero = int((differences != 0).sum())
        total_rank = nonzero * (nonzero + 1) / 2
        r_rb = (2 * float(stat) / total_rank - 1) if total_rank > 0 else float("nan")
        rows += [
            {"Metrica": "W", "Valor": _fmt(float(stat), 1)},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "Mediana das diferencas", "Valor": _fmt(float(differences.median()))},
            {"Metrica": "r (rank-biserial pareado)", "Valor": _fmt(abs(r_rb))},
            {"Metrica": "Magnitude do efeito", "Valor": _r_label(r_rb)},
        ]
        p_value = float(p)

    else:
        stat, p = stats.friedmanchisquare(*samples)
        kendall_w = float(stat) / (len(data) * (len(columns) - 1))
        rows += [
            {"Metrica": "qui-quadrado de Friedman", "Valor": _fmt(float(stat))},
            {"Metrica": "graus de liberdade", "Valor": str(len(columns) - 1)},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "W de Kendall", "Valor": _fmt(kendall_w)},
            {"Metrica": "Magnitude do efeito", "Valor": _r_label(kendall_w)},
        ]
        p_value = float(p)

    rows.append({
        "Metrica": "Conclusao (alfa=0.05)",
        "Valor": "diferenca significativa" if p_value < ALPHA else "sem diferenca significativa",
    })
    _table(pd.DataFrame(rows), f"Resultado - {label}")

    if len(columns) > 2 and p_value < ALPHA:
        pairs, raw = [], []
        for i in range(len(columns)):
            for j in range(i + 1, len(columns)):
                stat_ij, p_ij = stats.wilcoxon(samples[i], samples[j])
                pairs.append({
                    "Comparacao": f"{columns[i]} vs {columns[j]}",
                    "W": _fmt(float(stat_ij), 1),
                    "p bruto": _fmt_p(float(p_ij)),
                })
                raw.append(float(p_ij))
        for row, adjusted in zip(pairs, holm(raw)):
            row["p corrigido (Holm)"] = _fmt_p(adjusted)
            row["Significativo"] = "sim" if adjusted < ALPHA else "nao"
        _table(pd.DataFrame(pairs), "Post-hoc par a par (p corrigido por Holm-Bonferroni)")
    elif len(columns) > 2:
        print("Post-hoc nao executado: o teste global nao foi significativo.")

    return {"test": key, "label": label, "p": p_value, "n": len(data)}


def association(df, var_a, var_b, title=None):
    """
    Tests the association between two variables, numeric or categorical.

    A numeric-by-categorical pair is a group comparison, not an association, and is
    refused with that message rather than silently answered with the wrong test.
    """
    for column in (var_a, var_b):
        if column not in df.columns:
            raise NoRuleApplies(f"coluna '{column}' nao existe no dataframe")

    data = df[[var_a, var_b]].dropna()
    if len(data) < MIN_GROUP_N:
        raise NoRuleApplies(f"restaram {len(data)} linhas completas nas duas colunas")

    numeric_a = pd.api.types.is_numeric_dtype(data[var_a])
    numeric_b = pd.api.types.is_numeric_dtype(data[var_b])

    print(title or f"Associacao entre {var_a} e {var_b}")
    missing = len(df) - len(data)
    if missing > 0:
        print(f"Linhas descartadas por ausencia em uma das colunas: {missing} de {len(df)}")

    if numeric_a and numeric_b:
        normalities = [_normality(data[var_a], var_a), _normality(data[var_b], var_b)]
        _table(_assumption_table(normalities), "Pressupostos verificados")
        both_normal = all(item["normal"] for item in normalities)
        key, label, because = choose_association_test("numeric", both_normal=both_normal)
        _decision(label, because, key)

        if key == "pearson":
            r, p = stats.pearsonr(data[var_a], data[var_b])
        else:
            r, p = stats.spearmanr(data[var_a], data[var_b])
        low, high = _fisher_ci(float(r), len(data))
        rows = [
            {"Metrica": "Teste aplicado", "Valor": label},
            {"Metrica": "n", "Valor": str(len(data))},
            {"Metrica": "Coeficiente", "Valor": _fmt(float(r))},
            {"Metrica": "IC 95% do coeficiente", "Valor": f"[{_fmt(low)}; {_fmt(high)}]"},
            {"Metrica": "p-valor", "Valor": _fmt_p(float(p))},
            {"Metrica": "Variancia compartilhada (r2)", "Valor": _fmt(float(r) ** 2)},
            {"Metrica": "Magnitude do efeito", "Valor": _r_label(float(r))},
            {"Metrica": "Conclusao (alfa=0.05)",
             "Valor": "associacao significativa" if float(p) < ALPHA else "sem associacao significativa"},
        ]
        _table(pd.DataFrame(rows), f"Resultado - {label}")
        return {"test": key, "label": label, "p": float(p), "estimate": float(r)}

    if numeric_a != numeric_b:
        numeric_col = var_a if numeric_a else var_b
        categorical_col = var_b if numeric_a else var_a
        raise NoRuleApplies(
            f"'{numeric_col}' e numerica e '{categorical_col}' e categorica: isso e uma "
            f"comparacao de grupos, use compare_groups(df, outcome='{numeric_col}', "
            f"group='{categorical_col}')"
        )

    crosstab = pd.crosstab(data[var_a], data[var_b])
    if crosstab.shape[0] < 2 or crosstab.shape[1] < 2:
        raise NoRuleApplies("cada variavel precisa de pelo menos 2 categorias observadas")

    chi2, p, dof, expected = stats.chi2_contingency(crosstab)
    min_expected = float(expected.min())
    key, label, because = choose_association_test(
        "categorical", table_shape=crosstab.shape, min_expected=min_expected
    )
    _table(pd.DataFrame([{
        "Pressuposto": "Frequencia esperada minima >= 5",
        "n": int(crosstab.values.sum()),
        "Estatistica": _fmt(min_expected, 2),
        "Criterio": f"tabela {crosstab.shape[0]}x{crosstab.shape[1]}",
        "Atendido": "sim" if min_expected >= 5 else "nao",
    }]), "Pressupostos verificados")
    _decision(label, because, key)
    _table(crosstab.reset_index(), f"Tabela cruzada - {var_a} x {var_b}")

    n_total = int(crosstab.values.sum())
    rows = [{"Metrica": "Teste aplicado", "Valor": label}, {"Metrica": "n", "Valor": str(n_total)}]

    if key == "fisher":
        odds, p_exact = stats.fisher_exact(crosstab)
        p_value = float(p_exact)
        rows += [
            {"Metrica": "Razao de chances (OR)", "Valor": _fmt(float(odds))},
            {"Metrica": "p-valor exato", "Valor": _fmt_p(p_value)},
        ]
    else:
        p_value = float(p)
        rows += [
            {"Metrica": "qui-quadrado", "Valor": _fmt(float(chi2))},
            {"Metrica": "graus de liberdade", "Valor": str(int(dof))},
            {"Metrica": "p-valor", "Valor": _fmt_p(p_value)},
        ]
        if key == "chi2_unreliable":
            rows.append({
                "Metrica": "ATENCAO",
                "Valor": f"frequencia esperada minima {min_expected:.2f} < 5: o p-valor e "
                         "uma aproximacao fragil, agrupe categorias raras antes de concluir",
            })

    cramers_v = math.sqrt(float(chi2) / (n_total * (min(crosstab.shape) - 1)))
    rows += [
        {"Metrica": "V de Cramer", "Valor": _fmt(cramers_v)},
        {"Metrica": "Magnitude do efeito", "Valor": _r_label(cramers_v)},
        {"Metrica": "Conclusao (alfa=0.05)",
         "Valor": "associacao significativa" if p_value < ALPHA else "sem associacao significativa"},
    ]
    _table(pd.DataFrame(rows), f"Resultado - {label}")
    return {"test": key, "label": label, "p": p_value, "estimate": cramers_v}
