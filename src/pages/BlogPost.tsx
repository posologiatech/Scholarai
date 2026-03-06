import { useParams, Link } from "react-router-dom";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";

const blogPostsContent: Record<string, { pt: { title: string; date: string; readTime: string; category: string; content: string }; en: { title: string; date: string; readTime: string; category: string; content: string } }> = {
  "ia-revisao-literatura": {
    pt: {
      title: "Como a IA está transformando a revisão de literatura acadêmica",
      date: "18 Fev 2026",
      readTime: "8 min",
      category: "IA & Pesquisa",
      content: `A inteligência artificial está revolucionando a forma como pesquisadores conduzem revisões de literatura. Tradicionalmente, esse processo envolvia semanas — ou até meses — de busca manual, leitura de resumos e organização de referências. Hoje, ferramentas baseadas em IA conseguem automatizar grande parte dessas tarefas.

## O problema da revisão manual

Pesquisadores enfrentam um volume crescente de publicações científicas. Estima-se que mais de 3 milhões de artigos são publicados anualmente. Filtrar, ler e sintetizar esse volume é humanamente impossível sem auxílio tecnológico.

## Como a IA ajuda

- **Busca inteligente**: Algoritmos de NLP entendem o contexto da sua pergunta de pesquisa e retornam resultados mais relevantes do que buscas por palavras-chave simples.
- **Triagem automática**: Modelos de machine learning classificam artigos como relevantes ou irrelevantes com base nos seus critérios de inclusão/exclusão.
- **Extração de dados**: A IA pode extrair automaticamente informações estruturadas como tamanho da amostra, metodologia, resultados principais e conclusões.
- **Síntese narrativa**: Modelos de linguagem geram resumos e sínteses dos artigos selecionados, acelerando a escrita do seu trabalho.

## O papel do pesquisador

É importante ressaltar que a IA não substitui o pesquisador — ela o potencializa. A decisão final sobre inclusão de artigos, interpretação de resultados e construção de argumentos continua sendo humana. A IA é uma ferramenta que elimina o trabalho repetitivo e permite que o pesquisador foque no que realmente importa: pensar criticamente.

## Conclusão

A adoção de ferramentas de IA na revisão de literatura não é mais uma tendência futura — é uma realidade presente. Pesquisadores que adotam essas ferramentas conseguem produzir revisões mais abrangentes, em menos tempo e com maior rigor metodológico.`,
    },
    en: {
      title: "How AI is transforming academic literature review",
      date: "Feb 18, 2026",
      readTime: "8 min",
      category: "AI & Research",
      content: `Artificial intelligence is revolutionizing how researchers conduct literature reviews. Traditionally, this process involved weeks — or even months — of manual searching, reading abstracts, and organizing references. Today, AI-based tools can automate much of these tasks.

## The problem with manual review

Researchers face a growing volume of scientific publications. It is estimated that over 3 million papers are published annually. Filtering, reading, and synthesizing this volume is humanly impossible without technological assistance.

## How AI helps

- **Smart search**: NLP algorithms understand the context of your research question and return more relevant results than simple keyword searches.
- **Automatic screening**: Machine learning models classify papers as relevant or irrelevant based on your inclusion/exclusion criteria.
- **Data extraction**: AI can automatically extract structured information such as sample size, methodology, main results, and conclusions.
- **Narrative synthesis**: Language models generate summaries and syntheses of selected papers, accelerating the writing of your work.

## The researcher's role

It's important to note that AI does not replace the researcher — it empowers them. The final decision on paper inclusion, interpretation of results, and argument construction remains human. AI is a tool that eliminates repetitive work and allows the researcher to focus on what truly matters: thinking critically.

## Conclusion

The adoption of AI tools in literature review is no longer a future trend — it is a present reality. Researchers who adopt these tools can produce more comprehensive reviews, in less time, and with greater methodological rigor.`,
    },
  },
  "guia-revisao-sistematica": {
    pt: {
      title: "Guia completo: Revisão Sistemática com auxílio de IA",
      date: "10 Fev 2026",
      readTime: "12 min",
      category: "Tutoriais",
      content: `Conduzir uma revisão sistemática é uma das tarefas mais complexas e demoradas da pesquisa acadêmica. Neste guia, mostramos como utilizar ferramentas de IA para tornar esse processo mais eficiente sem comprometer a qualidade.

## Etapa 1: Definição da pergunta de pesquisa

Toda revisão sistemática começa com uma pergunta bem formulada. Use frameworks como PICO (População, Intervenção, Comparação, Desfecho) para estruturar sua questão. A IA pode ajudar sugerindo termos de busca e sinônimos relacionados à sua pergunta.

## Etapa 2: Estratégia de busca

Construa strings de busca combinando termos com operadores booleanos (AND, OR, NOT). Ferramentas de IA podem gerar automaticamente essas strings a partir da sua pergunta de pesquisa, garantindo maior cobertura das bases de dados.

## Etapa 3: Triagem de artigos

Esta é a etapa mais beneficiada pela IA. Modelos de classificação podem analisar milhares de títulos e resumos em minutos, priorizando os mais relevantes. O pesquisador então revisa as decisões do modelo, focando nos casos limítrofes.

## Etapa 4: Extração de dados

A extração manual de dados é tediosa e propensa a erros. A IA pode pré-preencher formulários de extração identificando automaticamente variáveis como tamanho da amostra, delineamento do estudo e desfechos medidos.

## Etapa 5: Avaliação de qualidade

Ferramentas de IA auxiliam na avaliação do risco de viés utilizando escalas padronizadas como RoB 2 e ROBINS-I, identificando automaticamente potenciais problemas metodológicos.

## Etapa 6: Síntese e relatório

A IA gera rascunhos de síntese narrativa e pode auxiliar na criação de tabelas de evidências, diagramas PRISMA e relatórios estruturados seguindo as diretrizes PRISMA 2020.

## Conclusão

A IA não substitui o rigor metodológico necessário em uma revisão sistemática, mas torna o processo significativamente mais eficiente. Ao automatizar tarefas repetitivas, o pesquisador pode dedicar mais tempo à análise crítica e à interpretação dos resultados.`,
    },
    en: {
      title: "Complete guide: Systematic Review with AI assistance",
      date: "Feb 10, 2026",
      readTime: "12 min",
      category: "Tutorials",
      content: `Conducting a systematic review is one of the most complex and time-consuming tasks in academic research. In this guide, we show how to use AI tools to make this process more efficient without compromising quality.

## Step 1: Defining the research question

Every systematic review starts with a well-formulated question. Use frameworks like PICO (Population, Intervention, Comparison, Outcome) to structure your question. AI can help by suggesting search terms and synonyms related to your question.

## Step 2: Search strategy

Build search strings combining terms with Boolean operators (AND, OR, NOT). AI tools can automatically generate these strings from your research question, ensuring greater database coverage.

## Step 3: Article screening

This is the step most benefited by AI. Classification models can analyze thousands of titles and abstracts in minutes, prioritizing the most relevant ones. The researcher then reviews the model's decisions, focusing on borderline cases.

## Step 4: Data extraction

Manual data extraction is tedious and error-prone. AI can pre-fill extraction forms by automatically identifying variables such as sample size, study design, and measured outcomes.

## Step 5: Quality assessment

AI tools assist in risk of bias assessment using standardized scales like RoB 2 and ROBINS-I, automatically identifying potential methodological issues.

## Step 6: Synthesis and report

AI generates narrative synthesis drafts and can help create evidence tables, PRISMA diagrams, and structured reports following PRISMA 2020 guidelines.

## Conclusion

AI does not replace the methodological rigor required in a systematic review, but it makes the process significantly more efficient. By automating repetitive tasks, the researcher can dedicate more time to critical analysis and interpretation of results.`,
    },
  },
  "erros-busca-literatura": {
    pt: {
      title: "5 erros comuns na busca de literatura e como evitá-los",
      date: "2 Fev 2026",
      readTime: "6 min",
      category: "Dicas",
      content: `A busca de literatura é a base de qualquer trabalho acadêmico. No entanto, pesquisadores frequentemente cometem erros que comprometem a abrangência e a qualidade da revisão. Aqui estão os 5 erros mais comuns e como evitá-los.

## Erro 1: Usar apenas uma base de dados

Muitos pesquisadores se limitam ao PubMed ou ao Google Scholar. Cada base de dados tem cobertura diferente. Para uma revisão abrangente, é essencial buscar em múltiplas bases como Semantic Scholar, Scopus, Web of Science e bases específicas da sua área.

## Erro 2: Strings de busca muito restritivas

Usar termos muito específicos ou poucos sinônimos resulta em uma busca que perde artigos relevantes. Use operadores booleanos, truncamento e sinônimos para ampliar a cobertura sem perder a precisão.

## Erro 3: Não documentar a estratégia de busca

A reprodutibilidade é fundamental na pesquisa. Documente exatamente quais termos, filtros e bases de dados foram utilizados. Isso permite que outros pesquisadores repliquem ou atualizem sua revisão.

## Erro 4: Ignorar a literatura cinza

Teses, dissertações, relatórios técnicos e preprints contêm evidências valiosas que não aparecem em bases de dados tradicionais. Incluir a literatura cinza reduz o viés de publicação.

## Erro 5: Não atualizar a busca

A literatura científica evolui rapidamente. Uma busca realizada no início do projeto pode estar desatualizada no momento da submissão. Configure alertas automáticos para manter sua revisão atualizada.

## Conclusão

Evitar esses erros é essencial para produzir revisões de qualidade. Ferramentas de IA podem ajudar em cada uma dessas etapas, desde a construção de strings de busca até o monitoramento contínuo de novas publicações.`,
    },
    en: {
      title: "5 common mistakes in literature search and how to avoid them",
      date: "Feb 2, 2026",
      readTime: "6 min",
      category: "Tips",
      content: `Literature search is the foundation of any academic work. However, researchers frequently make mistakes that compromise the breadth and quality of their review. Here are the 5 most common mistakes and how to avoid them.

## Mistake 1: Using only one database

Many researchers limit themselves to PubMed or Google Scholar. Each database has different coverage. For a comprehensive review, it's essential to search multiple databases like Semantic Scholar, Scopus, Web of Science, and field-specific databases.

## Mistake 2: Overly restrictive search strings

Using very specific terms or few synonyms results in a search that misses relevant papers. Use Boolean operators, truncation, and synonyms to broaden coverage without losing precision.

## Mistake 3: Not documenting the search strategy

Reproducibility is fundamental in research. Document exactly which terms, filters, and databases were used. This allows other researchers to replicate or update your review.

## Mistake 4: Ignoring grey literature

Theses, dissertations, technical reports, and preprints contain valuable evidence that doesn't appear in traditional databases. Including grey literature reduces publication bias.

## Mistake 5: Not updating the search

Scientific literature evolves rapidly. A search conducted at the beginning of a project may be outdated by the time of submission. Set up automatic alerts to keep your review current.

## Conclusion

Avoiding these mistakes is essential for producing quality reviews. AI tools can help at each of these stages, from building search strings to continuous monitoring of new publications.`,
    },
  },
  "semantic-scholar-vs-pubmed": {
    pt: {
      title: "Semantic Scholar vs PubMed: qual base usar para sua pesquisa?",
      date: "25 Jan 2026",
      readTime: "10 min",
      category: "Comparações",
      content: `Escolher a base de dados certa é crucial para o sucesso da sua revisão de literatura. Semantic Scholar e PubMed são duas das maiores e mais utilizadas, mas possuem diferenças importantes.

## PubMed

O PubMed é mantido pela National Library of Medicine (NLM) dos EUA e é a principal base de dados para ciências biomédicas e da saúde.

**Pontos fortes:**
- Mais de 36 milhões de citações
- Indexação com termos MeSH (Medical Subject Headings)
- Filtros avançados por tipo de estudo, data, idioma
- Padrão ouro para revisões sistemáticas em saúde

**Limitações:**
- Foco restrito em biomedicina
- Não inclui ciências sociais, engenharia ou computação
- Interface de busca pode ser complexa para iniciantes

## Semantic Scholar

O Semantic Scholar é uma ferramenta de IA desenvolvida pelo Allen Institute for AI que indexa artigos de diversas áreas do conhecimento.

**Pontos fortes:**
- Mais de 200 milhões de artigos indexados
- Cobertura multidisciplinar
- Análise de citações com IA (TLDR, citações influentes)
- API aberta para integração com ferramentas

**Limitações:**
- Menos controle sobre filtros de busca
- Sem indexação padronizada como MeSH
- Pode incluir artigos de qualidade variável

## Quando usar cada uma?

| Critério | PubMed | Semantic Scholar |
|----------|--------|------------------|
| Área biomédica | ✅ Ideal | ✅ Bom |
| Multidisciplinar | ❌ Limitado | ✅ Ideal |
| Revisão sistemática | ✅ Padrão | ✅ Complementar |
| Busca exploratória | ❌ Limitado | ✅ Ideal |

## Conclusão

A resposta ideal é: use ambas. PubMed oferece precisão e padronização para áreas biomédicas, enquanto o Semantic Scholar oferece amplitude e recursos de IA para análise. Combinar as duas bases maximiza a cobertura da sua revisão.`,
    },
    en: {
      title: "Semantic Scholar vs PubMed: which database for your research?",
      date: "Jan 25, 2026",
      readTime: "10 min",
      category: "Comparisons",
      content: `Choosing the right database is crucial for the success of your literature review. Semantic Scholar and PubMed are two of the largest and most used, but they have important differences.

## PubMed

PubMed is maintained by the US National Library of Medicine (NLM) and is the primary database for biomedical and health sciences.

**Strengths:**
- Over 36 million citations
- MeSH (Medical Subject Headings) indexing
- Advanced filters by study type, date, language
- Gold standard for health systematic reviews

**Limitations:**
- Narrow focus on biomedicine
- Doesn't include social sciences, engineering, or computer science
- Search interface can be complex for beginners

## Semantic Scholar

Semantic Scholar is an AI tool developed by the Allen Institute for AI that indexes papers from various fields of knowledge.

**Strengths:**
- Over 200 million indexed papers
- Multidisciplinary coverage
- AI-powered citation analysis (TLDR, influential citations)
- Open API for tool integration

**Limitations:**
- Less control over search filters
- No standardized indexing like MeSH
- May include papers of varying quality

## When to use each?

| Criteria | PubMed | Semantic Scholar |
|----------|--------|------------------|
| Biomedical area | ✅ Ideal | ✅ Good |
| Multidisciplinary | ❌ Limited | ✅ Ideal |
| Systematic review | ✅ Standard | ✅ Complementary |
| Exploratory search | ❌ Limited | ✅ Ideal |

## Conclusion

The ideal answer is: use both. PubMed offers precision and standardization for biomedical areas, while Semantic Scholar offers breadth and AI features for analysis. Combining both databases maximizes your review coverage.`,
    },
  },
  "extrair-dados-automaticamente": {
    pt: {
      title: "Como extrair dados de artigos científicos automaticamente",
      date: "15 Jan 2026",
      readTime: "7 min",
      category: "Tutoriais",
      content: `A extração de dados é uma das etapas mais demoradas e propensas a erros em revisões sistemáticas e meta-análises. Felizmente, a IA está tornando esse processo muito mais eficiente.

## O que é extração de dados?

Na pesquisa acadêmica, extração de dados é o processo de identificar e registrar informações específicas de cada artigo incluído na revisão. Isso inclui: características do estudo, tamanho da amostra, intervenções, desfechos, resultados estatísticos e conclusões.

## Desafios da extração manual

- **Tempo**: Um revisor experiente pode levar 30-60 minutos por artigo
- **Inconsistência**: Diferentes revisores podem interpretar informações de forma diferente
- **Erros**: A fadiga leva a omissões e erros de transcrição
- **Escala**: Revisões com centenas de artigos tornam-se inviáveis

## Como a IA automatiza a extração

### 1. Processamento de linguagem natural (NLP)
Modelos de NLP leem o texto completo do artigo e identificam automaticamente as informações relevantes com base nos campos definidos pelo pesquisador.

### 2. Extração estruturada
A IA organiza os dados extraídos em formato tabular, facilitando a análise e comparação entre estudos.

### 3. Validação humana
O pesquisador revisa e corrige as extrações da IA, garantindo qualidade. Esse processo é muito mais rápido do que fazer a extração do zero.

## Melhores práticas

1. **Defina campos claros**: Quanto mais específico o campo de extração, melhor o resultado da IA
2. **Use prompts detalhados**: Descreva exatamente o que você quer extrair
3. **Revise sempre**: A IA é uma assistente, não uma substituta
4. **Documente ajustes**: Registre quando e por que você corrigiu uma extração

## Conclusão

A extração automática de dados com IA reduz o tempo do processo em até 70%, mantendo ou melhorando a qualidade dos dados extraídos. É uma ferramenta indispensável para pesquisadores modernos.`,
    },
    en: {
      title: "How to automatically extract data from scientific papers",
      date: "Jan 15, 2026",
      readTime: "7 min",
      category: "Tutorials",
      content: `Data extraction is one of the most time-consuming and error-prone steps in systematic reviews and meta-analyses. Fortunately, AI is making this process much more efficient.

## What is data extraction?

In academic research, data extraction is the process of identifying and recording specific information from each paper included in the review. This includes: study characteristics, sample size, interventions, outcomes, statistical results, and conclusions.

## Challenges of manual extraction

- **Time**: An experienced reviewer can take 30-60 minutes per paper
- **Inconsistency**: Different reviewers may interpret information differently
- **Errors**: Fatigue leads to omissions and transcription errors
- **Scale**: Reviews with hundreds of papers become unfeasible

## How AI automates extraction

### 1. Natural Language Processing (NLP)
NLP models read the full text of the paper and automatically identify relevant information based on fields defined by the researcher.

### 2. Structured extraction
AI organizes extracted data in tabular format, facilitating analysis and comparison between studies.

### 3. Human validation
The researcher reviews and corrects AI extractions, ensuring quality. This process is much faster than extracting from scratch.

## Best practices

1. **Define clear fields**: The more specific the extraction field, the better the AI result
2. **Use detailed prompts**: Describe exactly what you want to extract
3. **Always review**: AI is an assistant, not a substitute
4. **Document adjustments**: Record when and why you corrected an extraction

## Conclusion

Automatic data extraction with AI reduces process time by up to 70%, while maintaining or improving the quality of extracted data. It's an indispensable tool for modern researchers.`,
    },
  },
  "futuro-publicacao-cientifica": {
    pt: {
      title: "O futuro da publicação científica: tendências para 2026",
      date: "8 Jan 2026",
      readTime: "9 min",
      category: "Tendências",
      content: `O ecossistema de publicação científica está passando por transformações profundas. Preprints, open access e inteligência artificial estão moldando o futuro da comunicação acadêmica.

## 1. Preprints como padrão

Os preprints — artigos publicados antes da revisão por pares — deixaram de ser uma exceção para se tornarem parte integral do fluxo de publicação. Plataformas como arXiv, bioRxiv e medRxiv aceleraram a disseminação do conhecimento, especialmente durante crises como a pandemia de COVID-19.

## 2. Open Access universal

O movimento por acesso aberto continua ganhando força. Agências de financiamento cada vez mais exigem que pesquisas financiadas com recursos públicos sejam publicadas em acesso aberto. O Plan S na Europa e políticas similares em outros países estão acelerando essa transição.

## 3. Revisão por pares com IA

A revisão por pares tradicional enfrenta desafios: falta de revisores, longos tempos de espera e inconsistência nas avaliações. Ferramentas de IA estão sendo desenvolvidas para auxiliar editores e revisores, verificando automaticamente questões metodológicas, estatísticas e de formatação.

## 4. Publicação contínua

O modelo de publicação por edições periódicas está dando lugar à publicação contínua, onde artigos são disponibilizados assim que aceitos, sem esperar pela composição de um volume completo.

## 5. Dados e código abertos

A reprodutibilidade exige que dados e códigos sejam compartilhados junto com os artigos. Repositórios como Zenodo, Figshare e GitHub estão se tornando complementos essenciais das publicações tradicionais.

## 6. Métricas alternativas

O Fator de Impacto está perdendo seu monopólio como medida de qualidade. Altmetrics — que incluem menções em redes sociais, downloads e citações em políticas públicas — oferecem uma visão mais completa do impacto de uma pesquisa.

## Conclusão

O futuro da publicação científica é mais aberto, mais rápido e mais transparente. Pesquisadores que se adaptarem a essas tendências estarão melhor posicionados para maximizar o impacto e a visibilidade de seu trabalho.`,
    },
    en: {
      title: "The future of scientific publishing: trends for 2026",
      date: "Jan 8, 2026",
      readTime: "9 min",
      category: "Trends",
      content: `The scientific publishing ecosystem is undergoing profound transformations. Preprints, open access, and artificial intelligence are shaping the future of academic communication.

## 1. Preprints as standard

Preprints — papers published before peer review — have gone from being an exception to becoming an integral part of the publication workflow. Platforms like arXiv, bioRxiv, and medRxiv have accelerated knowledge dissemination, especially during crises like the COVID-19 pandemic.

## 2. Universal Open Access

The open access movement continues to gain momentum. Funding agencies increasingly require that publicly funded research be published in open access. Plan S in Europe and similar policies in other countries are accelerating this transition.

## 3. AI-assisted peer review

Traditional peer review faces challenges: lack of reviewers, long wait times, and inconsistency in evaluations. AI tools are being developed to assist editors and reviewers, automatically checking methodological, statistical, and formatting issues.

## 4. Continuous publication

The periodic issue publication model is giving way to continuous publication, where papers are made available as soon as they are accepted, without waiting for a complete volume.

## 5. Open data and code

Reproducibility requires that data and code be shared alongside papers. Repositories like Zenodo, Figshare, and GitHub are becoming essential complements to traditional publications.

## 6. Alternative metrics

The Impact Factor is losing its monopoly as a quality measure. Altmetrics — which include social media mentions, downloads, and citations in public policies — offer a more complete view of a research's impact.

## Conclusion

The future of scientific publishing is more open, faster, and more transparent. Researchers who adapt to these trends will be better positioned to maximize the impact and visibility of their work.`,
    },
  },
};

const slugs = [
  "ia-revisao-literatura",
  "guia-revisao-sistematica",
  "erros-busca-literatura",
  "semantic-scholar-vs-pubmed",
  "extrair-dados-automaticamente",
  "futuro-publicacao-cientifica",
];

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useLanguage();

  const post = slug ? blogPostsContent[slug]?.[locale] : null;

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="py-16 md:py-24">
          <div className="container mx-auto max-w-3xl text-center">
            <h1 className="mb-4 font-display text-3xl font-bold text-foreground">
              {locale === "pt" ? "Post não encontrado" : "Post not found"}
            </h1>
            <Link to="/blog" className="text-primary hover:underline">
              {locale === "pt" ? "← Voltar ao blog" : "← Back to blog"}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-3xl">
          <Link
            to="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === "pt" ? "Voltar ao blog" : "Back to blog"}
          </Link>

          <span className="mb-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {post.category}
          </span>

          <h1 className="mb-6 font-display text-3xl font-bold text-foreground md:text-4xl leading-tight">
            {post.title}
          </h1>

          <div className="mb-10 flex items-center gap-4 text-sm text-muted-foreground border-b border-border pb-6">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {locale === "pt" ? "Equipe ScholarAI" : "ScholarAI Team"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>

          <article className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
            {post.content.split("\n\n").map((block, i) => {
              if (block.startsWith("## ")) {
                return (
                  <h2 key={i} className="mt-10 mb-4 text-2xl font-bold">
                    {block.replace("## ", "")}
                  </h2>
                );
              }
              if (block.startsWith("### ")) {
                return (
                  <h3 key={i} className="mt-8 mb-3 text-xl font-semibold">
                    {block.replace("### ", "")}
                  </h3>
                );
              }
              if (block.startsWith("- ") || block.startsWith("1. ")) {
                const items = block.split("\n");
                const isOrdered = block.startsWith("1. ");
                const ListTag = isOrdered ? "ol" : "ul";
                return (
                  <ListTag key={i} className={`my-4 space-y-2 ${isOrdered ? "list-decimal" : "list-disc"} pl-6`}>
                    {items.map((item, j) => (
                      <li key={j} dangerouslySetInnerHTML={{ __html: item.replace(/^[-\d]+\.?\s*/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                    ))}
                  </ListTag>
                );
              }
              if (block.startsWith("|")) {
                const rows = block.split("\n").filter((r) => !r.match(/^\|[-\s|]+\|$/));
                return (
                  <div key={i} className="my-6 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {rows[0]?.split("|").filter(Boolean).map((cell, ci) => (
                            <th key={ci} className="border border-border bg-muted px-4 py-2 text-left font-semibold text-foreground">
                              {cell.trim()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(1).map((row, ri) => (
                          <tr key={ri}>
                            {row.split("|").filter(Boolean).map((cell, ci) => (
                              <td key={ci} className="border border-border px-4 py-2">
                                {cell.trim()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              return (
                <p key={i} className="my-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: block.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
              );
            })}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export { slugs };
export default BlogPost;
