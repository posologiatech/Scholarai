import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DbConnection {
  id: string;
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password_encrypted: string;
  ssl_mode: string;
  schema_cache: any;
}

// Build connection URL for PostgreSQL
function buildPostgresUrl(conn: DbConnection): string {
  const ssl = conn.ssl_mode !== "disable" ? `?sslmode=${conn.ssl_mode}` : "";
  return `postgres://${encodeURIComponent(conn.username)}:${encodeURIComponent(conn.password_encrypted)}@${conn.host}:${conn.port}/${conn.database_name}${ssl}`;
}

// Execute SQL on remote PostgreSQL using Deno's postgres driver
async function executePostgresQuery(conn: DbConnection, sql: string): Promise<{ columns: string[]; rows: any[][]; rowCount: number }> {
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  
  const client = new Client({
    hostname: conn.host,
    port: conn.port,
    database: conn.database_name,
    user: conn.username,
    password: conn.password_encrypted,
    tls: { enabled: conn.ssl_mode !== "disable" },
  });

  try {
    await client.connect();
    const result = await client.queryObject(sql);
    
    const columns = result.columns?.map((c: any) => c.name || String(c)) || 
                     (result.rows.length > 0 ? Object.keys(result.rows[0] as any) : []);
    const rows = result.rows.map((row: any) => 
      columns.map((col: string) => {
        const val = row[col];
        return val === null ? null : String(val);
      })
    );

    return { columns, rows, rowCount: result.rowCount || rows.length };
  } finally {
    await client.end();
  }
}

// Fetch schema from PostgreSQL
async function fetchPostgresSchema(conn: DbConnection): Promise<any> {
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  
  const client = new Client({
    hostname: conn.host,
    port: conn.port,
    database: conn.database_name,
    user: conn.username,
    password: conn.password_encrypted,
    tls: { enabled: conn.ssl_mode !== "disable" },
  });

  try {
    await client.connect();
    
    // Get tables and columns
    const result = await client.queryObject(`
      SELECT 
        t.table_schema,
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default
      FROM information_schema.tables t
      JOIN information_schema.columns c 
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_schema, t.table_name, c.ordinal_position
      LIMIT 500
    `);

    const schema: Record<string, any> = {};
    for (const row of result.rows as any[]) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!schema[key]) {
        schema[key] = { schema: row.table_schema, table: row.table_name, columns: [] };
      }
      schema[key].columns.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
      });
    }

    return Object.values(schema);
  } finally {
    await client.end();
  }
}

// Convert natural language to SQL using AI
async function naturalLanguageToSQL(question: string, schema: any, dbType: string): Promise<string> {
  const schemaStr = JSON.stringify(schema, null, 2);
  
  const systemPrompt = `Você é um especialista em SQL. Converta perguntas em linguagem natural para consultas SQL válidas.

Database type: ${dbType}

Schema do banco:
${schemaStr}

REGRAS:
- Retorne APENAS o SQL, sem explicação, sem markdown
- Use apenas SELECT (NUNCA INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE)
- Limite resultados com LIMIT 1000 se não especificado
- Use nomes de tabelas e colunas EXATAMENTE como no schema
- Para PostgreSQL, use aspas duplas para nomes com maiúsculas/especiais
- Sempre qualifique tabelas com schema quando aplicável`;

  const response = await callAI({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    model: "google/gemini-3-flash-preview",
    temperature: 0.1,
  });

  if (!response.ok) {
    throw new Error("Failed to generate SQL");
  }

  const data = await response.json();
  let sql = data.choices?.[0]?.message?.content || "";
  
  // Clean up: remove markdown fences
  sql = sql.replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  
  // Security: verify it's a SELECT
  const firstWord = sql.split(/\s+/)[0]?.toUpperCase();
  if (!["SELECT", "WITH", "EXPLAIN"].includes(firstWord)) {
    throw new Error("Apenas consultas SELECT são permitidas por segurança.");
  }

  return sql;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, connection_id, query, question } = await req.json();

    // Fetch connection
    if (action === "test" || action === "query" || action === "schema" || action === "nl2sql") {
      const { data: conn, error: connError } = await supabase
        .from("datamind_db_connections")
        .select("*")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .single();

      if (connError || !conn) {
        return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "test") {
        try {
          const schema = await fetchPostgresSchema(conn as DbConnection);
          
          // Cache schema
          await supabase
            .from("datamind_db_connections")
            .update({ schema_cache: schema, last_connected_at: new Date().toISOString() })
            .eq("id", connection_id);

          return new Response(JSON.stringify({ 
            success: true, 
            message: `Conectado com sucesso! ${schema.length} tabelas encontradas.`,
            schema 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Falha na conexão: ${err instanceof Error ? err.message : "Erro desconhecido"}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (action === "schema") {
        const schema = conn.schema_cache || await fetchPostgresSchema(conn as DbConnection);
        return new Response(JSON.stringify({ schema }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "query") {
        // Validate: only SELECT allowed
        const firstWord = query.trim().split(/\s+/)[0]?.toUpperCase();
        if (!["SELECT", "WITH", "EXPLAIN"].includes(firstWord)) {
          return new Response(JSON.stringify({ error: "Apenas consultas SELECT são permitidas." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await executePostgresQuery(conn as DbConnection, query);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "nl2sql") {
        const schema = conn.schema_cache || await fetchPostgresSchema(conn as DbConnection);
        const sql = await naturalLanguageToSQL(question, schema, conn.db_type);
        
        // Execute the generated SQL
        const result = await executePostgresQuery(conn as DbConnection, sql);
        
        return new Response(JSON.stringify({ sql, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("datamind-db error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
