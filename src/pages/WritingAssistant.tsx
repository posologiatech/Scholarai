import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import CAPESAdvisorPanel from "@/components/app/CAPESAdvisorPanel";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  PenLine, BookOpen, Quote, RefreshCw, ShieldCheck, Sparkles, Loader2,
  FileText, Plus, Trash2, ChevronRight, ChevronDown, Database, Copy, Check, ArrowRight,
  Upload, File, X, GraduationCap, Eye, MessageSquareWarning, Sigma, Star,
  AlertTriangle, Save, FolderOpen, Clock, Search, FilePlus2, Shield, Users, ListTree,
} from "lucide-react";
import AIDeclarationDialog, { type AIUsageEntry } from "@/components/app/AIDeclarationDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { WritingDocumentVersionsDialog } from "@/components/app/WritingDocumentVersionsDialog";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/app/writing/RichTextEditor";
import { DocumentOutline } from "@/components/app/writing/DocumentOutline";
import { stripHtml, isContentEmpty } from "@/lib/writing/richText";
import { acceptSuggestion, rejectSuggestion, type SuggestionInfo } from "@/lib/writing/suggestionMarks";
import { SECTIONS, type SectionId } from "@/lib/writing/sections";
import type { SectionHeadingInfo } from "@/lib/writing/sectionPosition";
import * as Y from "yjs";
import type { SupabaseYjsProvider } from "@/lib/collab/supabaseYjsProvider";
import { bytesToPgHex, pgHexToBytes } from "@/lib/collab/yjsPersistence";
import { colorFromId } from "@/lib/collab/presenceColor";
import { promoteWritingToPublication } from "@/lib/research/integrations";
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

interface WritingDocument {
  id: string;
  title: string;
  content: string;
  section: string | null;
  citation_style: string | null;
  updated_at: string;
  created_at: string;
  research_project_id?: string | null;
  yjs_state?: string | null;
}

const WritingAssistant = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt";
  const [searchParams] = useSearchParams();

  const [editorContent, setEditorContent] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [citationStyle, setCitationStyle] = useState("APA");
  const [selectedSection, setSelectedSection] = useState("introduction");
  const [instructions, setInstructions] = useState("");
  const [headings, setHeadings] = useState<SectionHeadingInfo[]>([]);
  const [aiOutputMeta, setAiOutputMeta] = useState<{ action: string; sectionId: string } | null>(null);

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
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<"ai" | "capes">("ai");

  // Documents state
  const [savedDocuments, setSavedDocuments] = useState<WritingDocument[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [showDocManager, setShowDocManager] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotAtRef = useRef<number>(0);
  const lastSnapshotContentRef = useRef<string>("");

  // Real-time co-editing: only active once a document is saved and linked to a project.
  const [researchProjectId, setResearchProjectId] = useState<string | null>(null);
  const [yjsStateHex, setYjsStateHex] = useState<string | null>(null);
  const [collabPeers, setCollabPeers] = useState<{ clientId: number; name: string; color: string }[]>([]);
  const ydocRef = useRef<Y.Doc | null>(null);
  const yProviderRef = useRef<SupabaseYjsProvider | null>(null);

  // Track-changes: AI-inserted text starts as a pending suggestion until accepted/rejected.
  const [suggestions, setSuggestions] = useState<SuggestionInfo[]>([]);
  const acceptOneSuggestion = (id: string) => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;
    acceptSuggestion(editor, id);
    setSuggestions((prev) => prev.filter((s) => s.suggestionId !== id));
  };
  const rejectOneSuggestion = (id: string) => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;
    rejectSuggestion(editor, id);
    setSuggestions((prev) => prev.filter((s) => s.suggestionId !== id));
  };

  // AI usage tracking
  const [aiUsageLog, setAiUsageLog] = useState<AIUsageEntry[]>([]);
  const [showAIDeclaration, setShowAIDeclaration] = useState(false);
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

        const { data: finalRecord } = await supabase
          .from("uploaded_papers")
          .select("*")
          .eq("id", record.id)
          .single();

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

  // ─── Document CRUD ─────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setLoadingDocs(true);
    const { data } = await supabase
      .from("writing_documents")
      .select("id, title, content, section, citation_style, updated_at, created_at, research_project_id, yjs_state")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setSavedDocuments((data || []) as WritingDocument[]);
    setLoadingDocs(false);
  }, [user]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Auto-snapshot on save, throttled to avoid flooding the history with every 30s autosave —
  // only writes a new version if the content actually changed and 5+ minutes have passed
  // since the last automatic snapshot. Manual "named version" snapshots (in the History
  // dialog) bypass this throttle entirely.
  const maybeSnapshotVersion = useCallback(async (documentId: string, content: string) => {
    if (!content.trim()) return;
    const now = Date.now();
    if (content === lastSnapshotContentRef.current) return;
    if (now - lastSnapshotAtRef.current < 5 * 60 * 1000) return;
    const { error } = await supabase.from("writing_document_versions").insert({
      document_id: documentId,
      author_id: user?.id,
      content,
    });
    if (!error) {
      lastSnapshotAtRef.current = now;
      lastSnapshotContentRef.current = content;
    }
  }, [user?.id]);

  const saveDocument = useCallback(async () => {
    if (!user || isContentEmpty(editorContent)) return;
    setIsSaving(true);
    const title = docTitle.trim() || (pt ? "Sem título" : "Untitled");
    try {
      if (currentDocId) {
        const payload: Record<string, unknown> = {
          title,
          content: editorContent,
          section: selectedSection,
          citation_style: citationStyle,
        };
        if (ydocRef.current) {
          payload.yjs_state = bytesToPgHex(Y.encodeStateAsUpdate(ydocRef.current));
        }
        await supabase
          .from("writing_documents")
          .update(payload)
          .eq("id", currentDocId);
        maybeSnapshotVersion(currentDocId, editorContent);
      } else {
        const { data } = await supabase
          .from("writing_documents")
          .insert({
            user_id: user.id,
            title,
            content: editorContent,
            section: selectedSection,
            citation_style: citationStyle,
          })
          .select("id")
          .single();
        if (data) setCurrentDocId(data.id);
      }
      toast.success(pt ? "Documento salvo" : "Document saved");
      loadDocuments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [user, editorContent, docTitle, currentDocId, selectedSection, citationStyle, pt, loadDocuments, maybeSnapshotVersion]);

  const loadDocument = useCallback((doc: WritingDocument) => {
    setCurrentDocId(doc.id);
    setDocTitle(doc.title);
    setEditorContent(doc.content);
    if (doc.section) setSelectedSection(doc.section);
    if (doc.citation_style) setCitationStyle(doc.citation_style);
    setResearchProjectId(doc.research_project_id || null);
    setYjsStateHex(doc.yjs_state || null);
    setCollabPeers([]);
    setSuggestions([]);
    ydocRef.current = null;
    yProviderRef.current = null;
    setShowDocManager(false);
    setAiOutput("");
    lastSnapshotAtRef.current = 0;
    lastSnapshotContentRef.current = doc.content;
    toast.success(pt ? `"${doc.title}" aberto` : `"${doc.title}" opened`);
  }, [pt]);

  const loadDocumentById = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("writing_documents")
      .select("id, title, content, section, citation_style, updated_at, created_at, research_project_id, yjs_state")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error(pt ? "Documento não encontrado ou sem acesso" : "Document not found or no access");
      return;
    }
    loadDocument(data as WritingDocument);
  }, [pt, loadDocument]);

  useEffect(() => {
    const docId = searchParams.get("docId");
    if (docId) loadDocumentById(docId);
    // Only react to the URL param actually changing, not to loadDocumentById's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const newDocument = useCallback(() => {
    setCurrentDocId(null);
    setDocTitle("");
    setEditorContent("");
    setAiOutput("");
    setSelectedSection("introduction");
    setAiUsageLog([]);
    setResearchProjectId(null);
    setYjsStateHex(null);
    setCollabPeers([]);
    setSuggestions([]);
    ydocRef.current = null;
    yProviderRef.current = null;
    lastSnapshotAtRef.current = 0;
    lastSnapshotContentRef.current = "";
    toast.info(pt ? "Novo documento criado" : "New document created");
  }, [pt]);

  const deleteDocument = useCallback(async (docId: string) => {
    await supabase.from("writing_documents").delete().eq("id", docId);
    if (currentDocId === docId) newDocument();
    loadDocuments();
    toast.success(pt ? "Documento excluído" : "Document deleted");
  }, [currentDocId, newDocument, loadDocuments, pt]);

  // Auto-save every 30s when content changes and a document is active
  useEffect(() => {
    if (!currentDocId || isContentEmpty(editorContent)) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDocument();
    }, 30000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [editorContent, currentDocId, saveDocument]);

  const filteredDocuments = savedDocuments.filter(d =>
    d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.content.toLowerCase().includes(docSearch.toLowerCase())
  );


  const streamAI = useCallback(async (action: string, extraContent?: string) => {
    if (selectedPapers.length === 0 && selectedPDFs.length === 0 && action !== "rephrase") {
      toast.error(pt ? "Selecione pelo menos um paper ou PDF" : "Select at least one paper or PDF");
      return;
    }

    setIsGenerating(true);
    setAiOutput("");
    setAiOutputMeta({ action, sectionId: selectedSection });

    // Log AI usage
    const sectionLabel = SECTIONS.find(s => s.id === selectedSection)?.label[pt ? "pt" : "en"] || selectedSection;
    setAiUsageLog(prev => [...prev, {
      action,
      section: sectionLabel,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const body = {
        action,
        content: extraContent || stripHtml(editorContent),
        // Sent alongside `content` (not instead of it) so every action can honor
        // the instructions field, not just draft_section (which folds it into
        // `content` itself below since there's no existing text to send there).
        instructions: action === "draft_section" ? undefined : instructions,
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
  }, [selectedPapers, selectedPDFs, selectedAnalyses, editorContent, selectedSection, citationStyle, instructions, locale, pt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(aiOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const insertGeneratedText = (text: string) => {
    if (aiOutputMeta?.action === "draft_section") {
      const section = SECTIONS.find((s) => s.id === aiOutputMeta.sectionId);
      const label = section?.label[pt ? "pt" : "en"] || aiOutputMeta.sectionId;
      editorRef.current?.insertSuggestionInSection(aiOutputMeta.sectionId as SectionId, label, text);
    } else {
      editorRef.current?.insertSuggestion(text);
    }
  };

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
      insertGeneratedText(cleaned);
      toast.info(pt ? "Inserido como sugestão pendente — revise e aceite/rejeite" : "Inserted as a pending suggestion — review and accept/reject");
    } else {
      insertGeneratedText(aiOutput);
      toast.success(pt ? "Texto inserido como sugestão pendente" : "Text inserted as a pending suggestion");
    }
  };

  const handleInsertSkeleton = () => {
    editorRef.current?.insertSectionSkeleton(SECTIONS.map((s) => ({ id: s.id, label: s.label[pt ? "pt" : "en"] })));
    toast.success(pt ? "Estrutura de seções inserida" : "Section structure inserted");
  };

  // Quality metrics calculation (operates on plain text — editorContent is HTML)
  const qualityMetrics = useCallback(() => {
    const text = stripHtml(editorContent);
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const citations = (text.match(/\[\d+\]/g) || []).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
    const citationRatio = sentences > 0 ? (citations / sentences * 100).toFixed(0) : "0";

    const hedgingWords = ["suggests", "indicates", "appears", "may", "might", "could", "possibly", "likely",
      "sugere", "indica", "parece", "pode", "possivelmente", "provavelmente"];
    const hedgingCount = hedgingWords.reduce((acc, w) =>
      acc + (text.toLowerCase().match(new RegExp(`\\b${w}\\b`, "g")) || []).length, 0
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── Left sidebar: Sources ─── */}
      <div className="w-72 flex flex-col border-r border-border/30 bg-card/50 backdrop-blur-sm">
        {/* Sidebar header with gradient accent */}
        <div className="p-4 border-b border-border/30 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent">
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20">
              <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            {pt ? "Fontes" : "Sources"}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1.5 ml-[38px]">
            {pt ? "Selecione papers, análises e PDFs" : "Select papers, analyses and PDFs"}
          </p>
        </div>

        <Tabs defaultValue="papers" className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-3 grid grid-cols-3 h-9 rounded-lg bg-muted/60 p-0.5">
            <TabsTrigger value="papers" className="text-[10px] px-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
              <FileText className="h-3 w-3 mr-0.5" />
              Papers ({selectedPapers.length})
            </TabsTrigger>
            <TabsTrigger value="datamind" className="text-[10px] px-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-accent transition-all">
              <Database className="h-3 w-3 mr-0.5" />
              DataMind ({selectedAnalyses.length})
            </TabsTrigger>
            <TabsTrigger value="mypdfs" className="text-[10px] px-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
              <Upload className="h-3 w-3 mr-0.5" />
              {pt ? "PDFs" : "PDFs"} ({selectedPDFs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="papers" className="flex-1 flex flex-col px-3 pb-3 mt-2">
            <Input
              placeholder={pt ? "Buscar papers..." : "Search papers..."}
              value={paperSearch}
              onChange={e => setPaperSearch(e.target.value)}
              className="h-8 text-xs mb-2 bg-background/80 border-border/40 focus-visible:ring-primary/30"
            />
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {loadingPapers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {pt ? "Nenhum paper encontrado" : "No papers found"}
                    </p>
                  </div>
                ) : (
                  filteredGroups.map(group => {
                    const isExpanded = expandedSearches.has(group.id);
                    const selectedCount = group.papers.filter(p => selectedPapers.some(sp => sp.id === p.id)).length;
                    return (
                      <Collapsible key={group.id} open={isExpanded} onOpenChange={() => toggleSearchExpanded(group.id)}>
                        <CollapsibleTrigger className="w-full flex items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/60 text-xs text-left group transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-primary shrink-0 transition-transform" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 transition-transform" />
                          )}
                          <span className="font-semibold text-foreground line-clamp-1 flex-1">{group.query}</span>
                          {selectedCount > 0 && (
                            <Badge className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">{selectedCount}</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">{group.papers.length}</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-3 space-y-0.5 border-l-2 border-border/30 pl-3">
                            {group.papers.map(paper => {
                              const isSelected = selectedPapers.some(p => p.id === paper.id);
                              return (
                                <button
                                  key={paper.id}
                                  onClick={() => togglePaper(paper)}
                                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all duration-200 ${
                                    isSelected
                                      ? "bg-primary/8 border-l-2 border-l-primary shadow-sm shadow-primary/5 ml-[-2px]"
                                      : "hover:bg-muted/50 border-l-2 border-l-transparent ml-[-2px]"
                                  }`}
                                >
                                  <p className={`font-medium line-clamp-2 ${isSelected ? "text-primary" : "text-foreground"}`}>{paper.title}</p>
                                  <p className="text-muted-foreground/70 mt-0.5">
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
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-accent/50" />
                  </div>
                ) : datamindAnalyses.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {pt ? "Nenhuma análise encontrada" : "No analyses found"}
                    </p>
                  </div>
                ) : (
                  datamindAnalyses.map(analysis => {
                    const isSelected = selectedAnalyses.some(a => a.id === analysis.id);
                    return (
                      <button
                        key={analysis.id}
                        onClick={() => toggleAnalysis(analysis)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-all duration-200 ${
                          isSelected
                            ? "bg-accent/8 border-l-2 border-l-accent shadow-sm shadow-accent/5"
                            : "hover:bg-muted/50 border-l-2 border-l-transparent"
                        }`}
                      >
                        <p className={`font-medium line-clamp-2 ${isSelected ? "text-accent" : "text-foreground"}`}>{analysis.title}</p>
                        <p className="text-muted-foreground/60 mt-0.5 line-clamp-1">{analysis.content.slice(0, 80)}...</p>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mypdfs" className="flex-1 flex flex-col px-3 pb-3 mt-2">
            {/* Upload area with animated border */}
            <div className="mb-3">
              <label className="block">
                <div className={`relative rounded-xl p-3.5 text-center cursor-pointer transition-all duration-300 ${
                  uploadingPDF
                    ? "bg-primary/5 border border-primary/30"
                    : "border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/3 hover:shadow-sm"
                }`}>
                  {uploadingPDF ? (
                    <div className="space-y-2">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-muted-foreground">{pt ? "Processando..." : "Processing..."}</p>
                      <Progress value={uploadProgress} className="h-1.5" />
                    </div>
                  ) : (
                    <>
                      <div className="h-10 w-10 mx-auto rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-2">
                        <Upload className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {pt ? "Enviar PDFs" : "Upload PDFs"}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
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
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                  </div>
                ) : uploadedPDFs.length === 0 ? (
                  <div className="text-center py-8">
                    <File className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {pt ? "Nenhum PDF enviado ainda" : "No PDFs uploaded yet"}
                    </p>
                  </div>
                ) : (
                  uploadedPDFs.map(pdf => {
                    const isSelected = selectedPDFs.some(p => p.id === pdf.id);
                    const isProcessed = pdf.status === "processed";
                    const isProcessing = pdf.status === "processing";
                    return (
                      <div
                        key={pdf.id}
                        className={`relative group rounded-lg text-xs transition-all duration-200 ${
                          isSelected
                            ? "bg-primary/8 border-l-2 border-l-primary shadow-sm shadow-primary/5"
                            : "hover:bg-muted/50 border-l-2 border-l-transparent"
                        }`}
                      >
                        <button
                          onClick={() => isProcessed && togglePDF(pdf)}
                          className="w-full text-left p-2.5"
                          disabled={!isProcessed}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isProcessed ? "bg-primary/10" : isProcessing ? "bg-amber-500/10" : "bg-destructive/10"
                            }`}>
                              <File className={`h-3.5 w-3.5 ${
                                isProcessed ? "text-primary" : isProcessing ? "text-amber-500" : "text-destructive"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground line-clamp-2">
                                {pdf.title || pdf.file_name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant={isProcessed ? "secondary" : isProcessing ? "outline" : "destructive"}
                                  className={`text-[9px] px-1.5 py-0 ${
                                    isProcessed ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" : ""
                                  }`}
                                >
                                  {isProcessed
                                    ? (pt ? "Processado" : "Processed")
                                    : isProcessing
                                      ? (pt ? "Processando" : "Processing")
                                      : (pt ? "Erro" : "Error")}
                                </Badge>
                                {isProcessed && pdf.extracted_text && (
                                  <span className="text-[10px] text-muted-foreground/50">
                                    {(pdf.extracted_text.length / 1000).toFixed(0)}k chars
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePDF(pdf); }}
                          className="absolute top-2 right-2 h-5 w-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all"
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

      {/* ─── Main editor area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Document title bar — document management only */}
        <div className="h-[52px] shrink-0 border-b border-border/30 bg-background flex items-center gap-2.5 px-4">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <PenLine className="h-3 w-3 text-primary-foreground" />
          </div>
          <input
            type="text"
            value={docTitle}
            onChange={e => setDocTitle(e.target.value)}
            placeholder={pt ? "Título do documento..." : "Document title..."}
            className="text-xs font-semibold text-foreground/80 bg-transparent border-none outline-none focus:text-foreground placeholder:text-muted-foreground/40 w-56 tracking-wide"
          />
          {currentDocId && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 flex items-center gap-1 shrink-0">
              <Check className="h-2.5 w-2.5" />
              {pt ? "Salvo automaticamente" : "Auto-saved"}
            </span>
          )}
          {isGenerating && (
            <span className="flex items-center gap-1 text-primary/60 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px]">{pt ? "Gerando..." : "Generating..."}</span>
            </span>
          )}

          <div className="ml-auto flex items-center gap-0.5">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600" onClick={newDocument}>
                    <FilePlus2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{pt ? "Criar novo documento" : "Create new document"}</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" disabled={isSaving || isContentEmpty(editorContent)} onClick={saveDocument}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{pt ? "Salvar documento atual" : "Save current document"}</p></TooltipContent>
              </Tooltip>
              {currentDocId && (
                <LinkToProjectButton
                  resourceType="writing"
                  resourceId={currentDocId}
                  label={docTitle || (pt ? "Documento sem título" : "Untitled document")}
                  url={`/writing?docId=${currentDocId}`}
                  attachTable="writing_documents"
                  variant="ghost"
                  metadata={{ section: selectedSection }}
                  onLinked={async (projectId) => {
                    setResearchProjectId(projectId);
                    try {
                      await promoteWritingToPublication(projectId, docTitle || (pt ? "Manuscrito" : "Manuscript"));
                      toast.success(pt ? "Documento vinculado e registrado em Publicações — colaboradores do projeto já podem co-editar em tempo real" : "Document linked and registered in Publications — project collaborators can now co-edit in real time");
                    } catch { /* non-blocking */ }
                  }}
                />
              )}
              {currentDocId && (
                <WritingDocumentVersionsDialog
                  documentId={currentDocId}
                  currentContent={editorContent}
                  onRestore={(text) => setEditorContent(text)}
                />
              )}
              <Dialog open={showDocManager} onOpenChange={setShowDocManager}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 relative hover:bg-accent/10 hover:text-accent">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {savedDocuments.length > 0 && (
                          <Badge variant="secondary" className="absolute -top-1 -right-1 text-[8px] h-3.5 min-w-3.5 px-0.5 bg-muted/80">{savedDocuments.length}</Badge>
                        )}
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{pt ? "Abrir documento salvo" : "Open saved document"}</p></TooltipContent>
                </Tooltip>

                {/* ─── Document Manager Dialog ─── */}
                <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden border-border/30 bg-background/95 backdrop-blur-xl">
                  <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent">
                    <DialogTitle className="flex items-center gap-3 text-base">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20">
                        <FolderOpen className="h-4 w-4 text-primary-foreground" />
                      </div>
                      {pt ? "Meus Documentos" : "My Documents"}
                      <Badge variant="secondary" className="text-[10px] ml-auto bg-muted/60">
                        {savedDocuments.length} {pt ? "documentos" : "documents"}
                      </Badge>
                    </DialogTitle>
                  </DialogHeader>

                  <div className="px-6 py-3 border-b border-border/10">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                      <Input
                        placeholder={pt ? "Buscar documentos..." : "Search documents..."}
                        value={docSearch}
                        onChange={e => setDocSearch(e.target.value)}
                        className="h-8 text-xs bg-muted/30 border-border/20 pl-8 rounded-lg focus-visible:ring-primary/30"
                      />
                    </div>
                  </div>

                  <ScrollArea className="flex-1 max-h-[55vh]">
                    <div className="px-6 py-3 space-y-2">
                      {loadingDocs ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
                        </div>
                      ) : filteredDocuments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-3">
                            <FileText className="h-6 w-6 text-primary/30" />
                          </div>
                          <p className="text-sm text-muted-foreground/60">
                            {pt ? "Nenhum documento encontrado" : "No documents found"}
                          </p>
                          <p className="text-xs text-muted-foreground/40 mt-1">
                            {pt ? "Comece a escrever e salve seu primeiro artigo" : "Start writing and save your first article"}
                          </p>
                        </div>
                      ) : (
                        filteredDocuments.map((doc) => {
                          const isActive = currentDocId === doc.id;
                          const preview = doc.content.slice(0, 120).replace(/\n/g, " ");
                          const wordCount = doc.content.split(/\s+/).filter(Boolean).length;
                          const updatedDate = new Date(doc.updated_at);
                          const isToday = new Date().toDateString() === updatedDate.toDateString();
                          const dateStr = isToday
                            ? updatedDate.toLocaleTimeString(pt ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })
                            : updatedDate.toLocaleDateString(pt ? "pt-BR" : "en-US", { day: "2-digit", month: "short" });

                          return (
                            <button
                              key={doc.id}
                              onClick={() => loadDocument(doc)}
                              className={`w-full text-left rounded-xl p-3.5 group transition-all duration-200 border ${
                                isActive
                                  ? "bg-primary/5 border-primary/20 shadow-sm shadow-primary/5"
                                  : "bg-card/50 border-border/20 hover:border-primary/15 hover:bg-primary/[0.02] hover:shadow-sm"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${
                                      isActive ? "bg-primary/15" : "bg-muted/50"
                                    }`}>
                                      <FileText className={`h-3 w-3 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                                    </div>
                                    <h4 className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground/80"}`}>
                                      {doc.title}
                                    </h4>
                                    {isActive && (
                                      <Badge className="text-[8px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20 shrink-0">
                                        {pt ? "Aberto" : "Open"}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground/50 line-clamp-2 ml-7 leading-relaxed">
                                    {preview || (pt ? "Documento vazio" : "Empty document")}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 ml-7">
                                    <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                                      <Clock className="h-2.5 w-2.5" />
                                      {dateStr}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/40">
                                      {wordCount} {pt ? "palavras" : "words"}
                                    </span>
                                    {doc.section && (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/30 text-muted-foreground/50">
                                        {SECTIONS.find(s => s.id === doc.section)?.label[pt ? "pt" : "en"] || doc.section}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                                  className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-all shrink-0 mt-0.5"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
              {collabPeers.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 h-8 px-1.5 rounded-md bg-primary/5 text-xs text-primary ml-0.5">
                      <Users className="h-3 w-3" />
                      <div className="flex -space-x-1.5">
                        {collabPeers.slice(0, 4).map((p) => (
                          <span
                            key={p.clientId}
                            className="h-4 w-4 rounded-full border border-background flex items-center justify-center text-[8px] font-semibold text-white"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{collabPeers.map((p) => p.name).join(", ")}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {/* Content toolbar — configuration + AI actions only */}
        <div className="border-b border-border/30 bg-background/80 backdrop-blur-md px-4 py-2.5 flex items-center gap-2.5 flex-wrap shadow-sm">
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-40 h-8 text-xs rounded-lg border-border/40 bg-background/60">
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

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground" onClick={handleInsertSkeleton}>
                  <ListTree className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">{pt ? "Inserir estrutura de seções" : "Insert section structure"}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Select value={citationStyle} onValueChange={setCitationStyle}>
            <SelectTrigger className="w-28 h-8 text-xs rounded-lg border-border/40 bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APA" className="text-xs">APA 7th</SelectItem>
              <SelectItem value="Vancouver" className="text-xs">Vancouver</SelectItem>
              <SelectItem value="ABNT" className="text-xs">ABNT</SelectItem>
            </SelectContent>
          </Select>

          {/* Selected sources badges */}
          {(selectedPapers.length > 0 || selectedPDFs.length > 0 || selectedAnalyses.length > 0) && (
            <>
              <Separator orientation="vertical" className="h-6 bg-border/30" />
              <div className="flex items-center gap-1.5">
                {selectedPapers.length > 0 && (
                  <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {selectedPapers.length}
                  </Badge>
                )}
                {selectedPDFs.length > 0 && (
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10 dark:text-amber-400 gap-1">
                    <File className="h-2.5 w-2.5" />
                    {selectedPDFs.length}
                  </Badge>
                )}
                {selectedAnalyses.length > 0 && (
                  <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20 hover:bg-accent/10 gap-1">
                    <Database className="h-2.5 w-2.5" />
                    {selectedAnalyses.length}
                  </Badge>
                )}
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <TooltipProvider delayDuration={300}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-lg border-border/40 text-muted-foreground" disabled={isGenerating}>
                    {pt ? "Mais ações" : "More actions"}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">
                    {pt ? "Escrita" : "Write"}
                  </DropdownMenuLabel>
                  <DropdownMenuItem disabled={isGenerating} onClick={() => streamAI("insert_citation")}>
                    <Quote className="h-3.5 w-3.5 mr-2" />{pt ? "Citar" : "Cite"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isGenerating || isContentEmpty(editorContent)} onClick={() => streamAI("generate_abstract")}>
                    <Sigma className="h-3.5 w-3.5 mr-2" />Abstract
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isGenerating || isContentEmpty(editorContent)} onClick={() => streamAI("generate_highlights")}>
                    <Star className="h-3.5 w-3.5 mr-2" />Highlights
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[9px] font-bold text-accent/60 uppercase tracking-widest">
                    {pt ? "Revisão" : "Review"}
                  </DropdownMenuLabel>
                  <DropdownMenuItem disabled={isGenerating || isContentEmpty(editorContent)} onClick={() => streamAI("rephrase")}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />{pt ? "Reformular" : "Rephrase"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isGenerating || isContentEmpty(editorContent)} onClick={() => streamAI("check_consistency")}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />{pt ? "Verificar" : "Check"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isGenerating || isContentEmpty(editorContent)} onClick={() => streamAI("peer_review")}>
                    <MessageSquareWarning className="h-3.5 w-3.5 mr-2" />Peer Review
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isGenerating || isContentEmpty(editorContent)} onClick={() => streamAI("improve_hedging")}>
                    <Eye className="h-3.5 w-3.5 mr-2" />Hedging
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-lg border-primary/25 text-primary hover:bg-primary/5" disabled={isGenerating || isContentEmpty(editorContent)}
                    onClick={() => streamAI("continue_writing")}>
                    <ArrowRight className="h-3.5 w-3.5" />
                    {pt ? "Continuar" : "Continue"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{pt ? "Continuar escrevendo de onde parou" : "Continue writing from where you left off"}</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/20 border-0 hover:opacity-90 transition-all" disabled={isGenerating}
                    onClick={() => streamAI("draft_section", instructions)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    {pt ? "Gerar" : "Draft"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{pt ? "Gerar rascunho da seção com citações" : "Generate section draft with citations"}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Instructions bar */}
        <div className="border-b border-border/30 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 px-4 py-2.5">
          <div className="relative">
            <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/40" />
            <Input
              placeholder={pt
                ? "Instruções adicionais para a IA (ex: foco em estudos clínicos, mencionar limitações...)"
                : "Additional instructions for the AI (e.g., focus on clinical studies, mention limitations...)"}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="h-8 text-xs bg-background/60 border-border/30 pl-8 rounded-lg focus-visible:ring-primary/30 focus-visible:border-primary/30"
            />
          </div>
        </div>

        {/* Editor + AI output split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Section outline */}
          <DocumentOutline
            headings={headings}
            selectedSection={selectedSection}
            onSelectSection={setSelectedSection}
            onNavigate={(pos) => editorRef.current?.focusAt(pos + 1)}
            onInsertSkeleton={handleInsertSkeleton}
            pt={pt}
          />
          {/* Editor */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-border/30">
            <div
              className="flex-1 overflow-y-auto shadow-inner shadow-muted/20"
              style={{
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, hsl(var(--border) / 0.15) 31px, hsl(var(--border) / 0.15) 32px)',
                backgroundSize: '100% 32px',
                backgroundPositionY: '23px',
              }}
            >
              <RichTextEditor
                key={currentDocId || "new"}
                ref={editorRef}
                value={editorContent}
                onChange={setEditorContent}
                placeholder={pt
                  ? "Comece a escrever seu artigo aqui ou use os botões acima para gerar conteúdo com IA..."
                  : "Start writing your paper here or use the buttons above to generate content with AI..."}
                className="writing-editor-prose"
                collaboration={
                  currentDocId && researchProjectId && user
                    ? {
                        supabase,
                        documentId: currentDocId,
                        user: {
                          name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || (pt ? "Anônimo" : "Anonymous"),
                          color: colorFromId(user.id),
                        },
                        initialYjsState: pgHexToBytes(yjsStateHex),
                        onReady: ({ ydoc, provider }) => {
                          ydocRef.current = ydoc;
                          yProviderRef.current = provider;
                          const updatePeers = () => {
                            const states = Array.from(provider.awareness.getStates().entries()) as [number, Record<string, Record<string, string>>][];
                            setCollabPeers(
                              states
                                .filter(([clientId]) => clientId !== ydoc.clientID)
                                .map(([clientId, state]) => ({
                                  clientId,
                                  name: state?.user?.name || "?",
                                  color: state?.user?.color || "#888",
                                })),
                            );
                          };
                          provider.awareness.on("change", updatePeers);
                          updatePeers();
                        },
                      }
                    : undefined
                }
                onSuggestionsChange={setSuggestions}
                onHeadingsChange={setHeadings}
              />
            </div>
            {/* Pending AI suggestions (track changes) */}
            {suggestions.length > 0 && (
              <div className="border-t border-border/20 bg-primary/5">
                <div className="flex items-center justify-between px-4 py-1.5">
                  <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                    <MessageSquareWarning className="h-3 w-3" />
                    {suggestions.length} {pt ? "sugestão(ões) pendente(s)" : "pending suggestion(s)"}
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] px-2 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={() => suggestions.forEach((s) => acceptOneSuggestion(s.suggestionId))}
                    >
                      <Check className="h-3 w-3" />{pt ? "Aceitar todas" : "Accept all"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => suggestions.forEach((s) => rejectOneSuggestion(s.suggestionId))}
                    >
                      <X className="h-3 w-3" />{pt ? "Rejeitar todas" : "Reject all"}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="max-h-24">
                  <div className="px-4 pb-2 space-y-1">
                    {suggestions.map((s) => (
                      <div key={s.suggestionId} className="flex items-center gap-2 rounded-md bg-background/60 border border-border/40 px-2 py-1">
                        <span className="flex-1 min-w-0 truncate text-xs text-foreground/80">{s.text || "…"}</span>
                        <button
                          className="text-emerald-600 hover:text-emerald-700"
                          title={pt ? "Aceitar" : "Accept"}
                          onClick={() => acceptOneSuggestion(s.suggestionId)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="text-destructive hover:text-destructive/80"
                          title={pt ? "Rejeitar" : "Reject"}
                          onClick={() => rejectOneSuggestion(s.suggestionId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {/* Quality metrics footer */}
            {(() => {
              const metrics = qualityMetrics();
              return (
                <div className="px-4 py-2 border-t border-border/20 bg-gradient-to-r from-muted/15 via-muted/25 to-muted/15 flex items-center gap-3 text-[11px]">
                  <span className="text-muted-foreground font-medium">{stripHtml(editorContent).split(/\s+/).filter(Boolean).length} {pt ? "palavras" : "words"}</span>
                  {metrics && (
                    <>
                      <div className="h-3 w-px bg-border/40" />
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
                              Number(metrics.citationRatio) < 20 && metrics.wordCount > 100
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-primary/5 text-primary/70"
                            }`}>
                              <Quote className="h-2.5 w-2.5" />
                              {metrics.citations} ({metrics.citationRatio}%)
                            </span>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">{pt ? "Citações por frase" : "Citations per sentence"}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
                              Number(metrics.hedgingPer1000) < 3 && metrics.wordCount > 100
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-accent/5 text-accent/70"
                            }`}>
                              <Eye className="h-2.5 w-2.5" />
                              {metrics.hedgingPer1000}‰
                            </span>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">{pt ? "Hedging por 1000 palavras (ideal: >5)" : "Hedging per 1000 words (ideal: >5)"}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground">
                              TTR {metrics.ttr}%
                            </span>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">{pt ? "Variedade vocabular (Type-Token Ratio)" : "Vocabulary variety (Type-Token Ratio)"}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  <span className="ml-auto text-muted-foreground/50">{stripHtml(editorContent).length} {pt ? "caracteres" : "characters"}</span>
                </div>
              );
            })()}
          </div>

          {/* Right panel: AI Output or CAPES Advisor */}
          <div className="w-[45%] shrink-0 flex flex-col bg-gradient-to-b from-primary/[0.02] to-accent/[0.02]">
            {/* Explicit tab strip — two views of the same panel */}
            <div className="h-10 shrink-0 border-b border-border/20 flex items-center px-2 gap-1 bg-muted/30">
              <button
                onClick={() => setActiveRightPanel("ai")}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                  activeRightPanel === "ai"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                {pt ? "Saída da IA" : "AI Output"}
                {isGenerating && <Loader2 className="h-3 w-3 animate-spin ml-0.5" />}
              </button>
              <button
                onClick={() => setActiveRightPanel("capes")}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all ${
                  activeRightPanel === "capes"
                    ? "bg-background text-primary shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-3 w-3" />
                CAPES APC
              </button>

              <div className="ml-auto">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 relative hover:bg-emerald-500/10 hover:text-emerald-600"
                        onClick={() => setShowAIDeclaration(true)}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {aiUsageLog.length > 0 && (
                          <Badge className="absolute -top-1 -right-1 text-[8px] h-3.5 min-w-3.5 px-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">
                            {aiUsageLog.length}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{pt ? "Gerar declaração de uso de IA (Elsevier, Nature, SciELO...)" : "Generate AI usage declaration (Elsevier, Nature, SciELO...)"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {activeRightPanel === "ai" ? (
              <>
                {aiOutput && !isGenerating && (
                  <div className="px-4 py-2 border-b border-border/20 flex items-center justify-end gap-1.5">
                    {(() => {
                      const v = validateCitationsInOutput(aiOutput);
                      return !v.valid ? (
                        <Badge className="text-[9px] h-5 gap-0.5 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {v.invalidIds.length} {pt ? "citação suspeita" : "suspicious"}
                        </Badge>
                      ) : v.totalCitations > 0 ? (
                        <Badge className="text-[9px] h-5 gap-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 dark:text-emerald-400">
                          <Check className="h-2.5 w-2.5" />
                          {v.totalCitations} {pt ? "citações válidas" : "valid citations"}
                        </Badge>
                      ) : null;
                    })()}
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" onClick={handleCopy}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? (pt ? "Copiado" : "Copied") : (pt ? "Copiar" : "Copy")}
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1 px-3 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 shadow-sm shadow-primary/20 transition-all border-0" onClick={handleInsertInEditor}>
                      <Plus className="h-3 w-3" />
                      {pt ? "Inserir" : "Insert"}
                    </Button>
                  </div>
                )}
                <ScrollArea className="flex-1">
                  <div className="p-6 text-sm leading-[1.9] whitespace-pre-wrap font-serif text-foreground">
                    {aiOutput ? (
                      <div className="animate-in fade-in-0 duration-300">{aiOutput}</div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4">
                          <Sparkles className="h-7 w-7 text-primary/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground/60 max-w-[280px] leading-relaxed">
                          {pt
                            ? "Use os botões acima para gerar conteúdo. Selecione papers, PDFs e análises do DataMind no painel esquerdo."
                            : "Use the buttons above to generate content. Select papers, PDFs and DataMind analyses from the left panel."}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <CAPESAdvisorPanel
                editorContent={stripHtml(editorContent)}
                onFormatArticle={(publisher) => {
                  setActiveRightPanel("ai");
                  streamAI("format_for_journal", `${stripHtml(editorContent)}\n\n---\nFormat this article according to ${publisher} submission guidelines. Publisher: ${publisher}`);
                }}
                onClose={() => setActiveRightPanel("ai")}
                onInsertFormatted={(text) => {
                  editorRef.current?.insertSuggestion(text);
                  toast.success(pt ? "Texto formatado inserido como sugestão pendente" : "Formatted text inserted as a pending suggestion");
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* AI Declaration Dialog */}
      <AIDeclarationDialog
        open={showAIDeclaration}
        onOpenChange={setShowAIDeclaration}
        aiUsageLog={aiUsageLog}
        locale={locale}
        onInsert={(text) => {
          setEditorContent(prev => prev + (prev ? "\n\n" : "") + text);
        }}
      />
    </div>
  );
};

export default WritingAssistant;
