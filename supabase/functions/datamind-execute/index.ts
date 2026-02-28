import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Create E2B sandbox
    const createRes = await fetch("https://api.e2b.dev/sandboxes", {
      method: "POST",
      headers: {
        "X-API-Key": e2bApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: "base",
        timeout: 60,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("E2B create error:", err);
      return new Response(
        JSON.stringify({ type: "text", output: "Erro ao criar sandbox E2B." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sandbox = await createRes.json();
    const sandboxId = sandbox.sandboxId || sandbox.id;

    try {
      // Upload file to sandbox
      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      const base64File = btoa(String.fromCharCode(...fileBytes));

      await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/files`, {
        method: "POST",
        headers: {
          "X-API-Key": e2bApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "/tmp/data.csv",
          content: base64File,
        }),
      });

      // Install dependencies and run code
      const fullCode = `
import subprocess
subprocess.run(['pip', 'install', 'pandas', 'matplotlib', 'seaborn', 'openpyxl'], capture_output=True)

${code}
`;

      const execRes = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/code/execution`, {
        method: "POST",
        headers: {
          "X-API-Key": e2bApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: fullCode,
          language: "python",
        }),
      });

      if (!execRes.ok) {
        const err = await execRes.text();
        console.error("E2B exec error:", err);
        return new Response(
          JSON.stringify({ type: "text", output: "Erro ao executar código Python." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const execResult = await execRes.json();
      const stdout = execResult.stdout || "";
      const stderr = execResult.stderr || "";

      // Check if chart was generated
      const chartRes = await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}/files?path=/tmp/chart.png`, {
        headers: { "X-API-Key": e2bApiKey },
      });

      if (chartRes.ok) {
        const chartData = await chartRes.arrayBuffer();
        const chartBase64 = btoa(String.fromCharCode(...new Uint8Array(chartData)));

        // Upload chart to Supabase Storage
        const chartPath = `charts/${conversation_id}/${Date.now()}.png`;
        const chartBytes = Uint8Array.from(atob(chartBase64), (c) => c.charCodeAt(0));

        await supabase.storage
          .from("datamind-files")
          .upload(chartPath, chartBytes, { contentType: "image/png" });

        const { data: urlData } = supabase.storage
          .from("datamind-files")
          .getPublicUrl(chartPath);

        return new Response(
          JSON.stringify({
            type: "image",
            output: stdout,
            image_url: urlData.publicUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Text-only output
      const output = stdout || stderr || "Código executado sem output.";
      return new Response(
        JSON.stringify({ type: "text", output }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      // Kill sandbox
      await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: { "X-API-Key": e2bApiKey },
      }).catch(() => {});
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ type: "text", output: `Erro: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
