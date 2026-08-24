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

// --- AES-GCM encryption helpers ---
async function getEncryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("DB_ENCRYPTION_KEY");
  if (!raw) throw new Error("DB_ENCRYPTION_KEY not configured");
  const keyBytes = new TextEncoder().encode(raw.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptPassword(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Store as base64: iv:ciphertext
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `enc:${ivB64}:${ctB64}`;
}

async function decryptPassword(stored: string): Promise<string> {
  // If not encrypted (legacy), return as-is
  if (!stored.startsWith("enc:")) return stored;
  const key = await getEncryptionKey();
  const parts = stored.split(":");
  const iv = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// Build a connection object with decrypted password
async function withDecryptedPassword(conn: DbConnection): Promise<DbConnection> {
  return { ...conn, password_encrypted: await decryptPassword(conn.password_encrypted) };
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

// Execute SQL on remote MySQL using the deno_mysql driver
async function executeMySQLQuery(conn: DbConnection, sql: string): Promise<{ columns: string[]; rows: any[][]; rowCount: number }> {
  const { Client } = await import("https://deno.land/x/mysql@v2.12.1/mod.ts");

  const client = await new Client().connect({
    hostname: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password_encrypted,
    db: conn.database_name,
  });

  try {
    const result = await client.query(sql);
    const dataRows: Record<string, unknown>[] = Array.isArray(result) ? result : [];
    const columns = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
    const rows = dataRows.map((row) => columns.map((col) => (row[col] === null || row[col] === undefined ? null : String(row[col]))));

    return { columns, rows, rowCount: rows.length };
  } finally {
    await client.close();
  }
}

// Fetch schema from MySQL
async function fetchMySQLSchema(conn: DbConnection): Promise<any> {
  const { Client } = await import("https://deno.land/x/mysql@v2.12.1/mod.ts");

  const client = await new Client().connect({
    hostname: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password_encrypted,
    db: conn.database_name,
  });

  try {
    const result = await client.query(
      `SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = ?
       ORDER BY table_name, ordinal_position
       LIMIT 500`,
      [conn.database_name]
    );

    const schema: Record<string, any> = {};
    for (const row of result as any[]) {
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
    await client.close();
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
async function naturalLanguageToSQL(question: string, schema: any, dbType: string, userId?: string): Promise<string> {
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
- Para PostgreSQL, use aspas duplas para nomes com maiúsculas/especiais; para MySQL, use crases (\`nome\`)
- Sempre qualifique tabelas com schema quando aplicável (não aplicável ao MySQL, que já usa o próprio banco como schema)`;

  const response = await callAI({
    _userId: userId,
    _promptType: "datamind_db",
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
  
  sql = sql.replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  
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

    const body = await req.json();
    const { action, connection_id, query, question } = body;

    // --- NEW: Save connection with encrypted password ---
    if (action === "save") {
      const { name, db_type, host, port, database_name, username, password, ssl_mode } = body;
      if (!name || !host || !database_name || !username || !password) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encrypted = await encryptPassword(password);

      const { data, error } = await supabase
        .from("datamind_db_connections")
        .insert({
          user_id: user.id,
          name,
          db_type: db_type || "postgresql",
          host,
          port: port || 5432,
          database_name,
          username,
          password_encrypted: encrypted,
          ssl_mode: ssl_mode || "require",
        })
        .select("id, name, db_type, host, port, database_name, username, is_active, schema_cache, last_connected_at, created_at")
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, connection: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch connection and decrypt password
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

      // Decrypt password before use
      const decryptedConn = await withDecryptedPassword(conn as DbConnection);
      const isMySQL = decryptedConn.db_type === "mysql";
      const fetchSchema = isMySQL ? fetchMySQLSchema : fetchPostgresSchema;
      const executeQuery = isMySQL ? executeMySQLQuery : executePostgresQuery;

      if (action === "test") {
        try {
          const schema = await fetchSchema(decryptedConn);

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
        const schema = conn.schema_cache || await fetchSchema(decryptedConn);
        return new Response(JSON.stringify({ schema }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "query") {
        const firstWord = query.trim().split(/\s+/)[0]?.toUpperCase();
        if (!["SELECT", "WITH", "EXPLAIN"].includes(firstWord)) {
          return new Response(JSON.stringify({ error: "Apenas consultas SELECT são permitidas." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await executeQuery(decryptedConn, query);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "nl2sql") {
        const schema = conn.schema_cache || await fetchSchema(decryptedConn);
        const sql = await naturalLanguageToSQL(question, schema, conn.db_type, user.id);
        const result = await executeQuery(decryptedConn, sql);

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
