import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Shield,
  Award,
  Building,
  Calendar,
  User,
  Mail,
  Hash,
} from "lucide-react";

interface ComplianceDocumentsProps {
  surveyId: string;
}

const ComplianceDocuments = ({ surveyId }: ComplianceDocumentsProps) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const isPt = locale === "pt";

  // Carta de Anuência fields
  const [researcherName, setResearcherName] = useState("");
  const [researcherEmail, setResearcherEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [cepName, setCepName] = useState("");
  const [cepContact, setCepContact] = useState("");
  const [parecerNumber, setParecerNumber] = useState("");

  const { data: survey } = useQuery({
    queryKey: ["survey-compliance", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("surveys").select("*").eq("id", surveyId).single();
      return data;
    },
    enabled: !!surveyId,
  });

  const { data: consent } = useQuery({
    queryKey: ["consent-compliance", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_consents")
        .select("*")
        .eq("survey_id", surveyId)
        .maybeSingle();
      return data;
    },
    enabled: !!surveyId,
  });

  const { data: signatureCount = 0 } = useQuery({
    queryKey: ["sig-count-compliance", consent?.id],
    queryFn: async () => {
      if (!consent?.id) return 0;
      const { count } = await supabase
        .from("consent_signatures")
        .select("*", { count: "exact", head: true })
        .eq("consent_id", consent.id);
      return count || 0;
    },
    enabled: !!consent?.id,
  });

  const generateCartaAnuencia = () => {
    if (!researcherName || !institution || !projectTitle) {
      toast.error(isPt ? "Preencha os campos obrigatórios" : "Fill required fields");
      return;
    }

    const today = new Date().toLocaleDateString("pt-BR");

    const content = `
CARTA DE ANUÊNCIA DA PLATAFORMA

À/Ao
${cepName || "Comitê de Ética em Pesquisa"}
${cepContact || ""}

Prezados(as) Membros do Comitê de Ética em Pesquisa,

Declaramos, para os devidos fins, que a plataforma ARCA (acessível em https://arca-research.lovable.app) autoriza o(a) pesquisador(a) ${researcherName}, vinculado(a) à instituição ${institution}, a utilizar os recursos da plataforma para a condução do projeto de pesquisa intitulado "${projectTitle}".

${parecerNumber ? `Parecer CEP nº: ${parecerNumber}` : ""}

1. DESCRIÇÃO DA PLATAFORMA

A plataforma ARCA é um sistema digital para pesquisa científica que oferece os seguintes módulos relevantes para este projeto:

   a) Questionários Eletrônicos — Construtor de questionários com suporte a múltiplos tipos de questões (múltipla escolha, escala Likert, matriz, texto livre, soma constante, ordenação), lógica condicional (skip logic e branching), randomização de blocos e questões.

   b) Termo de Consentimento Livre e Esclarecido (TCLE) Digital — Sistema de consentimento etapizado com apresentação multimídia (vídeo e áudio), micro-commitments por seção ("Li e compreendi"), assinatura digital em canvas e envio automático de cópia ao participante por e-mail.

   c) eCRF (Electronic Case Report Form) — Coleta longitudinal de dados com visitas programadas (T0, T1, T2...), validação clínica em tempo real e upload seguro de documentos.

   d) Gestão de Participantes — Códigos anônimos de participação, controle de status (ativo, concluído, retirado), vinculação ao consentimento assinado.

2. MEDIDAS DE SEGURANÇA E CONFORMIDADE

A plataforma implementa as seguintes medidas técnicas e organizacionais:

   • Captura de IP e User-Agent do participante via servidor (Edge Function), nunca pelo navegador do cliente
   • Geração de hash de integridade SHA-256 para cada assinatura de consentimento
   • Armazenamento criptografado em trânsito (TLS 1.3) e em repouso (AES-256)
   • Controle de acesso granular por políticas de segurança em nível de linha (Row-Level Security)
   • Buckets de armazenamento privados para documentos de consentimento e documentos clínicos
   • Trilha de auditoria completa conforme Boas Práticas Clínicas (GCP-ICH), registrando: assinatura de consentimento, revogação, modificação de dados, exportação e exclusão
   • Versionamento automático do TCLE com controle de re-consentimento
   • Mecanismo de revogação de consentimento com registro de motivo e anonimização automática

3. CONFORMIDADE REGULATÓRIA

   • LGPD (Lei 13.709/2018) — Art. 7°, inciso IV (pesquisa científica); Art. 11 (dados sensíveis); Art. 18 (direitos do titular)
   • Resolução CNS 466/2012 — Consentimento livre e esclarecido com entrega de via ao participante
   • Resolução CNS 510/2016 — Pesquisa em ciências humanas e sociais
   • Lei 14.063/2020 — Assinatura eletrônica simples para consentimento em pesquisa
   • GCP-ICH — Rastreabilidade e trilha de auditoria
   • Ofício Circular CONEP nº 2/2021 — Autorização de TCLE eletrônico

4. DIREITOS DO PARTICIPANTE

A plataforma garante ao participante:
   • Acesso à cópia digital do TCLE assinado (enviada automaticamente por e-mail)
   • Direito de revogar o consentimento a qualquer momento, sem prejuízo (LGPD Art. 8° §5°)
   • Direito de solicitar a anonimização ou exclusão dos seus dados pessoais (LGPD Art. 18)
   • Acesso à Política de Privacidade para Participantes em https://arca-research.lovable.app/participant-privacy

5. ARMAZENAMENTO DOS DADOS

   • Infraestrutura: Supabase (AWS), com servidores em conformidade com padrões internacionais de segurança
   • Período de retenção: Os dados são mantidos pelo período definido pelo pesquisador responsável, conforme o protocolo de pesquisa aprovado pelo CEP
   • Após o término do estudo, o pesquisador pode solicitar a anonimização completa dos dados

6. RESPONSABILIDADES

   • O pesquisador é responsável pelo conteúdo do TCLE, pela condução ética da pesquisa e pelo cumprimento do protocolo aprovado pelo CEP
   • A plataforma ARCA é responsável pela infraestrutura tecnológica, segurança dos dados e disponibilidade do sistema

Colocamo-nos à disposição para quaisquer esclarecimentos adicionais.

Atenciosamente,

________________________________
Plataforma ARCA
https://arca-research.lovable.app
contato@arcasearch.com.br

Data: ${today}

________________________________
${researcherName}
${institution}
${researcherEmail || ""}
Pesquisador(a) Responsável
`;

    downloadTextFile(content, `carta_anuencia_${surveyId.slice(0, 8)}.txt`);
    toast.success(isPt ? "Carta de Anuência gerada!" : "Authorization letter generated!");
  };

  const generateComplianceCertificate = () => {
    const today = new Date().toLocaleDateString("pt-BR");
    const content = `
═══════════════════════════════════════════════════════
       CERTIFICADO DE CONFORMIDADE TÉCNICA
              PLATAFORMA ARCA
═══════════════════════════════════════════════════════

Data de Emissão: ${today}
Projeto: ${survey?.title || projectTitle || "N/A"}
ID do Estudo: ${surveyId}
${parecerNumber ? `Parecer CEP: ${parecerNumber}` : ""}
${researcherName ? `Pesquisador: ${researcherName}` : ""}
${institution ? `Instituição: ${institution}` : ""}

───────────────────────────────────────────────────────
                RECURSOS DE SEGURANÇA
───────────────────────────────────────────────────────

✓ Criptografia em trânsito (TLS 1.3)
✓ Criptografia em repouso (AES-256)
✓ Row-Level Security (RLS) — controle de acesso granular
✓ Buckets de armazenamento privados
✓ Autenticação multifator disponível
✓ Separação lógica de dados por pesquisador

───────────────────────────────────────────────────────
              CONFORMIDADE COM LGPD
───────────────────────────────────────────────────────

✓ Base legal: Art. 7°, IV — Pesquisa científica
✓ Consentimento informado com registro digital
✓ Direito de revogação implementado (Art. 8° §5°)
✓ Direito de eliminação/anonimização (Art. 18)
✓ Política de privacidade pública para participantes
✓ Registro de finalidade do tratamento

───────────────────────────────────────────────────────
              CONFORMIDADE COM CEP
───────────────────────────────────────────────────────

✓ TCLE digital conforme Resolução CNS 466/2012
✓ Envio automático de cópia do TCLE ao participante
✓ Versionamento de TCLE com controle de re-consentimento
✓ Assinatura eletrônica conforme Lei 14.063/2020
✓ Compatível com Ofício Circular CONEP nº 2/2021

───────────────────────────────────────────────────────
          CONFORMIDADE COM GCP-ICH
───────────────────────────────────────────────────────

✓ Trilha de auditoria completa (audit trail)
✓ Registro de IP via servidor (Edge Function)
✓ Hash de integridade SHA-256 por assinatura
✓ Timestamp ISO 8601 com timezone
✓ Imutabilidade dos registros de auditoria
✓ Controle de versão de documentos

───────────────────────────────────────────────────────
           FUNCIONALIDADES DO MÓDULO
───────────────────────────────────────────────────────

✓ Questionário eletrônico multi-tipo
✓ TCLE digital etapizado com multimídia
✓ eCRF para coleta longitudinal
✓ Validação clínica em tempo real
✓ Gestão de participantes com códigos anônimos
✓ Anonimização de dados pessoais
✓ Exportação de dados para análise

───────────────────────────────────────────────────────
              ESTATÍSTICAS DO ESTUDO
───────────────────────────────────────────────────────

Versão do TCLE: v${(consent as any)?.version || 1}
Assinaturas registradas: ${signatureCount}
Status do estudo: ${survey?.status || "N/A"}

───────────────────────────────────────────────────────
             INFRAESTRUTURA TÉCNICA
───────────────────────────────────────────────────────

Provedor de nuvem: Supabase (AWS)
CDN: Cloudflare
Frontend: React + TypeScript
Edge Functions: Deno (Supabase Edge)
Banco de dados: PostgreSQL com extensões de segurança

═══════════════════════════════════════════════════════

Este certificado atesta que a plataforma ARCA implementa
as medidas técnicas e organizacionais descritas acima na
data de emissão. O pesquisador pode anexar este documento
ao protocolo submetido ao Comitê de Ética em Pesquisa.

Plataforma ARCA — https://arca-research.lovable.app

═══════════════════════════════════════════════════════
`;

    downloadTextFile(content, `certificado_conformidade_${surveyId.slice(0, 8)}.txt`);
    toast.success(isPt ? "Certificado gerado!" : "Certificate generated!");
  };

  const generateTCLEWithMetadata = () => {
    if (!consent) {
      toast.error(isPt ? "Crie o TCLE primeiro na aba TCLE" : "Create the consent form first");
      return;
    }

    const today = new Date().toLocaleDateString("pt-BR");
    const sections = (consent.sections as any[]) || [];

    const content = `
═══════════════════════════════════════════════════════
    TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO
═══════════════════════════════════════════════════════

Título: ${consent.title || "TCLE"}
Versão: ${(consent as any).version || 1}
Data de geração: ${today}

${projectTitle ? `Projeto: ${projectTitle}` : ""}
${researcherName ? `Pesquisador Responsável: ${researcherName}` : ""}
${institution ? `Instituição: ${institution}` : ""}
${researcherEmail ? `Contato do Pesquisador: ${researcherEmail}` : ""}
${parecerNumber ? `Nº do Parecer CEP: ${parecerNumber}` : ""}
${cepName ? `Comitê de Ética: ${cepName}` : ""}
${cepContact ? `Contato do CEP: ${cepContact}` : ""}

───────────────────────────────────────────────────────
                  SEÇÕES DO TCLE
───────────────────────────────────────────────────────

${sections.map((s: any, i: number) => `
${i + 1}. ${s.title || "Seção " + (i + 1)}

${s.content_html || "[Conteúdo não preenchido]"}

${s.require_checkbox ? "☐ Declaro que li e compreendi esta seção" : ""}
`).join("\n───────────────────────────────────────────────────────\n")}

───────────────────────────────────────────────────────
              INFORMAÇÕES LEGAIS (LGPD)
───────────────────────────────────────────────────────

BASE LEGAL DO TRATAMENTO DE DADOS:
O tratamento dos dados pessoais do participante é
fundamentado no Art. 7°, inciso IV da Lei Geral de
Proteção de Dados (Lei 13.709/2018) — realização de
estudos por órgão de pesquisa, garantida, sempre que
possível, a anonimização dos dados pessoais.

Para dados pessoais sensíveis, aplica-se o Art. 11,
inciso II, alínea "c" da LGPD.

FINALIDADE DO TRATAMENTO:
Os dados coletados serão utilizados exclusivamente para
os fins descritos neste termo e no protocolo de pesquisa
aprovado pelo Comitê de Ética em Pesquisa.

DIREITOS DO PARTICIPANTE (LGPD Art. 18):
• Revogar o consentimento a qualquer momento, sem
  prejuízo ao participante (Art. 8° §5°)
• Solicitar acesso aos seus dados pessoais
• Solicitar correção de dados incompletos ou inexatos
• Solicitar a eliminação ou anonimização dos dados
• Solicitar informação sobre compartilhamento de dados

CONTATO PARA EXERCÍCIO DE DIREITOS:
${researcherName ? `Pesquisador: ${researcherName} — ${researcherEmail || ""}` : "Pesquisador responsável: [conforme informado acima]"}
${cepName ? `CEP: ${cepName} — ${cepContact || ""}` : "CEP: [conforme informado acima]"}
Plataforma: privacidade@arcasearch.com.br

POLÍTICA DE PRIVACIDADE PARA PARTICIPANTES:
https://arca-research.lovable.app/participant-privacy

───────────────────────────────────────────────────────
                    ASSINATURA
───────────────────────────────────────────────────────

${consent.require_signature ? "Assinatura digital: [será coletada eletronicamente]" : "Assinatura: não exigida para este estudo"}

Ao assinar eletronicamente, o participante declara que:
1. Leu e compreendeu todas as seções deste termo
2. Teve oportunidade de esclarecer suas dúvidas
3. Consente voluntariamente em participar da pesquisa
4. Compreende que pode retirar-se a qualquer momento

Data: ___/___/______
Nome do participante: _________________________________
Assinatura: __________________________________________

Data: ___/___/______
Nome do pesquisador: __________________________________
Assinatura: __________________________________________

───────────────────────────────────────────────────────
           INFORMAÇÕES DE SEGURANÇA
───────────────────────────────────────────────────────

• Assinatura eletrônica conforme Lei 14.063/2020
• IP do participante registrado via servidor
• Hash de integridade SHA-256 gerado automaticamente
• Cópia enviada por e-mail ao participante
• Registro em trilha de auditoria (GCP-ICH)

═══════════════════════════════════════════════════════
Este documento foi gerado pela plataforma ARCA.
https://arca-research.lovable.app
═══════════════════════════════════════════════════════
`;

    downloadTextFile(content, `TCLE_completo_v${(consent as any).version || 1}_${surveyId.slice(0, 8)}.txt`);
    toast.success(isPt ? "TCLE completo gerado com metadados legais!" : "Complete consent form generated!");
  };

  // CEP Draft Export (Art. 4.3-8 CONEP)
  const generateCEPDraft = () => {
    if (!consent) {
      toast.error(isPt ? "Crie o TCLE primeiro na aba TCLE" : "Create the consent form first");
      return;
    }

    const today = new Date().toLocaleDateString("pt-BR");
    const sections = (consent.sections as any[]) || [];
    const respondUrl = `${window.location.origin}/survey/respond/[TOKEN]`;

    const content = `
╔═══════════════════════════════════════════════════════╗
║  [RASCUNHO - PARA APRECIAÇÃO DO CEP]                 ║
║  Este documento NÃO é definitivo.                    ║
║  Sujeito a alterações após parecer do Comitê.        ║
╚═══════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════
    TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO
         (Rascunho para Apreciação do CEP)
═══════════════════════════════════════════════════════

Título: ${consent.title || "TCLE"}
Versão: ${(consent as any).version || 1}
Data de geração do rascunho: ${today}

${projectTitle ? `Projeto: ${projectTitle}` : ""}
${researcherName ? `Pesquisador Responsável: ${researcherName}` : ""}
${institution ? `Instituição: ${institution}` : ""}
${researcherEmail ? `Contato do Pesquisador: ${researcherEmail}` : ""}

FORMATO DE APRESENTAÇÃO AO PARTICIPANTE:
O TCLE será apresentado de forma etapizada (seção por seção)
na plataforma ARCA, conforme o Ofício Circular CONEP nº 23/2022.

Link de acesso (será gerado para cada participante):
${respondUrl}

O participante poderá acessar o TCLE pelo link acima, que será
personalizado e único para cada participante convidado.

───────────────────────────────────────────────────────
            SEÇÕES DO TCLE (na ordem de exibição)
───────────────────────────────────────────────────────

[RASCUNHO] AVISO DE PRIVACIDADE DO LOCAL
Antes de iniciar, o participante será solicitado a confirmar
que se encontra em local privado e seguro, conforme Art. 2.2-VII.

${sections.map((s: any, i: number) => `
[RASCUNHO] ${i + 1}. ${s.title || "Seção " + (i + 1)}

${s.content_html || "[Conteúdo a ser preenchido]"}

${s.require_checkbox ? "☐ Declaro que li e compreendi esta seção" : ""}
`).join("\n───────────────────────────────────────────────────────\n")}

───────────────────────────────────────────────────────
              ETAPA FINAL: ASSINATURA
───────────────────────────────────────────────────────

${consent.require_signature ? "Assinatura digital em canvas: EXIGIDA" : "Assinatura digital: NÃO EXIGIDA"}
Nome completo: OBRIGATÓRIO
E-mail para cópia: OPCIONAL (recomendado)

INFORMAÇÕES DE CONTATO DO PESQUISADOR (exibidas durante todo o processo):
${(consent as any).researcher_name || researcherName || "[A ser preenchido]"}
${(consent as any).researcher_email || researcherEmail || "[A ser preenchido]"}
${(consent as any).researcher_phone || "[A ser preenchido]"}
Horários: ${(consent as any).contact_hours || "[A ser preenchido]"}

ACESSO EM PAPEL (Art. 2.3-I):
${(consent as any).paper_access_info || "[Endereço/contato para solicitação de via impressa — a ser preenchido]"}

───────────────────────────────────────────────────────
         RECURSOS DE SEGURANÇA DA PLATAFORMA
───────────────────────────────────────────────────────

• Criptografia TLS 1.3 (trânsito) e AES-256 (repouso)
• Captura de IP via servidor (Edge Function)
• Hash de integridade SHA-256
• Trilha de auditoria GCP-ICH
• Versionamento automático do TCLE
• Link de auto-revogação enviado ao participante
• Co-assinatura do pesquisador (Art. 4.3-7)

───────────────────────────────────────────────────────
              FUNCIONALIDADES PÓS-ASSINATURA
───────────────────────────────────────────────────────

Após assinar, o participante receberá por e-mail:
1. Cópia completa do TCLE assinado
2. Link para auto-revogação do consentimento
3. Informações de contato do pesquisador
4. Link para a Política de Privacidade

╔═══════════════════════════════════════════════════════╗
║  [RASCUNHO - PARA APRECIAÇÃO DO CEP]                 ║
║  Conforme Art. 4.3-8 do Ofício Circular CONEP        ║
║  nº 23/2022, este documento é apresentado ao CEP     ║
║  para apreciação antes da aplicação definitiva.       ║
║                                                       ║
║  O texto acima pode ser copiado (Art. 5.3).          ║
╚═══════════════════════════════════════════════════════╝
`;

    downloadTextFile(content, `RASCUNHO_CEP_TCLE_${surveyId.slice(0, 8)}.txt`);
    toast.success(isPt ? "Rascunho para CEP gerado!" : "CEP draft generated!");
  };

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            {isPt ? "Documentos de Conformidade" : "Compliance Documents"}
          </h2>
        </div>

        <p className="text-sm text-muted-foreground">
          {isPt
            ? "Gere documentos necessários para submissão ao CEP e conformidade com a LGPD. Preencha os dados abaixo para personalizar os documentos."
            : "Generate documents required for ethics committee submission and LGPD compliance."}
        </p>

        {/* Common fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building className="h-4 w-4" />
              {isPt ? "Dados do Projeto" : "Project Details"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isPt ? "Esses dados serão usados em todos os documentos" : "Used across all documents"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {isPt ? "Nome do Pesquisador *" : "Researcher Name *"}
                </Label>
                <Input value={researcherName} onChange={(e) => setResearcherName(e.target.value)} placeholder="Dr. João Silva" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {isPt ? "E-mail do Pesquisador" : "Researcher Email"}
                </Label>
                <Input value={researcherEmail} onChange={(e) => setResearcherEmail(e.target.value)} placeholder="pesquisador@universidade.br" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {isPt ? "Instituição *" : "Institution *"}
                </Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Universidade Federal..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {isPt ? "Título do Projeto *" : "Project Title *"}
                </Label>
                <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="Título da pesquisa" />
              </div>
            </div>

            <Separator />

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isPt ? "Nome do CEP" : "Ethics Committee Name"}
                </Label>
                <Input value={cepName} onChange={(e) => setCepName(e.target.value)} placeholder="CEP da Universidade..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isPt ? "Contato do CEP" : "Committee Contact"}
                </Label>
                <Input value={cepContact} onChange={(e) => setCepContact(e.target.value)} placeholder="cep@universidade.br" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {isPt ? "Nº do Parecer" : "Approval Number"}
                </Label>
                <Input value={parecerNumber} onChange={(e) => setParecerNumber(e.target.value)} placeholder="CAAE 12345678" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document cards */}
        <div className="grid gap-4">
          {/* Carta de Anuência */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {isPt ? "Carta de Anuência da Plataforma" : "Platform Authorization Letter"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {isPt
                          ? "Documento que autoriza o uso da plataforma para a pesquisa. Necessário para submissão ao CEP."
                          : "Document authorizing platform use for research. Required for ethics submission."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">CEP</Badge>
                    <Badge variant="outline" className="text-[10px]">Plataforma Brasil</Badge>
                  </div>
                </div>
                <Button onClick={generateCartaAnuencia} className="shrink-0">
                  <Download className="h-4 w-4 mr-1" />
                  {isPt ? "Gerar" : "Generate"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* TCLE Completo */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {isPt ? "TCLE Completo com Metadados Legais" : "Complete Consent with Legal Metadata"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {isPt
                          ? "PDF do TCLE incluindo base legal LGPD, contato do CEP, nº do parecer e informações de segurança."
                          : "Consent PDF including LGPD legal basis, ethics contact, approval number and security info."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">LGPD</Badge>
                    <Badge variant="outline" className="text-[10px]">Res. 466/2012</Badge>
                    {consent && (
                      <Badge variant="secondary" className="text-[10px]">
                        v{(consent as any).version || 1}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button onClick={generateTCLEWithMetadata} className="shrink-0" disabled={!consent}>
                  <Download className="h-4 w-4 mr-1" />
                  {isPt ? "Gerar" : "Generate"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Certificado de Conformidade */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {isPt ? "Certificado de Conformidade Técnica" : "Technical Compliance Certificate"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {isPt
                          ? "Documento listando todas as medidas de segurança e conformidade da plataforma. Anexe ao protocolo do CEP."
                          : "Document listing all security and compliance measures. Attach to ethics protocol."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">GCP-ICH</Badge>
                    <Badge variant="outline" className="text-[10px]">LGPD</Badge>
                    <Badge variant="outline" className="text-[10px]">CEP</Badge>
                  </div>
                </div>
                <Button onClick={generateComplianceCertificate} className="shrink-0">
                  <Download className="h-4 w-4 mr-1" />
                  {isPt ? "Gerar" : "Generate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isPt ? "Status do Estudo" : "Study Status"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{(consent as any)?.version || "—"}</div>
                <div className="text-xs text-muted-foreground">{isPt ? "Versão TCLE" : "Consent Version"}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{signatureCount}</div>
                <div className="text-xs text-muted-foreground">{isPt ? "Assinaturas" : "Signatures"}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">
                  <Badge variant={survey?.status === "published" ? "default" : "secondary"} className="text-xs">
                    {survey?.status || "draft"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{isPt ? "Status" : "Status"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComplianceDocuments;
