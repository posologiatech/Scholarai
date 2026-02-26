import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Table, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractionColumn {
  id: string;
  name: string;
  prompt: string;
  enabled: boolean;
}

interface Paper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
}

interface StepExtractionProps {
  question: string;
  papers: Paper[];
  includedPaperIds: string[];
  columns: ExtractionColumn[];
  onColumnsChange: (c: ExtractionColumn[]) => void;
  extractionResults: Record<string, Record<string, string>>;
  onExtractionResultsChange: (r: Record<string, Record<string, string>>) => void;
  autoSuggestions: boolean;
  onNext: () => void;
  onPrev: () => void;
}

const StepExtraction = ({
  question,
  papers,
  includedPaperIds,
  columns,
  onColumnsChange,
  extractionResults,
  onExtractionResultsChange,
  autoSuggestions,
  onNext,
  onPrev,
}: StepExtractionProps) => {
  const { locale } = useLanguage();
  const [generatingColumns, setGeneratingColumns] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColPrompt, setNewColPrompt] = useState("");

  const includedPapers = papers.filter((p) => includedPaperIds.includes(p.id));

  useEffect(() => {
    if (autoSuggestions && columns.length === 0 && !generatingColumns) {
      generateColumns();
    }
  }, []);

  const generateColumns = async () => {
    setGeneratingColumns(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-screening-criteria", {
        body: { question, mode: "extraction" },
      });
      if (error) throw error;
      const generated: ExtractionColumn[] = (data?.criteria || []).map((c: any, i: number) => ({
        id: c.id || `col-${i}`,
        name: c.name,
        prompt: c.description,
        enabled: true,
      }));
      onColumnsChange(generated);
      toast.success(locale === "pt" ? "Campos de extração gerados!" : "Extraction fields generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate columns");
    } finally {
      setGeneratingColumns(false);
    }
  };

  const runExtraction = async () => {
    const enabledCols = columns.filter((c) => c.enabled);
    if (enabledCols.length === 0 || includedPapers.length === 0) return;
    setExtracting(true);
    try {
      const newResults = { ...extractionResults };

      for (const col of enabledCols) {
        // Filter papers that haven't been extracted for this column yet
        const papersToExtract = includedPapers.filter(
          (p) => !newResults[p.id]?.[col.id]
        );
        if (papersToExtract.length === 0) continue;

        const { data, error } = await supabase.functions.invoke("extract-column", {
          body: {
            query: question,
            papers: papersToExtract.map((p) => ({
              id: p.id,
              title: p.title,
              authors: p.authors || [],
              year: p.year,
              abstract: p.abstract || "",
            })),
            column_name: col.name,
            custom_prompt: col.prompt,
            locale: locale,
          },
        });
        if (error) {
          console.error("Extraction error for column", col.name, error);
          continue;
        }

        // Process extractions from response
        const extractions = data?.extractions || [];
        for (const ext of extractions) {
          const paper = papersToExtract[ext.paper_index] || includedPapers[ext.paper_index];
          if (paper?.id) {
            if (!newResults[paper.id]) newResults[paper.id] = {};
            newResults[paper.id][col.id] = ext.value || "N/A";
          }
        }
        onExtractionResultsChange({ ...newResults });
      }

      toast.success(locale === "pt" ? "Extração completa!" : "Extraction complete!");
    } catch (err: any) {
      console.error("Extraction error:", err);
      toast.error(err.message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    onColumnsChange([...columns, { id: `custom-${Date.now()}`, name: newColName, prompt: newColPrompt, enabled: true }]);
    setNewColName("");
    setNewColPrompt("");
  };

  const extractedCount = Object.keys(extractionResults).length;
  const enabledCols = columns.filter((c) => c.enabled);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Table className="h-4 w-4" />
          {locale === "pt" ? "Etapa 4: Extração de Dados" : "Step 4: Data Extraction"}
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? `Defina os campos de extração e aplique aos ${includedPapers.length} artigos incluídos.`
            : `Define extraction fields and apply to ${includedPapers.length} included papers.`}
        </p>
      </div>

      {/* Column definitions */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {locale === "pt" ? "Campos de Extração" : "Extraction Fields"}
          </h3>
          <Button variant="outline" size="sm" onClick={generateColumns} disabled={generatingColumns} className="gap-2">
            {generatingColumns ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {locale === "pt" ? "Gerar com IA" : "Generate with AI"}
          </Button>
        </div>

        {columns.map((col) => (
          <div key={col.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={col.enabled}
              onChange={(e) => onColumnsChange(columns.map((c) => (c.id === col.id ? { ...c, enabled: e.target.checked } : c)))}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{col.name}</p>
              <p className="text-xs text-muted-foreground">{col.prompt}</p>
            </div>
            <button onClick={() => onColumnsChange(columns.filter((c) => c.id !== col.id))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            placeholder={locale === "pt" ? "Nome do campo" : "Field name"}
            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            value={newColPrompt}
            onChange={(e) => setNewColPrompt(e.target.value)}
            placeholder={locale === "pt" ? "Instrução de extração" : "Extraction instruction"}
            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addColumn} disabled={!newColName.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Run extraction */}
      <div className="flex items-center gap-3">
        <Button onClick={runExtraction} disabled={extracting || enabledCols.length === 0} className="gap-2">
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table className="h-4 w-4" />}
          {locale === "pt" ? "Executar Extração" : "Run Extraction"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {locale === "pt"
            ? `${extractedCount}/${includedPapers.length} artigos extraídos`
            : `${extractedCount}/${includedPapers.length} papers extracted`}
        </span>
      </div>

      {/* Results table */}
      {extractedCount > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium text-foreground border-r border-border min-w-[200px]">
                  {locale === "pt" ? "Artigo" : "Paper"}
                </th>
                {enabledCols.map((col) => (
                  <th key={col.id} className="p-2 text-left font-medium text-foreground border-r border-border last:border-0 min-w-[150px]">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {includedPapers.map((paper) => {
                const results = extractionResults[paper.id];
                if (!results) return null;
                return (
                  <tr key={paper.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2 border-r border-border">
                      <p className="font-medium text-foreground text-xs truncate max-w-[200px]">{paper.title}</p>
                      <p className="text-xs text-muted-foreground">{paper.year}</p>
                    </td>
                    {enabledCols.map((col) => (
                      <td key={col.id} className="p-2 border-r border-border last:border-0 text-xs text-foreground">
                        {results[col.id] || "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {locale === "pt" ? "Anterior" : "Previous"}
        </Button>
        <Button onClick={onNext} className="gap-2">
          {locale === "pt" ? "Próximo: Relatório" : "Next: Report"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepExtraction;
