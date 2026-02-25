import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import AppHeader from "@/components/app/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, ExternalLink, Loader2, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

interface CitationEntry {
  id: string;
  cited_paper_id: string;
  classification: string;
  citation_context: string;
  confidence: number;
}

interface PaperInfo {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  doi?: string;
  url?: string;
  journal?: string;
}

const COLORS = {
  supporting: "hsl(var(--success))",
  contrasting: "hsl(var(--destructive))",
  mentioning: "hsl(var(--muted-foreground))",
};

const PaperReport = () => {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLanguage();
  const [paper, setPaper] = useState<PaperInfo | null>(null);
  const [citations, setCitations] = useState<CitationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!id) return;
    loadPaperData();
  }, [id]);

  const loadPaperData = async () => {
    if (!id) return;
    setLoading(true);

    // Load paper info from chunks
    const { data: chunks } = await supabase
      .from("paper_chunks")
      .select("paper_title, paper_id")
      .eq("paper_id", id)
      .limit(1);

    if (chunks && chunks.length > 0) {
      setPaper({
        id: chunks[0].paper_id,
        title: chunks[0].paper_title,
        authors: [],
        year: null,
        abstract: "",
      });
    }

    // Load citations
    const { data: citationData } = await supabase
      .from("citation_classifications")
      .select("*")
      .eq("paper_id", id);

    if (citationData) {
      setCitations(citationData as CitationEntry[]);
    }

    setLoading(false);
  };

  const triggerClassification = async () => {
    if (!id || !paper) return;
    setClassifying(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classify-citations`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ paper_id: id, paper_title: paper.title }),
      });
      if (resp.ok) {
        await loadPaperData();
      }
    } catch (err) {
      console.error("Classification failed:", err);
    } finally {
      setClassifying(false);
    }
  };

  const stats = {
    supporting: citations.filter((c) => c.classification === "supporting").length,
    contrasting: citations.filter((c) => c.classification === "contrasting").length,
    mentioning: citations.filter((c) => c.classification === "mentioning").length,
  };
  const total = stats.supporting + stats.contrasting + stats.mentioning;

  const pieData = [
    { name: locale === "pt" ? "Apoio" : "Supporting", value: stats.supporting, color: COLORS.supporting },
    { name: locale === "pt" ? "Contraste" : "Contrasting", value: stats.contrasting, color: COLORS.contrasting },
    { name: locale === "pt" ? "Menção" : "Mentioning", value: stats.mentioning, color: COLORS.mentioning },
  ].filter((d) => d.value > 0);

  const filteredCitations = filter === "all" ? citations : citations.filter((c) => c.classification === filter);

  const classificationIcon = (type: string) => {
    switch (type) {
      case "supporting": return <ThumbsUp className="h-3.5 w-3.5 text-success" />;
      case "contrasting": return <ThumbsDown className="h-3.5 w-3.5 text-destructive" />;
      default: return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const classificationLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      supporting: { pt: "Apoio", en: "Supporting" },
      contrasting: { pt: "Contraste", en: "Contrasting" },
      mentioning: { pt: "Menção", en: "Mentioning" },
    };
    return labels[type]?.[locale] || type;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl py-6 space-y-6">
          {/* Back */}
          <Link to="/search" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {locale === "pt" ? "Voltar à pesquisa" : "Back to search"}
          </Link>

          {loading ? (
            <div className="flex flex-col items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !paper ? (
            <div className="text-center py-16 text-muted-foreground">
              {locale === "pt" ? "Paper não encontrado" : "Paper not found"}
            </div>
          ) : (
            <>
              {/* Paper header */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-foreground leading-tight">{paper.title}</h1>
                {paper.doi && (
                  <a
                    href={`https://doi.org/${paper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    DOI: {paper.doi}
                  </a>
                )}
              </div>

              {/* Stats cards */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-foreground">{total}</p>
                    <p className="text-sm text-muted-foreground">
                      {locale === "pt" ? "Total de citações" : "Total citations"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-success">{stats.supporting}</p>
                    <p className="text-sm text-muted-foreground">
                      {locale === "pt" ? "Apoio" : "Supporting"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-destructive">{stats.contrasting}</p>
                    <p className="text-sm text-muted-foreground">
                      {locale === "pt" ? "Contraste" : "Contrasting"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-muted-foreground">{stats.mentioning}</p>
                    <p className="text-sm text-muted-foreground">
                      {locale === "pt" ? "Menção" : "Mentioning"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Chart + classify button */}
              {total === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center space-y-4">
                    <p className="text-muted-foreground">
                      {locale === "pt"
                        ? "Nenhuma classificação de citação encontrada para este paper."
                        : "No citation classifications found for this paper."}
                    </p>
                    <Button onClick={triggerClassification} disabled={classifying}>
                      {classifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {locale === "pt" ? "Classificar citações com IA" : "Classify citations with AI"}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {locale === "pt" ? "Índice de Citações" : "Citation Index"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {locale === "pt" ? "Distribuição" : "Distribution"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={pieData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis className="text-xs" />
                          <RechartsTooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Citation contexts list */}
              {total > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {locale === "pt" ? "Contextos de Citação" : "Citation Contexts"}
                      </CardTitle>
                      <div className="flex gap-1">
                        {["all", "supporting", "contrasting", "mentioning"].map((f) => (
                          <Button
                            key={f}
                            variant={filter === f ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => setFilter(f)}
                          >
                            {f === "all"
                              ? locale === "pt" ? "Todos" : "All"
                              : classificationLabel(f)}
                            {f !== "all" && (
                              <span className="ml-1">
                                ({f === "supporting" ? stats.supporting : f === "contrasting" ? stats.contrasting : stats.mentioning})
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredCitations.map((citation) => (
                        <div
                          key={citation.id}
                          className={`rounded-lg border p-4 ${
                            citation.classification === "supporting"
                              ? "border-success/30 bg-success/5"
                              : citation.classification === "contrasting"
                              ? "border-destructive/30 bg-destructive/5"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {classificationIcon(citation.classification)}
                            <Badge
                              variant={
                                citation.classification === "supporting"
                                  ? "default"
                                  : citation.classification === "contrasting"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {classificationLabel(citation.classification)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {locale === "pt" ? "Citado por" : "Cited by"}: {citation.cited_paper_id}
                            </span>
                          </div>
                          <p className="text-sm italic text-foreground/80 leading-relaxed">
                            "{citation.citation_context}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default PaperReport;
