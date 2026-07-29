/* Pyodide Web Worker — executes Python in browser via WebAssembly */

let pyodide = null;
let packagesInstalled = false;

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

async function initPyodide() {
  if (pyodide) return pyodide;

  try {
    importScripts(PYODIDE_CDN + "pyodide.js");
  } catch (e) {
    self.postMessage({ type: "error", data: "Falha ao carregar Pyodide CDN: " + e.message });
    throw e;
  }

  pyodide = await loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (text) => self.postMessage({ type: "stdout", data: text }),
    stderr: (text) => self.postMessage({ type: "stderr", data: text }),
  });

  self.postMessage({ type: "status", data: "ready" });
  
  // Pre-install packages immediately after init for faster first run
  installPackages();
  
  return pyodide;
}

async function installPackages() {
  if (packagesInstalled) return;
  
  // Load micropip first
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  
  const packages = ["numpy", "pandas", "matplotlib", "scipy", "scikit-learn", "statsmodels", "seaborn", "openpyxl", "lifelines"];
  
  for (const pkg of packages) {
    try {
      await pyodide.loadPackage(pkg);
    } catch (e1) {
      console.warn(`loadPackage('${pkg}') failed, trying micropip...`, e1);
      try {
        await micropip.install(pkg);
      } catch (e2) {
        console.warn(`micropip.install('${pkg}') also failed:`, e2);
      }
    }
  }
  
  packagesInstalled = true;
  self.postMessage({ type: "status", data: "packages_ready" });
}

async function writeFile(fileName, data) {
  const py = await initPyodide();
  const uint8 = new Uint8Array(data);
  py.FS.writeFile("/tmp/" + fileName, uint8);
}

// Turns "Vendas Mensais.csv" into a safe, unique Python identifier like "vendas_mensais"
function slugifyVarName(fileName, used) {
  let base = fileName.replace(/\.[^/.]+$/, "");
  base = base.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) base = "file";
  if (/^[0-9]/.test(base)) base = "f_" + base;
  let final = base;
  let i = 2;
  while (used.has(final)) {
    final = `${base}_${i}`;
    i++;
  }
  used.add(final);
  return final;
}

function buildDataBootstrap(fileNames) {
  const names = (fileNames || []).filter(Boolean);
  if (names.length === 0) return "";

  const used = new Set();
  const entries = names.map((fileName) => ({
    fileName,
    varName: `df_${slugifyVarName(fileName, used)}`,
  }));

  let code = "import pandas as pd\ndfs = {}\n";
  for (const { fileName, varName } of entries) {
    const isExcel = /\.xlsx?$/i.test(fileName);
    const reader = isExcel ? "read_excel" : "read_csv";
    code += `try:\n    ${varName} = pd.${reader}(${JSON.stringify("/tmp/" + fileName)})\n    dfs[${JSON.stringify(fileName)}] = ${varName}\nexcept Exception as e:\n    print(f"Aviso: falha ao carregar arquivo ${fileName.replace(/"/g, '\\"')}: {e}")\n`;
  }
  // With a single file, keep the familiar "df" name so existing prompt templates keep working.
  if (entries.length === 1) {
    code += `df = ${entries[0].varName}\n`;
  }
  return code;
}

async function runCode(code, fileNames) {
  const py = await initPyodide();
  await installPackages();

  let stdout = "";
  let images = [];

const bootstrapCode = `
import sys, io, os, base64, json as _json

os.chdir('/tmp')

class _StdoutCapture:
    def __init__(self):
        self.data = []
    def write(self, s):
        self.data.append(s)
    def flush(self):
        pass

_captured = _StdoutCapture()
sys.stdout = _captured

import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt

_figures = []

# Guard against re-patching on subsequent runs (causes infinite recursion)
if not hasattr(plt, '_orig_show_backup'):
    plt._orig_show_backup = plt.show
    plt._orig_savefig_backup = plt.Figure.savefig

_orig_show = plt._orig_show_backup
_orig_savefig = plt._orig_savefig_backup

def _capture_show(*args, **kwargs):
    for fig_num in plt.get_fignums():
        fig = plt.figure(fig_num)
        buf = io.BytesIO()
        _orig_savefig(fig, buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
        _figures.append(base64.b64encode(buf.read()).decode('utf-8'))
        plt.close(fig)

def _capture_savefig(self_fig, *args, **kwargs):
    buf = io.BytesIO()
    _orig_savefig(self_fig, buf, format='png', dpi=150, bbox_inches='tight')
    buf.seek(0)
    _figures.append(base64.b64encode(buf.read()).decode('utf-8'))

plt.show = _capture_show
plt.Figure.savefig = _capture_savefig

def show_table(dataframe, title=""):
    """Render a DataFrame as a structured JSON table in the UI."""
    import pandas as _pd
    if not isinstance(dataframe, _pd.DataFrame):
        print(str(dataframe))
        return
    data = _json.loads(dataframe.to_json(orient='records', force_ascii=False))
    cols = list(dataframe.columns)
    payload = _json.dumps({"title": title, "columns": cols, "data": data}, ensure_ascii=False)
    print(f"__DATATABLE_START__{payload}__DATATABLE_END__")

def show_chart(data, kind="bar", x=None, y=None, series=None, title=""):
    """Render data as an interactive chart (bar/line/pie/area/scatter) in the UI."""
    import pandas as _pd
    df_ = data if isinstance(data, _pd.DataFrame) else _pd.DataFrame(data)
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
    records = _json.loads(df_.to_json(orient='records', force_ascii=False))
    payload = _json.dumps({
        "kind": kind,
        "title": title,
        "xKey": x_key,
        "series": [{"key": k, "label": str(k)} for k in series_keys],
        "data": records,
    }, ensure_ascii=False)
    print(f"__DATACHART_START__{payload}__DATACHART_END__")
`;

  const dataBootstrap = buildDataBootstrap(fileNames);

  const collectCode = `
sys.stdout = sys.__stdout__
_stdout_text = ''.join(_captured.data)

for fig_num in plt.get_fignums():
    fig = plt.figure(fig_num)
    buf = io.BytesIO()
    _orig_savefig(fig, buf, format='png', dpi=150, bbox_inches='tight')
    buf.seek(0)
    _figures.append(base64.b64encode(buf.read()).decode('utf-8'))
    plt.close(fig)
`;

  // Wrap user code in try/except so partial stdout is still captured
  const wrappedUserCode = `
try:
${code.split('\n').map(l => '    ' + l).join('\n')}
except Exception as _user_err:
    print(f"\\nErro na análise: {_user_err}")
`;

  const fullCode = bootstrapCode + dataBootstrap + wrappedUserCode + "\n" + collectCode;

  try {
    await py.runPythonAsync(fullCode);

    stdout = py.globals.get("_stdout_text") || "";
    const figList = py.globals.get("_figures");
    if (figList) {
      const len = figList.length;
      for (let i = 0; i < len; i++) {
        images.push(figList.get(i));
      }
    }

    self.postMessage({
      type: "result",
      data: { stdout, images, error: null },
    });
  } catch (err) {
    self.postMessage({
      type: "result",
      data: { stdout: "", images: [], error: err.message || String(err) },
    });
  }
}

async function resetRuntime() {
  pyodide = null;
  packagesInstalled = false;
  self.postMessage({ type: "status", data: "reset" });
}

self.onmessage = async (e) => {
  const { action, payload } = e.data;

  try {
    switch (action) {
      case "init":
        await initPyodide();
        break;
      case "writeFile":
        await writeFile(payload.fileName, payload.data);
        self.postMessage({ type: "fileWritten", data: payload.fileName });
        break;
      case "run":
        await runCode(payload.code, payload.fileNames);
        break;
      case "reset":
        await resetRuntime();
        break;
      default:
        self.postMessage({ type: "error", data: `Unknown action: ${action}` });
    }
  } catch (err) {
    self.postMessage({ type: "error", data: err.message || String(err) });
  }
};