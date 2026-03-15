import { useState } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Search, BookOpen, Zap, Table, FileText, BarChart3, Image, ShieldCheck,
  ChevronRight, GraduationCap, Download, Globe, Sparkles, CheckCircle2,
  ArrowRight, Layers, Settings, Users, Upload, BrainCircuit, GitBranch,
  Database, PenTool, Filter, Network, AlertTriangle, BookMarked, FlaskConical,
  MessageSquare, Share2, LayoutDashboard, Workflow, ClipboardCheck, FileSearch,
  ClipboardList, QrCode, GripVertical, Wand2, Shield, FileSignature, UserX,
  Stethoscope, Server, Code, Lock, Cpu, HardDrive, Key, Blocks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  category: string;
  content: { heading: string; body: string; tip?: string }[];
}

const Docs = () => {
  const { locale } = useLanguage();
  const [activeSection, setActiveSection] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  const pt = locale === "pt";

  const sections: DocSection[] = [
    {
      id: "getting-started",
      icon: Zap,
      title: pt ? "Primeiros Passos" : "Getting Started",
      category: pt ? "Início" : "Start",
      content: [
        {
          heading: pt ? "Criando sua conta" : "Creating your account",
          body: pt
            ? "Acesse o ScholarAI e clique em 'Comece Grátis'. Preencha seu nome, email e senha. Você receberá um email de confirmação — clique no link para ativar sua conta. Após a ativação, você será redirecionado ao Dashboard principal."
            : "Go to ScholarAI and click 'Get Started Free'. Fill in your name, email, and password. You'll receive a confirmation email — click the link to activate your account.",
        },
        {
          heading: pt ? "Navegando pelo Dashboard" : "Navigating the Dashboard",
          body: pt
            ? "O Dashboard é seu ponto de partida. Na barra lateral você encontra links para todas as funcionalidades: Busca, Biblioteca, Extração, Relatórios, DataMind, Revisão Sistemática, Grafo de Conhecimento e mais. No centro, há um campo de busca inteligente onde você pode fazer sua primeira pesquisa em linguagem natural."
            : "The Dashboard is your starting point. The sidebar contains links to all features: Search, Library, Extraction, Reports, DataMind, Systematic Review, Knowledge Graph and more. In the center, there's a smart search field for your first natural language search.",
        },
        {
          heading: pt ? "Sua primeira pesquisa" : "Your first search",
          body: pt
            ? "Digite uma pergunta de pesquisa no campo central do Dashboard. Por exemplo: 'Quais os efeitos do exercício aeróbico na depressão em idosos?'. O sistema buscará automaticamente em múltiplas bases de dados científicas (Semantic Scholar, PubMed, OpenAlex, Europe PMC) e retornará os artigos mais relevantes organizados em uma tabela interativa."
            : "Type a research question in the Dashboard's central field. For example: 'What are the effects of aerobic exercise on depression in elderly people?'. The system automatically searches multiple scientific databases (Semantic Scholar, PubMed, OpenAlex, Europe PMC) and returns relevant papers in an interactive table.",
          tip: pt
            ? "Use perguntas em linguagem natural — o sistema entende semântica, não apenas palavras-chave."
            : "Use natural language questions — the system understands semantics, not just keywords.",
        },
      ],
    },
    {
      id: "search",
      icon: Search,
      title: pt ? "Busca Semântica" : "Semantic Search",
      category: pt ? "Pesquisa" : "Research",
      content: [
        {
          heading: pt ? "Como funciona a busca" : "How search works",
          body: pt
            ? "Diferente de buscas tradicionais por palavras-chave, o ScholarAI usa embeddings semânticos para entender o significado da sua pergunta. Isso significa que você pode perguntar em linguagem natural e o sistema encontrará artigos relevantes mesmo que usem terminologia diferente. A busca consulta simultaneamente Semantic Scholar (200M+ papers), PubMed, OpenAlex e Europe PMC."
            : "Unlike traditional keyword searches, ScholarAI uses semantic embeddings to understand the meaning of your question. You can ask in natural language and the system finds relevant papers even if they use different terminology. It simultaneously queries Semantic Scholar (200M+ papers), PubMed, OpenAlex, and Europe PMC.",
        },
        {
          heading: pt ? "Filtros avançados" : "Advanced filters",
          body: pt
            ? "Na página de resultados, clique em 'Filtros' para refinar sua busca. Você pode filtrar por: período de publicação, tipo de estudo (RCT, revisão, meta-análise), fonte específica, número mínimo de citações, Open Access, autor específico e palavras-chave no abstract. Os filtros são aplicados em tempo real e podem ser combinados."
            : "On the results page, click 'Filters' to refine your search. Filter by: publication period, study type (RCT, review, meta-analysis), specific source, minimum citations, Open Access, specific author, and abstract keywords. Filters are applied in real-time and can be combined.",
        },
        {
          heading: pt ? "Ordenação e busca interna" : "Sorting and internal search",
          body: pt
            ? "Ordene os resultados por relevância (padrão), mais recente ou mais citado. Use o botão 'Buscar' na barra de ferramentas para pesquisar dentro dos resultados já retornados, sem refazer a busca completa."
            : "Sort results by relevance (default), most recent, or most cited. Use the 'Search' button in the toolbar to search within already returned results, without redoing the full search.",
        },
      ],
    },
    {
      id: "columns",
      icon: Table,
      title: pt ? "Colunas de Extração" : "Extraction Columns",
      category: pt ? "Pesquisa" : "Research",
      content: [
        {
          heading: pt ? "O que são colunas" : "What are columns",
          body: pt
            ? "Colunas são campos de dados que a IA extrai automaticamente de cada artigo. Por padrão, inclui uma coluna 'Summary', mas você pode adicionar colunas customizadas para extrair qualquer informação: metodologia, tamanho da amostra, resultados principais, limitações, intervenções, desfechos, etc."
            : "Columns are data fields that AI automatically extracts from each paper. By default, it includes a 'Summary' column, but you can add custom columns to extract any information: methodology, sample size, main results, limitations, interventions, outcomes, etc.",
        },
        {
          heading: pt ? "Adicionando colunas com prompts" : "Adding columns with prompts",
          body: pt
            ? "Clique em 'Adicionar coluna' e defina um nome e opcionalmente um prompt personalizado que diz à IA exatamente o que extrair. Exemplo: coluna 'Metodologia' com prompt 'Descreva o desenho do estudo, incluindo randomização, cegamento e tamanho da amostra'. Quanto mais específico o prompt, melhor a extração."
            : "Click 'Add column' and define a name and optionally a custom prompt telling the AI exactly what to extract. Example: column 'Methodology' with prompt 'Describe the study design, including randomization, blinding, and sample size'. The more specific the prompt, the better the extraction.",
          tip: pt
            ? "Prompts descritivos com exemplos do que esperar produzem extrações muito mais precisas."
            : "Descriptive prompts with examples of expected output produce much more accurate extractions.",
        },
        {
          heading: pt ? "Cache inteligente" : "Smart cache",
          body: pt
            ? "Extrações são cacheadas automaticamente. Se você fizer a mesma busca novamente ou ativar uma coluna já extraída, os dados carregam instantaneamente do cache (ícone ⚡). Isso economiza tempo e recursos significativamente."
            : "Extractions are automatically cached. If you search again or activate a previously extracted column, data loads instantly from cache (⚡ icon). This saves significant time and resources.",
        },
        {
          heading: pt ? "Citações e fontes" : "Citations and sources",
          body: pt
            ? "Cada dado extraído pode conter um trecho do texto original do artigo como referência. Passe o mouse sobre um valor extraído para ver o contexto original. Isso garante transparência e permite verificar a precisão da extração."
            : "Each extracted value can contain an excerpt from the original paper text as reference. Hover over an extracted value to see the original context. This ensures transparency and allows verifying extraction accuracy.",
        },
      ],
    },
    {
      id: "library",
      icon: BookOpen,
      title: pt ? "Biblioteca" : "Library",
      category: pt ? "Pesquisa" : "Research",
      content: [
        {
          heading: pt ? "Salvando pesquisas" : "Saving searches",
          body: pt
            ? "Após fazer uma busca e configurar colunas, clique em 'Salvar na biblioteca' na barra de ferramentas. Isso salva a busca completa incluindo todos os papers, colunas configuradas e dados extraídos. Você pode acessar suas pesquisas salvas a qualquer momento."
            : "After searching and configuring columns, click 'Save to library' in the toolbar. This saves the complete search including all papers, configured columns, and extracted data. Access saved searches anytime.",
        },
        {
          heading: pt ? "Gerenciando a biblioteca" : "Managing the library",
          body: pt
            ? "Na Biblioteca, veja todas as pesquisas salvas com a query original, data de criação e número de papers. Clique em uma pesquisa para reabrir os resultados completos com todas as colunas e dados preservados."
            : "In the Library, see all saved searches with original query, creation date, and paper count. Click a search to reopen full results with all columns and data preserved.",
        },
      ],
    },
    {
      id: "systematic-review",
      icon: ClipboardCheck,
      title: pt ? "Revisão Sistemática" : "Systematic Review",
      category: pt ? "Revisão" : "Review",
      content: [
        {
          heading: pt ? "Fluxo de 6 etapas" : "6-step workflow",
          body: pt
            ? "O módulo de Revisão Sistemática segue o protocolo PRISMA 2020 com 6 etapas guiadas: 1) Pergunta de Pesquisa — defina sua questão usando o formato PICO; 2) Coleta — busque via API, use o construtor de busca booleana ou importe artigos de bases externas (RIS, BibTeX, CSV); 3) Triagem — aplique critérios de inclusão/exclusão com suporte de IA e Active Learning; 4) Extração — extraia dados padronizados dos artigos incluídos; 5) Qualidade — avalie a qualidade metodológica com checklists padronizados (CASP, Newcastle-Ottawa, Jadad, ROBINS-I); 6) Relatório — gere o relatório final com diagrama PRISMA."
            : "The Systematic Review module follows the PRISMA 2020 protocol with 6 guided steps: 1) Research Question — define your question using PICO format; 2) Collection — search via API, use the boolean query builder, or import papers from external databases (RIS, BibTeX, CSV); 3) Screening — apply inclusion/exclusion criteria with AI support and Active Learning; 4) Extraction — extract standardized data from included papers; 5) Quality — assess methodological quality with standardized checklists (CASP, Newcastle-Ottawa, Jadad, ROBINS-I); 6) Report — generate the final report with PRISMA diagram.",
        },
        {
          heading: pt ? "Busca booleana avançada" : "Advanced boolean search",
          body: pt
            ? "O construtor de busca booleana permite criar estratégias de busca complexas e reproduzíveis usando operadores AND/OR/NOT. Organize sua busca em blocos conceituais (ex: População, Intervenção, Desfecho), adicione sinônimos e termos MeSH para cada conceito, e combine-os com operadores lógicos. O sistema traduz automaticamente sua query para a sintaxe de cada base de dados (PubMed, Scopus, genérica) e gera uma 'Estratégia de Busca' formal exportável em Markdown — requisito essencial para revisões publicáveis."
            : "The boolean query builder lets you create complex, reproducible search strategies using AND/OR/NOT operators. Organize your search into concept blocks (e.g., Population, Intervention, Outcome), add synonyms and MeSH terms for each concept, and combine them with logical operators. The system automatically translates your query into each database's syntax (PubMed, Scopus, generic) and generates a formal exportable 'Search Strategy' in Markdown — an essential requirement for publishable reviews.",
          tip: pt
            ? "Use o campo MeSH para adicionar descritores controlados do PubMed. Isso aumenta a sensibilidade e a reproduzibilidade da sua busca."
            : "Use the MeSH field to add PubMed controlled descriptors. This increases the sensitivity and reproducibility of your search.",
        },
        {
          heading: pt ? "Importação de bases externas (RIS/BibTeX)" : "External database import (RIS/BibTeX)",
          body: pt
            ? "Na etapa de Coleta, além da busca via API, você pode importar artigos de arquivos RIS (Scopus, Web of Science), BibTeX (Google Scholar, Zotero), CSV e EndNote XML. Basta clicar em 'Importar arquivos' e selecionar seus arquivos. Múltiplos arquivos podem ser importados simultaneamente. A origem de cada artigo é indicada por badges na lista."
            : "In the Collection step, besides API search, you can import papers from RIS files (Scopus, Web of Science), BibTeX (Google Scholar, Zotero), CSV, and EndNote XML. Click 'Import files' and select your files. Multiple files can be imported simultaneously. Each paper's source is shown with badges.",
          tip: pt
            ? "Exporte do Scopus como .ris e do Google Scholar como .bib para melhor compatibilidade."
            : "Export from Scopus as .ris and from Google Scholar as .bib for best compatibility.",
        },
        {
          heading: pt ? "Deduplicação automática" : "Automatic deduplication",
          body: pt
            ? "Ao combinar resultados de múltiplas fontes ou importações, o sistema detecta e remove duplicatas automaticamente usando correspondência exata de DOI e similaridade fuzzy de títulos (Jaccard ≥ 0.85). Um painel mostra quantas duplicatas foram encontradas e quais grupos foram mesclados."
            : "When combining results from multiple sources or imports, the system automatically detects and removes duplicates using exact DOI matching and fuzzy title similarity (Jaccard ≥ 0.85). A panel shows how many duplicates were found and which groups were merged.",
        },
        {
          heading: pt ? "Triagem com IA" : "AI-powered screening",
          body: pt
            ? "Na etapa de Triagem, a IA gera critérios de inclusão/exclusão automaticamente com base na sua pergunta de pesquisa. Você pode editar, adicionar ou remover critérios. A triagem segue o princípio INCLUSIVO: na dúvida, o artigo é incluído. Cada artigo recebe um score de inclusão (0-100%) e pode ser 'Incluído', 'Talvez' ou 'Excluído'. Você pode sobrescrever qualquer decisão da IA manualmente."
            : "In the Screening step, AI automatically generates inclusion/exclusion criteria based on your research question. You can edit, add, or remove criteria. Screening follows the INCLUSIVE principle: when in doubt, the paper is included. Each paper gets an inclusion score (0-100%) and can be 'Included', 'Maybe', or 'Excluded'. You can manually override any AI decision.",
        },
        {
          heading: pt ? "Active Learning / Triagem Adaptativa" : "Active Learning / Adaptive Screening",
          body: pt
            ? "Após triar manualmente pelo menos 10 artigos (incluindo inclusões e exclusões), o sistema de Active Learning se ativa. Inspirado no ASReview, ele aprende com suas decisões manuais e re-ranqueia os artigos restantes por probabilidade de inclusão. Artigos mais provavelmente relevantes são priorizados no topo da fila, com badges 'AI Priority' indicando o score de prioridade. Isso pode reduzir o esforço de triagem em 70-95%. O sistema também calcula o Kappa de Cohen para medir a concordância entre suas decisões e as predições da IA."
            : "After manually screening at least 10 papers (including both inclusions and exclusions), the Active Learning system activates. Inspired by ASReview, it learns from your manual decisions and re-ranks remaining papers by inclusion probability. Most likely relevant papers are prioritized at the top of the queue, with 'AI Priority' badges showing the priority score. This can reduce screening effort by 70-95%. The system also calculates Cohen's Kappa to measure agreement between your decisions and AI predictions.",
          tip: pt
            ? "Triar os primeiros 20-30 artigos com atenção produz um modelo de Active Learning muito mais preciso para os restantes."
            : "Carefully screening the first 20-30 papers produces a much more accurate Active Learning model for the rest.",
        },
        {
          heading: pt ? "Avaliação de Qualidade Metodológica" : "Methodological Quality Assessment",
          body: pt
            ? "A nova etapa de Qualidade (entre Extração e Relatório) permite avaliar a qualidade metodológica dos estudos incluídos usando checklists padronizados internacionalmente reconhecidos: CASP RCT (ensaios clínicos randomizados), Newcastle-Ottawa Scale (estudos observacionais), Jadad Scale (qualidade de RCTs) e ROBINS-I (risco de viés em estudos não randomizados). A IA realiza uma avaliação inicial de cada domínio do checklist selecionado, atribuindo classificações de 'Baixo', 'Moderado' ou 'Alto' risco. O revisor pode sobrescrever manualmente qualquer avaliação. Os resultados são apresentados em uma tabela visual com indicadores coloridos por domínio e paper."
            : "The new Quality step (between Extraction and Report) lets you assess the methodological quality of included studies using internationally recognized standardized checklists: CASP RCT (randomized controlled trials), Newcastle-Ottawa Scale (observational studies), Jadad Scale (RCT quality), and ROBINS-I (risk of bias in non-randomized studies). AI performs an initial assessment of each domain in the selected checklist, assigning 'Low', 'Moderate', or 'High' risk ratings. The reviewer can manually override any assessment. Results are displayed in a visual table with color-coded indicators per domain and paper.",
          tip: pt
            ? "Escolha o checklist adequado ao tipo de estudo predominante na sua revisão. Use CASP para RCTs, Newcastle-Ottawa para coorte/caso-controle e ROBINS-I para intervenções não randomizadas."
            : "Choose the checklist appropriate to the predominant study type in your review. Use CASP for RCTs, Newcastle-Ottawa for cohort/case-control, and ROBINS-I for non-randomized interventions.",
        },
        {
          heading: pt ? "Diagrama PRISMA 2020 interativo" : "Interactive PRISMA 2020 diagram",
          body: pt
            ? "O relatório final inclui um diagrama de fluxo PRISMA 2020 gerado automaticamente, mostrando o número de artigos em cada etapa: identificação, deduplicação, triagem, avaliação de qualidade e inclusão final. O diagrama se atualiza em tempo real conforme você avança nas etapas e pode ser exportado como SVG ou PNG para inclusão direta em publicações."
            : "The final report includes an automatically generated PRISMA 2020 flow diagram showing the number of papers at each stage: identification, deduplication, screening, quality assessment, and final inclusion. The diagram updates in real-time as you progress and can be exported as SVG or PNG for direct inclusion in publications.",
        },
        {
          heading: pt ? "Relatório acadêmico" : "Academic report",
          body: pt
            ? "O relatório gerado segue normas acadêmicas com ~3000 palavras, incluindo: introdução, métodos (com estratégia de busca documentada), resultados, discussão, conclusão, diagrama PRISMA, tabela de características dos estudos, avaliação de qualidade e lista de referências formatadas. Disponível para download em Markdown e PDF (A4)."
            : "The generated report follows academic standards with ~3000 words, including: introduction, methods (with documented search strategy), results, discussion, conclusion, PRISMA diagram, study characteristics table, quality assessment, and formatted reference list. Available for download in Markdown and PDF (A4).",
        },
      ],
    },
    {
      id: "extraction",
      icon: Upload,
      title: pt ? "Extração de PDFs" : "PDF Extraction",
      category: pt ? "Pesquisa" : "Research",
      content: [
        {
          heading: pt ? "Upload e processamento de PDFs" : "Upload and PDF processing",
          body: pt
            ? "Na página 'Extração', faça upload de seus artigos em PDF (até 20MB cada). O sistema aceita múltiplos arquivos simultaneamente. Após o upload, os PDFs são processados e o texto é extraído automaticamente para análise com IA."
            : "On the 'Extraction' page, upload your papers in PDF format (up to 20MB each). The system accepts multiple files simultaneously. After upload, PDFs are processed and text is automatically extracted for AI analysis.",
        },
        {
          heading: pt ? "Wizard de extração em 4 etapas" : "4-step extraction wizard",
          body: pt
            ? "O processo segue 4 etapas guiadas: 1) Upload PDFs — envie os artigos; 2) Pergunta — defina sua pergunta de pesquisa para dar contexto à IA; 3) Colunas — adicione colunas com prompts para extração; 4) Extrair — execute a extração. Cada etapa possui indicador visual de progresso."
            : "The process follows 4 guided steps: 1) Upload PDFs — send articles; 2) Question — define your research question to give AI context; 3) Columns — add columns with prompts for extraction; 4) Extract — run extraction. Each step has a visual progress indicator.",
        },
        {
          heading: pt ? "Texto completo vs. abstract" : "Full text vs. abstract",
          body: pt
            ? "O sistema prioriza a extração a partir do texto completo dos artigos quando disponível via Europe PMC ou Unpaywall. Quando o texto integral não está disponível, a extração é feita a partir do abstract com a nota '(inferido do abstract)' para transparência. PDFs enviados pelo usuário sempre usam o texto completo."
            : "The system prioritizes extraction from full paper text when available via Europe PMC or Unpaywall. When full text isn't available, extraction uses the abstract with the note '(inferred from abstract)' for transparency. User-uploaded PDFs always use full text.",
        },
      ],
    },
    {
      id: "datamind",
      icon: BrainCircuit,
      title: "DataMind",
      category: pt ? "Análise" : "Analysis",
      content: [
        {
          heading: pt ? "O que é o DataMind" : "What is DataMind",
          body: pt
            ? "DataMind é uma plataforma de análise de dados com interface conversacional inspirada no Julius.ai. Faça perguntas em linguagem natural sobre seus dados e receba análises completas com gráficos, tabelas e insights estatísticos. Suporta Python (Pyodide) e R (WebR) no navegador."
            : "DataMind is a conversational data analysis platform inspired by Julius.ai. Ask natural language questions about your data and receive complete analyses with charts, tables, and statistical insights. Supports Python (Pyodide) and R (WebR) in the browser.",
        },
        {
          heading: pt ? "Upload e análise de dados" : "Data upload and analysis",
          body: pt
            ? "Faça upload de arquivos CSV, Excel (.xlsx) ou JSON. O sistema detecta automaticamente o schema (colunas, tipos, distribuição) e sugere análises relevantes. As tabelas usam estética de BI com cabeçalhos estilizados, linhas zebra, paginação e formatação inteligente (badges coloridos para categorias, alinhamento numérico, valores irrelevantes como traços)."
            : "Upload CSV, Excel (.xlsx), or JSON files. The system automatically detects schema (columns, types, distribution) and suggests relevant analyses. Tables use BI aesthetics with styled headers, zebra rows, pagination, and smart formatting (colored badges for categories, numeric alignment, irrelevant values as dashes).",
        },
        {
          heading: pt ? "Dashboards e compartilhamento" : "Dashboards and sharing",
          body: pt
            ? "Fixe gráficos e tabelas em Dashboards personalizados. Cada dashboard pode ser compartilhado via link público. Organize análises em pipelines reproduzíveis que podem ser salvos e aplicados a novos datasets."
            : "Pin charts and tables to custom Dashboards. Each dashboard can be shared via public link. Organize analyses into reproducible pipelines that can be saved and applied to new datasets.",
        },
        {
          heading: pt ? "Conexão SQL direta" : "Direct SQL connection",
          body: pt
            ? "Conecte-se diretamente a bancos de dados PostgreSQL ou MySQL. Faça perguntas em linguagem natural e o DataMind gera queries SQL automaticamente (NL-to-SQL), executa e visualiza os resultados."
            : "Connect directly to PostgreSQL or MySQL databases. Ask natural language questions and DataMind automatically generates SQL queries (NL-to-SQL), executes, and visualizes results.",
        },
        {
          heading: pt ? "Limpeza de dados" : "Data cleaning",
          body: pt
            ? "O pipeline de limpeza detecta automaticamente problemas como outliers, valores faltantes, tipos incorretos e inconsistências. Aplique transformações com um clique ou personalize regras de limpeza. Cada transformação é rastreada e pode ser revertida."
            : "The cleaning pipeline automatically detects issues like outliers, missing values, incorrect types, and inconsistencies. Apply transformations with one click or customize cleaning rules. Each transformation is tracked and can be reverted.",
        },
        {
          heading: pt ? "Versionamento e colaboração" : "Versioning and collaboration",
          body: pt
            ? "O DataMind inclui um sistema de versionamento (Analysis Git) que permite criar checkpoints, branches e comparar resultados entre versões. Compartilhe análises com colegas via email com permissões de visualização ou edição."
            : "DataMind includes a versioning system (Analysis Git) that lets you create checkpoints, branches, and compare results between versions. Share analyses with colleagues via email with view or edit permissions.",
        },
      ],
    },
    {
      id: "knowledge-graph",
      icon: Network,
      title: pt ? "Grafo de Conhecimento" : "Knowledge Graph",
      category: pt ? "Análise" : "Analysis",
      content: [
        {
          heading: pt ? "Visualização de relações" : "Relationship visualization",
          body: pt
            ? "O Grafo de Conhecimento mostra visualmente como artigos se relacionam através de citações. Cada nó representa um paper e as arestas representam citações entre eles, classificadas como 'supporting' (verde), 'contrasting' (vermelho) ou 'mentioning' (cinza). Interaja com o grafo arrastando, fazendo zoom e clicando em nós."
            : "The Knowledge Graph visually shows how papers relate through citations. Each node represents a paper and edges represent citations between them, classified as 'supporting' (green), 'contrasting' (red), or 'mentioning' (gray). Interact by dragging, zooming, and clicking nodes.",
        },
        {
          heading: pt ? "Análise de citações" : "Citation analysis",
          body: pt
            ? "Selecione um paper no grafo para ver detalhes: total de citações recebidas, breakdown por tipo (supporting, contrasting, mentioning), abstract e link para o artigo original. A classificação de citações é feita automaticamente por IA analisando o contexto de cada citação."
            : "Select a paper in the graph to see details: total citations received, breakdown by type (supporting, contrasting, mentioning), abstract, and link to the original paper. Citation classification is done automatically by AI analyzing each citation's context.",
        },
      ],
    },
    {
      id: "meta-analysis",
      icon: BarChart3,
      title: pt ? "Meta-Análise" : "Meta-Analysis",
      category: pt ? "Análise" : "Analysis",
      content: [
        {
          heading: pt ? "Análise estatística automatizada" : "Automated statistical analysis",
          body: pt
            ? "O módulo de Meta-Análise permite combinar resultados quantitativos de múltiplos estudos. A IA extrai automaticamente tamanhos de efeito, intervalos de confiança e tamanhos de amostra dos artigos selecionados. Os resultados são apresentados em forest plots e funnel plots interativos."
            : "The Meta-Analysis module combines quantitative results from multiple studies. AI automatically extracts effect sizes, confidence intervals, and sample sizes from selected papers. Results are presented in interactive forest plots and funnel plots.",
        },
        {
          heading: pt ? "Forest plot e funnel plot" : "Forest plot and funnel plot",
          body: pt
            ? "O forest plot mostra o tamanho de efeito de cada estudo com intervalos de confiança e o efeito combinado. O funnel plot avalia viés de publicação. Ambos são interativos e exportáveis como imagem."
            : "The forest plot shows effect size for each study with confidence intervals and combined effect. The funnel plot assesses publication bias. Both are interactive and exportable as images.",
        },
      ],
    },
    {
      id: "risk-of-bias",
      icon: AlertTriangle,
      title: pt ? "Risco de Viés" : "Risk of Bias",
      category: pt ? "Análise" : "Analysis",
      content: [
        {
          heading: pt ? "Avaliação automatizada" : "Automated assessment",
          body: pt
            ? "O módulo de Risco de Viés avalia automaticamente a qualidade metodológica dos artigos usando critérios padronizados. A IA analisa randomização, cegamento, atrito, relato seletivo e outras fontes de viés, gerando uma tabela de risco (baixo, incerto, alto) para cada domínio."
            : "The Risk of Bias module automatically assesses methodological quality of papers using standardized criteria. AI analyzes randomization, blinding, attrition, selective reporting, and other bias sources, generating a risk table (low, unclear, high) for each domain.",
        },
      ],
    },
    {
      id: "writing-assistant",
      icon: PenTool,
      title: pt ? "Assistente de Escrita" : "Writing Assistant",
      category: pt ? "Produção" : "Production",
      content: [
        {
          heading: pt ? "Escrita científica assistida por IA" : "AI-assisted scientific writing",
          body: pt
            ? "O Assistente de Escrita ajuda na redação de textos acadêmicos. Cole seu texto e peça para a IA revisar, melhorar a clareza, corrigir gramática, adaptar ao estilo acadêmico ou traduzir entre idiomas. Também suporta upload de PDFs para análise e resumo automático."
            : "The Writing Assistant helps with academic text writing. Paste your text and ask AI to review, improve clarity, correct grammar, adapt to academic style, or translate between languages. Also supports PDF upload for automatic analysis and summarization.",
        },
        {
          heading: pt ? "Modos de operação" : "Operation modes",
          body: pt
            ? "Escolha entre diferentes modos: Revisar (correção gramatical e estilística), Melhorar (reescrita para maior clareza), Resumir (extração de pontos-chave), Traduzir (PT↔EN), Expandir (desenvolvimento de ideias) e Perguntar (Q&A sobre o texto)."
            : "Choose between modes: Review (grammar and style correction), Improve (rewrite for clarity), Summarize (extract key points), Translate (PT↔EN), Expand (develop ideas), and Ask (Q&A about the text).",
        },
      ],
    },
    {
      id: "reports",
      icon: FileText,
      title: pt ? "Relatórios" : "Reports",
      category: pt ? "Produção" : "Production",
      content: [
        {
          heading: pt ? "Gerando relatórios de síntese" : "Generating synthesis reports",
          body: pt
            ? "Na página 'Relatórios', selecione uma pesquisa salva da biblioteca e clique em 'Gerar relatório'. A IA analisará todos os artigos e gerará um texto síntese coerente com citações no nível da frase, incluindo introdução, análise dos principais achados e conclusão."
            : "On the 'Reports' page, select a saved search from the library and click 'Generate report'. AI analyzes all papers and generates a coherent synthesis text with sentence-level citations, including introduction, main findings analysis, and conclusion.",
        },
        {
          heading: pt ? "Exportação PDF e Markdown" : "PDF and Markdown export",
          body: pt
            ? "Relatórios podem ser exportados como PDF formatado (A4 com tipografia acadêmica, numeração de páginas e referências) ou Markdown (para uso em editores como Overleaf, Word ou Google Docs). A exportação preserva tabelas, citações e formatação."
            : "Reports can be exported as formatted PDF (A4 with academic typography, page numbering, and references) or Markdown (for editors like Overleaf, Word, or Google Docs). Export preserves tables, citations, and formatting.",
        },
      ],
    },
    {
      id: "illustrations",
      icon: Image,
      title: pt ? "Ilustrações Científicas" : "Scientific Illustrations",
      category: pt ? "Produção" : "Production",
      content: [
        {
          heading: pt ? "Gerando ilustrações" : "Generating illustrations",
          body: pt
            ? "Na página 'Ilustrações', descreva o diagrama científico que você precisa em linguagem natural. Exemplo: 'Diagrama mostrando o ciclo de Krebs com todas as enzimas e cofatores'. A IA gerará uma ilustração profissional. Use os chips de sugestão para ideias prontas. Todas as ilustrações ficam salvas na sua galeria pessoal."
            : "On the 'Illustrations' page, describe the scientific diagram you need in natural language. Example: 'Diagram showing the Krebs cycle with all enzymes and cofactors'. AI generates a professional illustration. Use suggestion chips for ready ideas. All illustrations are saved to your personal gallery.",
        },
      ],
    },
    {
      id: "reference-check",
      icon: ShieldCheck,
      title: pt ? "Verificação de Referências" : "Reference Check",
      category: pt ? "Produção" : "Production",
      content: [
        {
          heading: pt ? "Monitoramento de retratações" : "Retraction monitoring",
          body: pt
            ? "Faça upload do seu manuscrito e o ScholarAI extrairá todas as referências citadas. O sistema verificará cada uma contra bases de retratações e controvérsias. Cada referência recebe um status: ✅ OK, ⚠️ Atenção ou ❌ Retratado. Você também pode monitorar papers específicos para alertas futuros de retratação."
            : "Upload your manuscript and ScholarAI extracts all cited references. The system checks each against retraction and controversy databases. Each reference gets a status: ✅ OK, ⚠️ Attention, or ❌ Retracted. You can also monitor specific papers for future retraction alerts.",
        },
      ],
    },
    {
      id: "literature-alerts",
      icon: BookMarked,
      title: pt ? "Alertas de Literatura" : "Literature Alerts",
      category: pt ? "Produção" : "Production",
      content: [
        {
          heading: pt ? "Monitoramento contínuo" : "Continuous monitoring",
          body: pt
            ? "Configure alertas para receber notificações quando novos artigos relevantes são publicados sobre seus temas de interesse. Defina a query de busca, filtros e frequência (diário, semanal ou mensal). Os resultados são armazenados e você pode revisá-los a qualquer momento no painel de alertas."
            : "Set up alerts to receive notifications when new relevant papers are published on your topics of interest. Define the search query, filters, and frequency (daily, weekly, or monthly). Results are stored and you can review them anytime in the alerts panel.",
        },
      ],
    },
    {
      id: "workspaces",
      icon: Users,
      title: pt ? "Espaços de Trabalho" : "Workspaces",
      category: pt ? "Colaboração" : "Collaboration",
      content: [
        {
          heading: pt ? "Pesquisa colaborativa" : "Collaborative research",
          body: pt
            ? "Crie Espaços de Trabalho para organizar projetos de pesquisa em equipe. Convide membros com diferentes papéis: Proprietário (controle total), Orientador (gestão + revisão), Coautor (contribuição direta), Revisor (apenas leitura + anotações). Cada membro pode adicionar artigos, fazer anotações e registrar atividades."
            : "Create Workspaces to organize team research projects. Invite members with different roles: Owner (full control), Advisor (management + review), Co-author (direct contribution), Reviewer (read-only + annotations). Each member can add papers, make annotations, and log activities.",
        },
        {
          heading: pt ? "Anotações e atividades" : "Annotations and activities",
          body: pt
            ? "Dentro de cada workspace, membros podem fazer anotações vinculadas a artigos específicos (comentários, highlights, notas) e um log de atividades registra automaticamente todas as ações da equipe (artigos adicionados, anotações criadas, etc.)."
            : "Within each workspace, members can make annotations linked to specific papers (comments, highlights, notes) and an activity log automatically records all team actions (papers added, annotations created, etc.).",
        },
      ],
    },
    {
      id: "surveys",
      icon: ClipboardList,
      title: pt ? "Pesquisas / Surveys" : "Surveys",
      category: pt ? "Pesquisa" : "Research",
      content: [
        {
          heading: pt ? "Construtor de pesquisas acadêmicas" : "Academic survey builder",
          body: pt
            ? "O módulo de Pesquisas permite criar, distribuir e analisar questionários acadêmicos completos — do design à coleta e análise de dados. Inspirado em ferramentas como Qualtrics, ele é integrado ao ecossistema ScholarAI e ao DataMind para análise avançada."
            : "The Surveys module lets you create, distribute, and analyze complete academic questionnaires — from design to data collection and analysis. Inspired by tools like Qualtrics, it's integrated with the ScholarAI ecosystem and DataMind for advanced analysis.",
        },
        {
          heading: pt ? "6 tipos de questões" : "6 question types",
          body: pt
            ? "O construtor suporta 6 tipos de questão validados para pesquisa acadêmica: Múltipla Escolha (seleção única ou múltipla), Entrada de Texto (campo aberto ou multilinha), Tabela Matricial (escala Likert com linhas de afirmações e colunas de concordância), Slider (escala numérica contínua com min/max/step configuráveis), Ranking (ordenação por prioridade com drag-and-drop), e Soma Constante (distribuição de pontos com total fixo). Cada tipo possui configurações avançadas como validação, obrigatoriedade e texto de ajuda."
            : "The builder supports 6 validated question types for academic research: Multiple Choice (single or multi-select), Text Entry (open or multiline field), Matrix Table (Likert scale with statement rows and agreement columns), Slider (continuous numeric scale with configurable min/max/step), Rank Order (priority ordering with drag-and-drop), and Constant Sum (point distribution with fixed total). Each type has advanced settings like validation, required fields, and helper text.",
        },
        {
          heading: pt ? "Blocos e organização" : "Blocks and organization",
          body: pt
            ? "As questões são organizadas em Blocos temáticos (ex: 'Dados Demográficos', 'Escala de Satisfação', 'Perguntas Abertas'). Blocos podem ser reordenados via drag-and-drop visual — arraste pela alça de arraste para reorganizar a ordem. Dentro de cada bloco, as questões também podem ser reordenadas por arraste. Cada bloco pode ter aleatorização de questões ativada independentemente."
            : "Questions are organized into thematic Blocks (e.g., 'Demographics', 'Satisfaction Scale', 'Open Questions'). Blocks can be reordered via visual drag-and-drop — drag by the handle to reorganize order. Within each block, questions can also be reordered by dragging. Each block can have question randomization enabled independently.",
        },
        {
          heading: pt ? "Geração de questões com IA" : "AI question generation",
          body: pt
            ? "Clique no botão 'Gerar com IA' no canvas de questões e descreva seu objetivo de pesquisa (ex: 'Avaliar a satisfação de estudantes com o ensino remoto durante a pandemia'). A IA gera questões metodologicamente sólidas com tipos apropriados (Likert para atitudes, múltipla escolha para dados demográficos, texto aberto para percepções qualitativas). Você pode selecionar quais questões adicionar à pesquisa. O sistema utiliza os provedores de IA configurados no painel administrativo, com fallback automático."
            : "Click the 'Generate with AI' button on the question canvas and describe your research objective (e.g., 'Evaluate student satisfaction with remote learning during the pandemic'). AI generates methodologically sound questions with appropriate types (Likert for attitudes, multiple choice for demographics, open text for qualitative perceptions). You can select which questions to add to your survey. The system uses AI providers configured in the admin panel, with automatic fallback.",
          tip: pt
            ? "Descreva o objetivo de pesquisa com detalhes e a IA gerará questões mais relevantes e diversificadas."
            : "Describe the research objective in detail and AI will generate more relevant and diverse questions.",
        },
        {
          heading: pt ? "Lógica condicional (Skip Logic)" : "Conditional logic (Skip Logic)",
          body: pt
            ? "Na aba 'Lógica' do construtor, defina regras condicionais para criar pesquisas ramificadas. Exemplos: 'Se respondeu X na Q1, pular para o Bloco 3', 'Se selecionou Outro, mostrar campo de texto'. As regras suportam operadores como 'igual a', 'contém', 'maior que', com ações de 'pular para questão', 'pular para bloco' ou 'ocultar questão'. Badges visuais indicam quais questões têm lógica aplicada."
            : "In the builder's 'Logic' tab, define conditional rules to create branched surveys. Examples: 'If answered X on Q1, skip to Block 3', 'If selected Other, show text field'. Rules support operators like 'equals', 'contains', 'greater than', with actions of 'skip to question', 'skip to block', or 'hide question'. Visual badges indicate which questions have applied logic.",
        },
        {
          heading: pt ? "Prévia embutida" : "Embedded preview",
          body: pt
            ? "A aba 'Prévia' no construtor renderiza o formulário exatamente como o respondente verá, incluindo avaliação em tempo real de regras de lógica condicional. Alterne entre visualizações de desktop e mobile para testar a responsividade. Útil para validar o fluxo antes de distribuir."
            : "The 'Preview' tab in the builder renders the form exactly as the respondent will see it, including real-time evaluation of conditional logic rules. Toggle between desktop and mobile views to test responsiveness. Useful for validating the flow before distribution.",
        },
        {
          heading: pt ? "Distribuição e QR Code" : "Distribution and QR Code",
          body: pt
            ? "Na aba 'Distribuir', gere um link anônimo para coleta de respostas sem autenticação. O sistema gera automaticamente um QR Code SVG funcional do link, pronto para impressão ou inclusão em materiais de pesquisa. Também é possível gerenciar listas de contatos e configurar envio por email com templates personalizáveis."
            : "In the 'Distribute' tab, generate an anonymous link for response collection without authentication. The system automatically generates a functional SVG QR Code of the link, ready for printing or inclusion in research materials. You can also manage contact lists and configure email sending with customizable templates.",
        },
        {
          heading: pt ? "Formulário do respondente" : "Respondent form",
          body: pt
            ? "O link anônimo abre um formulário público responsivo com navegação bloco-a-bloco, barra de progresso e validação em tempo real. A lógica condicional é avaliada dinamicamente: questões e blocos são exibidos ou ocultados conforme as respostas do participante. Ao final, as respostas são salvas com metadados (duração, user agent) para análise posterior."
            : "The anonymous link opens a responsive public form with block-by-block navigation, progress bar, and real-time validation. Conditional logic is dynamically evaluated: questions and blocks are shown or hidden based on participant responses. Upon completion, responses are saved with metadata (duration, user agent) for later analysis.",
        },
        {
          heading: pt ? "Resultados e análise" : "Results and analysis",
          body: pt
            ? "A aba 'Resultados' oferece dois modos: Dashboard de Relatórios com gráficos interativos (barras, pizza, stacked bars para Likert/Matriz) e estatísticas por questão (média, desvio padrão, n); e Grade de Dados Brutos com paginação, alternância entre texto da questão e nome de variável, e exportação multi-formato (CSV, TSV, XLSX). É possível exportar diretamente para o DataMind para análise avançada com IA."
            : "The 'Results' tab offers two modes: Reports Dashboard with interactive charts (bar, pie, stacked bars for Likert/Matrix) and per-question statistics (mean, std deviation, n); and Raw Data Grid with pagination, toggle between question text and variable name, and multi-format export (CSV, TSV, XLSX). You can export directly to DataMind for advanced AI-powered analysis.",
          tip: pt
            ? "Use a exportação para o DataMind para cruzamentos estatísticos avançados, regressões e análises de subgrupos automatizadas."
            : "Use the DataMind export for advanced statistical cross-tabulations, regressions, and automated subgroup analyses.",
        },
      ],
    },
    {
      id: "consent-tcle",
      icon: FileSignature,
      title: pt ? "TCLE / Consentimento" : "Informed Consent (TCLE)",
      category: pt ? "Pesquisa Clínica" : "Clinical Research",
      content: [
        {
          heading: pt ? "Consentimento digital etapizado" : "Step-by-step digital consent",
          body: pt
            ? "O módulo de TCLE (Termo de Consentimento Livre e Esclarecido) apresenta as seções do consentimento de forma etapizada, exigindo que o participante confirme 'Li e compreendi' para cada seção antes de prosseguir. Suporta mídia embutida (vídeo e áudio) para consentimentos acessíveis. Ao final, o participante assina digitalmente via canvas (toque/mouse)."
            : "The TCLE (Informed Consent) module presents consent sections step-by-step, requiring the participant to confirm 'I have read and understood' for each section before proceeding. Supports embedded media (video and audio) for accessible consents. At the end, the participant signs digitally via canvas (touch/mouse).",
        },
        {
          heading: pt ? "Assinatura com captura de IP server-side" : "Signature with server-side IP capture",
          body: pt
            ? "A assinatura é processada por uma Edge Function (consent-sign) que captura o IP real do participante via headers do servidor, gera um hash SHA-256 de integridade (nome + timestamp + IP), salva o registro com todos os metadados (IP, user agent, timestamp) e envia automaticamente uma cópia por e-mail ao participante — atendendo à Resolução CNS 466/2012."
            : "The signature is processed by an Edge Function (consent-sign) that captures the participant's real IP via server headers, generates a SHA-256 integrity hash (name + timestamp + IP), saves the record with all metadata (IP, user agent, timestamp), and automatically sends a copy by email to the participant — complying with CNS Resolution 466/2012.",
          tip: pt
            ? "O participante recebe automaticamente uma cópia do TCLE por e-mail com todos os dados da assinatura, conforme exigido pelo CEP."
            : "The participant automatically receives a copy of the consent form by email with all signature data, as required by the ethics committee.",
        },
        {
          heading: pt ? "Versionamento de termos" : "Terms versioning",
          body: pt
            ? "Ao editar um TCLE que já possui assinaturas, o sistema detecta automaticamente e solicita a criação de uma nova versão (ex: v1 → v2). O campo consent_version na tabela consent_signatures registra qual versão cada participante assinou. Versões anteriores são preservadas e auditáveis."
            : "When editing a consent form that already has signatures, the system automatically detects this and prompts for a new version (e.g., v1 → v2). The consent_version field in the consent_signatures table records which version each participant signed. Previous versions are preserved and auditable.",
        },
        {
          heading: pt ? "Revogação de consentimento" : "Consent revocation",
          body: pt
            ? "Participantes podem revogar seu consentimento a qualquer momento (LGPD Art. 8° §5°). O pesquisador registra a revogação com motivo no painel de detalhes do participante, que marca o status como 'withdrawn' e registra na trilha de auditoria. Após a revogação, o pesquisador pode anonimizar os dados pessoais do participante."
            : "Participants can revoke their consent at any time (LGPD Art. 8° §5°). The researcher records the revocation with reason in the participant detail panel, which marks the status as 'withdrawn' and logs it in the audit trail. After revocation, the researcher can anonymize the participant's personal data.",
        },
      ],
    },
    {
      id: "ecrf",
      icon: Stethoscope,
      title: pt ? "eCRF / Pesquisa Clínica" : "eCRF / Clinical Research",
      category: pt ? "Pesquisa Clínica" : "Clinical Research",
      content: [
        {
          heading: pt ? "Formulário eletrônico de relato de caso" : "Electronic case report form",
          body: pt
            ? "O eCRF permite coleta de dados longitudinal com visitas programadas (T0 Baseline, T1 Follow-up, T2...). Cada visita tem um rótulo e um intervalo-alvo em dias. Os participantes são gerenciados com códigos anônimos e metadados clínicos personalizáveis."
            : "The eCRF enables longitudinal data collection with scheduled visits (T0 Baseline, T1 Follow-up, T2...). Each visit has a label and target day interval. Participants are managed with anonymous codes and customizable clinical metadata.",
        },
        {
          heading: pt ? "Validação clínica em tempo real" : "Real-time clinical validation",
          body: pt
            ? "Templates de validação clínica verificam automaticamente ranges fisiológicos (ex: PA sistólica 60-250 mmHg, IMC 10-80 kg/m²) durante a digitação. Alertas visuais indicam valores fora do range esperado, permitindo correção imediata ou justificativa."
            : "Clinical validation templates automatically check physiological ranges (e.g., systolic BP 60-250 mmHg, BMI 10-80 kg/m²) during data entry. Visual alerts indicate out-of-range values, allowing immediate correction or justification.",
        },
        {
          heading: pt ? "Upload de documentos" : "Document upload",
          body: pt
            ? "Faça upload de documentos clínicos (PDFs, imagens, laudos) vinculados a participantes e visitas específicas. Os arquivos são armazenados de forma segura no bucket privado 'study-documents' com RLS."
            : "Upload clinical documents (PDFs, images, reports) linked to specific participants and visits. Files are securely stored in the private 'study-documents' bucket with RLS.",
        },
      ],
    },
    {
      id: "compliance",
      icon: Shield,
      title: pt ? "Conformidade CEP/LGPD" : "CEP/LGPD Compliance",
      category: pt ? "Pesquisa Clínica" : "Clinical Research",
      content: [
        {
          heading: pt ? "Trilha de auditoria (GCP/ICH)" : "Audit trail (GCP/ICH)",
          body: pt
            ? "Todas as ações relevantes são registradas na tabela study_audit_log: assinatura de consentimento, revogação, exportação de dados, modificações e exclusões. Cada registro inclui ator, timestamp, IP e detalhes da ação. A aba 'Auditoria' no painel de resultados permite visualizar e filtrar todos os eventos com ícones coloridos por tipo de ação."
            : "All relevant actions are logged in the study_audit_log table: consent signature, revocation, data export, modifications, and deletions. Each record includes actor, timestamp, IP, and action details. The 'Audit' tab in the results panel lets you view and filter all events with color-coded icons by action type.",
        },
        {
          heading: pt ? "Anonimização de dados (LGPD Art. 18)" : "Data anonymization (LGPD Art. 18)",
          body: pt
            ? "O botão 'Anonimizar' na lista de participantes permite remover irreversivelmente os dados pessoais (nome, e-mail, assinatura, IP) substituindo-os por '[DADOS REMOVIDOS]'. Os dados estatísticos e respostas anônimas são preservados para análise. Cada anonimização é registrada na trilha de auditoria."
            : "The 'Anonymize' button in the participant list allows irreversible removal of personal data (name, email, signature, IP) by replacing them with '[DATA REMOVED]'. Statistical data and anonymous responses are preserved for analysis. Each anonymization is logged in the audit trail.",
          tip: pt
            ? "A anonimização é irreversível. Use apenas quando o participante solicitar exclusão de dados ou ao encerrar o estudo."
            : "Anonymization is irreversible. Use only when the participant requests data deletion or when closing the study.",
        },
        {
          heading: pt ? "Requisitos atendidos" : "Requirements met",
          body: pt
            ? "O sistema atende aos seguintes requisitos regulatórios: Resolução CNS 466/2012 (via do TCLE ao participante, consentimento informado), LGPD Art. 7° e 8° (base legal, revogação), LGPD Art. 16 e 18 (exclusão e anonimização de dados), GCP/ICH (trilha de auditoria completa), e boas práticas de pesquisa clínica (versionamento de documentos, validação de dados)."
            : "The system meets the following regulatory requirements: CNS Resolution 466/2012 (consent copy to participant, informed consent), LGPD Art. 7 and 8 (legal basis, revocation), LGPD Art. 16 and 18 (data deletion and anonymization), GCP/ICH (complete audit trail), and clinical research best practices (document versioning, data validation).",
        },
      ],
    },
    {
      id: "anonymization",
      icon: UserX,
      title: pt ? "Anonimização & Exclusão" : "Anonymization & Deletion",
      category: pt ? "Pesquisa Clínica" : "Clinical Research",
      content: [
        {
          heading: pt ? "Direito de exclusão de dados" : "Right to data deletion",
          body: pt
            ? "A LGPD garante ao titular o direito de solicitar a exclusão de seus dados pessoais. No ScholarAI, isso é implementado através da funcionalidade de anonimização que substitui nome, e-mail, assinatura digital e endereço IP por marcadores genéricos, preservando apenas os dados estatísticos não-identificáveis."
            : "LGPD guarantees data subjects the right to request deletion of their personal data. In ScholarAI, this is implemented through the anonymization feature that replaces name, email, digital signature, and IP address with generic markers, preserving only non-identifiable statistical data.",
        },
        {
          heading: pt ? "Processo de anonimização" : "Anonymization process",
          body: pt
            ? "1) Acesse a lista de participantes na aba eCRF; 2) Localize o participante e clique no ícone de anonimização; 3) Confirme a ação no diálogo (informando que é irreversível); 4) O sistema substitui os dados pessoais na tabela consent_signatures, registra o evento na trilha de auditoria e atualiza o status do participante. Os dados de respostas permanecem vinculados ao código anônimo do participante."
            : "1) Go to the participant list in the eCRF tab; 2) Find the participant and click the anonymization icon; 3) Confirm the action in the dialog (noting it's irreversible); 4) The system replaces personal data in the consent_signatures table, logs the event in the audit trail, and updates the participant status. Response data remains linked to the participant's anonymous code.",
        },
      ],
    },
    {
      id: "export",
      icon: Download,
      title: pt ? "Exportação" : "Export",
      category: pt ? "Geral" : "General",
      content: [
        {
          heading: pt ? "Formatos disponíveis" : "Available formats",
          body: pt
            ? "O ScholarAI suporta exportação em múltiplos formatos: PDF (relatórios acadêmicos, tabelas de extração, diagramas PRISMA), Markdown (relatórios para editores de texto), PNG/SVG (diagramas PRISMA, gráficos do DataMind), CSV/Excel (dados tabulares do DataMind), e integração direta com Google Sheets."
            : "ScholarAI supports export in multiple formats: PDF (academic reports, extraction tables, PRISMA diagrams), Markdown (reports for text editors), PNG/SVG (PRISMA diagrams, DataMind charts), CSV/Excel (DataMind tabular data), and direct Google Sheets integration.",
        },
      ],
    },
    {
      id: "languages",
      icon: Globe,
      title: pt ? "Idiomas" : "Languages",
      category: pt ? "Geral" : "General",
      content: [
        {
          heading: pt ? "Interface bilíngue" : "Bilingual interface",
          body: pt
            ? "O ScholarAI é totalmente bilíngue (PT/EN). Alterne entre idiomas clicando no botão 🌐 no cabeçalho. A interface, mensagens e extrações se adaptam ao idioma selecionado. Sua preferência é salva automaticamente. Mesmo artigos em inglês terão dados extraídos em português se esse for o idioma ativo."
            : "ScholarAI is fully bilingual (PT/EN). Switch between languages by clicking the 🌐 button in the header. Interface, messages, and extractions adapt to the selected language. Your preference is saved automatically. Even English papers will have data extracted in Portuguese if that's the active language.",
        },
      ],
    },
    // ========== TECHNICAL DOCUMENTATION ==========
    {
      id: "tech-architecture",
      icon: Blocks,
      title: pt ? "Arquitetura Geral" : "System Architecture",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Visão geral da arquitetura" : "Architecture overview",
          body: pt
            ? "O ScholarAI é uma Single Page Application (SPA) construída com React 18 + TypeScript + Vite como bundler. O frontend roda inteiramente no navegador e se comunica com o backend via Supabase (PostgreSQL + Edge Functions + Auth + Storage). Não há servidor Node.js próprio — toda a lógica de backend é executada em Supabase Edge Functions (Deno runtime). A execução de código Python/R para análise de dados ocorre no navegador via WebAssembly (Pyodide / WebR) em Web Workers dedicados."
            : "ScholarAI is a Single Page Application (SPA) built with React 18 + TypeScript + Vite as bundler. The frontend runs entirely in the browser and communicates with the backend via Supabase (PostgreSQL + Edge Functions + Auth + Storage). There is no custom Node.js server — all backend logic runs in Supabase Edge Functions (Deno runtime). Python/R code execution for data analysis runs in the browser via WebAssembly (Pyodide / WebR) in dedicated Web Workers.",
        },
        {
          heading: pt ? "Fluxo de dados" : "Data flow",
          body: pt
            ? "1) O usuário interage com o React frontend; 2) Chamadas autenticadas são feitas ao Supabase usando o JWT do usuário (access_token obtido via supabase.auth.getSession()); 3) Para operações simples (CRUD), o Supabase Client SDK acessa diretamente o PostgreSQL via PostgREST com RLS (Row-Level Security); 4) Para operações complexas (IA, APIs externas), Edge Functions são invocadas via supabase.functions.invoke(); 5) Edge Functions usam o SUPABASE_SERVICE_ROLE_KEY para operações privilegiadas e chamam APIs externas (OpenAI, Semantic Scholar, etc.)."
            : "1) User interacts with React frontend; 2) Authenticated calls go to Supabase using the user's JWT (access_token from supabase.auth.getSession()); 3) For simple operations (CRUD), Supabase Client SDK accesses PostgreSQL directly via PostgREST with RLS (Row-Level Security); 4) For complex operations (AI, external APIs), Edge Functions are invoked via supabase.functions.invoke(); 5) Edge Functions use SUPABASE_SERVICE_ROLE_KEY for privileged operations and call external APIs (OpenAI, Semantic Scholar, etc.).",
        },
        {
          heading: pt ? "Padrão de autenticação em Edge Functions" : "Edge Function auth pattern",
          body: pt
            ? "IMPORTANTE: Chamadas do frontend para Edge Functions devem obrigatoriamente usar o JWT dinâmico do usuário (access_token) no header 'Authorization: Bearer <token>', obtido via supabase.auth.getSession(). O uso da chave anônima estática (VITE_SUPABASE_PUBLISHABLE_KEY) para essas chamadas é proibido, pois causa erros 401 Unauthorized. Dentro da Edge Function, o service_role_key é usado para criar um client com permissões elevadas quando necessário."
            : "IMPORTANT: Frontend calls to Edge Functions must use the user's dynamic JWT (access_token) in the 'Authorization: Bearer <token>' header, obtained via supabase.auth.getSession(). Using the static anon key (VITE_SUPABASE_PUBLISHABLE_KEY) for these calls is prohibited as it causes 401 Unauthorized errors. Inside the Edge Function, the service_role_key creates an elevated-permission client when needed.",
          tip: pt
            ? "Nunca exponha o SERVICE_ROLE_KEY no frontend. Ele só deve existir como secret nas Edge Functions."
            : "Never expose the SERVICE_ROLE_KEY on the frontend. It should only exist as a secret in Edge Functions.",
        },
      ],
    },
    {
      id: "tech-stack",
      icon: Code,
      title: pt ? "Stack Tecnológico" : "Technology Stack",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Frontend" : "Frontend",
          body: pt
            ? "• React 18 — biblioteca de UI com hooks e componentes funcionais\n• TypeScript — tipagem estática em todo o projeto\n• Vite — bundler ultrarrápido com HMR\n• Tailwind CSS — estilização utility-first com design tokens semânticos (HSL) definidos em index.css\n• shadcn/ui — componentes acessíveis baseados em Radix UI (Button, Dialog, Table, Sheet, Tabs, etc.)\n• React Router DOM — roteamento SPA com rotas protegidas\n• Framer Motion — animações fluídas\n• Recharts — gráficos interativos (forest plots, funnel plots, dashboards)\n• Lucide React — ícones consistentes\n• TanStack React Query — gerenciamento de estado assíncrono e cache\n• Sonner — sistema de toasts/notificações"
            : "• React 18 — UI library with hooks and functional components\n• TypeScript — static typing throughout the project\n• Vite — ultra-fast bundler with HMR\n• Tailwind CSS — utility-first styling with semantic design tokens (HSL) in index.css\n• shadcn/ui — accessible components based on Radix UI (Button, Dialog, Table, Sheet, Tabs, etc.)\n• React Router DOM — SPA routing with protected routes\n• Framer Motion — fluid animations\n• Recharts — interactive charts (forest plots, funnel plots, dashboards)\n• Lucide React — consistent icons\n• TanStack React Query — async state management and caching\n• Sonner — toast/notification system",
        },
        {
          heading: pt ? "Backend (Supabase)" : "Backend (Supabase)",
          body: pt
            ? "• Supabase — plataforma BaaS (Backend-as-a-Service) com PostgreSQL 15\n• PostgREST — API REST automática sobre o PostgreSQL\n• Supabase Auth — autenticação com email/senha, magic links e OAuth\n• Supabase Storage — armazenamento de arquivos (PDFs, ilustrações, documentos clínicos) em buckets privados e públicos\n• Supabase Edge Functions — funções serverless em Deno runtime para lógica de backend\n• Row-Level Security (RLS) — políticas de segurança no nível de linha do banco de dados\n• pgvector — extensão para busca por similaridade vetorial (embeddings de artigos)"
            : "• Supabase — BaaS platform with PostgreSQL 15\n• PostgREST — automatic REST API over PostgreSQL\n• Supabase Auth — authentication with email/password, magic links, and OAuth\n• Supabase Storage — file storage (PDFs, illustrations, clinical docs) in private and public buckets\n• Supabase Edge Functions — serverless functions on Deno runtime for backend logic\n• Row-Level Security (RLS) — row-level database security policies\n• pgvector — extension for vector similarity search (paper embeddings)",
        },
        {
          heading: pt ? "Execução de código no navegador" : "In-browser code execution",
          body: pt
            ? "• Pyodide (WebAssembly) — runtime Python completo no navegador para análise de dados via DataMind. Roda em Web Worker dedicado (public/pyodide-worker.js) com pacotes pré-instalados: pandas, matplotlib, seaborn, scikit-learn, scipy, openpyxl. O código é executado em sandbox isolada com protocolo de serialização de tabelas (__DATATABLE_START__ / __DATATABLE_END__) e captura de gráficos como base64.\n• WebR — runtime R no navegador para análises estatísticas. Também executa em Web Worker dedicado (public/webr-worker.js)."
            : "• Pyodide (WebAssembly) — full Python runtime in the browser for DataMind data analysis. Runs in a dedicated Web Worker (public/pyodide-worker.js) with pre-installed packages: pandas, matplotlib, seaborn, scikit-learn, scipy, openpyxl. Code executes in an isolated sandbox with table serialization protocol (__DATATABLE_START__ / __DATATABLE_END__) and chart capture as base64.\n• WebR — R runtime in the browser for statistical analyses. Also runs in a dedicated Web Worker (public/webr-worker.js).",
        },
        {
          heading: pt ? "Internacionalização" : "Internationalization",
          body: pt
            ? "O sistema é bilíngue (PT/EN) usando um LanguageContext customizado (src/i18n/LanguageContext.tsx) com dicionário de traduções (src/i18n/translations.ts). O idioma é detectado automaticamente e pode ser alternado pelo usuário. Componentes usam o hook useLanguage() para acessar locale e a função t() de tradução."
            : "The system is bilingual (PT/EN) using a custom LanguageContext (src/i18n/LanguageContext.tsx) with translation dictionary (src/i18n/translations.ts). Language is auto-detected and can be toggled by the user. Components use the useLanguage() hook to access locale and the t() translation function.",
        },
      ],
    },
    {
      id: "tech-database",
      icon: Database,
      title: pt ? "Estrutura do Banco de Dados" : "Database Structure",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Tabelas principais — Pesquisa" : "Core tables — Research",
          body: pt
            ? "• papers — artigos científicos com metadados (título, abstract, DOI, autores, ano, journal, contadores de citações)\n• paper_chunks — chunks de texto com embeddings vetoriais (pgvector) para busca semântica e RAG\n• saved_searches — pesquisas salvas na biblioteca com papers, colunas e dados extraídos em JSONB\n• extraction_cache — cache de valores extraídos por IA (paper_id + column_name → extracted_value)\n• citation_classifications — classificações de citações (supporting, contrasting, mentioning) com contexto e confiança\n• reports — relatórios de síntese gerados pela IA\n• uploaded_papers — PDFs enviados pelo usuário com texto extraído"
            : "• papers — scientific papers with metadata (title, abstract, DOI, authors, year, journal, citation counters)\n• paper_chunks — text chunks with vector embeddings (pgvector) for semantic search and RAG\n• saved_searches — library saved searches with papers, columns, and extracted data in JSONB\n• extraction_cache — AI-extracted values cache (paper_id + column_name → extracted_value)\n• citation_classifications — citation classifications (supporting, contrasting, mentioning) with context and confidence\n• reports — AI-generated synthesis reports\n• uploaded_papers — user-uploaded PDFs with extracted text",
        },
        {
          heading: pt ? "Tabelas — Revisão Sistemática" : "Tables — Systematic Review",
          body: pt
            ? "• systematic_reviews — revisões com pergunta de pesquisa, papers, critérios de triagem, resultados de extração e relatório. Usa JSONB para flexibilidade.\n• screening_decisions — decisões de triagem por artigo (include/exclude/maybe) com score de inclusão e resultados por critério"
            : "• systematic_reviews — reviews with research question, papers, screening criteria, extraction results, and report. Uses JSONB for flexibility.\n• screening_decisions — per-paper screening decisions (include/exclude/maybe) with inclusion score and per-criteria results",
        },
        {
          heading: pt ? "Tabelas — DataMind" : "Tables — DataMind",
          body: pt
            ? "• datamind_conversations — sessões de análise\n• datamind_messages — mensagens com code_block e output (tipo + conteúdo)\n• datamind_files — arquivos enviados com schema_info e preview_data\n• datamind_checkpoints — versionamento (snapshots de mensagens e arquivos)\n• datamind_pipelines / datamind_pipeline_steps — pipelines reproduzíveis\n• datamind_dashboards / datamind_dashboard_items — dashboards com posição/layout\n• datamind_conversation_shares — compartilhamento com permissões (view/edit)\n• datamind_comments — comentários em mensagens\n• datamind_cleaning_profiles — perfis de limpeza de dados\n• datamind_db_connections — conexões SQL externas (host, port, credentials criptografadas)"
            : "• datamind_conversations — analysis sessions\n• datamind_messages — messages with code_block and output (type + content)\n• datamind_files — uploaded files with schema_info and preview_data\n• datamind_checkpoints — versioning (message and file snapshots)\n• datamind_pipelines / datamind_pipeline_steps — reproducible pipelines\n• datamind_dashboards / datamind_dashboard_items — dashboards with position/layout\n• datamind_conversation_shares — sharing with permissions (view/edit)\n• datamind_comments — message comments\n• datamind_cleaning_profiles — data cleaning profiles\n• datamind_db_connections — external SQL connections (host, port, encrypted credentials)",
        },
        {
          heading: pt ? "Tabelas — Surveys e Pesquisa Clínica" : "Tables — Surveys & Clinical Research",
          body: pt
            ? "• surveys — pesquisas com status (draft/active/closed) e settings JSONB\n• survey_blocks / survey_questions — blocos e questões com tipos variados (multiple_choice, matrix, slider, rank_order, etc.)\n• survey_responses / survey_answers — respostas e dados de cada questão\n• survey_logic_rules — regras de skip/branch logic\n• survey_distributions / survey_contacts — distribuição por email e contatos\n• study_consents / consent_signatures — TCLE com versionamento e assinaturas digitais\n• study_participants — participantes com código anônimo e status\n• study_visits — visitas programadas para eCRF longitudinal\n• participant_documents — documentos clínicos vinculados\n• study_audit_log — trilha de auditoria GCP/ICH completa"
            : "• surveys — surveys with status (draft/active/closed) and JSONB settings\n• survey_blocks / survey_questions — blocks and questions with varied types (multiple_choice, matrix, slider, rank_order, etc.)\n• survey_responses / survey_answers — responses and per-question data\n• survey_logic_rules — skip/branch logic rules\n• survey_distributions / survey_contacts — email distribution and contacts\n• study_consents / consent_signatures — informed consent with versioning and digital signatures\n• study_participants — participants with anonymous code and status\n• study_visits — scheduled visits for longitudinal eCRF\n• participant_documents — linked clinical documents\n• study_audit_log — complete GCP/ICH audit trail",
        },
        {
          heading: pt ? "Tabelas — Sistema" : "Tables — System",
          body: pt
            ? "• user_roles — papéis de usuário (admin, moderator, user) usando enum app_role. Nunca armazenados na tabela de perfis por segurança.\n• user_approvals — aprovação manual de novos cadastros\n• subscriptions — assinaturas Stripe com plano, status e período\n• usage_tracking — rastreamento de uso por feature e período\n• ai_usage_log — log de uso de IA (provider, modelo, tokens, custo)\n• ai_api_keys — chaves de API de provedores de IA (apenas admins)\n• analytics_events — eventos de analytics (page views, ações)\n• workspaces / workspace_members / workspace_activity / workspace_annotations — espaços colaborativos com papéis (owner, advisor, coauthor, reviewer)\n• literature_alerts / alert_results — alertas de nova literatura\n• retraction_watches — monitoramento de retratações\n• illustrations — ilustrações científicas geradas"
            : "• user_roles — user roles (admin, moderator, user) using app_role enum. Never stored on profile table for security.\n• user_approvals — manual approval of new registrations\n• subscriptions — Stripe subscriptions with plan, status, and period\n• usage_tracking — per-feature usage tracking\n• ai_usage_log — AI usage log (provider, model, tokens, cost)\n• ai_api_keys — AI provider API keys (admin only)\n• analytics_events — analytics events (page views, actions)\n• workspaces / workspace_members / workspace_activity / workspace_annotations — collaborative workspaces with roles (owner, advisor, coauthor, reviewer)\n• literature_alerts / alert_results — new literature alerts\n• retraction_watches — retraction monitoring\n• illustrations — generated scientific illustrations",
        },
        {
          heading: pt ? "Funções e Enums do banco" : "Database functions and enums",
          body: pt
            ? "Enums: app_role (admin, moderator, user), workspace_role (owner, advisor, coauthor, reviewer). Funções: has_role() — verifica papel do usuário (SECURITY DEFINER para evitar recursão RLS); is_workspace_member() — verifica pertencimento a workspace; get_workspace_role() — retorna papel no workspace; create_workspace() — cria workspace e adiciona owner; match_paper_chunks() — busca vetorial de chunks por similaridade (pgvector); handle_new_user_approval() — trigger que cria registro de aprovação ao novo cadastro; update_paper_citation_counters() — trigger que atualiza contadores de citação."
            : "Enums: app_role (admin, moderator, user), workspace_role (owner, advisor, coauthor, reviewer). Functions: has_role() — checks user role (SECURITY DEFINER to avoid RLS recursion); is_workspace_member() — checks workspace membership; get_workspace_role() — returns workspace role; create_workspace() — creates workspace and adds owner; match_paper_chunks() — vector chunk search by similarity (pgvector); handle_new_user_approval() — trigger creating approval record on new signup; update_paper_citation_counters() — trigger updating citation counters.",
          tip: pt
            ? "A função has_role() é SECURITY DEFINER para evitar loops infinitos nas políticas RLS que verificam papéis."
            : "The has_role() function is SECURITY DEFINER to avoid infinite loops in RLS policies that check roles.",
        },
      ],
    },
    {
      id: "tech-edge-functions",
      icon: Server,
      title: pt ? "Edge Functions (API)" : "Edge Functions (API)",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Visão geral" : "Overview",
          body: pt
            ? "Edge Functions são funções serverless executadas no Deno runtime do Supabase. Cada function é um diretório em supabase/functions/ com um index.ts. São deployadas automaticamente. Todas usam CORS headers e retornam JSON. A configuração (verify_jwt, etc.) fica em supabase/config.toml."
            : "Edge Functions are serverless functions running on Supabase's Deno runtime. Each function is a directory in supabase/functions/ with an index.ts. They are auto-deployed. All use CORS headers and return JSON. Configuration (verify_jwt, etc.) is in supabase/config.toml.",
        },
        {
          heading: pt ? "Funções de busca e IA" : "Search and AI functions",
          body: pt
            ? "• search-papers — busca multi-fonte (Semantic Scholar, PubMed, OpenAlex, Europe PMC) com normalização de resultados\n• synthesize-papers — síntese com IA de múltiplos artigos em texto coerente com citações\n• extract-column — extração de dados de artigos por coluna com prompt customizado\n• extract-pdf — extração de texto de PDFs enviados\n• embed-papers — geração de embeddings vetoriais para chunks de artigos\n• chat-papers — chat contextual com RAG sobre artigos\n• classify-citations — classificação automática de citações (supporting/contrasting/mentioning)\n• check-references — verificação de referências contra bases de retratação\n• evaluate-question — avaliação de qualidade de perguntas de pesquisa\n• generate-illustration — geração de ilustrações científicas via IA\n• generate-knowledge-graph — geração de grafo de relações entre artigos\n• writing-assist — assistente de escrita acadêmica\n• fetch-full-text — busca de texto completo via Europe PMC / Unpaywall"
            : "• search-papers — multi-source search (Semantic Scholar, PubMed, OpenAlex, Europe PMC) with result normalization\n• synthesize-papers — AI synthesis of multiple papers into coherent text with citations\n• extract-column — per-column data extraction with custom prompts\n• extract-pdf — text extraction from uploaded PDFs\n• embed-papers — vector embedding generation for paper chunks\n• chat-papers — contextual RAG chat about papers\n• classify-citations — automatic citation classification (supporting/contrasting/mentioning)\n• check-references — reference checking against retraction databases\n• evaluate-question — research question quality evaluation\n• generate-illustration — AI scientific illustration generation\n• generate-knowledge-graph — paper relationship graph generation\n• writing-assist — academic writing assistant\n• fetch-full-text — full text retrieval via Europe PMC / Unpaywall",
        },
        {
          heading: pt ? "Funções de revisão sistemática" : "Systematic review functions",
          body: pt
            ? "• generate-screening-criteria — geração de critérios de inclusão/exclusão baseados na pergunta de pesquisa\n• screen-papers — triagem de artigos com IA usando critérios definidos\n• active-learning-screen — triagem adaptativa com Active Learning (re-ranking por probabilidade)\n• quality-assessment — avaliação de qualidade metodológica com checklists (CASP, Newcastle-Ottawa, etc.)\n• risk-of-bias — avaliação automatizada de risco de viés\n• meta-analysis — cálculos de meta-análise (tamanhos de efeito, forest plots)\n• generate-review-report — geração de relatório acadêmico de revisão\n• clinical-synthesis — síntese clínica para rascunhos de evolução"
            : "• generate-screening-criteria — inclusion/exclusion criteria generation based on research question\n• screen-papers — AI paper screening using defined criteria\n• active-learning-screen — adaptive screening with Active Learning (probability re-ranking)\n• quality-assessment — methodological quality assessment with checklists (CASP, Newcastle-Ottawa, etc.)\n• risk-of-bias — automated risk of bias assessment\n• meta-analysis — meta-analysis calculations (effect sizes, forest plots)\n• generate-review-report — academic review report generation\n• clinical-synthesis — clinical synthesis for progress note drafts",
        },
        {
          heading: pt ? "Funções de DataMind e utilidades" : "DataMind and utility functions",
          body: pt
            ? "• datamind-chat — chat conversacional com geração de código Python/R\n• datamind-execute — execução de código via E2B sandbox (fallback server-side)\n• datamind-db — operações NL-to-SQL em bancos externos\n• datamind-providers — lista provedores de IA disponíveis\n• export-to-sheets — exportação para Google Sheets\n• check-alerts — verificação periódica de alertas de literatura\n• send-contact — envio de formulário de contato via Resend\n• send-metrics-to-hub — envio de métricas para hub central\n• survey-respond / survey-generate-questions — resposta e geração de questões de survey\n• consent-sign / consent-revoke — assinatura e revogação de TCLE\n• create-checkout / check-subscription / customer-portal — integração Stripe"
            : "• datamind-chat — conversational chat with Python/R code generation\n• datamind-execute — code execution via E2B sandbox (server-side fallback)\n• datamind-db — NL-to-SQL operations on external databases\n• datamind-providers — list available AI providers\n• export-to-sheets — Google Sheets export\n• check-alerts — periodic literature alert checking\n• send-contact — contact form sending via Resend\n• send-metrics-to-hub — metrics reporting to central hub\n• survey-respond / survey-generate-questions — survey response and question generation\n• consent-sign / consent-revoke — informed consent signature and revocation\n• create-checkout / check-subscription / customer-portal — Stripe integration",
        },
        {
          heading: pt ? "Módulo compartilhado (_shared)" : "Shared module (_shared)",
          body: pt
            ? "O diretório supabase/functions/_shared/ contém módulos reutilizados:\n• ai-caller.ts — abstrai chamadas a provedores de IA (OpenAI, Anthropic, Google, etc.) buscando chaves da tabela ai_api_keys ou keys do usuário\n• auth.ts — helper de autenticação para Edge Functions\n• usage-tracker.ts — registra uso de IA na tabela ai_usage_log com tokens, custo e tipo de prompt"
            : "The supabase/functions/_shared/ directory contains reusable modules:\n• ai-caller.ts — abstracts AI provider calls (OpenAI, Anthropic, Google, etc.) fetching keys from ai_api_keys table or user keys\n• auth.ts — authentication helper for Edge Functions\n• usage-tracker.ts — logs AI usage to ai_usage_log table with tokens, cost, and prompt type",
        },
      ],
    },
    {
      id: "tech-security",
      icon: Lock,
      title: pt ? "Segurança e RLS" : "Security & RLS",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Row-Level Security (RLS)" : "Row-Level Security (RLS)",
          body: pt
            ? "Todas as tabelas possuem RLS habilitado. As políticas seguem o princípio do menor privilégio:\n• Tabelas de usuário (searches, reports, alerts, etc.) — 'auth.uid() = user_id' para SELECT, INSERT, UPDATE, DELETE\n• Tabelas públicas (papers, paper_chunks) — SELECT aberto, INSERT/UPDATE restrito a service_role\n• Tabelas de admin (ai_api_keys) — todas as operações protegidas por has_role(auth.uid(), 'admin')\n• Tabelas de workspace — verificam pertencimento via is_workspace_member()\n• Tabelas de survey — owner-based com exceções para acesso anônimo (respondentes de survey)\n• Tabelas de consentimento — INSERT público (participantes), SELECT restrito ao owner do survey"
            : "All tables have RLS enabled. Policies follow the principle of least privilege:\n• User tables (searches, reports, alerts, etc.) — 'auth.uid() = user_id' for SELECT, INSERT, UPDATE, DELETE\n• Public tables (papers, paper_chunks) — open SELECT, INSERT/UPDATE restricted to service_role\n• Admin tables (ai_api_keys) — all operations protected by has_role(auth.uid(), 'admin')\n• Workspace tables — check membership via is_workspace_member()\n• Survey tables — owner-based with exceptions for anonymous access (survey respondents)\n• Consent tables — public INSERT (participants), SELECT restricted to survey owner",
        },
        {
          heading: pt ? "Papéis e autenticação" : "Roles and authentication",
          body: pt
            ? "Papéis são armazenados na tabela user_roles (NUNCA na tabela de perfis) com enum app_role. A verificação é feita via função has_role() (SECURITY DEFINER). O sistema usa aprovação manual: novos usuários são criados com status 'pendente' na tabela user_approvals e só acessam funcionalidades após aprovação por admin. O componente ProtectedRoute.tsx bloqueia rotas para usuários não aprovados."
            : "Roles are stored in the user_roles table (NEVER in the profile table) with app_role enum. Verification uses the has_role() function (SECURITY DEFINER). The system uses manual approval: new users are created with 'pending' status in user_approvals and only access features after admin approval. The ProtectedRoute.tsx component blocks routes for unapproved users.",
          tip: pt
            ? "Nunca verifique status de admin via localStorage ou credenciais hardcoded no frontend — sempre use validação server-side."
            : "Never check admin status via localStorage or hardcoded frontend credentials — always use server-side validation.",
        },
        {
          heading: pt ? "Storage e buckets" : "Storage and buckets",
          body: pt
            ? "Cinco buckets de armazenamento:\n• papers (privado) — PDFs de artigos enviados pelo usuário\n• illustrations (público) — ilustrações científicas geradas\n• datamind-files (privado) — arquivos de análise do DataMind\n• consents (privado) — PDFs de consentimento assinados\n• study-documents (privado) — documentos clínicos de participantes\nBuckets privados exigem autenticação e são protegidos por políticas de storage."
            : "Five storage buckets:\n• papers (private) — user-uploaded paper PDFs\n• illustrations (public) — generated scientific illustrations\n• datamind-files (private) — DataMind analysis files\n• consents (private) — signed consent PDFs\n• study-documents (private) — participant clinical documents\nPrivate buckets require authentication and are protected by storage policies.",
        },
      ],
    },
    {
      id: "tech-apis",
      icon: Key,
      title: pt ? "APIs Externas" : "External APIs",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "APIs de busca acadêmica" : "Academic search APIs",
          body: pt
            ? "• Semantic Scholar API (api.semanticscholar.org) — busca semântica em 200M+ papers, dados de citações, embeddings, informações de autores. Usada como fonte principal.\n• PubMed / E-utilities (eutils.ncbi.nlm.nih.gov) — busca em literatura biomédica e ciências da saúde. API pública do NCBI.\n• OpenAlex API (api.openalex.org) — índice aberto de toda a literatura acadêmica. Acesso gratuito sem autenticação.\n• Europe PMC (europepmc.org/rest) — busca em literatura biomédica europeia com acesso a texto completo gratuito.\n• Unpaywall (api.unpaywall.org) — localização de versões Open Access de artigos via DOI."
            : "• Semantic Scholar API (api.semanticscholar.org) — semantic search in 200M+ papers, citation data, embeddings, author info. Used as primary source.\n• PubMed / E-utilities (eutils.ncbi.nlm.nih.gov) — biomedical and health sciences literature search. NCBI public API.\n• OpenAlex API (api.openalex.org) — open index of all academic literature. Free access without authentication.\n• Europe PMC (europepmc.org/rest) — European biomedical literature search with free full text access.\n• Unpaywall (api.unpaywall.org) — Open Access version location via DOI.",
        },
        {
          heading: pt ? "APIs de IA" : "AI APIs",
          body: pt
            ? "O sistema suporta múltiplos provedores de IA configuráveis:\n• OpenAI (GPT-4o, GPT-4o-mini) — provider principal para extração, síntese e chat\n• Anthropic (Claude) — alternativa para tarefas de raciocínio\n• Google (Gemini) — alternativa de custo menor\n• Groq — inferência ultrarrápida para tarefas simples\nAs chaves são armazenadas na tabela ai_api_keys (acessível apenas por admins) ou fornecidas pelo usuário. O módulo ai-caller.ts abstrai a seleção de provider e modelo."
            : "The system supports multiple configurable AI providers:\n• OpenAI (GPT-4o, GPT-4o-mini) — primary provider for extraction, synthesis, and chat\n• Anthropic (Claude) — alternative for reasoning tasks\n• Google (Gemini) — lower cost alternative\n• Groq — ultra-fast inference for simple tasks\nKeys are stored in the ai_api_keys table (admin-only) or provided by the user. The ai-caller.ts module abstracts provider and model selection.",
        },
        {
          heading: pt ? "Serviços de infraestrutura" : "Infrastructure services",
          body: pt
            ? "• Stripe — processamento de pagamentos e gestão de assinaturas (checkout, customer portal, webhooks)\n• Resend — envio de emails transacionais (confirmação de conta, cópia de TCLE, alertas)\n• E2B — sandbox de execução de código server-side (fallback quando Pyodide não é suficiente)\n• Google Sheets API — exportação direta de dados para planilhas"
            : "• Stripe — payment processing and subscription management (checkout, customer portal, webhooks)\n• Resend — transactional email sending (account confirmation, consent copy, alerts)\n• E2B — server-side code execution sandbox (fallback when Pyodide is insufficient)\n• Google Sheets API — direct data export to spreadsheets",
        },
      ],
    },
    {
      id: "tech-env-secrets",
      icon: HardDrive,
      title: pt ? "Variáveis de Ambiente" : "Environment Variables",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Variáveis do frontend (.env)" : "Frontend variables (.env)",
          body: pt
            ? "• VITE_SUPABASE_URL — URL do projeto Supabase (auto-populada)\n• VITE_SUPABASE_PUBLISHABLE_KEY — chave anônima do Supabase (pública, segura para o frontend)\n• VITE_SUPABASE_PROJECT_ID — ID do projeto Supabase\nEstas são as ÚNICAS variáveis disponíveis no frontend. Nunca exponha chaves secretas aqui."
            : "• VITE_SUPABASE_URL — Supabase project URL (auto-populated)\n• VITE_SUPABASE_PUBLISHABLE_KEY — Supabase anon key (public, safe for frontend)\n• VITE_SUPABASE_PROJECT_ID — Supabase project ID\nThese are the ONLY variables available on the frontend. Never expose secret keys here.",
        },
        {
          heading: pt ? "Secrets das Edge Functions" : "Edge Function secrets",
          body: pt
            ? "Configurados no painel do Supabase (Settings > Edge Functions):\n• SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — acesso ao Supabase (auto-configurados)\n• SUPABASE_DB_URL — URL de conexão direta ao PostgreSQL\n• DB_ENCRYPTION_KEY — chave para criptografia de dados sensíveis (senhas de DB)\n• RESEND_API_KEY — envio de emails via Resend\n• STRIPE_SECRET_KEY — integração de pagamentos Stripe\n• E2B_API_KEY — execução de código server-side\n• HUB_SERVICE_KEY / HUB_SERVICE_ID / HUB_METRICS_KEY — integração com hub de métricas\n• LOVABLE_API_KEY — integração com plataforma Lovable"
            : "Configured in Supabase dashboard (Settings > Edge Functions):\n• SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — Supabase access (auto-configured)\n• SUPABASE_DB_URL — direct PostgreSQL connection URL\n• DB_ENCRYPTION_KEY — encryption key for sensitive data (DB passwords)\n• RESEND_API_KEY — email sending via Resend\n• STRIPE_SECRET_KEY — Stripe payment integration\n• E2B_API_KEY — server-side code execution\n• HUB_SERVICE_KEY / HUB_SERVICE_ID / HUB_METRICS_KEY — metrics hub integration\n• LOVABLE_API_KEY — Lovable platform integration",
          tip: pt
            ? "Os valores das secrets nunca são exibidos na documentação. Consulte o painel do Supabase para gerenciá-las."
            : "Secret values are never shown in documentation. Check the Supabase dashboard to manage them.",
        },
      ],
    },
    {
      id: "tech-project-structure",
      icon: Cpu,
      title: pt ? "Estrutura do Projeto" : "Project Structure",
      category: pt ? "Técnico" : "Technical",
      content: [
        {
          heading: pt ? "Organização de diretórios" : "Directory organization",
          body: pt
            ? "src/\n├── components/          → Componentes React reutilizáveis\n│   ├── ui/              → Componentes shadcn/ui (button, dialog, table...)\n│   ├── app/             → Componentes do app (header, sidebar, onboarding...)\n│   ├── landing/         → Componentes da landing page\n│   ├── datamind/        → Componentes do DataMind\n│   ├── survey/          → Componentes de surveys (builder, flow, results, eCRF, consent, compliance)\n│   ├── knowledge-graph/ → Componentes do grafo de conhecimento\n│   └── meta-analysis/   → Componentes de meta-análise\n├── pages/               → Páginas/rotas do React Router\n├── hooks/               → Custom hooks (useAuth, useSubscription, usePyodide, useWebR...)\n├── i18n/                → Internacionalização (LanguageContext, translations)\n├── integrations/supabase/ → Client e tipos auto-gerados do Supabase\n├── lib/                 → Utilidades (analytics, parsers bibliográficos, formatos de referência)\n└── assets/              → Imagens e recursos estáticos"
            : "src/\n├── components/          → Reusable React components\n│   ├── ui/              → shadcn/ui components (button, dialog, table...)\n│   ├── app/             → App components (header, sidebar, onboarding...)\n│   ├── landing/         → Landing page components\n│   ├── datamind/        → DataMind components\n│   ├── survey/          → Survey components (builder, flow, results, eCRF, consent, compliance)\n│   ├── knowledge-graph/ → Knowledge graph components\n│   └── meta-analysis/   → Meta-analysis components\n├── pages/               → React Router pages/routes\n├── hooks/               → Custom hooks (useAuth, useSubscription, usePyodide, useWebR...)\n├── i18n/                → Internationalization (LanguageContext, translations)\n├── integrations/supabase/ → Supabase client and auto-generated types\n├── lib/                 → Utilities (analytics, bibliographic parsers, reference formats)\n└── assets/              → Images and static resources",
        },
        {
          heading: pt ? "Supabase functions" : "Supabase functions",
          body: pt
            ? "supabase/\n├── config.toml          → Configuração do projeto (project_id, verify_jwt por function)\n├── functions/\n│   ├── _shared/         → Módulos compartilhados (ai-caller, auth, usage-tracker)\n│   ├── search-papers/   → Cada function é um diretório com index.ts\n│   ├── synthesize-papers/\n│   ├── datamind-chat/\n│   └── ... (35+ functions)\n└── migrations/          → Migrações SQL versionadas"
            : "supabase/\n├── config.toml          → Project configuration (project_id, verify_jwt per function)\n├── functions/\n│   ├── _shared/         → Shared modules (ai-caller, auth, usage-tracker)\n│   ├── search-papers/   → Each function is a directory with index.ts\n│   ├── synthesize-papers/\n│   ├── datamind-chat/\n│   └── ... (35+ functions)\n└── migrations/          → Versioned SQL migrations",
        },
        {
          heading: pt ? "Configuração e build" : "Configuration and build",
          body: pt
            ? "• vite.config.ts — configuração do Vite com plugin React e aliases de path (@/)\n• tailwind.config.ts — configuração do Tailwind com tokens de design semânticos\n• tsconfig.app.json — configuração do TypeScript para o app\n• index.css — variáveis CSS customizadas (design tokens HSL para cores, gradientes, sombras)\n• components.json — configuração do shadcn/ui (aliases, estilo, cor base)\n• vitest.config.ts — configuração de testes unitários com Vitest"
            : "• vite.config.ts — Vite configuration with React plugin and path aliases (@/)\n• tailwind.config.ts — Tailwind configuration with semantic design tokens\n• tsconfig.app.json — TypeScript configuration for the app\n• index.css — custom CSS variables (HSL design tokens for colors, gradients, shadows)\n• components.json — shadcn/ui configuration (aliases, style, base color)\n• vitest.config.ts — unit test configuration with Vitest",
        },
      ],
    },
  ];

  // Group by category
  const categories = [...new Set(sections.map((s) => s.category))];

  const filteredSections = searchQuery
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.content.some(
            (c) =>
              c.heading.toLowerCase().includes(searchQuery.toLowerCase()) ||
              c.body.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : sections;

  const activeDoc = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-10 md:py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3">
              {pt ? "Documentação completa" : "Complete documentation"}
            </Badge>
            <h1 className="mb-3 font-display text-4xl font-bold text-foreground md:text-5xl">
              {pt ? "Documentação" : "Documentation"}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {pt
                ? "Guia completo de todas as funcionalidades do ScholarAI — busca, revisão sistemática, DataMind, pesquisas, pesquisa clínica, conformidade CEP/LGPD e mais."
                : "Complete guide to all ScholarAI features — search, systematic review, DataMind, surveys, clinical research, CEP/LGPD compliance and more."}
            </p>

            {/* Search */}
            <div className="mx-auto mt-6 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={pt ? "Buscar na documentação..." : "Search documentation..."}
                  className="w-full rounded-xl border border-border bg-card px-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar */}
            <nav className="shrink-0 md:w-64">
              <div className="sticky top-20 space-y-4 rounded-xl border border-border bg-card p-3 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {categories.map((cat) => {
                  const catSections = filteredSections.filter((s) => s.category === cat);
                  if (catSections.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        {cat}
                      </p>
                      <div className="space-y-0.5">
                        {catSections.map((section) => {
                          const isActive = section.id === activeSection;
                          return (
                            <button
                              key={section.id}
                              onClick={() => {
                                setActiveSection(section.id);
                                setSearchQuery("");
                              }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                isActive
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              <section.icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{section.title}</span>
                              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border border-border bg-card p-6 md:p-10">
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <activeDoc.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {activeDoc.category}
                    </p>
                    <h2 className="font-display text-2xl font-bold text-foreground">{activeDoc.title}</h2>
                  </div>
                </div>

                <div className="space-y-8">
                  {activeDoc.content.map((item, i) => (
                    <div key={i} className="group">
                      <h3 className="mb-2.5 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        {item.heading}
                      </h3>
                      <p className="pl-8 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
                      {item.tip && (
                        <div className="ml-8 mt-3 flex gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
                          <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                          <p className="text-sm text-primary/80">
                            <span className="font-semibold">{pt ? "Dica:" : "Tip:"}</span> {item.tip}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Navigation between sections */}
                <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
                  {(() => {
                    const idx = sections.findIndex((s) => s.id === activeSection);
                    const prev = idx > 0 ? sections[idx - 1] : null;
                    const next = idx < sections.length - 1 ? sections[idx + 1] : null;
                    return (
                      <>
                        {prev ? (
                          <button
                            onClick={() => setActiveSection(prev.id)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronRight className="h-4 w-4 rotate-180" />
                            {prev.title}
                          </button>
                        ) : (
                          <div />
                        )}
                        {next ? (
                          <button
                            onClick={() => setActiveSection(next.id)}
                            className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors"
                          >
                            {next.title}
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <div />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Docs;
