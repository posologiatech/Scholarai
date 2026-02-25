import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { Calendar, Clock, ArrowRight, User } from "lucide-react";
import { Link } from "react-router-dom";

const blogPosts = {
  pt: [
    {
      title: "Como a IA está transformando a revisão de literatura acadêmica",
      excerpt: "Descubra como ferramentas de inteligência artificial estão revolucionando o processo de busca e análise de artigos científicos, economizando horas de trabalho manual.",
      author: "Equipe ScholarAI",
      date: "18 Fev 2026",
      readTime: "8 min",
      category: "IA & Pesquisa",
    },
    {
      title: "Guia completo: Revisão Sistemática com auxílio de IA",
      excerpt: "Um passo a passo detalhado de como conduzir uma revisão sistemática usando ferramentas de IA para triagem, extração de dados e síntese de resultados.",
      author: "Equipe ScholarAI",
      date: "10 Fev 2026",
      readTime: "12 min",
      category: "Tutoriais",
    },
    {
      title: "5 erros comuns na busca de literatura e como evitá-los",
      excerpt: "Pesquisadores frequentemente cometem erros que comprometem a qualidade da revisão. Aprenda a identificar e corrigir esses problemas.",
      author: "Equipe ScholarAI",
      date: "2 Fev 2026",
      readTime: "6 min",
      category: "Dicas",
    },
    {
      title: "Semantic Scholar vs PubMed: qual base usar para sua pesquisa?",
      excerpt: "Comparamos as duas maiores bases de dados científicas e explicamos quando usar cada uma — ou ambas — para maximizar a cobertura da sua revisão.",
      author: "Equipe ScholarAI",
      date: "25 Jan 2026",
      readTime: "10 min",
      category: "Comparações",
    },
    {
      title: "Como extrair dados de artigos científicos automaticamente",
      excerpt: "A extração manual de dados é uma das etapas mais tediosas da pesquisa. Veja como automatizar esse processo com IA sem perder qualidade.",
      author: "Equipe ScholarAI",
      date: "15 Jan 2026",
      readTime: "7 min",
      category: "Tutoriais",
    },
    {
      title: "O futuro da publicação científica: tendências para 2026",
      excerpt: "Preprints, open access, peer review com IA — exploramos as principais tendências que estão moldando o futuro da comunicação científica.",
      author: "Equipe ScholarAI",
      date: "8 Jan 2026",
      readTime: "9 min",
      category: "Tendências",
    },
  ],
  en: [
    {
      title: "How AI is transforming academic literature review",
      excerpt: "Discover how artificial intelligence tools are revolutionizing the process of searching and analyzing scientific papers, saving hours of manual work.",
      author: "ScholarAI Team",
      date: "Feb 18, 2026",
      readTime: "8 min",
      category: "AI & Research",
    },
    {
      title: "Complete guide: Systematic Review with AI assistance",
      excerpt: "A detailed step-by-step guide on conducting a systematic review using AI tools for screening, data extraction, and results synthesis.",
      author: "ScholarAI Team",
      date: "Feb 10, 2026",
      readTime: "12 min",
      category: "Tutorials",
    },
    {
      title: "5 common mistakes in literature search and how to avoid them",
      excerpt: "Researchers often make mistakes that compromise review quality. Learn to identify and fix these problems.",
      author: "ScholarAI Team",
      date: "Feb 2, 2026",
      readTime: "6 min",
      category: "Tips",
    },
    {
      title: "Semantic Scholar vs PubMed: which database for your research?",
      excerpt: "We compare the two largest scientific databases and explain when to use each — or both — to maximize your review coverage.",
      author: "ScholarAI Team",
      date: "Jan 25, 2026",
      readTime: "10 min",
      category: "Comparisons",
    },
    {
      title: "How to automatically extract data from scientific papers",
      excerpt: "Manual data extraction is one of the most tedious research steps. See how to automate this process with AI without losing quality.",
      author: "ScholarAI Team",
      date: "Jan 15, 2026",
      readTime: "7 min",
      category: "Tutorials",
    },
    {
      title: "The future of scientific publishing: trends for 2026",
      excerpt: "Preprints, open access, AI peer review — we explore the main trends shaping the future of scientific communication.",
      author: "ScholarAI Team",
      date: "Jan 8, 2026",
      readTime: "9 min",
      category: "Trends",
    },
  ],
};

const Blog = () => {
  const { locale } = useLanguage();
  const posts = blogPosts[locale];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">
              Blog
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              {locale === "pt"
                ? "Artigos, tutoriais e novidades sobre pesquisa científica com IA"
                : "Articles, tutorials and news about AI-powered scientific research"}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <article
                key={i}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="mb-3 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {post.category}
                </span>
                <h2 className="mb-2 font-display text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
