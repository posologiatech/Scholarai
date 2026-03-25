import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import CAPESAdvisorPanel from "@/components/app/CAPESAdvisorPanel";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  PenLine, BookOpen, Quote, RefreshCw, ShieldCheck, Sparkles, Loader2,
  FileText, Plus, Trash2, ChevronRight, ChevronDown, Database, Copy, Check, ArrowRight,
  Upload, File, X, GraduationCap, Eye, MessageSquareWarning, Sigma, Star,
  AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Paper {
  id: string;
  title: string;
  authors: any;
  year: number | null;
  journal: string | null;
  doi: string | null;
}

interface SearchGroup {
  id: string;
  query: string;
  papers: Paper[];
}

interface DataMindAnalysis {
  id: string;
  title: string;
  content: string;
}

interface UploadedPDF {
  id: string;
  file_name: string;
  title: string | null;
  extracted_text: string | null;
  file_path: string;
  status: string | null;
  created_at: string | null;
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

  // Papers grouped by saved search
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<Paper[]>([]);
  const [paperSearch, setPaperSearch] = useState("");
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [expandedSearches, setExpandedSearches] = useState<Set<string>>(new Set());

  // DataMind analyses
  const [datamindAnalyses, setDatamindAnalyses] = useState<DataMindAnalysis[]>([]);
  const [selectedAnalyses, setSelectedAnalyses] = useState<DataMindAnalysis[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  // Uploaded PDFs (researcher's own files)
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([]);
  const [selectedPDFs, setSelectedPDFs] = useState<UploadedPDF[]>([]);
  const [loadingPDFs, setLoadingPDFs] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<"ai" | "capes">("ai");

  // Load papers from saved searches (grouped)
  useEffect(() => {
    if (!user) return;
    const loadPapers = async () => {
      setLoadingPapers(true);
      const { data } = await supabase
        .from("saved_searches")
        .select("id, query, papers")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        const groups: SearchGroup[] = data.map((s: any) => ({
          id: s.id,
          query: s.query,
          papers: (s.papers as any[] || []).map((p: any, idx: number) => ({
            id: `${s.id}_${idx}`,
            title: p.title || "",
            authors: p.authors,
            year: p.year,
            journal: p.journal,
            doi: p.doi,
          })),
        })).filter(g => g.papers.length > 0);
        setSearchGroups(groups);
        // Collapsed by default — researcher opens each group manually
        setExpandedSearches(new Set());
      }
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

  // Load uploaded PDFs
  useEffect(() => {
    if (!user) return;
    const loadPDFs = async () => {
      setLoadingPDFs(true);
      const { data } = await supabase
        .from("uploaded_papers")
        .select("id, file_name, title, extracted_text, file_path, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setUploadedPDFs((data || []) as UploadedPDF[]);
      setLoadingPDFs(false);
    };
    loadPDFs();
  }, [user]);

  const filteredGroups = searchGroups.map(g => ({
    ...g,
    papers: g.papers.filter(p =>
      p.title.toLowerCase().includes(paperSearch.toLowerCase())
    ),
  })).filter(g => g.papers.length > 0);

  const toggleSearchExpanded = (searchId: string) => {
    setExpandedSearches(prev => {
      const next = new Set(prev);
      if (next.has(searchId)) next.delete(searchId);
      else next.add(searchId);
      return next;
    });
  };

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

  const togglePDF = (pdf: UploadedPDF) => {
    setSelectedPDFs(prev =>
      prev.find(p => p.id === pdf.id)
        ? prev.filter(p => p.id !== pdf.id)
        : [...prev, pdf]
    );
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploadingPDF(true);
    setUploadProgress(0);

    const totalFiles = files.length;
    let completed = 0;

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name}: ${pt ? "Apenas arquivos PDF são aceitos" : "Only PDF files are accepted"}`);
        continue;
      }

      try {
        // 1. Upload to storage
        const safeFileName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_");
        const filePath = `${user.id}/writing/${Date.now()}_${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from("papers")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Create record in uploaded_papers
        const { data: record, error: insertError } = await supabase
          .from("uploaded_papers")
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            title: file.name.replace(/\.pdf$/i, ""),
            status: "processing",
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // 3. Extract text from PDF via edge function (sends paper_id, function downloads from storage)
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess?.session?.access_token;
        if (!tk) throw new Error("Not authenticated");

        const extractResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-pdf`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tk}`,
            },
            body: JSON.stringify({ paper_id: record.id }),
          }
        );

        let extractedText = "";
        if (extractResp.ok) {
          const extractData = await extractResp.json();
          extractedText = extractData.extracted_text || "";
          // Re-fetch the updated record to get full extracted text
          const { data: updated } = await supabase
            .from("uploaded_papers")
            .select("extracted_text, status, title")
            .eq("id", record.id)
            .single();
          if (updated?.extracted_text) {
            extractedText = updated.extracted_text;
          }
        } else {
          const errData = await extractResp.json().catch(() => ({}));
          const errMsg = errData.error || `HTTP ${extractResp.status}`;
          console.error("PDF extraction failed:", errMsg);
          toast.error(`${file.name}: ${pt ? "Falha na extração" : "Extraction failed"} - ${errMsg}`);
          
          await supabase
            .from("uploaded_papers")
            .update({ status: "error" })
            .eq("id", record.id);

          const errorRecord: UploadedPDF = { ...record, status: "error", extracted_text: null };
          setUploadedPDFs(prev => [errorRecord, ...prev]);
          continue;
        }

        // 4. Re-fetch to get the latest status (edge function already updates)
        const { data: finalRecord } = await supabase
          .from("uploaded_papers")
          .select("*")
          .eq("id", record.id)
          .single();

        // 5. Add to local state
        const updatedRecord: UploadedPDF = {
          ...(finalRecord || record),
          extracted_text: extractedText.slice(0, 100000),
          status: extractedText ? "processed" : "error",
        } as UploadedPDF;
        setUploadedPDFs(prev => [updatedRecord, ...prev]);

        completed++;
        setUploadProgress(Math.round((completed / totalFiles) * 100));
      } catch (err: any) {
        console.error("PDF upload error:", err);
        toast.error(`${file.name}: ${err.message}`);
      }
    }

    setUploadingPDF(false);
    setUploadProgress(0);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (completed > 0) {
      toast.success(pt
        ? `${completed} arquivo(s) processado(s) com sucesso`
        : `${completed} file(s) processed successfully`
      );
    }
  };

  const deletePDF = async (pdf: UploadedPDF) => {
    await supabase.storage.from("papers").remove([pdf.file_path]);
    await supabase.from("uploaded_papers").delete().eq("id", pdf.id);
    setUploadedPDFs(prev => prev.filter(p => p.id !== pdf.id));
    setSelectedPDFs(prev => prev.filter(p => p.id !== pdf.id));
    toast.success(pt ? "Arquivo removido" : "File removed");
  };

  const clearErrorPDFs = async () => {
    const errorPDFs = uploadedPDFs.filter(p => p.status === "error");
    if (errorPDFs.length === 0) return;
    for (const pdf of errorPDFs) {
      await supabase.storage.from("papers").remove([pdf.file_path]);
      await supabase.from("uploaded_papers").delete().eq("id", pdf.id);
    }
    setUploadedPDFs(prev => prev.filter(p => p.status !== "error"));
    setSelectedPDFs(prev => prev.filter(sp => !errorPDFs.some(ep => ep.id === sp.id)));
    toast.success(pt ? "Erros limpos" : "Errors cleared");
  };

  const streamAI = useCallback(async (action: string, extraContent?: string) => {
    if (selectedPapers.length === 0 && selectedPDFs.length === 0 && action !== "rephrase") {
      toast.error(pt ? "Selecione pelo menos um paper ou PDF" : "Select at least one paper or PDF");
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
        uploadedPDFs: selectedPDFs.map(p => ({
          title: p.title || p.file_name,
          content: (p.extracted_text || "").slice(0, 15000),
        })),
        language: locale,
      };

      const { data: sess2 } = await supabase.auth.getSession();
      const tk2 = sess2?.session?.access_token;
      if (!tk2) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-assist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tk2}`,
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
  }, [selectedPapers, selectedPDFs, selectedAnalyses, editorContent, selectedSection, citationStyle, locale, pt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(aiOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Citation validation before insert
  const validateCitationsInOutput = useCallback((text: string): { valid: boolean; invalidIds: number[]; totalCitations: number } => {
    const citationPattern = /\[(\d+)\]/g;
    let match;
    const invalidIds: number[] = [];
    let totalCitations = 0;
    const maxValid = selectedPapers.length;
    while ((match = citationPattern.exec(text)) !== null) {
      totalCitations++;
      const id = parseInt(match[1]);
      if (id < 1 || id > maxValid) invalidIds.push(id);
    }
    return { valid: invalidIds.length === 0, invalidIds: [...new Set(invalidIds)], totalCitations };
  }, [selectedPapers.length]);

  const handleInsertInEditor = () => {
    const validation = validateCitationsInOutput(aiOutput);
    if (!validation.valid) {
      const cleaned = aiOutput.replace(/\[\??\d*\]/g, (match) => {
        const num = parseInt(match.replace(/[\[\]?]/g, ""));
        return (num < 1 || num > selectedPapers.length) ? "[?]" : match;
      });
      toast.warning(
        pt
          ? `⚠️ ${validation.invalidIds.length} citação(ões) suspeita(s) detectada(s) e marcada(s) com [?]. Verifique antes de submeter.`
          : `⚠️ ${validation.invalidIds.length} suspicious citation(s) detected and marked with [?]. Please verify before submitting.`,
        { duration: 6000 }
      );
      setEditorContent(prev => prev + (prev ? "\n\n" : "") + cleaned);
    } else {
      setEditorContent(prev => prev + (prev ? "\n\n" : "") + aiOutput);
      toast.success(pt ? "Texto inserido no editor" : "Text inserted in editor");
    }
  };

  // Quality metrics calculation
  const qualityMetrics = useCallback(() => {
    if (!editorContent.trim()) return null;
    const words = editorContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const citations = (editorContent.match(/\[\d+\]/g) || []).length;
    const sentences = editorContent.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
    const citationRatio = sentences > 0 ? (citations / sentences * 100).toFixed(0) : "0";

    const hedgingWords = ["suggests", "indicates", "appears", "may", "might", "could", "possibly", "likely",
      "sugere", "indica", "parece", "pode", "possivelmente", "provavelmente"];
    const hedgingCount = hedgingWords.reduce((acc, w) =>
      acc + (editorContent.toLowerCase().match(new RegExp(`\\b${w}\\b`, "g")) || []).length, 0
    );
    const hedgingPer1000 = wordCount > 0 ? (hedgingCount / wordCount * 1000).toFixed(1) : "0";

    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-záàãâéêíóôõúç]/gi, "")));
    const ttr = wordCount > 0 ? (uniqueWords.size / wordCount * 100).toFixed(0) : "0";

    return { wordCount, citations, citationRatio, hedgingCount, hedgingPer1000, ttr };
  }, [editorContent]);

  const formatAuthors = (authors: any) => {
    if (!authors) return "Unknown";
    if (Array.isArray(authors)) return authors.slice(0, 2).join(", ") + (authors.length > 2 ? " et al." : "");
    return String(authors);
  };

  return (
      <div className="flex h-screen overflow-hidden">
        {/* Left sidebar: Paper, DataMind & PDF selection */}
        <div className="w-72 border-r border-border/40 flex flex-col bg-background">
          <div className="p-4 border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {pt ? "Fontes" : "Sources"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {pt ? "Selecione papers, análises e PDFs" : "Select papers, analyses and PDFs"}
            </p>
          </div>

          <Tabs defaultValue="papers" className="flex-1 flex flex-col">
            <TabsList className="mx-3 mt-2 grid grid-cols-3">
              <TabsTrigger value="papers" className="text-[10px] px-1">
                <FileText className="h-3 w-3 mr-0.5" />
                Papers ({selectedPapers.length})
              </TabsTrigger>
              <TabsTrigger value="datamind" className="text-[10px] px-1">
                <Database className="h-3 w-3 mr-0.5" />
                DataMind ({selectedAnalyses.length})
              </TabsTrigger>
              <TabsTrigger value="mypdfs" className="text-[10px] px-1">
                <Upload className="h-3 w-3 mr-0.5" />
                {pt ? "Meus PDFs" : "My PDFs"} ({selectedPDFs.length})
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
                  ) : filteredGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {pt ? "Nenhum paper encontrado" : "No papers found"}
                    </p>
                  ) : (
                    filteredGroups.map(group => {
                      const isExpanded = expandedSearches.has(group.id);
                      const selectedCount = group.papers.filter(p => selectedPapers.some(sp => sp.id === p.id)).length;
                      return (
                        <Collapsible key={group.id} open={isExpanded} onOpenChange={() => toggleSearchExpanded(group.id)}>
                          <CollapsibleTrigger className="w-full flex items-center gap-1.5 p-2 rounded-md hover:bg-muted text-xs text-left group">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-semibold text-foreground line-clamp-1 flex-1">{group.query}</span>
                            {selectedCount > 0 && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{selectedCount}</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground shrink-0">{group.papers.length}</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-4 space-y-0.5">
                              {group.papers.map(paper => {
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
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
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

            <TabsContent value="mypdfs" className="flex-1 flex flex-col px-3 pb-3 mt-2">
              {/* Upload area */}
              <div className="mb-2">
                <label className="block">
                  <div className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                    uploadingPDF ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
                  }`}>
                    {uploadingPDF ? (
                      <div className="space-y-2">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                        <p className="text-xs text-muted-foreground">{pt ? "Processando..." : "Processing..."}</p>
                        <Progress value={uploadProgress} className="h-1.5" />
                      </div>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">
                          {pt ? "Enviar PDFs" : "Upload PDFs"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {pt ? "Clique ou arraste" : "Click or drag"}
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={handlePDFUpload}
                    disabled={uploadingPDF}
                  />
                </label>
                {uploadedPDFs.some(p => p.status === "error") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearErrorPDFs}
                    className="w-full text-xs text-destructive hover:text-destructive h-7 mt-1"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {pt ? "Limpar erros" : "Clear errors"}
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-1">
                  {loadingPDFs ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : uploadedPDFs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {pt ? "Nenhum PDF enviado ainda" : "No PDFs uploaded yet"}
                    </p>
                  ) : (
                    uploadedPDFs.map(pdf => {
                      const isSelected = selectedPDFs.some(p => p.id === pdf.id);
                      const isProcessed = pdf.status === "processed";
                      const isProcessing = pdf.status === "processing";
                      return (
                        <div
                          key={pdf.id}
                          className={`relative group rounded-md text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted border border-transparent"
                          }`}
                        >
                          <button
                            onClick={() => isProcessed && togglePDF(pdf)}
                            className="w-full text-left p-2"
                            disabled={!isProcessed}
                          >
                            <div className="flex items-start gap-2">
                              <File className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                                isProcessed ? "text-primary" : isProcessing ? "text-amber-500" : "text-destructive"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground line-clamp-2">
                                  {pdf.title || pdf.file_name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant={isProcessed ? "secondary" : isProcessing ? "outline" : "destructive"} className="text-[9px] px-1 py-0">
                                    {isProcessed
                                      ? (pt ? "Processado" : "Processed")
                                      : isProcessing
                                        ? (pt ? "Processando" : "Processing")
                                        : (pt ? "Erro" : "Error")}
                                  </Badge>
                                  {isProcessed && pdf.extracted_text && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {(pdf.extracted_text.length / 1000).toFixed(0)}k chars
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deletePDF(pdf); }}
                            className="absolute top-1.5 right-1.5 h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
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
          <div className="border-b border-border/40 bg-background px-4 py-2 flex items-center gap-2 flex-wrap">
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
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APA" className="text-xs">APA 7th</SelectItem>
                <SelectItem value="Vancouver" className="text-xs">Vancouver</SelectItem>
                <SelectItem value="ABNT" className="text-xs">ABNT</SelectItem>
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6" />

            {/* Selected sources summary */}
            {(selectedPapers.length > 0 || selectedPDFs.length > 0 || selectedAnalyses.length > 0) && (
              <div className="flex items-center gap-1">
                {selectedPapers.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    <FileText className="h-2.5 w-2.5 mr-0.5" />
                    {selectedPapers.length}
                  </Badge>
                )}
                {selectedPDFs.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    <File className="h-2.5 w-2.5 mr-0.5" />
                    {selectedPDFs.length}
                  </Badge>
                )}
                {selectedAnalyses.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Database className="h-2.5 w-2.5 mr-0.5" />
                    {selectedAnalyses.length}
                  </Badge>
                )}
                <Separator orientation="vertical" className="h-4" />
              </div>
            )}

            {/* Group 1: Writing */}
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 bg-muted/40 rounded-md px-1.5 py-0.5">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mr-0.5">
                  {pt ? "Escrita" : "Write"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating}
                      onClick={() => streamAI("draft_section", instructions)}>
                      <Sparkles className="h-3 w-3" />
                      {pt ? "Gerar" : "Draft"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Gerar rascunho da seção com citações" : "Generate section draft with citations"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("continue_writing")}>
                      <ArrowRight className="h-3 w-3" />
                      {pt ? "Continuar" : "Continue"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Continuar escrevendo de onde parou" : "Continue writing from where you left off"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating}
                      onClick={() => streamAI("insert_citation")}>
                      <Quote className="h-3 w-3" />
                      {pt ? "Citar" : "Cite"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Formatar citações dos papers selecionados" : "Format citations from selected papers"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("generate_abstract")}>
                      <Sigma className="h-3 w-3" />
                      Abstract
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Gerar abstract estruturado do artigo" : "Generate structured abstract from article"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("generate_highlights")}>
                      <Star className="h-3 w-3" />
                      Highlights
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Gerar Key Findings / Highlights" : "Generate Key Findings / Highlights"}</p></TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            {/* Group 2: Review */}
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 bg-muted/40 rounded-md px-1.5 py-0.5">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mr-0.5">
                  {pt ? "Revisão" : "Review"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("rephrase")}>
                      <RefreshCw className="h-3 w-3" />
                      {pt ? "Reformular" : "Rephrase"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Reformular com qualidade de pesquisador sênior" : "Rephrase with senior researcher quality"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("check_consistency")}>
                      <ShieldCheck className="h-3 w-3" />
                      {pt ? "Verificar" : "Check"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Verificar consistência entre claims e evidências" : "Check consistency between claims and evidence"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("peer_review")}>
                      <MessageSquareWarning className="h-3 w-3" />
                      Peer Review
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Simular revisão por pares rigorosa" : "Simulate rigorous peer review"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" disabled={isGenerating || !editorContent.trim()}
                      onClick={() => streamAI("improve_hedging")}>
                      <Eye className="h-3 w-3" />
                      Hedging
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Corrigir linguagem absolutista para hedging científico" : "Fix absolutist language to scientific hedging"}</p></TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            <Separator orientation="vertical" className="h-6" />

            <Button
              size="sm"
              variant={activeRightPanel === "capes" ? "default" : "outline"}
              className={`h-7 text-xs gap-1 ${activeRightPanel === "capes" ? "" : "border-primary/30 text-primary hover:bg-primary/10"}`}
              onClick={() => setActiveRightPanel(activeRightPanel === "capes" ? "ai" : "capes")}
            >
              <GraduationCap className="h-3 w-3" />
              CAPES APC
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

            {/* Right panel: AI Output or CAPES Advisor */}
            <div className="w-[45%] flex flex-col bg-muted/10">
              {activeRightPanel === "ai" ? (
                <>
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
                            ? "Use os botões acima para gerar conteúdo. Selecione papers, PDFs e análises do DataMind no painel esquerdo para contextualizar a escrita."
                            : "Use the buttons above to generate content. Select papers, PDFs and DataMind analyses from the left panel to contextualize the writing."}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <CAPESAdvisorPanel
                  editorContent={editorContent}
                  onFormatArticle={(publisher) => {
                    setActiveRightPanel("ai");
                    streamAI("format_for_journal", `Format this article according to ${publisher} submission guidelines. Publisher: ${publisher}`);
                  }}
                  onClose={() => setActiveRightPanel("ai")}
                  onInsertFormatted={(text) => {
                    setEditorContent(prev => prev + (prev ? "\n\n" : "") + text);
                    toast.success(pt ? "Texto formatado inserido" : "Formatted text inserted");
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

export default WritingAssistant;
