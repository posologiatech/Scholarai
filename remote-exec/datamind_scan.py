"""
Deterministic finding scan for DataMind.

Runs once per dataset, with no question asked and no researcher having stated a
design: it enumerates the comparisons and associations the dataset actually
supports, asks the SAME rule table the reporting engine uses which test each one
calls for, runs it, and hands back a ranked shortlist.

Two properties matter more than coverage here:

1. It never invents a second opinion. Every test it runs comes from
   datamind_stats' `screen_comparison` / `screen_association`, so a finding the
   scan surfaces and the analysis the researcher then asks for cannot disagree
   about which test applies - they are the same decision, rendered twice.

2. It corrects for its own fishing. A scan of a 20-column dataset runs hundreds
   of tests; at alpha=0.05 dozens come back "significant" by construction. Every
   p-value is therefore carried alongside a Benjamini-Hochberg q-value computed
   over the whole family, and only q decides whether a finding is presented as
   real. Presenting raw p-values from a scan would be the single most misleading
   thing this module could do.

Host-agnostic: the home server imports it as a module next to datamind_stats,
while the browser exec's both into the same Pyodide globals - `_stat` resolves
the engine either way.
"""
import json
import math

import pandas as pd

# Columns with more distinct values than this are not groupings, they are labels.
MAX_GROUP_LEVELS = 8
# Below this a dataset cannot support a screen worth showing.
MIN_ROWS = 20
# A categorical column that is mostly unique is an identifier by another name.
MAX_UNIQUE_RATIO = 0.5
# Hard ceilings, because the candidate count grows as the product of the column
# counts and this occupies the single browser sandbox the researcher's own analyses
# also queue behind - a scan that runs for minutes would be felt as the page being
# stuck, however deferred it was.
MAX_NUMERIC_COLS = 15
MAX_CATEGORICAL_COLS = 10
MAX_TESTS = 200
MAX_FINDINGS = 25
# Below this q-value a finding is presented as real rather than as a lead.
Q_THRESHOLD = 0.05
# A negligible effect that reaches significance only because n is large is not a
# finding, it is arithmetic.
MIN_ABS_EFFECT = 0.1


def _stat(name):
    """
    Resolves one name from the statistics engine.

    On the home server datamind_stats is a real module; in Pyodide it was exec'd
    into these same globals, so there is nothing to import.
    """
    try:
        import datamind_stats
        return getattr(datamind_stats, name)
    except ImportError:
        return globals()[name]


def _no_rule():
    return _stat("NoRuleApplies")


def _finite(value):
    """JSON has no NaN; a missing number must arrive as null, not as a string."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def classify_columns(df, exclude=None):
    """
    Splits the columns into the two roles the rule table understands.

    `exclude` carries the id/constant columns the client-side profile already
    flagged - reusing that judgement instead of re-deriving a different one.
    """
    excluded = set(exclude or [])
    numeric, categorical = [], []

    for column in df.columns:
        if column in excluded:
            continue
        series = df[column].dropna()
        if series.empty:
            continue
        unique = int(series.nunique())
        if unique < 2:
            continue

        if pd.api.types.is_numeric_dtype(df[column]):
            # A numeric column with a handful of values is a coded category, and
            # comparing its "mean" would be meaningless.
            if unique <= MAX_GROUP_LEVELS and unique <= max(2, len(series) // 20):
                categorical.append(column)
            else:
                numeric.append(column)
            continue

        if unique <= MAX_GROUP_LEVELS and unique / len(series) <= MAX_UNIQUE_RATIO:
            categorical.append(column)

    return numeric[:MAX_NUMERIC_COLS], categorical[:MAX_CATEGORICAL_COLS]


def _candidates(numeric, categorical):
    """Every design the rule table covers, cheapest family first."""
    for group in categorical:
        for outcome in numeric:
            yield ("comparison", outcome, group)
    for i in range(len(numeric)):
        for j in range(i + 1, len(numeric)):
            yield ("correlation", numeric[i], numeric[j])
    for i in range(len(categorical)):
        for j in range(i + 1, len(categorical)):
            yield ("association", categorical[i], categorical[j])


def scan_dataframe(df, file_name="", exclude=None):
    """Runs every covered design in one dataframe and returns the raw results."""
    if df is None or len(df) < MIN_ROWS:
        return [], {"reason": "poucas linhas para uma varredura", "tested": 0}

    numeric, categorical = classify_columns(df, exclude)
    screen_comparison = _stat("screen_comparison")
    screen_association = _stat("screen_association")
    NoRuleApplies = _no_rule()

    results, tested, refused = [], 0, 0
    for kind, first, second in _candidates(numeric, categorical):
        if tested >= MAX_TESTS:
            break
        try:
            if kind == "comparison":
                result = screen_comparison(df, first, second)
            else:
                result = screen_association(df, first, second)
        except NoRuleApplies:
            refused += 1
            continue
        except Exception:
            # One bad column must not cost the researcher the whole scan.
            refused += 1
            continue
        tested += 1
        if _finite(result.get("p")) is None:
            continue
        result["file"] = file_name
        results.append(result)

    return results, {
        "tested": tested,
        "refused": refused,
        "numeric": numeric,
        "categorical": categorical,
        "truncated": tested >= MAX_TESTS,
    }


def _key(result):
    """Stable identity, so a re-scan updates a finding instead of duplicating it."""
    if result["kind"] == "comparison":
        parts = [result["outcome"], result["group"]]
    else:
        parts = sorted([result["var_a"], result["var_b"]])
    return "|".join([result["kind"], result.get("file", "")] + parts)


def _rank_key(result):
    """
    Real before plausible, then by effect size.

    Sorting by p-value would put a negligible difference measured on 50,000 rows
    above a large one measured on 60 - the exact inversion the scan exists to
    avoid.
    """
    effect = abs(_finite(result.get("effect")) or 0.0)
    return (0 if result.get("significant") else 1, -effect)


def scan(frames, exclude_by_file=None):
    """
    Scans every loaded dataframe and returns one ranked, FDR-corrected shortlist.

    `frames` is {file_name: DataFrame} - the same mapping the sandbox bootstrap
    builds as `dfs`.
    """
    exclude_by_file = exclude_by_file or {}
    benjamini_hochberg = _stat("benjamini_hochberg")

    results, diagnostics = [], {}
    for file_name, frame in (frames or {}).items():
        found, info = scan_dataframe(frame, file_name, exclude_by_file.get(file_name))
        results.extend(found)
        diagnostics[file_name] = info

    # One correction over the whole family: the researcher ran all of these tests
    # at once, across every file, whether or not they meant to.
    qvalues = benjamini_hochberg([float(r["p"]) for r in results])
    for result, q in zip(results, qvalues):
        effect = abs(_finite(result.get("effect")) or 0.0)
        result["q"] = float(q)
        result["significant"] = bool(q < Q_THRESHOLD and effect >= MIN_ABS_EFFECT)
        result["key"] = _key(result)
        # Significant but negligible: worth saying so explicitly, because this is
        # where large datasets mislead people.
        result["negligible"] = bool(q < Q_THRESHOLD and effect < MIN_ABS_EFFECT)

    results.sort(key=_rank_key)
    shortlist = results[:MAX_FINDINGS]

    for result in shortlist:
        for field in ("p", "q", "effect"):
            result[field] = _finite(result.get(field))
        for index, centre in enumerate(result.get("centres", [])):
            result["centres"][index] = _finite(centre)

    return {
        "findings": shortlist,
        "totalTested": sum(info.get("tested", 0) for info in diagnostics.values()),
        "totalSignificant": sum(1 for r in results if r.get("significant")),
        "files": diagnostics,
    }


def run_scan(frames, exclude_by_file=None):
    """Prints the scan as a tagged JSON payload for the host to pick out of stdout."""
    try:
        payload = scan(frames, exclude_by_file)
    except Exception as error:
        payload = {"findings": [], "error": f"{type(error).__name__}: {error}"}
    print("__DATAFINDINGS_START__" + json.dumps(payload, ensure_ascii=False) + "__DATAFINDINGS_END__")
