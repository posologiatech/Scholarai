/* WebR Worker — executes R code in browser via WebAssembly */

let webRInstance = null;
let initialized = false;

const WEBR_VERSION = "0.4.2";
const WEBR_BASE = `https://webr.r-wasm.org/v${WEBR_VERSION}/`;

async function loadWebRModule() {
  // Dynamic import of the WebR ESM module from CDN
  const { WebR } = await import(`${WEBR_BASE}webr.mjs`);
  return WebR;
}

async function initWebR() {
  if (webRInstance && initialized) return webRInstance;

  try {
    self.postMessage({ type: "status", data: "loading" });

    const WebR = await loadWebRModule();
    webRInstance = new WebR({
      baseUrl: WEBR_BASE,
      // Use PostMessage channel for communication (works in workers)
      channelType: 1, // ChannelType.PostMessage — numeric because we import from CDN
    });

    await webRInstance.init();
    initialized = true;
    self.postMessage({ type: "status", data: "ready" });

    // Install commonly used packages (best-effort, don't block on failure)
    try {
      self.postMessage({ type: "status", data: "installing_packages" });
      await webRInstance.installPackages(["jsonlite"], { quiet: true });
      self.postMessage({ type: "status", data: "packages_ready" });
    } catch (e) {
      console.warn("Some R packages failed to install:", e);
      self.postMessage({ type: "status", data: "packages_ready" });
    }

    return webRInstance;
  } catch (err) {
    self.postMessage({ type: "error", data: "Falha ao carregar WebR: " + (err.message || String(err)) });
    throw err;
  }
}

async function writeFile(fileName, data) {
  const r = await initWebR();
  const uint8 = new Uint8Array(data);
  const path = "/tmp/" + fileName;
  await r.FS.writeFile(path, uint8);
  self.postMessage({ type: "fileWritten", data: fileName });
}

async function runCode(code, fileName) {
  const r = await initWebR();

  let fullCode = "";

  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".csv")) {
      fullCode += `df <- tryCatch(read.csv("/tmp/${fileName}", stringsAsFactors=FALSE), error=function(e) { cat("Aviso: falha ao carregar arquivo:", e$message, "\\n"); NULL })\n`;
    }
  }

  fullCode += code;

  try {
    // Use evalR for simpler, more reliable execution
    const result = await r.evalR(`
      .output <- tryCatch({
        capture.output({
          ${fullCode.replace(/`/g, "\\`")}
        }, type = "output")
      }, error = function(e) {
        paste0("ERRO: ", e$message)
      })
      paste(.output, collapse = "\\n")
    `);

    let stdout = "";
    try {
      const jsResult = await result.toJs();
      stdout = typeof jsResult === "object" && jsResult.values
        ? jsResult.values.join("\n")
        : String(jsResult);
    } catch (convErr) {
      stdout = String(await result.toString());
    }

    // Clean up R object
    try { await r.destroy(result); } catch (_) { /* ignore */ }

    self.postMessage({
      type: "result",
      data: { stdout: stdout.trim(), images: [], error: null },
    });
  } catch (err) {
    self.postMessage({
      type: "result",
      data: { stdout: "", images: [], error: err.message || String(err) },
    });
  }
}

async function resetRuntime() {
  if (webRInstance) {
    try { await webRInstance.close(); } catch (_) { /* ignore */ }
  }
  webRInstance = null;
  initialized = false;
  self.postMessage({ type: "status", data: "reset" });
}

self.onmessage = async (e) => {
  const { action, payload } = e.data;

  try {
    switch (action) {
      case "init":
        await initWebR();
        break;
      case "writeFile":
        await writeFile(payload.fileName, payload.data);
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
