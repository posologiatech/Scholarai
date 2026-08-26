import {
  Search, Table, FileText, ClipboardCheck, ShieldCheck, Palette,
  BrainCircuit, Network, GitBranch, Filter, FlaskConical, BookOpen,
  ClipboardList, Shield, UserX, FileSignature, UsersRound, Rocket,
  GraduationCap, PenTool, Activity, Microscope, Hash,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import AnimatedSection from "./AnimatedSection";

const FeaturesSection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const features = [
    {
      icon: Search,
      title: pt ? "Busca Semântica Multi-Fonte" : "Multi-Source Semantic Search",
      desc: pt
        ? "Perguntas em linguagem natural buscando simultaneamente em Semantic Scholar, PubMed, OpenAlex e Europe PMC — 200M+ artigos."
        : "Natural language queries searching simultaneously across Semantic Scholar, PubMed, OpenAlex and Europe PMC — 200M+ papers.",
      badge: null,
    },
    {
      icon: Filter,
      title: pt ? "Busca Booleana Avançada" : "Advanced Boolean Search",
      desc: pt
        ? "Construtor visual de queries com AND/OR/NOT, termos MeSH e tradução automática para PubMed/Scopus. Estratégia de busca exportável."
        : "Visual query builder with AND/OR/NOT, MeSH terms, and automatic translation to PubMed/Scopus syntax. Exportable search strategy.",
      badge: null,
    },
    {
      icon: ClipboardCheck,
      title: pt ? "Revisão Sistemática PRISMA" : "PRISMA Systematic Review",
      desc: pt
        ? "Fluxo completo de 6 etapas: pergunta PICO, coleta com importação RIS/BibTeX, triagem AI, extração, avaliação de qualidade e relatório com diagrama PRISMA 2020."
        : "Complete 6-step workflow: PICO question, collection with RIS/BibTeX import, AI screening, extraction, quality assessment, and PRISMA 2020 report.",
      badge: null,
    },
    {
      icon: GitBranch,
      title: "Active Learning",
      desc: pt
        ? "Após ~20 triagens manuais, a IA aprende seus padrões e re-ranqueia os restantes por probabilidade de inclusão. Reduz esforço em até 95%."
        : "After ~20 manual screenings, AI learns your patterns and re-ranks remaining papers by inclusion probability. Reduces effort by up to 95%.",
      badge: null,
    },
    {
      icon: FlaskConical,
      title: pt ? "Avaliação de Qualidade" : "Quality Assessment",
      desc: pt
        ? "Checklists padronizados (CASP, Newcastle-Ottawa, Jadad, ROBINS-I) com avaliação automática por IA e override manual por domínio."
        : "Standardized checklists (CASP, Newcastle-Ottawa, Jadad, ROBINS-I) with automatic AI assessment and manual domain-level override.",
      badge: null,
    },
    {
      icon: Table,
      title: pt ? "Extração Inteligente" : "Smart Extraction",
      desc: pt
        ? "IA extrai dados de cada artigo com prompts customizados — amostra, metodologia, resultados — em colunas comparativas com cache inteligente."
        : "AI extracts data from each paper with custom prompts — sample size, methodology, results — in comparative columns with smart caching.",
      badge: null,
    },
    {
      icon: PenTool,
      title: pt ? "Assistente de Escrita Científica" : "Scientific Writing Assistant",
      desc: pt
        ? "Editor de 3 painéis com fontes da Library, DataMind e PDFs. Gera rascunhos, reformula, verifica consistência e insere citações em APA, Vancouver e ABNT."
        : "3-panel editor with Library, DataMind and PDF sources. Generates drafts, rephrases, checks consistency and inserts citations in APA, Vancouver and ABNT.",
      badge: null,
    },
    {
      icon: GraduationCap,
      title: pt ? "Consultor CAPES APC" : "CAPES APC Advisor",
      desc: pt
        ? "IA identifica periódicos com APC paga pela CAPES (7 editoras), orienta submissão, formata o artigo e fornece links da Portaria 120/2024."
        : "AI identifies journals with CAPES-paid APC (7 publishers), guides submission, formats the article and provides Portaria 120/2024 links.",
      badge: "NEW",
    },
    {
      icon: FileText,
      title: pt ? "Relatórios Acadêmicos" : "Academic Reports",
      desc: pt
        ? "Síntese de dezenas de artigos em ~3000 palavras com citações por frase, diagrama PRISMA e exportação Markdown/PDF (A4)."
        : "Synthesis of dozens of papers into ~3000 words with sentence-level citations, PRISMA diagram, and Markdown/PDF export (A4).",
      badge: null,
    },
    {
      icon: BrainCircuit,
      title: "DataMind",
      desc: pt
        ? "Análise de dados conversacional com Python/R no navegador. Upload CSV/Excel, gráficos automáticos, dashboards e pipelines reutilizáveis."
        : "Conversational data analysis with Python/R in browser. Upload CSV/Excel, auto charts, dashboards, and reusable pipelines.",
      badge: null,
    },
    {
      icon: Activity,
      title: "DataSUS",
      desc: pt
        ? "Consulta a dados epidemiológicos brasileiros (SIM, SINASC, SINAN) com IA. Gera análises, boletins e alertas epidemiológicos automáticos."
        : "Query Brazilian epidemiological data (SIM, SINASC, SINAN) with AI. Generate analyses, bulletins and automatic epidemiological alerts.",
      badge: "NEW",
    },
    {
      icon: Network,
      title: pt ? "Grafo de Conhecimento" : "Knowledge Graph",
      desc: pt
        ? "Mapa visual interativo das conexões entre artigos, autores e conceitos. Explore a rede de citações e descubra gaps na literatura."
        : "Interactive visual map of connections between papers, authors, and concepts. Explore citation networks and discover literature gaps.",
      badge: null,
    },
    {
      icon: Microscope,
      title: pt ? "Gaps de Pesquisa" : "Research Gaps",
      desc: pt
        ? "IA analisa a literatura e identifica lacunas, contradições e oportunidades de pesquisa não exploradas na sua área."
        : "AI analyzes the literature and identifies gaps, contradictions and unexplored research opportunities in your field.",
      badge: "NEW",
    },
    {
      icon: ShieldCheck,
      title: pt ? "Verificação de Referências" : "Reference Check",
      desc: pt
        ? "Verifique se as referências do seu manuscrito foram retratadas, contestadas ou têm irregularidades. Garante integridade bibliográfica."
        : "Check if your manuscript's references have been retracted, contested, or have irregularities. Ensures bibliographic integrity.",
      badge: null,
    },
    {
      icon: BookOpen,
      title: pt ? "Workspaces Colaborativos" : "Collaborative Workspaces",
      desc: pt
        ? "Convide coautores, orientadores e revisores para trabalhar juntos. Anotações por artigo, feed de atividades e papéis de acesso."
        : "Invite co-authors, advisors, and reviewers to work together. Per-paper annotations, activity feed, and access roles.",
      badge: null,
    },
    {
      icon: Palette,
      title: pt ? "Ilustrações com IA" : "AI Illustrations",
      desc: pt
        ? "Gere diagramas científicos profissionais no estilo BioRender com inteligência artificial para suas publicações."
        : "Generate professional BioRender-style scientific diagrams with AI for your publications.",
      badge: null,
    },
    {
      icon: ClipboardList,
      title: pt ? "Coleta de Dados" : "Data Collection",
      desc: pt
        ? "Construtor de questionários com 6 tipos de questão, lógica condicional, distribuição via QR Code e análise integrada ao DataMind."
        : "Survey builder with 6 question types, conditional logic, QR Code distribution, and DataMind-integrated analysis.",
      badge: null,
    },
    {
      icon: Hash,
      title: pt ? "Integridade de Dados" : "Data Integrity",
      desc: pt
        ? "Hash SHA-256 por resposta, versionamento de edições auditadas, verificação de integridade e cadeia de hashes criptográficos para conformidade CEP."
        : "SHA-256 hash per response, audited edit versioning, integrity verification and cryptographic hash chain for ethics compliance.",
      badge: "NEW",
    },
    {
      icon: FileSignature,
      title: pt ? "TCLE & Pesquisa Clínica" : "Consent & Clinical Research",
      desc: pt
        ? "Consentimento digital com assinatura, eCRF longitudinal com visitas (T0, T1...), validação clínica em tempo real e geração de PDF com hash de integridade."
        : "Digital consent with signature, longitudinal eCRF with visits (T0, T1...), real-time clinical validation, and PDF generation with integrity hash.",
      badge: null,
    },
    {
      icon: Shield,
      title: pt ? "Conformidade CEP/LGPD" : "CEP/LGPD Compliance",
      desc: pt
        ? "Trilha de auditoria GCP/ICH, captura de IP server-side, versionamento de TCLE, revogação de consentimento e envio automático de cópia ao participante."
        : "GCP/ICH audit trail, server-side IP capture, consent versioning, consent revocation, and automatic copy delivery to participants.",
      badge: null,
    },
    {
      icon: UserX,
      title: pt ? "Anonimização de Dados" : "Data Anonymization",
      desc: pt
        ? "Exclusão de dados pessoais (LGPD Art. 18) com preservação de dados estatísticos anônimos e registro completo na trilha de auditoria."
        : "Personal data deletion (LGPD Art. 18) with anonymous statistical data preservation and full audit trail logging.",
      badge: null,
    },
    {
      icon: UsersRound,
      title: pt ? "Equipe de Pesquisa" : "Research Team",
      desc: pt
        ? "Adicione coordenadores, pesquisadores colaboradores e estudantes (graduação/pós) à equipe do estudo. Membros acessam formulários e dados de coleta."
        : "Add coordinators, collaborators, and students (undergrad/grad) to your study team. Members access forms and data collection.",
      badge: null,
    },
    {
      icon: Rocket,
      title: pt ? "Pipeline de Atualizações" : "Update Pipeline",
      desc: pt
        ? "Sistema de changelog e roadmap integrado. Acompanhe funcionalidades lançadas, planejadas e ideias futuras em tempo real."
        : "Integrated changelog and roadmap system. Track released features, planned items, and future ideas in real time.",
      badge: null,
    },
  ];

  return (
    <section className="border-t border-border/40 py-20 md:py-28 bg-muted/20">
      <div className="container mx-auto max-w-6xl px-4">
        <AnimatedSection>
          <div className="mb-14 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              {pt ? "Tudo que você precisa para pesquisar melhor" : "Everything you need to research better"}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {pt
                ? "23 ferramentas integradas de IA cobrindo cada etapa da pesquisa acadêmica e clínica — da busca à publicação, com conformidade CEP/LGPD."
                : "23 integrated AI tools covering every stage of academic and clinical research — from search to publication, with CEP/LGPD compliance."}
            </p>
          </div>
        </AnimatedSection>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f, i) => (
            <AnimatedSection key={f.title} delay={i * 0.05}>
              <div className="group relative flex h-full flex-col rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/[0.04]">
                {f.badge && (
                  <span className="absolute right-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {f.badge}
                  </span>
                )}
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
                  <f.icon className="h-5 w-5 text-foreground/70 transition-colors group-hover:text-primary" />
                </div>
                <h3 className="mb-2 font-display text-sm font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
