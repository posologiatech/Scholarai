"""DataMind remote execution service.

Runs on the user's own home server (outside the scholar.ai deploy) and is called
by the "datamind-run-remote" Supabase edge function when a conversation's combined
dataset is too large for the browser-based Pyodide sandbox. It mirrors the exact
same output protocol Pyodide/WebR already use (__DATATABLE_START__, __DATACHART_START__,
plain stdout, base64 PNG figures) so the existing client-side parser needs no changes.
"""

import base64
import io
import json
import multiprocessing
import os
import re
import resource
import tempfile
import traceback
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

EXEC_TOKEN = os.environ.get("DATAMIND_EXEC_TOKEN")
if not EXEC_TOKEN:
    raise RuntimeError("DATAMIND_EXEC_TOKEN environment variable is required")

TIMEOUT_SECONDS = int(os.environ.get("DATAMIND_EXEC_TIMEOUT", "90"))
MEMORY_LIMIT_BYTES = int(os.environ.get("DATAMIND_EXEC_MEMORY_LIMIT_GB", "3")) * 1024 * 1024 * 1024

app = FastAPI()


class TabularDialect(BaseModel):
    """How the browser read the file; mirrored here so pandas reads it identically."""

    delimiter: str = ","
    decimal: str = "."
    encoding: str = "utf-8"


class FileRef(BaseModel):
    file_name: str
    url: str
    dialect: Optional[TabularDialect] = None


class RunRequest(BaseModel):
    code: str
    codeLanguage: str = "python"
    files: list[FileRef] = []


def slugify_var_name(file_name: str, used: set) -> str:
    """Mirrors buildDataBootstrap()'s slug rule in public/pyodide-worker.js."""
    base = re.sub(r"\.[^.]+$", "", file_name)
    base = re.sub(r"[^a-z0-9_]+", "_", base.lower()).strip("_")
    if not base:
        base = "file"
    if base[0].isdigit():
        base = f"f_{base}"
    final = base
    i = 2
    while final in used:
        final = f"{base}_{i}"
        i += 1
    used.add(final)
    return final


def read_csv_kwargs(dialect: Optional[dict]) -> dict:
    """Turns the browser-detected dialect into explicit pandas read arguments.

    Without this, a pt-BR export (";" separator, "1.234,56" numbers, cp1252) loads
    as a single text column and every downstream analysis is wrong.
    """
    if not dialect:
        return {}
    kwargs: dict = {}
    delimiter = dialect.get("delimiter")
    if delimiter:
        kwargs["sep"] = delimiter
    if dialect.get("decimal") == ",":
        kwargs["decimal"] = ","
        kwargs["thousands"] = "."
    encoding = dialect.get("encoding")
    if encoding:
        kwargs["encoding"] = encoding
    return kwargs


def _worker(code: str, files: list, result_queue) -> None:
    """Runs in its own child process so a runaway analysis can't take the API down."""
    try:
        resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES))
    except Exception:
        pass

    import sys

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import pandas as pd

    stdout_buffer = io.StringIO()
    sys.stdout = stdout_buffer

    figures: list[str] = []
    orig_savefig = plt.Figure.savefig

    def capture_show(*args, **kwargs):
        for num in plt.get_fignums():
            fig = plt.figure(num)
            buf = io.BytesIO()
            orig_savefig(fig, buf, format="png", dpi=150, bbox_inches="tight")
            buf.seek(0)
            figures.append(base64.b64encode(buf.read()).decode("utf-8"))
            plt.close(fig)

    plt.show = capture_show

    def show_table(dataframe, title=""):
        if not isinstance(dataframe, pd.DataFrame):
            print(str(dataframe))
            return
        data = json.loads(dataframe.to_json(orient="records", force_ascii=False))
        cols = list(dataframe.columns)
        payload = json.dumps({"title": title, "columns": cols, "data": data}, ensure_ascii=False)
        print(f"__DATATABLE_START__{payload}__DATATABLE_END__")

    def show_chart(data, kind="bar", x=None, y=None, series=None, title=""):
        df_ = data if isinstance(data, pd.DataFrame) else pd.DataFrame(data)
        if df_.empty:
            print("Aviso: show_chart recebeu dados vazios.")
            return
        x_key = x or df_.columns[0]
        if series:
            series_keys = series if isinstance(series, list) else [series]
        elif y:
            series_keys = y if isinstance(y, list) else [y]
        else:
            series_keys = [c for c in df_.columns if c != x_key]
        records = json.loads(df_.to_json(orient="records", force_ascii=False))
        payload = json.dumps(
            {
                "kind": kind,
                "title": title,
                "xKey": x_key,
                "series": [{"key": k, "label": str(k)} for k in series_keys],
                "data": records,
            },
            ensure_ascii=False,
        )
        print(f"__DATACHART_START__{payload}__DATACHART_END__")

    scope = {"pd": pd, "plt": plt, "show_table": show_table, "show_chart": show_chart}
    try:
        import numpy as np
        import seaborn as sns

        scope["np"] = np
        scope["sns"] = sns
    except Exception:
        pass

    used_names: set = set()
    dfs: dict = {}
    scope["dfs"] = dfs

    for entry in files:
        file_name = entry["file_name"]
        local_path = entry["local_path"]
        var_name = f"df_{slugify_var_name(file_name, used_names)}"
        try:
            if file_name.lower().endswith((".xlsx", ".xls")):
                loaded = pd.read_excel(local_path)
            else:
                loaded = pd.read_csv(local_path, **read_csv_kwargs(entry.get("dialect")))
            scope[var_name] = loaded
            dfs[file_name] = loaded
        except Exception as e:
            print(f"Aviso: falha ao carregar arquivo {file_name}: {e}")

    if len(files) == 1:
        only_var = f"df_{slugify_var_name(files[0]['file_name'], set())}"
        if only_var in scope:
            scope["df"] = scope[only_var]

    error: Optional[str] = None
    try:
        exec(code, scope)
    except Exception:
        error = traceback.format_exc()

    sys.stdout = sys.__stdout__
    result_queue.put({"stdout": stdout_buffer.getvalue(), "images": figures, "error": error})


@app.post("/run")
def run(payload: RunRequest, authorization: str = Header(None)):
    if authorization != f"Bearer {EXEC_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if payload.codeLanguage == "r":
        return {"stdout": "", "images": [], "error": "Execução remota de R ainda não é suportada."}

    with tempfile.TemporaryDirectory() as tmp_dir:
        files: list[dict] = []
        for f in payload.files:
            local_path = str(Path(tmp_dir) / f.file_name)
            try:
                resp = requests.get(f.url, timeout=30)
                resp.raise_for_status()
                with open(local_path, "wb") as fh:
                    fh.write(resp.content)
                files.append({
                    "file_name": f.file_name,
                    "local_path": local_path,
                    "dialect": f.dialect.model_dump() if f.dialect else None,
                })
            except Exception as e:
                return {"stdout": "", "images": [], "error": f"Falha ao baixar {f.file_name}: {e}"}

        ctx = multiprocessing.get_context("spawn")
        result_queue = ctx.Queue()
        proc = ctx.Process(target=_worker, args=(payload.code, files, result_queue))
        proc.start()
        proc.join(timeout=TIMEOUT_SECONDS)

        if proc.is_alive():
            proc.terminate()
            proc.join(5)
            return {
                "stdout": "",
                "images": [],
                "error": f"Execução excedeu o limite de {TIMEOUT_SECONDS}s e foi interrompida.",
            }

        if not result_queue.empty():
            return result_queue.get()

        return {"stdout": "", "images": [], "error": f"Processo encerrou inesperadamente (código {proc.exitcode})."}


@app.get("/health")
def health():
    return {"status": "ok"}
