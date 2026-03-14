import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      consentId,
      respondentName,
      respondentEmail,
      signatureData,
      sectionConfirmations,
      consentTitle,
      sections,
      paperAccessInfo,
    } = await req.json();

    if (!consentId || !respondentName) {
      return new Response(
        JSON.stringify({ error: "consentId and respondentName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = req.headers.get("user-agent") || "";
    const signedAt = new Date().toISOString();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: consentData } = await supabaseAdmin
      .from("study_consents")
      .select("version, survey_id, researcher_name, researcher_email, researcher_phone, contact_hours, paper_access_info")
      .eq("id", consentId)
      .single();

    const consentVersion = consentData?.version || 1;
    const surveyId = consentData?.survey_id;

    const pdfFileName = `consent_${consentId}_${Date.now()}.pdf`;

    const pdfContent = [
      `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO`,
      `Título: ${consentTitle || "TCLE"}`,
      `Versão: ${consentVersion}`,
      ``,
      `Data/Hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      `Participante: ${respondentName}`,
      respondentEmail ? `Email: ${respondentEmail}` : "",
      `IP: ${ipAddress}`,
      `User-Agent: ${userAgent}`,
      ``,
      `--- BASE LEGAL ---`,
      `Tratamento de dados fundamentado no Art. 7°, inciso IV da LGPD`,
      `(Lei 13.709/2018) - Pesquisa científica com consentimento.`,
      ``,
      `O participante tem o direito de revogar este consentimento a`,
      `qualquer momento, conforme Art. 8° §5° da LGPD e Resolução`,
      `CNS 466/2012, sem qualquer prejuízo.`,
      ``,
      `--- CONTATO DO PESQUISADOR ---`,
      consentData?.researcher_name ? `Pesquisador: ${consentData.researcher_name}` : "",
      consentData?.researcher_email ? `E-mail: ${consentData.researcher_email}` : "",
      consentData?.researcher_phone ? `Telefone: ${consentData.researcher_phone}` : "",
      consentData?.contact_hours ? `Horários: ${consentData.contact_hours}` : "",
      ``,
      `--- ACESSO EM PAPEL ---`,
      consentData?.paper_access_info || paperAccessInfo
        ? `Para solicitar via impressa:\n${consentData?.paper_access_info || paperAccessInfo}`
        : "Consulte o pesquisador responsável para solicitar via impressa.",
      ``,
      `--- SEÇÕES CONSENTIDAS ---`,
      ...(sections || []).map(
        (s: any, i: number) =>
          `${i + 1}. ${s.title}\n${s.content_html || ""}\n✓ Li e compreendi esta seção\n`
      ),
      ``,
      `Assinatura digital: ${signatureData ? "[PRESENTE]" : "[NÃO EXIGIDA]"}`,
      ``,
      `Timestamp ISO: ${signedAt}`,
      `Hash de integridade: ${await computeHash(respondentName + signedAt + ipAddress)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const pdfBlob = new Blob([pdfContent], { type: "text/plain" });

    await supabaseAdmin.storage
      .from("consents")
      .upload(pdfFileName, pdfBlob, { contentType: "text/plain" });

    const { data: sig, error: sigError } = await supabaseAdmin
      .from("consent_signatures")
      .insert({
        consent_id: consentId,
        respondent_name: respondentName,
        respondent_email: respondentEmail || null,
        signature_data: signatureData,
        user_agent: userAgent,
        ip_address: ipAddress,
        section_confirmations: sectionConfirmations || [],
        pdf_path: pdfFileName,
        consent_version: consentVersion,
      })
      .select("id")
      .single();

    if (sigError) throw sigError;

    // Write audit log
    await supabaseAdmin.from("study_audit_log").insert({
      survey_id: surveyId,
      action: "consent_signed",
      details: {
        consent_id: consentId,
        consent_version: consentVersion,
        signature_id: sig.id,
        respondent_name: respondentName,
      },
      ip_address: ipAddress,
    });

    // Build revocation link
    const baseUrl = Deno.env.get("SITE_URL") || "https://arca-research.lovable.app";
    const revokeLink = `${baseUrl}/consent/revoke/${sig.id}`;

    // Send email copy to participant via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && respondentEmail) {
      try {
        const researcherContactHtml = consentData?.researcher_name
          ? `
            <h3>Contato do Pesquisador Responsável</h3>
            <p>${consentData.researcher_name}</p>
            ${consentData.researcher_email ? `<p>E-mail: ${consentData.researcher_email}</p>` : ""}
            ${consentData.researcher_phone ? `<p>Telefone: ${consentData.researcher_phone}</p>` : ""}
            ${consentData.contact_hours ? `<p>Horários: ${consentData.contact_hours}</p>` : ""}
          `
          : "";

        const paperAccessHtml = consentData?.paper_access_info || paperAccessInfo
          ? `
            <h3>Acesso à Via Impressa</h3>
            <p>Você tem o direito de solicitar uma via impressa do TCLE. Para isso, entre em contato:</p>
            <p style="white-space:pre-wrap;">${consentData?.paper_access_info || paperAccessInfo}</p>
          `
          : "";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "pesquisa@arcasearch.com.br",
            to: respondentEmail,
            subject: `Cópia do TCLE - ${consentTitle || "Termo de Consentimento"}`,
            html: `
              <h2>Cópia do seu Termo de Consentimento</h2>
              <p>Olá <strong>${respondentName}</strong>,</p>
              <p>Você assinou o Termo de Consentimento Livre e Esclarecido (TCLE) para participação em pesquisa científica.</p>
              <p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
              <p><strong>Versão do TCLE:</strong> ${consentVersion}</p>
              <p><strong>IP registrado:</strong> ${ipAddress}</p>
              ${researcherContactHtml}
              <hr/>
              <h3>Base Legal</h3>
              <p>O tratamento dos seus dados é fundamentado no Art. 7°, inciso IV da LGPD (Lei 13.709/2018) — pesquisa científica com consentimento informado.</p>
              <h3>Direito de Revogação</h3>
              <p>Você pode revogar este consentimento a qualquer momento, sem qualquer prejuízo.</p>
              <p><strong><a href="${revokeLink}">Clique aqui para revogar seu consentimento</a></strong></p>
              <p style="font-size:12px;color:#666;">Guarde este link. Ele permite que você revogue seu consentimento de forma autônoma, conforme Art. 5.4 do Ofício Circular CONEP nº 23/2022.</p>
              ${paperAccessHtml}
              <hr/>
              <p><a href="https://arca-research.lovable.app/participant-privacy">Política de Privacidade para Participantes</a></p>
              <p style="font-size:12px;color:#666;">Este e-mail foi enviado automaticamente. Guarde-o como comprovante.</p>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send consent email:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ signatureId: sig.id, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("consent-sign error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function computeHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
