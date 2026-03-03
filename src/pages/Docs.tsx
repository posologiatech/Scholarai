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
                ? "Guia completo de todas as funcionalidades do ScholarAI — busca, revisão sistemática, DataMind, colaboração e mais."
                : "Complete guide to all ScholarAI features — search, systematic review, DataMind, collaboration and more."}
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
