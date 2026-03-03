import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  Search,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface QueryConcept {
  id: string;
  label: string;
  terms: string[];
  meshTerms: string[];
}

interface BooleanQueryBuilderProps {
  onQueryGenerated: (query: string) => void;
  onStrategyExport: (strategy: string) => void;
}

const BooleanQueryBuilder = ({ onQueryGenerated, onStrategyExport }: BooleanQueryBuilderProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";

  const [concepts, setConcepts] = useState<QueryConcept[]>([
    { id: "c1", label: pt ? "Conceito 1 (População)" : "Concept 1 (Population)", terms: [], meshTerms: [] },
    { id: "c2", label: pt ? "Conceito 2 (Intervenção)" : "Concept 2 (Intervention)", terms: [], meshTerms: [] },
    { id: "c3", label: pt ? "Conceito 3 (Desfecho)" : "Concept 3 (Outcome)", terms: [], meshTerms: [] },
  ]);
  const [newTerms, setNewTerms] = useState<Record<string, string>>({});
  const [newMesh, setNewMesh] = useState<Record<string, string>>({});

  const addTerm = (conceptId: string) => {
    const term = newTerms[conceptId]?.trim();
    if (!term) return;
    setConcepts(concepts.map((c) =>
      c.id === conceptId ? { ...c, terms: [...c.terms, term] } : c
    ));
    setNewTerms({ ...newTerms, [conceptId]: "" });
  };

  const addMeshTerm = (conceptId: string) => {
    const mesh = newMesh[conceptId]?.trim();
    if (!mesh) return;
    setConcepts(concepts.map((c) =>
      c.id === conceptId ? { ...c, meshTerms: [...c.meshTerms, mesh] } : c
    ));
    setNewMesh({ ...newMesh, [conceptId]: "" });
  };

  const removeTerm = (conceptId: string, term: string) => {
    setConcepts(concepts.map((c) =>
      c.id === conceptId ? { ...c, terms: c.terms.filter((t) => t !== term) } : c
    ));
  };

  const removeMesh = (conceptId: string, mesh: string) => {
    setConcepts(concepts.map((c) =>
      c.id === conceptId ? { ...c, meshTerms: c.meshTerms.filter((m) => m !== mesh) } : c
    ));
  };

  const addConcept = () => {
    const num = concepts.length + 1;
    setConcepts([...concepts, {
      id: `c${Date.now()}`,
      label: pt ? `Conceito ${num}` : `Concept ${num}`,
      terms: [],
      meshTerms: [],
    }]);
  };

  const removeConcept = (id: string) => {
    if (concepts.length <= 2) return;
    setConcepts(concepts.filter((c) => c.id !== id));
  };

  const updateLabel = (id: string, label: string) => {
    setConcepts(concepts.map((c) => c.id === id ? { ...c, label } : c));
  };

  // Build query for different databases
  const buildQuery = (format: "generic" | "pubmed" | "scopus") => {
    const conceptQueries = concepts
      .filter((c) => c.terms.length > 0 || c.meshTerms.length > 0)
      .map((c) => {
        const parts: string[] = [];

        // Free text terms with OR
        if (c.terms.length > 0) {
          const termGroup = c.terms.map((t) => {
            if (t.includes(" ")) return `"${t}"`;
            if (t.includes("*")) return t;
            return t;
          });

          if (format === "pubmed") {
            parts.push(...termGroup.map((t) => `${t}[Title/Abstract]`));
          } else if (format === "scopus") {
            parts.push(...termGroup.map((t) => `TITLE-ABS-KEY(${t})`));
          } else {
            parts.push(...termGroup);
          }
        }

        // MeSH terms
        if (c.meshTerms.length > 0) {
          if (format === "pubmed") {
            parts.push(...c.meshTerms.map((m) => `"${m}"[MeSH Terms]`));
          } else if (format === "scopus") {
            parts.push(...c.meshTerms.map((m) => `KEY("${m}")`));
          } else {
            parts.push(...c.meshTerms.map((m) => `"${m}"`));
          }
        }

        return `(${parts.join(" OR ")})`;
      });

    return conceptQueries.join(" AND ");
  };

  const generateAndApply = () => {
    const query = buildQuery("generic");
    if (!query) {
      toast.error(pt ? "Adicione termos aos conceitos" : "Add terms to concepts");
      return;
    }
    onQueryGenerated(query);
    toast.success(pt ? "Query aplicada!" : "Query applied!");
  };

  const exportStrategy = () => {
    const now = new Date().toLocaleDateString(pt ? "pt-BR" : "en-US");
    let strategy = "";

    strategy += pt ? "# ESTRATÉGIA DE BUSCA\n\n" : "# SEARCH STRATEGY\n\n";
    strategy += pt ? `Data: ${now}\n\n` : `Date: ${now}\n\n`;

    strategy += pt ? "## Conceitos e Termos\n\n" : "## Concepts and Terms\n\n";
    concepts.forEach((c) => {
      strategy += `### ${c.label}\n`;
      if (c.terms.length > 0) {
        strategy += pt ? `- Termos livres: ${c.terms.join(", ")}\n` : `- Free terms: ${c.terms.join(", ")}\n`;
      }
      if (c.meshTerms.length > 0) {
        strategy += `- MeSH/Descriptors: ${c.meshTerms.join(", ")}\n`;
      }
      strategy += "\n";
    });

    strategy += pt ? "## Queries por Base de Dados\n\n" : "## Database-Specific Queries\n\n";

    const pubmedQuery = buildQuery("pubmed");
    const scopusQuery = buildQuery("scopus");
    const genericQuery = buildQuery("generic");

    strategy += `### PubMed\n\`\`\`\n${pubmedQuery || "(empty)"}\n\`\`\`\n\n`;
    strategy += `### Scopus / Web of Science\n\`\`\`\n${scopusQuery || "(empty)"}\n\`\`\`\n\n`;
    strategy += `### Semantic Scholar / OpenAlex\n\`\`\`\n${genericQuery || "(empty)"}\n\`\`\`\n\n`;

    strategy += pt
      ? "## Operadores Utilizados\n- AND: conecta conceitos diferentes\n- OR: conecta sinônimos dentro do mesmo conceito\n- Aspas: busca frase exata\n- *: truncamento (wildcard)\n- MeSH Terms: descritores controlados\n"
      : "## Operators Used\n- AND: connects different concepts\n- OR: connects synonyms within a concept\n- Quotes: exact phrase search\n- *: truncation (wildcard)\n- MeSH Terms: controlled vocabulary descriptors\n";

    onStrategyExport(strategy);
    toast.success(pt ? "Estratégia exportada!" : "Strategy exported!");
  };

  const copyQuery = (format: "generic" | "pubmed" | "scopus") => {
    const query = buildQuery(format);
    navigator.clipboard.writeText(query);
    toast.success(pt ? "Query copiada!" : "Query copied!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {pt ? "Editor de Busca Booleana" : "Boolean Search Editor"}
        </h3>
        <Button variant="outline" size="sm" onClick={addConcept} className="gap-1.5">
          <Plus className="h-3 w-3" />
          {pt ? "Conceito" : "Concept"}
        </Button>
      </div>

      {/* Concept blocks */}
      {concepts.map((concept, ci) => (
        <div key={concept.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            {ci > 0 && (
              <Badge variant="secondary" className="text-xs font-bold bg-primary/10 text-primary">AND</Badge>
            )}
            <input
              value={concept.label}
              onChange={(e) => updateLabel(concept.id, e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-foreground focus:outline-none border-b border-transparent focus:border-primary"
            />
            {concepts.length > 2 && (
              <button onClick={() => removeConcept(concept.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Terms */}
          <div className="flex flex-wrap gap-1.5">
            {concept.terms.map((term, ti) => (
              <span key={ti} className="inline-flex items-center gap-1">
                {ti > 0 && <span className="text-[10px] text-muted-foreground font-medium">OR</span>}
                <Badge variant="outline" className="text-xs gap-1">
                  {term}
                  <button onClick={() => removeTerm(concept.id, term)} className="hover:text-destructive">×</button>
                </Badge>
              </span>
            ))}
            {concept.meshTerms.map((mesh, mi) => (
              <span key={`m${mi}`} className="inline-flex items-center gap-1">
                {(concept.terms.length > 0 || mi > 0) && <span className="text-[10px] text-muted-foreground font-medium">OR</span>}
                <Badge variant="default" className="text-xs gap-1 bg-green-600/10 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300">
                  🏷 {mesh}
                  <button onClick={() => removeMesh(concept.id, mesh)} className="hover:text-destructive">×</button>
                </Badge>
              </span>
            ))}
          </div>

          {/* Add term inputs */}
          <div className="flex gap-2">
            <div className="flex-1 flex gap-1">
              <input
                value={newTerms[concept.id] || ""}
                onChange={(e) => setNewTerms({ ...newTerms, [concept.id]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addTerm(concept.id)}
                placeholder={pt ? "Termo livre (ex: diabetes*)" : "Free term (e.g. diabetes*)"}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <Button size="sm" variant="ghost" onClick={() => addTerm(concept.id)} className="h-7 px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 flex gap-1">
              <input
                value={newMesh[concept.id] || ""}
                onChange={(e) => setNewMesh({ ...newMesh, [concept.id]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addMeshTerm(concept.id)}
                placeholder="MeSH term"
                className="flex-1 rounded border border-green-300 bg-green-50/50 dark:bg-green-950/20 px-2 py-1 text-xs"
              />
              <Button size="sm" variant="ghost" onClick={() => addMeshTerm(concept.id)} className="h-7 px-2 text-green-600">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Preview */}
      {concepts.some((c) => c.terms.length > 0 || c.meshTerms.length > 0) && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {pt ? "Preview da query:" : "Query preview:"}
          </p>
          <code className="block text-xs text-foreground bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {buildQuery("generic")}
          </code>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => copyQuery("pubmed")} className="gap-1.5 text-xs h-7">
              <Copy className="h-3 w-3" /> PubMed
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyQuery("scopus")} className="gap-1.5 text-xs h-7">
              <Copy className="h-3 w-3" /> Scopus
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyQuery("generic")} className="gap-1.5 text-xs h-7">
              <Copy className="h-3 w-3" /> {pt ? "Genérica" : "Generic"}
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={generateAndApply} className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          {pt ? "Aplicar como busca" : "Apply as search"}
        </Button>
        <Button size="sm" variant="outline" onClick={exportStrategy} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {pt ? "Exportar estratégia" : "Export strategy"}
        </Button>
      </div>
    </div>
  );
};

export default BooleanQueryBuilder;
