import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Sandbox } from "npm:@e2b/code-interpreter@1.0.4";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { code, file_path, conversation_id } = await req.json();

    const e2bApiKey = Deno.env.get("E2B_API_KEY");
    if (!e2bApiKey) {
      return new Response(
        JSON.stringify({ type: "text", output: "E2B API key não configurada. Adicione E2B_API_KEY nos secrets do Supabase." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: fileData, error: fileError } = await supabase.storage
      .from("datamind-files")
      .download(file_path);

    if (fileError) {
      console.error("File download error:", fileError);
      return new Response(
        JSON.stringify({ type: "text", output: `Erro ao baixar arquivo: ${fileError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create E2B sandbox using SDK
    console.log("Creating E2B sandbox...");
    const sandbox = await Sandbox.create({ apiKey: e2bApiKey });
    console.log("Sandbox created:", sandbox.sandboxId);

    try {
      // Upload file to sandbox
      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      const fileName = file_path.split("/").pop() || "data.csv";
      const sandboxPath = `/tmp/${fileName}`;

      console.log(`Uploading file to sandbox: ${sandboxPath} (${fileBytes.length} bytes)`);
      await sandbox.files.write(sandboxPath, fileBytes);

      const lowerFileName = fileName.toLowerCase();
      const isExcel = lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xls");

      // Prepare code: always bootstrap dataframe as `df` before user code
      const fullCode = `
import subprocess
subprocess.run(['pip', 'install', 'pandas', 'matplotlib', 'seaborn', 'openpyxl', 'scipy', 'scikit-learn', 'statsmodels'], capture_output=True, text=True)

import matplotlib
matplotlib.use('Agg')

import os
import pandas as pd
os.chdir('/tmp')

DATA_FILE_PATH = ${JSON.stringify(sandboxPath)}

try:
    if ${isExcel ? "True" : "False"}:
        df = pd.read_excel(DATA_FILE_PATH)
    else:
        df = pd.read_csv(DATA_FILE_PATH)
except Exception as e:
    raise RuntimeError(f"Falha ao carregar o arquivo em df: {e}")

${code}
`;

      console.log("Running Python code...");
      const execution = await sandbox.runCode(fullCode);

      const stdout = execution.logs.stdout.join("\n");
      const stderr = execution.logs.stderr.join("\n");

      console.log("stdout length:", stdout.length);
      console.log("stderr length:", stderr.length);
      if (stderr) {
        console.error("Python stderr:", stderr.substring(0, 500));
      }

      // Check if there are image results (charts generated inline)
      const imageResult = execution.results.find((r: any) => r.png);

      if (imageResult && imageResult.png) {
        console.log("Chart found in execution results, uploading...");

        // Decode base64 PNG
        const chartBytes = Uint8Array.from(atob(imageResult.png), (c) => c.charCodeAt(0));
        const chartPath = `charts/${conversation_id}/${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from("datamind-files")
          .upload(chartPath, chartBytes, { contentType: "image/png" });

        if (uploadError) {
          console.error("Chart upload error:", uploadError);
        }

        const { data: urlData } = supabase.storage
          .from("datamind-files")
          .getPublicUrl(chartPath);

        return new Response(
          JSON.stringify({
            type: "image",
            output: stdout || "Gráfico gerado com sucesso.",
            image_url: urlData.publicUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also check if chart.png was saved to filesystem
      try {
        const chartFileBytes = await sandbox.files.read("/tmp/chart.png");
        if (chartFileBytes && chartFileBytes.length > 0) {
          console.log("Chart file found on filesystem, uploading...");

          const chartUint8 = chartFileBytes instanceof Uint8Array ? chartFileBytes : new Uint8Array(chartFileBytes);
          const chartPath = `charts/${conversation_id}/${Date.now()}.png`;

          await supabase.storage
            .from("datamind-files")
            .upload(chartPath, chartUint8, { contentType: "image/png" });

          const { data: urlData } = supabase.storage
            .from("datamind-files")
            .getPublicUrl(chartPath);

          return new Response(
            JSON.stringify({
              type: "image",
              output: stdout || "Gráfico gerado com sucesso.",
              image_url: urlData.publicUrl,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        // No chart file, that's fine
      }

      // Text-only output
      if (execution.error) {
        console.error("Execution error:", execution.error.name, execution.error.value);
        const errorOutput = `Erro na execução:\n${execution.error.name}: ${execution.error.value}\n\n${stderr}`;
        return new Response(
          JSON.stringify({ type: "text", output: errorOutput }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const output = stdout || "Código executado sem output.";
      return new Response(
        JSON.stringify({ type: "text", output }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      console.log("Killing sandbox...");
      await sandbox.kill().catch((e: any) => console.error("Kill error:", e));
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ type: "text", output: `Erro: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
