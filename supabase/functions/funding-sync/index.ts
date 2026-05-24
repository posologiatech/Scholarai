import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Periodic sync of public funding-call RSS feeds (CAPES, CNPq, FAPESP, Finep, FAPs).
// Runs unauthenticated via pg_cron; uses service-role to upsert.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: sources, error: sErr } = await supabase
      .from("funding_sources")
      .select("*")
      .eq("active", true);
    if (sErr) throw sErr;

    let inserted = 0;
    let skipped = 0;

    for (const src of sources ?? []) {
      if (!src.feed_url) continue;
      try {
        const res = await fetch(src.feed_url, {
          headers: { "User-Agent": "ScholarAI-FundingSync/1.0" },
        });
        if (!res.ok) { skipped++; continue; }
        const xml = await res.text();
        const items = parseRSS(xml);
        for (const item of items.slice(0, 50)) {
          const external_id = item.guid || item.link || `${src.id}:${item.title}`;
          // upsert by (source_id, external_id)
          const { error: upErr } = await supabase
            .from("funding_calls")
            .upsert({
              source_id: src.id,
              external_id,
              title: item.title?.slice(0, 500) ?? "Sem título",
              description: item.description?.slice(0, 4000) ?? null,
              url: item.link ?? null,
              published_at: item.pubDate ?? null,
              raw: item,
            }, { onConflict: "source_id,external_id" });
          if (upErr) skipped++; else inserted++;
        }
        await supabase.from("funding_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", src.id);
      } catch (e) {
        console.error("source failed", src.id, e);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseRSS(xml: string): Array<Record<string, any>> {
  const items: any[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches) {
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link"),
      description: tag(block, "description"),
      pubDate: toISO(tag(block, "pubDate")),
      guid: tag(block, "guid"),
    });
  }
  return items;
}
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
}
function toISO(d: string | null): string | null {
  if (!d) return null;
  const t = Date.parse(d);
  return isNaN(t) ? null : new Date(t).toISOString();
}
