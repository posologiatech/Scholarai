/* WebR Worker — executes R code in browser via WebAssembly */

let webRInstance = null;
let initialized = false;

async function initWebR() {
  if (webRInstance && initialized) return webRInstance;

  try {
    self.postMessage({ type: "status", data: "loading" });

    // Import WebR and ChannelType from CDN
    const { WebR, ChannelType } = await import("https://webr.r-wasm.org/latest/webr.mjs");

    webRInstance = new WebR({
      channelType: ChannelType.PostMessage,
    });

    await webRInstance.init();
    initialized = true;
    self.postMessage({ type: "status", data: "ready" });

    // Install basic packages (best-effort)
    try {
      self.postMessage({ type: "status", data: "installing_packages" });
      await webRInstance.installPackages(["jsonlite"], { quiet: true });
    } catch (e) {
      console.warn("R package install warning:", e);
    }
    self.postMessage({ type: "status", data: "packages_ready" });

    return webRInstance;
  } catch (err) {
    self.postMessage({ type: "error", data: "Falha ao carregar WebR: " + (err.message || String(err)) });
    throw err;
  }
}

async function writeFile(fileName, data) {
  const r = await initWebR();
  const uint8 = new Uint8Array(data);
  await r.FS.writeFile("/tmp/" + fileName, uint8);
  self.postMessage({ type: "fileWritten", data: fileName });
}

async function runCode(code, fileName) {
  const r = await initWebR();

  let fullCode = "";

  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".csv")) {
      fullCode += 'df <- tryCatch(read.csv("/tmp/' + fileName + '", stringsAsFactors=FALSE), error=function(e) { cat("Aviso:", e$message, "\\n"); NULL })\n';
    }
  }

  fullCode += code;

  try {
    // Wrap code in capture.output for clean text output
    const wrappedCode = 'paste(capture.output({ ' + fullCode + ' }), collapse = "\\n")';
    const result = await r.evalR(wrappedCode);

    let stdout = "";
    try {
      const jsVal = await result.toJs();
      if (jsVal && typeof jsVal === "object" && jsVal.values) {
        stdout = jsVal.values.join("\n");
      } else {
        stdout = String(jsVal);
      }
    } catch (_) {
      stdout = "";
    }

    // Destroy the R proxy object
    try { await webRInstance.destroy(result); } catch (_) {}

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
    try { await webRInstance.close(); } catch (_) {}
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
        self.postMessage({ type: "error", data: "Unknown action: " + action });
    }
  } catch (err) {
    self.postMessage({ type: "error", data: err.message || String(err) });
  }
};
