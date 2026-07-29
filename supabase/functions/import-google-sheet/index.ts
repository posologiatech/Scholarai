import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Accepts a raw ID or a full Google Sheets URL and returns the spreadsheet ID.
function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { spreadsheet_url, sheet_name, provider_token } = await req.json();

    if (!provider_token) {
      return new Response(
        JSON.stringify({ error: "Google OAuth token não encontrado. Faça login com Google." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!spreadsheet_url) {
      return new Response(
        JSON.stringify({ error: "URL ou ID da planilha é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheet_url);

    // 1. Fetch spreadsheet metadata (title + sheet names) to resolve the tab to read
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
      { headers: { Authorization: `Bearer ${provider_token}` } }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("Google Sheets metadata error:", errText);
      let errorMessage = "Falha ao acessar a planilha. Verifique o link e as permissões.";
      try {
        const errJson = JSON.parse(errText);
        errorMessage = errJson?.error?.message || errorMessage;
      } catch { /* use default */ }
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = await metaRes.json();
    const sheetTitles: string[] = (meta.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
    const resolvedSheetName = sheet_name || sheetTitles[0];

    if (!resolvedSheetName) {
      return new Response(JSON.stringify({ error: "Nenhuma aba encontrada nesta planilha." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch the values of that tab
    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(resolvedSheetName)}`,
      { headers: { Authorization: `Bearer ${provider_token}` } }
    );

    if (!valuesRes.ok) {
      const errText = await valuesRes.text();
      console.error("Google Sheets values error:", errText);
      return new Response(JSON.stringify({ error: "Falha ao ler os dados da planilha." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valuesData = await valuesRes.json();
    const values: string[][] = valuesData.values || [];

    if (values.length < 2) {
      return new Response(JSON.stringify({ error: "A planilha está vazia ou só tem cabeçalho." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const columns = values[0].map((h) => (h || "").trim());
    const rows = values.slice(1).map((row) => {
      const record: Record<string, string> = {};
      columns.forEach((col, i) => { record[col] = row[i] ?? ""; });
      return record;
    });

    return new Response(
      JSON.stringify({
        title: meta.properties?.title || "Planilha Google Sheets",
        sheet_name: resolvedSheetName,
        sheet_names: sheetTitles,
        columns,
        rows,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("import-google-sheet error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
