import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZoteroItem {
  key: string;
  data: {
    title?: string;
    creators?: { firstName?: string; lastName?: string; name?: string; creatorType?: string }[];
    date?: string;
    DOI?: string;
    url?: string;
    abstractNote?: string;
    publicationTitle?: string;
    itemType?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const { action, provider, connectionId } = body;
    // action: "pull" | "push" | "full_sync"
    // provider: "zotero" | "mendeley"

    // Get connection
    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: conn } = await adminSb
      .from("reference_manager_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .single();

    if (!conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: CORS });
    }

    // Update status
    await adminSb.from("reference_manager_connections").update({ sync_status: "syncing" }).eq("id", conn.id);

    let pulled = 0;
    let pushed = 0;

    try {
      if (conn.provider === "zotero") {
        const result = await syncZotero(conn, userId, adminSb, action || "full_sync");
        pulled = result.pulled;
        pushed = result.pushed;
      } else if (conn.provider === "mendeley") {
        const result = await syncMendeley(conn, userId, adminSb, action || "full_sync");
        pulled = result.pulled;
        pushed = result.pushed;
      }

      await adminSb.from("reference_manager_connections").update({
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
      }).eq("id", conn.id);
    } catch (syncErr: any) {
      await adminSb.from("reference_manager_connections").update({ sync_status: "error" }).eq("id", conn.id);
      throw syncErr;
    }

    return new Response(JSON.stringify({ success: true, pulled, pushed }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sync-references error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ── Zotero sync ──
async function syncZotero(conn: any, userId: string, sb: any, action: string) {
  const apiKey = conn.api_key;
  const libraryId = conn.user_library_id || "0";
  const baseUrl = `https://api.zotero.org/users/${libraryId}/items`;
  let pulled = 0;
  let pushed = 0;

  // PULL: fetch items from Zotero → saved_searches
  if (action === "pull" || action === "full_sync") {
    const headers = { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" };
    let start = 0;
    const limit = 100;
    const allItems: any[] = [];

    while (true) {
      const res = await fetch(`${baseUrl}?start=${start}&limit=${limit}&itemType=-attachment+-note`, { headers });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Zotero API error ${res.status}: ${errText}`);
      }
      const items: ZoteroItem[] = await res.json();
      if (items.length === 0) break;
      allItems.push(...items);
      start += limit;
      if (items.length < limit) break;
    }

    // Convert to papers format
    const papers = allItems.map((item) => {
      const d = item.data;
      const authors = (d.creators || [])
        .filter((c: any) => c.creatorType === "author")
        .map((c: any) => c.name || `${c.lastName || ""}, ${c.firstName || ""}`.trim());
      const yearMatch = (d.date || "").match(/(\d{4})/);
      return {
        title: d.title || "Sem título",
        authors,
        year: yearMatch ? parseInt(yearMatch[1]) : null,
        doi: d.DOI || null,
        url: d.url || null,
        abstract: d.abstractNote || null,
        journal: d.publicationTitle || null,
        source: "zotero",
        zotero_key: item.key,
      };
    });

    if (papers.length > 0) {
      // Save as a single saved_search entry
      const existingQuery = `zotero-sync-${conn.id}`;
      const { data: existing } = await sb
        .from("saved_searches")
        .select("id")
        .eq("user_id", userId)
        .eq("query", existingQuery)
        .maybeSingle();

      if (existing) {
        await sb.from("saved_searches").delete().eq("id", existing.id);
      }

      await sb.from("saved_searches").insert({
        user_id: userId,
        query: existingQuery,
        papers: papers,
        columns: [],
        column_data: {},
      });

      pulled = papers.length;
    }
  }

  // PUSH: send library papers to Zotero
  if (action === "push" || action === "full_sync") {
    const { data: searches } = await sb
      .from("saved_searches")
      .select("papers")
      .eq("user_id", userId)
      .not("query", "like", "zotero-sync-%")
      .not("query", "like", "mendeley-sync-%");

    if (searches && searches.length > 0) {
      const allPapers: any[] = [];
      for (const s of searches) {
        if (Array.isArray(s.papers)) allPapers.push(...s.papers);
      }

      // Deduplicate by DOI or title
      const seen = new Set<string>();
      const unique = allPapers.filter((p: any) => {
        const key = p.doi || p.title?.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Push each paper to Zotero (batch of 50)
      const headers: Record<string, string> = {
        "Zotero-API-Key": apiKey,
        "Zotero-API-Version": "3",
        "Content-Type": "application/json",
      };

      for (let i = 0; i < unique.length; i += 50) {
        const batch = unique.slice(i, i + 50).map((p: any) => {
          const authors = Array.isArray(p.authors)
            ? p.authors.map((a: any) => {
                const name = typeof a === "string" ? a : a.name || "";
                const parts = name.split(",");
                return {
                  creatorType: "author",
                  lastName: parts[0]?.trim() || name,
                  firstName: parts[1]?.trim() || "",
                };
              })
            : [];
          return {
            itemType: "journalArticle",
            title: p.title || "",
            creators: authors,
            date: p.year ? String(p.year) : "",
            DOI: p.doi || "",
            url: p.url || "",
            abstractNote: p.abstract || "",
            publicationTitle: p.journal || "",
          };
        });

        const res = await fetch(`https://api.zotero.org/users/${libraryId}/items`, {
          method: "POST",
          headers,
          body: JSON.stringify(batch),
        });

        if (res.ok) {
          pushed += batch.length;
        } else {
          console.error("Zotero push error:", await res.text());
        }
      }
    }
  }

  return { pulled, pushed };
}

// ── Mendeley sync ──
async function syncMendeley(conn: any, userId: string, sb: any, action: string) {
  const accessToken = conn.api_key; // For Mendeley, this is the OAuth access token
  const baseUrl = "https://api.mendeley.com";
  let pulled = 0;
  let pushed = 0;

  if (action === "pull" || action === "full_sync") {
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.mendeley-document.1+json" };
    let marker: string | null = null;
    const allDocs: any[] = [];

    while (true) {
      const url = marker
        ? `${baseUrl}/documents?limit=100&marker=${marker}&view=all`
        : `${baseUrl}/documents?limit=100&view=all`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Mendeley API error ${res.status}: ${errText}`);
      }
      const docs = await res.json();
      if (!Array.isArray(docs) || docs.length === 0) break;
      allDocs.push(...docs);

      // Check for next page via Link header
      const linkHeader = res.headers.get("Link");
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>/);
        if (match) {
          const nextUrl = new URL(match[1]);
          marker = nextUrl.searchParams.get("marker");
        } else break;
      } else break;
    }

    const papers = allDocs.map((doc: any) => {
      const authors = (doc.authors || []).map((a: any) => `${a.last_name || ""}, ${a.first_name || ""}`.trim());
      return {
        title: doc.title || "Sem título",
        authors,
        year: doc.year || null,
        doi: doc.identifiers?.doi || null,
        url: doc.websites?.[0] || null,
        abstract: doc.abstract || null,
        journal: doc.source || null,
        source: "mendeley",
        mendeley_id: doc.id,
      };
    });

    if (papers.length > 0) {
      const existingQuery = `mendeley-sync-${conn.id}`;
      const { data: existing } = await sb
        .from("saved_searches")
        .select("id")
        .eq("user_id", userId)
        .eq("query", existingQuery)
        .maybeSingle();

      if (existing) {
        await sb.from("saved_searches").delete().eq("id", existing.id);
      }

      await sb.from("saved_searches").insert({
        user_id: userId,
        query: existingQuery,
        papers: papers,
        columns: [],
        column_data: {},
      });

      pulled = papers.length;
    }
  }

  if (action === "push" || action === "full_sync") {
    const { data: searches } = await sb
      .from("saved_searches")
      .select("papers")
      .eq("user_id", userId)
      .not("query", "like", "zotero-sync-%")
      .not("query", "like", "mendeley-sync-%");

    if (searches && searches.length > 0) {
      const allPapers: any[] = [];
      for (const s of searches) {
        if (Array.isArray(s.papers)) allPapers.push(...s.papers);
      }

      const seen = new Set<string>();
      const unique = allPapers.filter((p: any) => {
        const key = p.doi || p.title?.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/vnd.mendeley-document.1+json",
      };

      for (const p of unique) {
        const authors = Array.isArray(p.authors)
          ? p.authors.map((a: any) => {
              const name = typeof a === "string" ? a : a.name || "";
              const parts = name.split(",");
              return { last_name: parts[0]?.trim() || name, first_name: parts[1]?.trim() || "" };
            })
          : [];

        const doc = {
          type: "journal",
          title: p.title || "",
          authors,
          year: p.year || undefined,
          identifiers: p.doi ? { doi: p.doi } : undefined,
          abstract: p.abstract || undefined,
          source: p.journal || undefined,
          websites: p.url ? [p.url] : undefined,
        };

        const res = await fetch(`${baseUrl}/documents`, {
          method: "POST",
          headers,
          body: JSON.stringify(doc),
        });

        if (res.ok || res.status === 201) pushed++;
      }
    }
  }

  return { pulled, pushed };
}
