import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const STEPS_EN = [
  { label: "Gather papers", active: true },
  { label: "Screen papers", active: false },
  { label: "Extract insights", active: false },
  { label: "Generate report", active: false },
];

const STEPS_PT = [
  { label: "Coletar artigos", active: true },
  { label: "Filtrar artigos", active: false },
  { label: "Extrair insights", active: false },
  { label: "Gerar relatório", active: false },
];

// Simulated paper thumbnails for the animation
const PaperThumbnail = ({ delay, variant }: { delay: number; variant: number }) => {
  const heights = [
    [40, 8, 32, 8, 20, 16],
    [32, 8, 40, 12, 8, 24],
    [28, 12, 36, 8, 16, 20],
    [36, 8, 28, 16, 12, 24],
  ];
  const h = heights[variant % heights.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.15 + 0.8, duration: 0.4 }}
      className="flex w-28 flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-3 shadow-sm"
    >
      {/* Title lines */}
      <div className="h-2 w-[80%] rounded bg-foreground/15" />
      <div className="h-2 w-[60%] rounded bg-foreground/10" />
      <div className="mt-1 space-y-1">
        <div className="h-1.5 w-full rounded bg-muted-foreground/8" />
        <div className="h-1.5 w-full rounded bg-muted-foreground/8" />
        <div className="h-1.5 w-[90%] rounded bg-muted-foreground/8" />
        <div className="h-1.5 w-full rounded bg-muted-foreground/8" />
        <div className="h-1.5 w-[70%] rounded bg-muted-foreground/8" />
      </div>
      <div className="mt-1 flex gap-1">
        <div className="h-6 w-10 rounded bg-muted" />
        <div className="h-6 flex-1 rounded bg-muted" />
      </div>
    </motion.div>
  );
};

// Chart-like decorative element
const ChartDecoration = ({ side }: { side: "left" | "right" }) => {
  const points = side === "left"
    ? "10,70 30,50 50,55 70,30 90,40"
    : "10,40 30,30 50,45 70,20 90,35";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5, duration: 0.8 }}
      className="hidden lg:block absolute"
      style={side === "left" ? { left: -60, top: "50%" } : { right: -60, top: "40%" }}
    >
      <svg width="100" height="80" viewBox="0 0 100 80" className="text-primary/20">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.split(" ").map((p, i) => {
          const [x, y] = p.split(",");
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill="currentColor"
            />
          );
        })}
      </svg>
    </motion.div>
  );
};

const HeroSection = () => {
  const { t, locale } = useLanguage();
  const steps = locale === "pt" ? STEPS_PT : STEPS_EN;
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <section className="relative overflow-hidden pb-24 pt-20 md:pt-28">
      {/* Subtle dotted background pattern */}
      <div className="absolute inset-0 -z-10" style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--primary) / 0.06) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />
      {/* Soft gradient wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background/80 to-muted/30" />

      <div className="container mx-auto max-w-4xl text-center">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-5 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-[3.5rem]"
        >
          {locale === "pt" ? "IA para Pesquisa Científica" : "AI for Scientific Research"}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground"
        >
          {locale === "pt"
            ? "ScholarAI ajuda pesquisadores a serem 10x mais baseados em evidências"
            : "ScholarAI helps researchers be 10x more evidence-based"}
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-16"
        >
          <Link to="/signup">
            <Button
              size="lg"
              className="h-14 min-w-[200px] gap-3 rounded-xl bg-foreground text-background text-base font-semibold hover:bg-foreground/90 shadow-lg"
            >
              {locale === "pt" ? "Começar agora" : "Try now"}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </motion.div>

        {/* Workflow animation card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative mx-auto max-w-2xl"
        >
          <ChartDecoration side="left" />
          <ChartDecoration side="right" />

          {/* Floating icons above card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mb-3 flex justify-center gap-2"
          >
            <div className="flex items-center gap-1 rounded-lg bg-foreground/90 px-2.5 py-1.5 shadow-md">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-background">
                <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-background">
                <polygon points="4,2 13,8 4,14" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          </motion.div>

          {/* Main card */}
          <div className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 overflow-hidden">
            {/* Active step with paper thumbnails */}
            <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <motion.div
                  key="gather"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent"
                    />
                    <span className="text-sm font-medium text-foreground">{steps[0].label}</span>
                  </div>
                  <div className="flex justify-center gap-3 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                      <PaperThumbnail key={i} delay={i} variant={i} />
                    ))}
                  </div>
                </motion.div>
              )}
              {activeStep === 1 && (
                <motion.div
                  key="screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent"
                    />
                    <span className="text-sm font-medium text-foreground">{steps[1].label}</span>
                  </div>
                  <div className="space-y-2">
                    {[85, 72, 68, 45].map((score, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3"
                      >
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: score > 60 ? "hsl(var(--success))" : "hsl(var(--muted-foreground) / 0.3)" }} />
                        <div className="flex-1">
                          <div className="h-2 w-[60%] rounded bg-foreground/12" />
                          <div className="mt-1 h-1.5 w-[40%] rounded bg-muted-foreground/8" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{score}%</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {activeStep === 2 && (
                <motion.div
                  key="extract"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent"
                    />
                    <span className="text-sm font-medium text-foreground">{steps[2].label}</span>
                  </div>
                  {/* Mini table */}
                  <div className="overflow-hidden rounded-lg border border-border/50">
                    <div className="flex border-b border-border/50 bg-muted/30">
                      <div className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground">Paper</div>
                      <div className="w-32 px-3 py-2 text-xs font-medium text-muted-foreground">
                        {locale === "pt" ? "Amostra" : "Sample"}
                      </div>
                      <div className="w-32 px-3 py-2 text-xs font-medium text-muted-foreground">
                        {locale === "pt" ? "Resultado" : "Outcome"}
                      </div>
                    </div>
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.2 }}
                        className="flex border-b border-border/30 last:border-0"
                      >
                        <div className="flex-1 px-3 py-2.5">
                          <div className="h-2 w-[70%] rounded bg-foreground/12" />
                          <div className="mt-1 h-1.5 w-[40%] rounded bg-muted-foreground/8" />
                        </div>
                        <div className="w-32 px-3 py-2.5">
                          <div className="h-2 w-12 rounded bg-primary/20" />
                        </div>
                        <div className="w-32 px-3 py-2.5">
                          <div className="h-2 w-16 rounded bg-primary/20" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {activeStep === 3 && (
                <motion.div
                  key="report"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent"
                    />
                    <span className="text-sm font-medium text-foreground">{steps[3].label}</span>
                  </div>
                  <div className="space-y-3 rounded-lg border border-border/50 bg-background p-4">
                    <div className="h-3 w-[50%] rounded bg-foreground/15" />
                    <div className="space-y-1.5">
                      <div className="h-2 w-full rounded bg-muted-foreground/8" />
                      <div className="h-2 w-full rounded bg-muted-foreground/8" />
                      <div className="h-2 w-[85%] rounded bg-muted-foreground/8" />
                    </div>
                    <div className="h-3 w-[40%] rounded bg-foreground/12 mt-2" />
                    <div className="space-y-1.5">
                      <div className="h-2 w-full rounded bg-muted-foreground/8" />
                      <div className="h-2 w-[90%] rounded bg-muted-foreground/8" />
                      <div className="h-2 w-full rounded bg-muted-foreground/8" />
                      <div className="h-2 w-[60%] rounded bg-muted-foreground/8" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step list */}
            <div className="border-t border-border">
              {steps.map((step, i) => (
                <button
                  key={step.label}
                  onClick={() => setActiveStep(i)}
                  className={`flex w-full items-center gap-3 border-b border-border/50 px-6 py-3.5 text-left text-sm transition-colors last:border-0 ${
                    i === activeStep
                      ? "bg-muted/40 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/20"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      i === activeStep
                        ? "border-primary"
                        : i < activeStep
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {i === activeStep && (
                      <motion.div
                        layoutId="step-dot"
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                      />
                    )}
                  </div>
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
