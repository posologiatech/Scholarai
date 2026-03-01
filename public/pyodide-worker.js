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
  
  const packages = ["numpy", "pandas", "matplotlib", "scipy", "scikit-learn", "statsmodels", "seaborn", "openpyxl"];
  
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

async function runCode(code, fileName) {
  const py = await initPyodide();
  await installPackages();

  let stdout = "";
  let images = [];

  const bootstrapCode = `
import sys, io, os, base64
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
_orig_show = plt.show
_orig_savefig = plt.Figure.savefig

def _capture_show(*args, **kwargs):
    for fig_num in plt.get_fignums():
        fig = plt.figure(fig_num)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
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
`;

  let dataBootstrap = "";
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    const isExcel = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
    dataBootstrap = `
import pandas as pd
try:
    df = pd.read_${ isExcel ? "excel" : "csv" }(${JSON.stringify("/tmp/" + fileName)})
except Exception as e:
    print(f"Aviso: falha ao carregar arquivo: {e}")
`;
  }

  const collectCode = `
sys.stdout = sys.__stdout__
_stdout_text = ''.join(_captured.data)

for fig_num in plt.get_fignums():
    fig = plt.figure(fig_num)
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
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
        await runCode(payload.code, payload.fileName);
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