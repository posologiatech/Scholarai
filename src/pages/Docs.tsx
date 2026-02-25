import { useState } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Search, BookOpen, Zap, Table, FileText, BarChart3, Image, ShieldCheck,
  ChevronRight, GraduationCap, Download, Globe, Sparkles, CheckCircle2,
  ArrowRight, Layers, Settings, Users, Upload,
} from "lucide-react";

interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  content: { heading: string; body: string }[];
}

const Docs = () => {
  const { locale } = useLanguage();
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections: DocSection[] = locale === "pt" ? [
    {
      id: "getting-started",
      icon: Zap,
      title: "Primeiros Passos",
      content: [
        {
          heading: "Criando sua conta",
          body: "Acesse o ScholarAI e clique em 'Comece Grátis'. Preencha seu nome, email e senha. Você receberá um email de confirmação — clique no link para ativar sua conta. Após a ativação, você será redirecionado ao Dashboard principal.",
        },
        {
          heading: "Navegando pelo Dashboard",
          body: "O Dashboard é seu ponto de partida. Na barra superior você encontra links para todas as funcionalidades: Busca, Biblioteca, Extração, Relatórios, Ilustrações e Verificação de Referências. No centro, há um campo de busca inteligente onde você pode fazer sua primeira pesquisa em linguagem natural. Abaixo, ficam suas buscas recentes e ações rápidas para acessar as principais ferramentas.",
        },
        {
          heading: "Sua primeira pesquisa",
          body: "Digite uma pergunta de pesquisa no campo central do Dashboard. Por exemplo: 'Quais os efeitos do exercício aeróbico na depressão em idosos?'. O sistema buscará automaticamente em múltiplas bases de dados científicas (Semantic Scholar, PubMed, OpenAlex, Europe PMC) e retornará os artigos mais relevantes organizados em uma tabela interativa.",
        },
      ],
    },
    {
      id: "search",
      icon: Search,
      title: "Busca Semântica",
      content: [
        {
          heading: "Como funciona a busca",
          body: "Diferente de buscas tradicionais por palavras-chave, o ScholarAI usa embeddings semânticos para entender o significado da sua pergunta. Isso significa que você pode perguntar em linguagem natural e o sistema encontrará artigos relevantes mesmo que usem terminologia diferente da sua busca. A busca consulta simultaneamente Semantic Scholar (200M+ papers), PubMed, OpenAlex e Europe PMC.",
        },
        {
          heading: "Filtros avançados",
          body: "Na página de resultados, clique em 'Filtros' para refinar sua busca. Você pode filtrar por: período de publicação (slider de ano), tipo de estudo (RCT, revisão, meta-análise, etc.), fonte específica (PubMed, Semantic Scholar, etc.), número mínimo de citações, Open Access apenas, autor específico, e palavras-chave no abstract. Os filtros são aplicados em tempo real e podem ser combinados.",
        },
        {
          heading: "Busca dentro dos resultados",
          body: "Use o botão 'Buscar' na barra de ferramentas para pesquisar dentro dos resultados já retornados. Isso é útil quando você tem muitos resultados e quer encontrar algo específico sem refazer a busca completa.",
        },
        {
          heading: "Ordenação",
          body: "Ordene os resultados por relevância (padrão), mais recente ou mais citado usando o seletor de ordenação na barra de ferramentas.",
        },
      ],
    },
    {
      id: "columns",
      icon: Table,
      title: "Colunas de Extração",
      content: [
        {
          heading: "O que são colunas",
          body: "Colunas são campos de dados que a IA extrai automaticamente de cada artigo. Por padrão, o ScholarAI inclui uma coluna 'Summary' (resumo), mas você pode adicionar colunas customizadas para extrair qualquer tipo de informação: metodologia, tamanho da amostra, resultados principais, limitações, etc.",
        },
        {
          heading: "Adicionando colunas",
          body: "Clique em 'Adicionar coluna' na barra de ferramentas ou no painel lateral de colunas. Defina um nome (ex: 'Metodologia') e opcionalmente um prompt personalizado que diz à IA exatamente o que extrair (ex: 'Descreva o desenho do estudo, incluindo randomização e cegamento'). Quanto mais específico o prompt, melhor a extração.",
        },
        {
          heading: "Painel de colunas",
          body: "O painel lateral (botão 'Colunas' no canto direito) mostra todas as colunas disponíveis. Ative ou desative colunas com os toggles. Colunas desativadas não são exibidas na tabela, mas os dados já extraídos são preservados. Você pode reativar uma coluna a qualquer momento sem precisar re-extrair.",
        },
        {
          heading: "Cache inteligente",
          body: "Extrações são cacheadas automaticamente. Se você fizer a mesma busca novamente ou ativar uma coluna que já foi extraída antes, os dados são carregados instantaneamente do cache (indicado pelo ícone de raio ⚡). Isso economiza tempo e recursos.",
        },
        {
          heading: "Citações e fontes",
          body: "Cada dado extraído pode conter um trecho do texto original do artigo como referência. Passe o mouse sobre um valor extraído para ver o contexto original. Isso garante transparência e permite verificar a precisão da extração.",
        },
      ],
    },
    {
      id: "library",
      icon: BookOpen,
      title: "Biblioteca",
      content: [
        {
          heading: "Salvando pesquisas",
          body: "Após fazer uma busca e configurar colunas, clique em 'Salvar na biblioteca' na barra de ferramentas dos resultados. Isso salva a busca completa incluindo todos os papers, colunas configuradas e dados extraídos. Você pode acessar suas pesquisas salvas a qualquer momento na página 'Biblioteca'.",
        },
        {
          heading: "Gerenciando a biblioteca",
          body: "Na página Biblioteca, você vê todas as suas pesquisas salvas com a query original, data de criação e número de papers. Clique em uma pesquisa para reabrir os resultados completos com todas as colunas e dados preservados. Você pode excluir pesquisas que não precisa mais.",
        },
      ],
    },
    {
      id: "extraction",
      icon: Upload,
      title: "Extração de PDFs",
      content: [
        {
          heading: "Upload de PDFs",
          body: "Na página 'Extração', faça upload de seus próprios artigos em formato PDF (até 20MB cada). O sistema aceita múltiplos arquivos simultaneamente. Após o upload, os PDFs ficam armazenados de forma segura na sua conta.",
        },
        {
          heading: "Wizard de extração",
          body: "O processo de extração segue 4 etapas guiadas por um indicador visual: 1) Upload PDFs — envie os artigos; 2) Pergunta — defina sua pergunta de pesquisa; 3) Colunas — adicione colunas para extração; 4) Extrair — execute a extração. O wizard mostra seu progresso e indica claramente qual é o próximo passo.",
        },
        {
          heading: "Definindo pergunta e colunas",
          body: "A pergunta de pesquisa dá contexto à IA para extrair informações relevantes. Adicione colunas clicando em 'Adicionar coluna'. Para cada coluna, defina um nome e opcionalmente um prompt descritivo. Por exemplo: coluna 'Resultados' com prompt 'Quais foram os principais resultados e desfechos do estudo?'.",
        },
        {
          heading: "Executando a extração",
          body: "Clique em 'Extrair de todos' para processar todos os PDFs simultaneamente, ou use o botão individual (ícone ✨) para extrair um paper por vez. Os dados extraídos aparecem na tabela em tempo real. O status de cada paper é indicado por ícones: uploaded (enviado), processing (em processamento), ready (pronto).",
        },
      ],
    },
    {
      id: "reports",
      icon: FileText,
      title: "Relatórios",
      content: [
        {
          heading: "Gerando relatórios",
          body: "Na página 'Relatórios', selecione uma pesquisa salva da biblioteca e clique em 'Gerar relatório'. A IA analisará todos os artigos da pesquisa e gerará um texto síntese coerente com citações no nível da frase. O relatório inclui introdução, análise dos principais achados e conclusão.",
        },
        {
          heading: "Persistência",
          body: "Todos os relatórios são salvos automaticamente na nuvem (Supabase). Eles ficam acessíveis de qualquer dispositivo e nunca são perdidos. Você pode excluir relatórios que não precisa mais.",
        },
      ],
    },
    {
      id: "illustrations",
      icon: Image,
      title: "Ilustrações Científicas",
      content: [
        {
          heading: "Gerando ilustrações",
          body: "Na página 'Ilustrações', descreva o diagrama científico que você precisa em linguagem natural. Por exemplo: 'Diagrama mostrando o ciclo de Krebs com todas as enzimas e cofatores'. A IA gerará uma ilustração profissional no estilo BioRender. A geração pode levar até 30 segundos.",
        },
        {
          heading: "Sugestões rápidas",
          body: "Use os chips de sugestão abaixo do campo de texto para ideias de ilustrações comuns: vias metabólicas, estruturas celulares, mecanismos de ação, etc. Clique em um chip para preencher automaticamente o campo com um prompt otimizado.",
        },
        {
          heading: "Galeria pessoal",
          body: "Todas as ilustrações geradas ficam salvas na sua galeria pessoal. Você pode baixar qualquer ilustração como PNG ou excluir as que não precisa mais.",
        },
      ],
    },
    {
      id: "reference-check",
      icon: ShieldCheck,
      title: "Verificação de Referências",
      content: [
        {
          heading: "Como funciona",
          body: "Faça upload do seu manuscrito e o ScholarAI extrairá automaticamente todas as referências citadas. O sistema verificará cada referência contra bases de dados de retratações e controvérsias científicas, alertando se algum paper citado foi retratado, contestado ou tem problemas conhecidos.",
        },
        {
          heading: "Resultado da verificação",
          body: "Cada referência recebe um status: ✅ OK (sem problemas encontrados), ⚠️ Atenção (menções ou controvérsias), ❌ Retratado (paper foi formalmente retratado). O relatório detalhado mostra o contexto de cada problema encontrado.",
        },
      ],
    },
    {
      id: "export",
      icon: Download,
      title: "Exportação",
      content: [
        {
          heading: "Exportar para PDF",
          body: "Na página de resultados de busca, clique em 'Export' na barra de ferramentas. O sistema gerará um PDF formatado contendo todos os papers filtrados e suas colunas extraídas. O PDF usa formato A4 landscape quando há muitas colunas para melhor legibilidade.",
        },
        {
          heading: "Dados incluídos",
          body: "O PDF exportado inclui: query de busca, número de resultados, data da exportação, tabela com título/autores de cada paper, e todas as colunas ativas com seus dados extraídos. É ideal para compartilhar resultados com orientadores ou colegas.",
        },
      ],
    },
    {
      id: "languages",
      icon: Globe,
      title: "Idiomas",
      content: [
        {
          heading: "Português e inglês",
          body: "O ScholarAI é totalmente bilíngue (PT/EN). Alterne entre idiomas clicando no botão de idioma (ícone 🌐) no cabeçalho. A interface, mensagens e extrações se adaptam ao idioma selecionado. Sua preferência é salva automaticamente.",
        },
        {
          heading: "Extrações no seu idioma",
          body: "Quando você extrai dados de colunas, o sistema gera as respostas no idioma selecionado. Isso significa que mesmo artigos em inglês terão seus dados extraídos em português se esse for o idioma ativo — facilitando a compreensão e o uso direto em trabalhos acadêmicos.",
        },
      ],
    },
  ] : [
    {
      id: "getting-started",
      icon: Zap,
      title: "Getting Started",
      content: [
        {
          heading: "Creating your account",
          body: "Go to ScholarAI and click 'Get Started Free'. Fill in your name, email, and password. You'll receive a confirmation email — click the link to activate your account. After activation, you'll be redirected to the main Dashboard.",
        },
        {
          heading: "Navigating the Dashboard",
          body: "The Dashboard is your starting point. In the top bar, you'll find links to all features: Search, Library, Extraction, Reports, Illustrations, and Reference Check. In the center, there's a smart search field where you can make your first natural language search. Below, you'll find recent searches and quick actions to access the main tools.",
        },
        {
          heading: "Your first search",
          body: "Type a research question in the Dashboard's central field. For example: 'What are the effects of aerobic exercise on depression in elderly people?'. The system will automatically search multiple scientific databases (Semantic Scholar, PubMed, OpenAlex, Europe PMC) and return the most relevant papers organized in an interactive table.",
        },
      ],
    },
    {
      id: "search",
      icon: Search,
      title: "Semantic Search",
      content: [
        {
          heading: "How search works",
          body: "Unlike traditional keyword searches, ScholarAI uses semantic embeddings to understand the meaning of your question. This means you can ask in natural language and the system will find relevant papers even if they use different terminology. The search simultaneously queries Semantic Scholar (200M+ papers), PubMed, OpenAlex, and Europe PMC.",
        },
        {
          heading: "Advanced filters",
          body: "On the results page, click 'Filters' to refine your search. You can filter by: publication period (year slider), study type (RCT, review, meta-analysis, etc.), specific source, minimum citations, Open Access only, specific author, and abstract keywords. Filters are applied in real-time and can be combined.",
        },
        {
          heading: "Search within results",
          body: "Use the 'Search' button in the toolbar to search within already returned results. This is useful when you have many results and want to find something specific without redoing the full search.",
        },
        {
          heading: "Sorting",
          body: "Sort results by relevance (default), most recent, or most cited using the sort selector in the toolbar.",
        },
      ],
    },
    {
      id: "columns",
      icon: Table,
      title: "Extraction Columns",
      content: [
        {
          heading: "What are columns",
          body: "Columns are data fields that AI automatically extracts from each paper. By default, ScholarAI includes a 'Summary' column, but you can add custom columns to extract any type of information: methodology, sample size, main results, limitations, etc.",
        },
        {
          heading: "Adding columns",
          body: "Click 'Add column' in the toolbar or the side columns panel. Define a name (e.g., 'Methodology') and optionally a custom prompt that tells the AI exactly what to extract (e.g., 'Describe the study design, including randomization and blinding'). The more specific the prompt, the better the extraction.",
        },
        {
          heading: "Columns panel",
          body: "The side panel ('Columns' button on the right) shows all available columns. Toggle columns on/off. Disabled columns are not shown in the table, but already extracted data is preserved. You can reactivate a column at any time without re-extracting.",
        },
        {
          heading: "Smart cache",
          body: "Extractions are automatically cached. If you search again or activate a previously extracted column, data loads instantly from cache (indicated by the ⚡ icon). This saves time and resources.",
        },
        {
          heading: "Citations and sources",
          body: "Each extracted value can contain an excerpt from the original paper text as reference. Hover over an extracted value to see the original context. This ensures transparency and allows verifying extraction accuracy.",
        },
      ],
    },
    {
      id: "library",
      icon: BookOpen,
      title: "Library",
      content: [
        {
          heading: "Saving searches",
          body: "After searching and configuring columns, click 'Save to library' in the results toolbar. This saves the complete search including all papers, configured columns, and extracted data. You can access your saved searches anytime on the 'Library' page.",
        },
        {
          heading: "Managing the library",
          body: "On the Library page, you see all saved searches with the original query, creation date, and number of papers. Click a search to reopen full results with all columns and data preserved. You can delete searches you no longer need.",
        },
      ],
    },
    {
      id: "extraction",
      icon: Upload,
      title: "PDF Extraction",
      content: [
        {
          heading: "Uploading PDFs",
          body: "On the 'Extraction' page, upload your own papers in PDF format (up to 20MB each). The system accepts multiple files simultaneously. After upload, PDFs are securely stored in your account.",
        },
        {
          heading: "Extraction wizard",
          body: "The extraction process follows 4 guided steps with a visual indicator: 1) Upload PDFs; 2) Question — define your research question; 3) Columns — add extraction columns; 4) Extract — run the extraction. The wizard shows your progress and clearly indicates the next step.",
        },
        {
          heading: "Defining question and columns",
          body: "The research question gives AI context to extract relevant information. Add columns by clicking 'Add column'. For each column, define a name and optionally a descriptive prompt. For example: column 'Results' with prompt 'What were the main results and outcomes of the study?'.",
        },
        {
          heading: "Running extraction",
          body: "Click 'Extract all' to process all PDFs simultaneously, or use the individual button (✨ icon) to extract one paper at a time. Extracted data appears in the table in real-time. Each paper's status is indicated by icons: uploaded, processing, ready.",
        },
      ],
    },
    {
      id: "reports",
      icon: FileText,
      title: "Reports",
      content: [
        {
          heading: "Generating reports",
          body: "On the 'Reports' page, select a saved search from the library and click 'Generate report'. AI will analyze all papers in the search and generate a coherent synthesis text with sentence-level citations. The report includes introduction, analysis of main findings, and conclusion.",
        },
        {
          heading: "Persistence",
          body: "All reports are automatically saved to the cloud (Supabase). They're accessible from any device and never lost. You can delete reports you no longer need.",
        },
      ],
    },
    {
      id: "illustrations",
      icon: Image,
      title: "Scientific Illustrations",
      content: [
        {
          heading: "Generating illustrations",
          body: "On the 'Illustrations' page, describe the scientific diagram you need in natural language. For example: 'Diagram showing the Krebs cycle with all enzymes and cofactors'. AI will generate a professional BioRender-style illustration. Generation may take up to 30 seconds.",
        },
        {
          heading: "Quick suggestions",
          body: "Use the suggestion chips below the text field for common illustration ideas: metabolic pathways, cellular structures, mechanisms of action, etc. Click a chip to auto-fill the field with an optimized prompt.",
        },
        {
          heading: "Personal gallery",
          body: "All generated illustrations are saved to your personal gallery. You can download any illustration as PNG or delete ones you no longer need.",
        },
      ],
    },
    {
      id: "reference-check",
      icon: ShieldCheck,
      title: "Reference Check",
      content: [
        {
          heading: "How it works",
          body: "Upload your manuscript and ScholarAI will automatically extract all cited references. The system will check each reference against retraction and scientific controversy databases, alerting if any cited paper has been retracted, contested, or has known issues.",
        },
        {
          heading: "Verification result",
          body: "Each reference receives a status: ✅ OK (no problems found), ⚠️ Attention (mentions or controversies), ❌ Retracted (paper was formally retracted). The detailed report shows the context of each issue found.",
        },
      ],
    },
    {
      id: "export",
      icon: Download,
      title: "Export",
      content: [
        {
          heading: "Export to PDF",
          body: "On the search results page, click 'Export' in the toolbar. The system will generate a formatted PDF containing all filtered papers and their extracted columns. The PDF uses A4 landscape format when there are many columns for better readability.",
        },
        {
          heading: "Included data",
          body: "The exported PDF includes: search query, number of results, export date, table with each paper's title/authors, and all active columns with their extracted data. Ideal for sharing results with advisors or colleagues.",
        },
      ],
    },
    {
      id: "languages",
      icon: Globe,
      title: "Languages",
      content: [
        {
          heading: "Portuguese and English",
          body: "ScholarAI is fully bilingual (PT/EN). Switch between languages by clicking the language button (🌐 icon) in the header. The interface, messages, and extractions adapt to the selected language. Your preference is automatically saved.",
        },
        {
          heading: "Extractions in your language",
          body: "When you extract column data, the system generates responses in the selected language. This means even English papers will have their data extracted in Portuguese if that's the active language — making it easier to understand and use directly in academic work.",
        },
      ],
    },
  ];

  const activeDoc = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-10 md:py-16">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h1 className="mb-3 font-display text-4xl font-bold text-foreground md:text-5xl">
              {locale === "pt" ? "Documentação" : "Documentation"}
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              {locale === "pt"
                ? "Tudo que você precisa saber para usar o ScholarAI ao máximo"
                : "Everything you need to know to use ScholarAI to its fullest"}
            </p>
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar */}
            <nav className="shrink-0 md:w-64">
              <div className="sticky top-20 space-y-1 rounded-xl border border-border bg-card p-3">
                {sections.map((section) => {
                  const isActive = section.id === activeSection;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <section.icon className="h-4 w-4 shrink-0" />
                      {section.title}
                      {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border border-border bg-card p-6 md:p-10">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <activeDoc.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">{activeDoc.title}</h2>
                </div>

                <div className="space-y-8">
                  {activeDoc.content.map((item, i) => (
                    <div key={i}>
                      <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        {item.heading}
                      </h3>
                      <p className="pl-6 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
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
