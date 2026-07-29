import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

  // Personal feature: only the configured owner account may route execution to the
  // home server. Every other user keeps using the in-browser Pyodide/WebR sandbox.
  const ownerId = Deno.env.get("DATAMIND_REMOTE_EXEC_OWNER_ID");
  if (!ownerId || auth.userId !== ownerId) {
    return new Response(JSON.stringify({ error: "Execução remota não disponível para esta conta." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { code, codeLanguage, filePaths } = await req.json();

    if (codeLanguage === "r") {
      return new Response(
        JSON.stringify({ stdout: "", images: [], error: "Execução remota de R ainda não é suportada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const execUrl = Deno.env.get("DATAMIND_EXEC_URL");
    const execToken = Deno.env.get("DATAMIND_EXEC_TOKEN");
    if (!execUrl || !execToken) {
      throw new Error("Execução remota não configurada (DATAMIND_EXEC_URL/DATAMIND_EXEC_TOKEN ausentes).");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const files: { file_name: string; url: string }[] = [];
    for (const filePath of (filePaths as string[]) || []) {
      const { data, error } = await supabaseAdmin.storage
        .from("datamind-files")
        .createSignedUrl(filePath, 120);
      if (error || !data) {
        throw new Error(`Falha ao gerar URL assinada para ${filePath}: ${error?.message}`);
      }
      files.push({ file_name: filePath.split("/").pop() || filePath, url: data.signedUrl });
    }

    const execRes = await fetch(`${execUrl.replace(/\/$/, "")}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${execToken}` },
      body: JSON.stringify({ code, codeLanguage, files }),
      signal: AbortSignal.timeout(100_000),
    });

    if (!execRes.ok) {
      const text = await execRes.text();
      throw new Error(`Servidor remoto respondeu ${execRes.status}: ${text.slice(0, 300)}`);
    }

    const result = await execRes.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("datamind-run-remote error:", error);
    // Same {stdout, images, error} shape the client already handles for Pyodide/WebR
    // failures, so DataMind.tsx doesn't need a separate error path for this engine.
    return new Response(
      JSON.stringify({
        stdout: "",
        images: [],
        error: error instanceof Error ? error.message : "Erro ao executar remotamente.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
