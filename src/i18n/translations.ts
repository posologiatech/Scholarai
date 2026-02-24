export type Locale = "pt" | "en";

export const translations = {
  // Nav
  "nav.solutions": { pt: "Soluções", en: "Solutions" },
  "nav.useCases": { pt: "Casos de Uso", en: "Use Cases" },
  "nav.about": { pt: "Sobre", en: "About" },
  "nav.faq": { pt: "FAQ", en: "FAQ" },
  "nav.login": { pt: "Entrar", en: "Log in" },
  "nav.getStarted": { pt: "Comece Grátis", en: "Get Started Free" },

  // Hero
  "hero.badge": { pt: "Pesquisa acadêmica com IA", en: "AI-powered academic research" },
  "hero.title1": { pt: "Encontre, analise e sintetize", en: "Find, analyze, and synthesize" },
  "hero.title2": { pt: "artigos científicos com IA", en: "scientific papers with AI" },
  "hero.subtitle": {
    pt: "Busca semântica em milhões de papers, extração automática de dados e relatórios gerados por inteligência artificial. Acelere sua pesquisa em até 10x.",
    en: "Semantic search across millions of papers, automatic data extraction, and AI-generated reports. Speed up your research by up to 10x.",
  },
  "hero.searchPlaceholder": {
    pt: "Qual é sua pergunta de pesquisa? Ex: Efeitos do jejum intermitente na pressão arterial",
    en: "What's your research question? E.g., Effects of intermittent fasting on blood pressure",
  },
  "hero.cta": { pt: "Pesquisar com IA", en: "Search with AI" },
  "hero.ctaSecondary": { pt: "Ver como funciona", en: "See how it works" },

  // Social proof
  "social.trusted": { pt: "Usado por pesquisadores em", en: "Trusted by researchers at" },
  "social.papers": { pt: "papers indexados", en: "papers indexed" },
  "social.researchers": { pt: "pesquisadores", en: "researchers" },
  "social.universities": { pt: "universidades", en: "universities" },
  "social.timeSaved": { pt: "economia de tempo", en: "time saved" },

  // Features
  "features.title": { pt: "Tudo que você precisa para pesquisar melhor", en: "Everything you need to research better" },
  "features.subtitle": {
    pt: "Ferramentas poderosas de IA projetadas para cada etapa do processo de pesquisa acadêmica.",
    en: "Powerful AI tools designed for every stage of the academic research process.",
  },
  "features.search.title": { pt: "Busca Semântica", en: "Semantic Search" },
  "features.search.desc": {
    pt: "Faça perguntas em linguagem natural e encontre artigos relevantes em Semantic Scholar e PubMed simultaneamente.",
    en: "Ask questions in natural language and find relevant papers across Semantic Scholar and PubMed simultaneously.",
  },
  "features.extraction.title": { pt: "Extração em Tabela", en: "Table Extraction" },
  "features.extraction.desc": {
    pt: "IA extrai dados específicos de cada paper — amostra, metodologia, resultados — e organiza em colunas comparativas.",
    en: "AI extracts specific data from each paper — sample size, methodology, results — organized in comparative columns.",
  },
  "features.reports.title": { pt: "Relatórios por IA", en: "AI Reports" },
  "features.reports.desc": {
    pt: "Síntese automática de dezenas de artigos em um texto coerente com citações no nível da frase.",
    en: "Automatic synthesis of dozens of papers into coherent text with sentence-level citations.",
  },
  "features.review.title": { pt: "Revisão Sistemática", en: "Systematic Review" },
  "features.review.desc": {
    pt: "Automatize triagem de artigos com critérios de inclusão/exclusão e extração de dados em massa.",
    en: "Automate paper screening with inclusion/exclusion criteria and bulk data extraction.",
  },

  // CTA section
  "cta.title": { pt: "Comece a pesquisar de forma mais inteligente", en: "Start researching smarter" },
  "cta.subtitle": {
    pt: "Junte-se a milhares de pesquisadores que já economizam horas em cada revisão de literatura.",
    en: "Join thousands of researchers already saving hours on every literature review.",
  },
  "cta.button": { pt: "Criar conta gratuita", en: "Create free account" },

  // Footer
  "footer.product": { pt: "Produto", en: "Product" },
  "footer.resources": { pt: "Recursos", en: "Resources" },
  "footer.company": { pt: "Empresa", en: "Company" },
  "footer.legal": { pt: "Legal", en: "Legal" },
  "footer.searchArticles": { pt: "Buscar Artigos", en: "Search Papers" },
  "footer.systematicReview": { pt: "Revisão Sistemática", en: "Systematic Review" },
  "footer.alerts": { pt: "Alertas", en: "Alerts" },
  "footer.aiReports": { pt: "Relatórios IA", en: "AI Reports" },
  "footer.helpCenter": { pt: "Central de Ajuda", en: "Help Center" },
  "footer.blog": { pt: "Blog", en: "Blog" },
  "footer.docs": { pt: "Documentação", en: "Documentation" },
  "footer.aboutUs": { pt: "Sobre Nós", en: "About Us" },
  "footer.careers": { pt: "Carreiras", en: "Careers" },
  "footer.contact": { pt: "Contato", en: "Contact" },
  "footer.terms": { pt: "Termos de Serviço", en: "Terms of Service" },
  "footer.privacy": { pt: "Política de Privacidade", en: "Privacy Policy" },
  "footer.rights": { pt: "Todos os direitos reservados.", en: "All rights reserved." },
} as const;

export type TranslationKey = keyof typeof translations;
