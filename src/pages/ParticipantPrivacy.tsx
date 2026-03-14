import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Shield, Eye, Trash2, Lock, Mail, FileText, Scale } from "lucide-react";

const ParticipantPrivacy = () => {
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Shield className="h-4 w-4" />
            {isPt ? "Política de Privacidade para Participantes" : "Participant Privacy Policy"}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {isPt
              ? "Seus Direitos como Participante de Pesquisa"
              : "Your Rights as a Research Participant"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isPt
              ? "Este documento explica como seus dados pessoais são tratados quando você participa de uma pesquisa científica conduzida através da plataforma ARCA."
              : "This document explains how your personal data is handled when you participate in scientific research conducted through the ARCA platform."}
          </p>
        </div>

        {/* Base Legal */}
        <Section
          icon={<Scale className="h-5 w-5" />}
          title={isPt ? "1. Base Legal do Tratamento" : "1. Legal Basis"}
          content={
            isPt ? (
              <>
                <p>O tratamento dos seus dados pessoais é fundamentado nas seguintes bases legais:</p>
                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li><strong>LGPD Art. 7°, inciso IV</strong> — Realização de estudos por órgão de pesquisa, garantida, sempre que possível, a anonimização dos dados pessoais.</li>
                  <li><strong>LGPD Art. 11, inciso II, alínea "c"</strong> — Para dados pessoais sensíveis: realização de estudos por órgão de pesquisa.</li>
                  <li><strong>Resolução CNS 466/2012</strong> — Pesquisa envolvendo seres humanos com consentimento livre e esclarecido.</li>
                  <li><strong>Resolução CNS 510/2016</strong> — Pesquisa em ciências humanas e sociais.</li>
                  <li><strong>Lei 14.063/2020</strong> — Regulamentação de assinaturas eletrônicas.</li>
                </ul>
              </>
            ) : (
              <>
                <p>Your personal data processing is based on:</p>
                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li><strong>LGPD Art. 7, IV</strong> — Research studies with anonymization whenever possible.</li>
                  <li><strong>LGPD Art. 11, II, "c"</strong> — Sensitive data for research purposes.</li>
                  <li><strong>CNS Resolution 466/2012</strong> — Human research with informed consent.</li>
                  <li><strong>Law 14.063/2020</strong> — Electronic signatures regulation.</li>
                </ul>
              </>
            )
          }
        />

        {/* Dados Coletados */}
        <Section
          icon={<Eye className="h-5 w-5" />}
          title={isPt ? "2. Dados Pessoais Coletados" : "2. Personal Data Collected"}
          content={
            isPt ? (
              <>
                <p>Ao assinar o TCLE e responder ao questionário, os seguintes dados podem ser coletados:</p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <DataCard title="Dados de Identificação" items={["Nome completo", "E-mail (quando fornecido)", "Código anônimo de participante"]} />
                  <DataCard title="Dados Técnicos" items={["Endereço IP", "User-Agent do navegador", "Data e hora da assinatura"]} />
                  <DataCard title="Dados de Pesquisa" items={["Respostas ao questionário", "Dados clínicos (se aplicável)", "Documentos enviados"]} />
                  <DataCard title="Dados de Consentimento" items={["Assinatura digital", "Confirmações por seção", "Hash de integridade (SHA-256)"]} />
                </div>
              </>
            ) : (
              <>
                <p>When signing the consent form and answering the questionnaire, the following data may be collected:</p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <DataCard title="Identification Data" items={["Full name", "Email (when provided)", "Anonymous participant code"]} />
                  <DataCard title="Technical Data" items={["IP address", "Browser User-Agent", "Signature date and time"]} />
                  <DataCard title="Research Data" items={["Questionnaire responses", "Clinical data (if applicable)", "Uploaded documents"]} />
                  <DataCard title="Consent Data" items={["Digital signature", "Section confirmations", "Integrity hash (SHA-256)"]} />
                </div>
              </>
            )
          }
        />

        {/* Finalidade */}
        <Section
          icon={<FileText className="h-5 w-5" />}
          title={isPt ? "3. Finalidade do Tratamento" : "3. Purpose of Processing"}
          content={
            isPt ? (
              <ul className="list-disc ml-6 space-y-2">
                <li>Condução da pesquisa científica conforme descrito no TCLE</li>
                <li>Garantia de rastreabilidade e auditoria conforme exigências do CEP/CONEP e GCP-ICH</li>
                <li>Envio de cópia do TCLE assinado ao participante (Res. 466/2012)</li>
                <li>Análise estatística dos dados (de forma agregada e anonimizada quando possível)</li>
              </ul>
            ) : (
              <ul className="list-disc ml-6 space-y-2">
                <li>Conducting scientific research as described in the consent form</li>
                <li>Ensuring traceability and audit compliance per CEP/CONEP and GCP-ICH</li>
                <li>Sending a signed consent copy to the participant</li>
                <li>Statistical analysis (aggregated and anonymized when possible)</li>
              </ul>
            )
          }
        />

        {/* Segurança */}
        <Section
          icon={<Lock className="h-5 w-5" />}
          title={isPt ? "4. Medidas de Segurança" : "4. Security Measures"}
          content={
            isPt ? (
              <ul className="list-disc ml-6 space-y-2">
                <li>Armazenamento em servidores com criptografia em trânsito (TLS) e em repouso</li>
                <li>Controle de acesso baseado em políticas (Row-Level Security)</li>
                <li>Buckets de armazenamento privados para documentos e consentimentos</li>
                <li>Captura de IP e geração de hash de integridade feitas no servidor (Edge Function), nunca no navegador</li>
                <li>Trilha de auditoria completa com registro de todas as ações (GCP/ICH)</li>
                <li>Separação lógica entre dados de pesquisa e dados de identificação</li>
              </ul>
            ) : (
              <ul className="list-disc ml-6 space-y-2">
                <li>Encrypted storage (TLS in transit, encryption at rest)</li>
                <li>Row-Level Security policies for access control</li>
                <li>Private storage buckets for documents and consents</li>
                <li>Server-side IP capture and integrity hashing (Edge Functions)</li>
                <li>Complete audit trail (GCP/ICH compliance)</li>
                <li>Logical separation between research and identification data</li>
              </ul>
            )
          }
        />

        {/* Direitos */}
        <Section
          icon={<Trash2 className="h-5 w-5" />}
          title={isPt ? "5. Seus Direitos (LGPD Art. 18)" : "5. Your Rights (LGPD Art. 18)"}
          content={
            isPt ? (
              <>
                <p>Como titular dos dados, você tem direito a:</p>
                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li><strong>Revogação do consentimento</strong> — A qualquer momento, sem prejuízo (Art. 8° §5°)</li>
                  <li><strong>Acesso aos dados</strong> — Solicitar uma cópia dos seus dados pessoais</li>
                  <li><strong>Correção de dados</strong> — Solicitar a correção de dados incompletos ou inexatos</li>
                  <li><strong>Eliminação/anonimização</strong> — Solicitar a exclusão ou anonimização dos seus dados pessoais</li>
                  <li><strong>Portabilidade</strong> — Solicitar a transferência dos seus dados</li>
                  <li><strong>Informação sobre compartilhamento</strong> — Saber com quais entidades seus dados são compartilhados</li>
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  Para exercer seus direitos, entre em contato com o pesquisador responsável indicado no TCLE ou com o CEP que aprovou a pesquisa.
                </p>
              </>
            ) : (
              <>
                <p>As a data subject, you have the right to:</p>
                <ul className="list-disc ml-6 space-y-2 mt-3">
                  <li><strong>Consent revocation</strong> — At any time, without prejudice</li>
                  <li><strong>Data access</strong> — Request a copy of your personal data</li>
                  <li><strong>Data correction</strong> — Request correction of incomplete or inaccurate data</li>
                  <li><strong>Deletion/anonymization</strong> — Request deletion or anonymization of your data</li>
                  <li><strong>Portability</strong> — Request data transfer</li>
                  <li><strong>Sharing information</strong> — Know which entities your data is shared with</li>
                </ul>
              </>
            )
          }
        />

        {/* Contato */}
        <Section
          icon={<Mail className="h-5 w-5" />}
          title={isPt ? "6. Contato" : "6. Contact"}
          content={
            isPt ? (
              <div className="space-y-3">
                <p>Para dúvidas sobre o tratamento dos seus dados nesta plataforma:</p>
                <div className="p-4 border rounded-lg bg-muted/50 space-y-1">
                  <p className="font-medium">Plataforma ARCA</p>
                  <p className="text-sm text-muted-foreground">E-mail: privacidade@arcasearch.com.br</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Para questões específicas sobre uma pesquisa, entre em contato com o pesquisador responsável ou o Comitê de Ética em Pesquisa (CEP) indicados no TCLE.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p>For questions about data processing on this platform:</p>
                <div className="p-4 border rounded-lg bg-muted/50 space-y-1">
                  <p className="font-medium">ARCA Platform</p>
                  <p className="text-sm text-muted-foreground">Email: privacidade@arcasearch.com.br</p>
                </div>
              </div>
            )
          }
        />

        <div className="text-center text-xs text-muted-foreground pt-8 border-t">
          {isPt
            ? "Última atualização: Março de 2026"
            : "Last updated: March 2026"}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const Section = ({ icon, title, content }: { icon: React.ReactNode; title: string; content: React.ReactNode }) => (
  <section className="space-y-4">
    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
      {icon} {title}
    </h2>
    <div className="text-sm text-muted-foreground leading-relaxed">{content}</div>
  </section>
);

const DataCard = ({ title, items }: { title: string; items: string[] }) => (
  <div className="p-4 border rounded-lg bg-card">
    <h4 className="font-medium text-sm mb-2 text-foreground">{title}</h4>
    <ul className="text-xs text-muted-foreground space-y-1">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);

export default ParticipantPrivacy;
