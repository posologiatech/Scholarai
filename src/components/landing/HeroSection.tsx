import { useState, useEffect } from "react";
import { ArrowRight, Sparkles, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const TYPING_QUERIES_PT = [
  "Efeitos do exercício aeróbico na depressão em idosos?",
  "Impacto da telemedicina na adesão ao tratamento de diabetes?",
  "Cannabis medicinal para dor crônica: eficácia e segurança?",
];

const TYPING_QUERIES_EN = [
  "Effects of aerobic exercise on depression in elderly?",
  "Impact of telemedicine on diabetes treatment adherence?",
  "Medical cannabis for chronic pain: efficacy and safety?",
];

const HeroSection = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const queries = pt ? TYPING_QUERIES_PT : TYPING_QUERIES_EN;
  const [queryIndex, setQueryIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentQuery = queries[queryIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText.length < currentQuery.length) {
      timeout = setTimeout(() => setDisplayText(currentQuery.slice(0, displayText.length + 1)), 40);
    } else if (!isDeleting && displayText.length === currentQuery.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2500);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 20);
    } else if (isDeleting && displayText.length === 0) {
      setIsDeleting(false);
      setQueryIndex((prev) => (prev + 1) % queries.length);
    }
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, queryIndex, queries]);

  const stats = [
    { value: "200M+", label: pt ? "Artigos indexados" : "Papers indexed" },
    { value: "4", label: pt ? "Bases científicas" : "Databases" },
    { value: "10x", label: pt ? "Mais rápido" : "Faster" },
    { value: "6", label: pt ? "Etapas PRISMA" : "PRISMA steps" },
  ];

  return (
    <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-background to-accent/[0.03]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left — copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                {pt ? "Plataforma completa para pesquisa científica" : "Complete scientific research platform"}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-5 font-display text-4xl font-bold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]"
            >
              {pt ? (
                <>Da pergunta ao artigo publicável, <span className="text-primary">com IA</span></>
              ) : (
                <>From question to publishable paper, <span className="text-primary">with AI</span></>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              {pt
                ? "Busca semântica, revisão sistemática com Active Learning, pesquisas acadêmicas, TCLE digital com conformidade CEP/LGPD e pesquisa clínica — tudo em uma plataforma."
                : "Semantic search, systematic review with Active Learning, academic surveys, digital consent with CEP/LGPD compliance, and clinical research — all in one platform."}
            </motion.p>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8 flex flex-wrap gap-2"
            >
              {(pt
                ? ["Busca Booleana", "Active Learning", "PRISMA 2020", "Coleta de Dados", "TCLE Digital", "CEP/LGPD", "eCRF Clínico", "DataMind"]
                : ["Boolean Search", "Active Learning", "PRISMA 2020", "Data Collection", "Digital Consent", "CEP/LGPD", "Clinical eCRF", "DataMind"]
              ).map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {pill}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/signup">
                <Button
                  size="lg"
                  className="h-12 gap-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  {pt ? "Começar gratuitamente" : "Get started free"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/docs">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl text-sm font-medium"
                >
                  {pt ? "Ver documentação" : "View docs"}
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Right — interactive demo card */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/[0.06] overflow-hidden">
              {/* Fake browser bar */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-accent/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/40" />
                </div>
                <div className="flex-1 mx-8">
                  <div className="flex items-center gap-2 rounded-md bg-background border border-border px-3 py-1.5">
                    <Search className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground/50">scholarai.app</span>
                  </div>
                </div>
              </div>

              {/* Search area */}
              <div className="p-6">
                <div className="mb-5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {pt ? "Sua pergunta de pesquisa" : "Your research question"}
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-background px-4 py-3 shadow-sm">
                    <Search className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground min-h-[20px]">
                      {displayText}
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="text-primary"
                      >
                        |
                      </motion.span>
                    </span>
                  </div>
                </div>

                {/* Simulated results */}
                <div className="space-y-2.5">
                  {[
                    { score: 94, color: "bg-success" },
                    { score: 87, color: "bg-success" },
                    { score: 72, color: "bg-primary" },
                    { score: 58, color: "bg-muted-foreground/30" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.12 }}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3"
                    >
                      <div className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2 w-[75%] rounded bg-foreground/12" />
                        <div className="h-1.5 w-[50%] rounded bg-muted-foreground/8" />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{item.score}%</span>
                    </motion.div>
                  ))}
                </div>

                {/* Mini extraction table */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="mt-4 overflow-hidden rounded-lg border border-border/50"
                >
                  <div className="flex border-b border-border/50 bg-muted/30 text-[10px] font-medium text-muted-foreground">
                    <div className="flex-1 px-3 py-1.5">Paper</div>
                    <div className="w-20 px-2 py-1.5">{pt ? "Amostra" : "Sample"}</div>
                    <div className="w-20 px-2 py-1.5">{pt ? "Resultado" : "Outcome"}</div>
                  </div>
                  {[1, 2].map((i) => (
                    <div key={i} className="flex border-b border-border/30 last:border-0">
                      <div className="flex-1 px-3 py-2">
                        <div className="h-1.5 w-[65%] rounded bg-foreground/10" />
                      </div>
                      <div className="w-20 px-2 py-2">
                        <div className="h-1.5 w-10 rounded bg-primary/15" />
                      </div>
                      <div className="w-20 px-2 py-2">
                        <div className="h-1.5 w-12 rounded bg-primary/15" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Decorative floating badges */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5 }}
              className="absolute -right-3 top-16 hidden lg:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
            >
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-medium text-foreground">Active Learning</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.7 }}
              className="absolute -left-3 bottom-20 hidden lg:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
            >
              <span className="text-[10px]">📊</span>
              <span className="text-[10px] font-medium text-foreground">PRISMA 2020</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-2xl font-bold text-foreground md:text-3xl">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
