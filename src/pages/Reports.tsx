import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/app/AppHeader";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, Loader2, Sparkles, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface SavedSearch {
  id: string;
  query: string;
  papers: any[];
  columns: any[];
  column_data: Record<string, Record<number, string>>;
  created_at: string;
}

interface Report {
  id: string;
  title: string;
  content: string;
  searchId: string;
  createdAt: string;
}

const SYNTHESIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/synthesize-papers`;

const Reports = () => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchSavedSearches();
      // Load reports from localStorage
      const stored = localStorage.getItem(`reports_${user.id}`);
      if (stored) setReports(JSON.parse(stored));
    }
    setLoading(false);
  }, [user]);

  const fetchSavedSearches = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setSavedSearches(data as unknown as SavedSearch[]);
  };

  const generateReport = async (search: SavedSearch) => {
    setGenerating(search.id);
    try {
      const resp = await fetch(SYNTHESIZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          query: search.query,
          papers: search.papers.slice(0, 15),
          locale,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Generation failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullText += content;
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      const newReport: Report = {
        id: crypto.randomUUID(),
        title: search.query,
        content: fullText,
        searchId: search.id,
        createdAt: new Date().toISOString(),
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      if (user) localStorage.setItem(`reports_${user.id}`, JSON.stringify(updated));
      toast.success(locale === "pt" ? "Relatório gerado!" : "Report generated!");
    } catch (err) {
      console.error(err);
      toast.error(locale === "pt" ? "Erro ao gerar relatório" : "Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  const exportReportPDF = (report: Report) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text(report.title, 14, 20);
    doc.setFontSize(9);
    doc.text(new Date(report.createdAt).toLocaleDateString(), 14, 28);
    doc.setFontSize(11);

    const lines = doc.splitTextToSize(report.content, 180);
    let y = 36;
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 14; }
      doc.text(line, 14, y);
      y += 5.5;
    }
    doc.save(`report-${report.title.slice(0, 30).replace(/\s+/g, "_")}.pdf`);
  };

  const deleteReport = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    if (user) localStorage.setItem(`reports_${user.id}`, JSON.stringify(updated));
    toast.success(locale === "pt" ? "Relatório removido" : "Report deleted");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="container max-w-5xl flex-1 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">{t("reports.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("reports.subtitle")}</p>
        </div>

        {/* Generate from saved searches */}
        {savedSearches.length > 0 && (
          <div className="mb-8 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {locale === "pt" ? "Gerar relatório a partir de pesquisa salva" : "Generate report from saved search"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {savedSearches.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.query}</p>
                    <p className="text-xs text-muted-foreground">
                      {(s.papers || []).length} papers • {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => generateReport(s)}
                    disabled={generating === s.id}
                    className="ml-3 flex-shrink-0"
                  >
                    {generating === s.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {locale === "pt" ? "Gerar" : "Generate"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports list */}
        {reports.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {locale === "pt" ? "Seus relatórios" : "Your reports"}
            </h2>
            {reports.map((report) => (
              <div key={report.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div>
                    <h3 className="font-medium text-foreground">{report.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportReportPDF(report)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteReport(report.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-4">
                  <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {report.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : savedSearches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 py-20">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{t("reports.empty")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reports.emptyHint")}
            </p>
            <Button className="mt-4" onClick={() => navigate("/library")}>
              {t("reports.goLibrary")}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default Reports;
