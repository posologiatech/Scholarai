import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/app/AppSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  PenLine, BookOpen, Quote, RefreshCw, ShieldCheck, Sparkles, Loader2,
  FileText, Plus, Trash2, ChevronRight, Database, Copy, Check, ArrowRight,
} from "lucide-react";

interface Paper {
  id: string;
  title: string;
  authors: any;
  year: number | null;
  journal: string | null;
  doi: string | null;
}

interface DataMindAnalysis {
  id: string;
  title: string;
  content: string;
}

const SECTIONS = [
  { id: "introduction", label: { pt: "Introdução", en: "Introduction" } },
  { id: "methods", label: { pt: "Métodos", en: "Methods" } },
  { id: "results", label: { pt: "Resultados", en: "Results" } },
  { id: "discussion", label: { pt: "Discussão", en: "Discussion" } },
  { id: "conclusion", label: { pt: "Conclusão", en: "Conclusion" } },
  { id: "abstract", label: { pt: "Resumo", en: "Abstract" } },
];

const WritingAssistant = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt";

  const [editorContent, setEditorContent] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [citationStyle, setCitationStyle] = useState("APA");
  const [selectedSection, setSelectedSection] = useState("introduction");
  const [instructions, setInstructions] = useState("");

  // Papers
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<Paper[]>([]);
  const [paperSearch, setPaperSearch] = useState("");
  const [loadingPapers, setLoadingPapers] = useState(false);

  // DataMind analyses
  const [datamindAnalyses, setDatamindAnalyses] = useState<DataMindAnalysis[]>([]);
  const [selectedAnalyses, setSelectedAnalyses] = useState<DataMindAnalysis[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Load papers from library
  useEffect(() => {
    if (!user) return;
    const loadPapers = async () => {
      setLoadingPapers(true);
      const { data } = await supabase
        .from("papers")
        .select("id, title, authors, year, journal, doi")
        .order("created_at", { ascending: false })
        .limit(200);
      setPapers(data || []);
      setLoadingPapers(false);
    };
    loadPapers();
  }, [user]);

  // Load DataMind conversations/analyses
  useEffect(() => {
    if (!user) return;
    const loadAnalyses = async () => {
      setLoadingAnalyses(true);
      const { data: convs } = await supabase
        .from("datamind_conversations")
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (convs && convs.length > 0) {
        const convIds = convs.map(c => c.id);
        const { data: msgs } = await supabase
          .from("datamind_messages")
          .select("conversation_id, content, role, output_content")
          .in("conversation_id", convIds)
          .eq("role", "assistant")
          .order("created_at", { ascending: false });

        const analyses: DataMindAnalysis[] = convs.map(c => {
          const convMsgs = (msgs || []).filter(m => m.conversation_id === c.id);
          const summary = convMsgs.slice(0, 3).map(m => m.content || m.output_content || "").join("\n");
          return { id: c.id, title: c.title, content: summary.slice(0, 2000) };
        });
        setDatamindAnalyses(analyses);
      }
      setLoadingAnalyses(false);
    };
    loadAnalyses();
  }, [user]);

  const filteredPapers = papers.filter(p =>
    p.title.toLowerCase().includes(paperSearch.toLowerCase())
  );

  const togglePaper = (paper: Paper) => {
    setSelectedPapers(prev =>
      prev.find(p => p.id === paper.id)
        ? prev.filter(p => p.id !== paper.id)
        : [...prev, paper]
    );
  };

  const toggleAnalysis = (analysis: DataMindAnalysis) => {
    setSelectedAnalyses(prev =>
      prev.find(a => a.id === analysis.id)
        ? prev.filter(a => a.id !== analysis.id)
        : [...prev, analysis]
    );
  };

  const streamAI = useCallback(async (action: string, extraContent?: string) => {
    if (selectedPapers.length === 0 && action !== "rephrase") {
      toast.error(pt ? "Selecione pelo menos um paper" : "Select at least one paper");
      return;
    }

    setIsGenerating(true);
    setAiOutput("");

    try {
      const body = {
        action,
        content: extraContent || editorContent,
        papers: selectedPapers.map(p => ({
          title: p.title,
          authors: Array.isArray(p.authors) ? p.authors : [],
          year: p.year,
          journal: p.journal,
          doi: p.doi,
        })),
        section: SECTIONS.find(s => s.id === selectedSection)?.label[pt ? "pt" : "en"] || selectedSection,
        citationStyle,
        datamindAnalyses: selectedAnalyses.map(a => ({ title: a.title, content: a.content })),
        language: locale,
      };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-assist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
              setAiOutput(result);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedPapers, selectedAnalyses, editorContent, selectedSection, citationStyle, locale, pt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(aiOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertInEditor = () => {
    setEditorContent(prev => prev + (prev ? "\n\n" : "") + aiOutput);
    toast.success(pt ? "Texto inserido no editor" : "Text inserted in editor");
  };

  const formatAuthors = (authors: any) => {
    if (!authors) return "Unknown";
    if (Array.isArray(authors)) return authors.slice(0, 2).join(", ") + (authors.length > 2 ? " et al." : "");
    return String(authors);
  };

  return (
    <AppSidebar>
      <div className="flex h-screen overflow-hidden">
        {/* Left sidebar: Paper & DataMind selection */}
        <div className="w-72 border-r border-border/40 flex flex-col bg-background">
          <div className="p-4 border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {pt ? "Fontes" : "Sources"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {pt ? "Selecione papers e análises" : "Select papers and analyses"}
            </p>
          </div>

          <Tabs defaultValue="papers" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-2 grid grid-cols-2">
              <TabsTrigger value="papers" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Papers ({selectedPapers.length})
              </TabsTrigger>
              <TabsTrigger value="datamind" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                DataMind ({selectedAnalyses.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="papers" className="flex-1 flex flex-col px-3 pb-3 mt-2">
              <Input
                placeholder={pt ? "Buscar papers..." : "Search papers..."}
                value={paperSearch}
                onChange={e => setPaperSearch(e.target.value)}
                className="h-8 text-xs mb-2"
              />
              <ScrollArea className="flex-1">
                <div className="space-y-1">
                  {loadingPapers ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredPapers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {pt ? "Nenhum paper encontrado" : "No papers found"}
                    </p>
                  ) : (
                    filteredPapers.slice(0, 50).map(paper => {
                      const isSelected = selectedPapers.some(p => p.id === paper.id);
                      return (
                        <button
                          key={paper.id}
                          onClick={() => togglePaper(paper)}
                          className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted border border-transparent"
                          }`}
                        >
                          <p className="font-medium text-foreground line-clamp-2">{paper.title}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {formatAuthors(paper.authors)} {paper.year ? `(${paper.year})` : ""}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="datamind" className="flex-1 flex flex-col px-3 pb-3 mt-2">
              <ScrollArea className="flex-1">
                <div className="space-y-1">
                  {loadingAnalyses ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : datamindAnalyses.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {pt ? "Nenhuma análise encontrada" : "No analyses found"}
                    </p>
                  ) : (
                    datamindAnalyses.map(analysis => {
                      const isSelected = selectedAnalyses.some(a => a.id === analysis.id);
                      return (
                        <button
                          key={analysis.id}
                          onClick={() => toggleAnalysis(analysis)}
                          className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                            isSelected
                              ? "bg-accent/10 border border-accent/30"
                              : "hover:bg-muted border border-transparent"
                          }`}
                        >
                          <p className="font-medium text-foreground line-clamp-2">{analysis.title}</p>
                          <p className="text-muted-foreground mt-0.5 line-clamp-1">{analysis.content.slice(0, 80)}...</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Main editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="border-b border-border/40 bg-background px-4 py-2 flex items-center gap-3 flex-wrap">
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.label[pt ? "pt" : "en"]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={citationStyle} onValueChange={setCitationStyle}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APA" className="text-xs">APA 7th</SelectItem>
                <SelectItem value="Vancouver" className="text-xs">Vancouver</SelectItem>
                <SelectItem value="ABNT" className="text-xs">ABNT</SelectItem>
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6" />

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={isGenerating}
              onClick={() => streamAI("draft_section", instructions)}
            >
              <Sparkles className="h-3 w-3" />
              {pt ? "Gerar Rascunho" : "Generate Draft"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={isGenerating || !editorContent.trim()}
              onClick={() => streamAI("continue_writing")}
            >
              <ArrowRight className="h-3 w-3" />
              {pt ? "Continuar" : "Continue"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={isGenerating || !editorContent.trim()}
              onClick={() => streamAI("rephrase")}
            >
              <RefreshCw className="h-3 w-3" />
              {pt ? "Reformular" : "Rephrase"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={isGenerating || !editorContent.trim()}
              onClick={() => streamAI("check_consistency")}
            >
              <ShieldCheck className="h-3 w-3" />
              {pt ? "Verificar" : "Check"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={isGenerating}
              onClick={() => streamAI("insert_citation")}
            >
              <Quote className="h-3 w-3" />
              {pt ? "Citações" : "Citations"}
            </Button>
          </div>

          {/* Instructions bar */}
          <div className="border-b border-border/40 bg-muted/30 px-4 py-2">
            <Input
              placeholder={pt
                ? "Instruções adicionais para a IA (ex: foco em estudos clínicos, mencionar limitações...)"
                : "Additional instructions for the AI (e.g., focus on clinical studies, mention limitations...)"}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>

          {/* Editor + AI output split */}
          <div className="flex-1 flex overflow-hidden">
            {/* Editor */}
            <div className="flex-1 flex flex-col border-r border-border/40">
              <div className="px-4 py-2 border-b border-border/40 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <PenLine className="h-3 w-3" />
                  {pt ? "Editor" : "Editor"}
                </p>
              </div>
              <Textarea
                ref={editorRef}
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                placeholder={pt
                  ? "Comece a escrever seu artigo aqui ou use os botões acima para gerar conteúdo com IA..."
                  : "Start writing your paper here or use the buttons above to generate content with AI..."}
                className="flex-1 resize-none border-0 rounded-none focus-visible:ring-0 text-sm leading-relaxed p-4 font-serif"
              />
              <div className="px-4 py-1.5 border-t border-border/40 bg-muted/20 flex justify-between text-xs text-muted-foreground">
                <span>{editorContent.split(/\s+/).filter(Boolean).length} {pt ? "palavras" : "words"}</span>
                <span>{editorContent.length} {pt ? "caracteres" : "characters"}</span>
              </div>
            </div>

            {/* AI Output */}
            <div className="w-[45%] flex flex-col bg-muted/10">
              <div className="px-4 py-2 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {pt ? "Saída da IA" : "AI Output"}
                  {isGenerating && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                </p>
                {aiOutput && !isGenerating && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={handleCopy}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? (pt ? "Copiado" : "Copied") : (pt ? "Copiar" : "Copy")}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={handleInsertInEditor}>
                      <Plus className="h-3 w-3" />
                      {pt ? "Inserir" : "Insert"}
                    </Button>
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-serif text-foreground">
                  {aiOutput || (
                    <p className="text-muted-foreground italic text-center mt-12">
                      {pt
                        ? "Use os botões acima para gerar conteúdo. Selecione papers e análises do DataMind no painel esquerdo para contextualizar a escrita."
                        : "Use the buttons above to generate content. Select papers and DataMind analyses from the left panel to contextualize the writing."}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </AppSidebar>
  );
};

export default WritingAssistant;
