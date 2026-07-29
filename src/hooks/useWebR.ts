import { useState, useRef, useCallback, useEffect } from "react";

export type WebRStatus = "idle" | "loading" | "installing" | "ready" | "running" | "error";

interface RunResult {
  stdout: string;
  images: string[];
  error: string | null;
}

export function useWebR() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<WebRStatus>("idle");
  const resolveRef = useRef<((result: RunResult) => void) | null>(null);
  const fileWrittenRef = useRef<((name: string) => void) | null>(null);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    setStatus("loading");
    const worker = new Worker("/webr-worker.js");

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      switch (type) {
        case "status":
          if (data === "loading") setStatus("loading");
          else if (data === "ready") setStatus("installing");
          else if (data === "installing_packages") setStatus("installing");
          else if (data === "packages_ready") setStatus("ready");
          else if (data === "reset") setStatus("idle");
          break;
        case "result":
          setStatus("ready");
          resolveRef.current?.(data as RunResult);
          resolveRef.current = null;
          break;
        case "fileWritten":
          fileWrittenRef.current?.(data);
          fileWrittenRef.current = null;
          break;
        case "error":
          setStatus("error");
          resolveRef.current?.({ stdout: "", images: [], error: data });
          resolveRef.current = null;
          break;
      }
    };

    worker.onerror = (err) => {
      console.error("WebR worker error:", err);
      setStatus("error");
      resolveRef.current?.({ stdout: "", images: [], error: err?.message || "WebR worker failed" });
      resolveRef.current = null;
    };

    workerRef.current = worker;
    worker.postMessage({ action: "init" });
    return worker;
  }, []);

  const writeFile = useCallback(
    (fileName: string, data: ArrayBuffer): Promise<string> => {
      const worker = getWorker();
      return new Promise((resolve) => {
        fileWrittenRef.current = resolve;
        worker.postMessage({ action: "writeFile", payload: { fileName, data } }, [data]);
      });
    },
    [getWorker]
  );

  const runR = useCallback(
    (code: string, fileNames?: string[]): Promise<RunResult> => {
      const worker = getWorker();
      setStatus("running");
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        worker.postMessage({ action: "run", payload: { code, fileNames } });
      });
    },
    [getWorker]
  );

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: "reset" });
    }
  }, []);

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return { status, writeFile, runR, reset, terminate, init: getWorker };
}
