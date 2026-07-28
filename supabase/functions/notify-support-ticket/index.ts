// Emails the admin when a customer opens or replies to a support ticket.
// The in-app admin notification (admin_notifications) is created reliably by
// a DB trigger independent of this function -- this is the best-effort email
// side effect on top, invoked fire-and-forget by the client right after it
// inserts a ticket/message row. Never invoked for admin replies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "ScholarAI Support <contato@tbl.posologia.app>";
const ADMIN_EMAILS = ["sergio.araujo@ufrn.br"];
const APP_URL = "https://scholarai.posologia.app";

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  billing: "Cobrança",
  technical: "Dúvida técnica",
  suggestion: "Sugestão",
  other: "Outro",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { ticketId, messageId } = await req.json();
    if (!ticketId || !messageId) {
      return new Response(JSON.stringify({ error: "Missing ticketId or messageId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: ticketErr } = await admin
      .from("support_tickets")
      .select("id, user_id, subject, category, priority")
      .eq("id", ticketId)
      .single();
    if (ticketErr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdminCaller } = await admin.rpc("has_role", {
      _user_id: auth.userId,
      _role: "admin",
    });
    if (ticket.user_id !== auth.userId && !isAdminCaller) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: msgErr } = await admin
      .from("support_ticket_messages")
      .select("id, ticket_id, body, is_admin_reply")
      .eq("id", messageId)
      .single();
    if (msgErr || !message || message.ticket_id !== ticketId) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.is_admin_reply) {
      return new Response(JSON.stringify({ sent: false, reason: "admin_reply" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ sent: false, reason: "email_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count } = await admin
      .from("support_ticket_messages")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticketId);
    const isNewTicket = (count ?? 1) <= 1;

    const { data: approval } = await admin
      .from("user_approvals")
      .select("email, full_name")
      .eq("user_id", ticket.user_id)
      .single();
    const customerEmail = approval?.email || undefined;
    const customerName = approval?.full_name || customerEmail || "Cliente";

    const subject = isNewTicket
      ? `[ScholarAI] Novo ticket de suporte: ${ticket.subject}`
      : `[ScholarAI] Nova resposta no ticket: ${ticket.subject}`;

    const link = `${APP_URL}/admin?tab=tickets&ticket=${ticketId}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px;font-size:18px">${isNewTicket ? "Novo ticket de suporte" : "Nova resposta em um ticket"}</h2>
        <p style="margin:0 0 8px"><strong>Cliente:</strong> ${escapeHtml(customerName)}${customerEmail ? ` (${escapeHtml(customerEmail)})` : ""}</p>
        <p style="margin:0 0 8px"><strong>Assunto:</strong> ${escapeHtml(ticket.subject)}</p>
        <p style="margin:0 0 8px"><strong>Categoria:</strong> ${CATEGORY_LABELS[ticket.category] || ticket.category} &nbsp;|&nbsp; <strong>Prioridade:</strong> ${PRIORITY_LABELS[ticket.priority] || ticket.priority}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
        <p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(message.body)}</p>
        <a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Abrir no painel de suporte</a>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">ScholarAI — sistema de suporte</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAILS,
        subject,
        html,
        reply_to: customerEmail,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ sent: false, error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
