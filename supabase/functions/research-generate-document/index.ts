import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { callAI } from "../_shared/ai-caller.ts";

type DocType = "tcle" | "tale" | "dmp" | "relatorio_parcial" | "relatorio_final" | "folha_rosto" | "termo_sigilo" | "custom";

const DOC_INSTRUCTIONS: Record<DocType, string> = {
  tcle: `Gere um TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE) conforme Resolução CNS 466/2012 e 510/2016. Inclua: identificação do estudo, objetivos, justificativa, procedimentos, riscos, benefícios, garantias (sigilo, retirada do consentimento, ressarcimento, indenização), contatos do pesquisador e do CEP, e campos para assinatura. Linguagem acessível, 1ª pessoa do plural.`,
  tale: `Gere um TERMO DE ASSENTIMENTO LIVRE E ESCLARECIDO (TALE) para menores/incapazes, em linguagem simples e adequada à faixa etária. Inclua objetivos, o que será feito, direitos do participante, e espaço para assinatura.`,
  dmp: `Gere um PLANO DE GESTÃO DE DADOS (DMP) seguindo princípios FAIR e templates do CNPq/Horizon Europe. Seções: 1) Descrição dos dados; 2) Documentação e metadados; 3) Ética e legalidade (LGPD); 4) Armazenamento e backup; 5) Seleção e preservação; 6) Compartilhamento e reuso; 7) Responsabilidades e recursos.`,
  relatorio_parcial: `Gere um RELATÓRIO PARCIAL no padrão CNPq/CAPES contendo: 1) Identificação; 2) Resumo executivo; 3) Atividades realizadas (com base nas tarefas concluídas e cronograma); 4) Resultados parciais; 5) Dificuldades encontradas; 6) Próximas etapas; 7) Produção bibliográfica.`,
  relatorio_final: `Gere um RELATÓRIO FINAL no padrão CNPq/CAPES contendo: 1) Identificação; 2) Resumo; 3) Objetivos alcançados; 4) Metodologia executada; 5) Resultados e discussão; 6) Conclusões; 7) Produção bibliográfica e formação de recursos humanos; 8) Prestação de contas resumida.`,
  folha_rosto: `Gere uma FOLHA DE ROSTO para submissão na Plataforma Brasil, com identificação completa do estudo, instituição, pesquisador responsável, orçamento, prazo, e área temática.`,
  termo_sigilo: `Gere um TERMO DE COMPROMISSO DE CONFIDENCIALIDADE/SIGILO entre pesquisadores e equipe, conforme LGPD e Res. CNS 466/12.`,
  custom: `Gere o documento solicitado.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, corsHeaders);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;

    const { project_id, doc_type, custom_instructions, title } = await req.json();
    if (!project_id || !doc_type) {
      return new Response(JSON.stringify({ error: "project_id and doc_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: project }, { data: members }] = await Promise.all([
      supabase.from("research_projects").select("*").eq("id", project_id).single(),
      supabase.from("research_project_members").select("full_name,role,invited_email").eq("project_id", project_id),
    ]);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const instr = DOC_INSTRUCTIONS[doc_type as DocType] || DOC_INSTRUCTIONS.custom;
    const teamStr = (members || []).map((m: any) => `- ${m.full_name || m.invited_email} (${m.role})`).join("\n");

    const system = `Você é especialista em redação de documentos oficiais de pesquisa no Brasil (CONEP, CNPq, CAPES, LGPD). Produza o documento em pt-BR, em Markdown, profissional, juridicamente alinhado, SEM inventar dados. Quando faltar informação, use "[A PREENCHER: ...]". Use APENAS os dados do projeto fornecidos abaixo.`;

    const user = `${instr}\n\n## Dados do projeto\n- Título: ${project.title}\n- Área CNPq: ${project.cnpq_area || "[A PREENCHER]"}\n- Status: ${project.status}\n- Início: ${project.start_date || "[A PREENCHER]"}\n- Término: ${project.end_date || "[A PREENCHER]"}\n- Objetivos: ${project.objectives || "[A PREENCHER]"}\n- Palavras-chave: ${(project.keywords || []).join(", ")}\n- Descrição: ${project.description || "[A PREENCHER]"}\n\n## Equipe\n${teamStr || "[A PREENCHER]"}\n\n${custom_instructions ? `## Instruções adicionais do usuário\n${custom_instructions}` : ""}`;

    const aiRes = await callAI({
      _userId: userId,
      _promptType: "research_generate_document",
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    } as any);
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", details: text }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || "";

    const { data: doc, error: insErr } = await supabase
      .from("research_documents")
      .insert({
        project_id,
        doc_type,
        title: title || defaultTitle(doc_type, project.title),
        content,
        generated_by_ai: true,
        created_by: userId,
        metadata: { model: "google/gemini-2.5-flash" },
      })
      .select("*")
      .single();
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ document: doc }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function defaultTitle(type: string, projectTitle: string): string {
  const map: Record<string, string> = {
    tcle: "TCLE",
    tale: "TALE",
    dmp: "Plano de Gestão de Dados",
    relatorio_parcial: "Relatório Parcial",
    relatorio_final: "Relatório Final",
    folha_rosto: "Folha de Rosto",
    termo_sigilo: "Termo de Sigilo",
    custom: "Documento",
  };
  return `${map[type] || "Documento"} — ${projectTitle}`;
}
