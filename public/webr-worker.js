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

// Turns "Vendas Mensais.csv" into a safe, unique R identifier like "vendas_mensais"
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
  const names = (fileNames || []).filter((fn) => fn && fn.toLowerCase().endsWith(".csv"));
  if (names.length === 0) return "";

  const used = new Set();
  const entries = names.map((fileName) => ({
    fileName,
    varName: `df_${slugifyVarName(fileName, used)}`,
  }));

  let code = "dfs <- list()\n";
  for (const { fileName, varName } of entries) {
    const path = "/tmp/" + fileName;
    code += `${varName} <- tryCatch(read.csv("${path}", stringsAsFactors=FALSE), error=function(e) { cat("Aviso:", e$message, "\\n"); NULL })\n`;
    code += `dfs[["${fileName}"]] <- ${varName}\n`;
  }
  if (entries.length === 1) {
    code += `df <- ${entries[0].varName}\n`;
  }
  return code;
}

async function runCode(code, fileNames) {
  const r = await initWebR();

  const showChartHelper = `
show_chart <- function(data, kind="bar", x=NULL, y=NULL, series=NULL, title="") {
  df_ <- as.data.frame(data)
  if (nrow(df_) == 0) {
    cat("Aviso: show_chart recebeu dados vazios.\\n")
    return(invisible(NULL))
  }
  x_key <- if (!is.null(x)) x else names(df_)[1]
  series_keys <- if (!is.null(series)) series else if (!is.null(y)) y else setdiff(names(df_), x_key)
  payload <- jsonlite::toJSON(list(
    kind = kind,
    title = title,
    xKey = x_key,
    series = lapply(series_keys, function(k) list(key = k, label = as.character(k))),
    data = jsonlite::fromJSON(jsonlite::toJSON(df_, dataframe = "rows", auto_unbox = TRUE), simplifyVector = FALSE)
  ), auto_unbox = TRUE)
  cat(paste0("__DATACHART_START__", payload, "__DATACHART_END__\\n"))
}
`;

  let fullCode = showChartHelper + buildDataBootstrap(fileNames);

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
        await runCode(payload.code, payload.fileNames);
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
