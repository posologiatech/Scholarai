/* WebR Worker — executes R code in browser via WebAssembly */

let webR = null;
let initialized = false;

const WEBR_CDN = "https://webr.r-wasm.org/v0.4.2/";

async function initWebR() {
  if (webR && initialized) return webR;

  try {
    importScripts(WEBR_CDN + "webr-worker.js");
  } catch (e) {
    // Try module approach
    try {
      const mod = await import(WEBR_CDN + "webr.mjs");
      webR = new mod.WebR();
      await webR.init();
    } catch (e2) {
      self.postMessage({ type: "error", data: "Falha ao carregar WebR: " + e2.message });
      throw e2;
    }
  }

  // If loaded via importScripts, WebR global should be available
  if (!webR && typeof WebR !== "undefined") {
    webR = new WebR({ baseUrl: WEBR_CDN });
    await webR.init();
  }

  if (!webR) {
    self.postMessage({ type: "error", data: "WebR não disponível" });
    throw new Error("WebR not available");
  }

  initialized = true;
  self.postMessage({ type: "status", data: "ready" });

  // Install commonly used packages
  try {
    self.postMessage({ type: "status", data: "installing_packages" });
    await webR.installPackages(["ggplot2", "dplyr", "tidyr"], { quiet: true });
    self.postMessage({ type: "status", data: "packages_ready" });
  } catch (e) {
    console.warn("Some R packages failed to install:", e);
    self.postMessage({ type: "status", data: "packages_ready" });
  }

  return webR;
}

async function writeFile(fileName, data) {
  const r = await initWebR();
  const uint8 = new Uint8Array(data);
  // Write file to virtual filesystem
  await r.FS.writeFile("/tmp/" + fileName, uint8);
}

async function runCode(code, fileName) {
  const r = await initWebR();

  let stdout = "";
  let images = [];

  // Build the full code with data loading
  let fullCode = "";
  
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".csv")) {
      fullCode += `df <- tryCatch(read.csv("/tmp/${fileName}", stringsAsFactors=FALSE), error=function(e) { cat("Aviso: falha ao carregar arquivo:", e$message, "\\n"); NULL })\n`;
    } else if (lowerName.match(/\\.xlsx?$/)) {
      fullCode += `if(require(readxl, quietly=TRUE)) { df <- tryCatch(read_excel("/tmp/${fileName}"), error=function(e) { cat("Aviso:", e$message, "\\n"); NULL }) } else { cat("Pacote readxl não disponível\\n") }\n`;
    }
  }

  fullCode += code;

  try {
    // Capture output
    const shelter = await r.Shelter.init();
    const result = await shelter.captureR(fullCode, {
      withAutoprint: true,
      captureStreams: true,
      captureConditions: true,
      captureGraphics: { width: 800, height: 600 },
    });

    // Collect stdout
    if (result.output) {
      for (const out of result.output) {
        if (out.type === "stdout") {
          stdout += out.data + "\n";
        }
      }
    }

    // Collect graphics
    if (result.images) {
      for (const img of result.images) {
        // Convert to base64
        const response = await fetch(img.src);
        const blob = await response.blob();
        const reader = new FileReader();
        const b64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(blob);
        });
        images.push(b64);
      }
    }

    shelter.purge();

    self.postMessage({
      type: "result",
      data: { stdout: stdout.trim(), images, error: null },
    });
  } catch (err) {
    self.postMessage({
      type: "result",
      data: { stdout: "", images: [], error: err.message || String(err) },
    });
  }
}

async function resetRuntime() {
  webR = null;
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
