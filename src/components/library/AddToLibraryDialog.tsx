import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload, Hash, FileText, Loader2, Search, CheckCircle2, XCircle, FileUp,
} from "lucide-react";
import { parseRIS, parseBibTeX, parseCSV, type PaperRef } from "@/lib/referenceFormats";

interface AddToLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type IdType = "doi" | "pmid" | "arxiv";

function detectIdType(raw: string): IdType | null {
  const v = raw.trim();
  if (/arxiv\.org\/abs\//i.test(v) || /^\d{4}\.\d{4,5}(v\d+)?$/.test(v)) return "arxiv";
  if (/doi\.org\//i.test(v) || /^10\.\d{4,9}\/\S+$/.test(v)) return "doi";
  if (/^\d{6,9}$/.test(v)) return "pmid";
  return null;
}

function cleanIdValue(raw: string, type: IdType): string {
  const v = raw.trim();
  if (type === "doi") return v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (type === "arxiv") return v.replace(/^https?:\/\/arxiv\.org\/abs\//i, "").replace(/^arxiv:/i, "");
  return v;
}

const ID_EXAMPLES: { labelKey: string; type: IdType; value: string }[] = [
  { labelKey: "DOI", type: "doi", value: "10.1038/s41522-018-0073-2" },
  { labelKey: "PMID", type: "pmid", value: "34234088" },
  { labelKey: "arXiv", type: "arxiv", value: "2306.01643" },
];

async function insertToLibrary(user: { id: string }, name: string, papers: PaperRef[]) {
  const { error } = await supabase.from("saved_searches").insert({
    user_id: user.id,
    query: name,
    papers,
    columns: [],
    column_data: {},
  });
  if (error) throw error;
}

const AddToLibraryDialog = ({ open, onOpenChange, onImported }: AddToLibraryDialogProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const { user } = useAuth();
  const [tab, setTab] = useState("pdf");

  const closeAndRefresh = () => {
    onOpenChange(false);
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{pt ? "Enviar para Biblioteca" : "Send to Library"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pdf" title={pt ? "Enviar PDFs" : "Upload PDFs"}>
              <Upload className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="zotero" title="Zotero">
              <span className="text-xs font-bold text-red-500">Z</span>
            </TabsTrigger>
            <TabsTrigger value="mendeley" title="Mendeley">
              <span className="text-xs font-bold text-rose-700">M</span>
            </TabsTrigger>
            <TabsTrigger value="bibris" title={pt ? "Importar .bib/.ris" : "Import .bib/.ris"}>
              <FileText className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="id" title={pt ? "Colar ID" : "Paste ID"}>
              <Hash className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-4">
            <TabsContent value="pdf" className="mt-0">
              <PdfTab pt={pt} user={user} onDone={closeAndRefresh} />
            </TabsContent>
            <TabsContent value="zotero" className="mt-0">
              <ProviderTab pt={pt} user={user} provider="zotero" onDone={closeAndRefresh} />
            </TabsContent>
            <TabsContent value="mendeley" className="mt-0">
              <ProviderTab pt={pt} user={user} provider="mendeley" onDone={closeAndRefresh} />
            </TabsContent>
            <TabsContent value="bibris" className="mt-0">
              <BibRisTab pt={pt} user={user} onDone={closeAndRefresh} />
            </TabsContent>
            <TabsContent value="id" className="mt-0">
              <PasteIdTab pt={pt} user={user} onDone={closeAndRefresh} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddToLibraryDialog;

// ── Enviar PDFs ──

interface PdfEntry {
  file: File;
  status: "pending" | "uploading" | "extracting" | "done" | "error";
  paper?: PaperRef;
  error?: string;
}

function PdfTab({ pt, user, onDone }: { pt: boolean; user: { id: string } | null; onDone: () => void }) {
  const [entries, setEntries] = useState<PdfEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (entry: PdfEntry, index: number) => {
    if (!user) return;
    const setStatus = (patch: Partial<PdfEntry>) =>
      setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));

    try {
      setStatus({ status: "uploading" });
      const path = `${user.id}/library/${Date.now()}_${entry.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("papers")
        .upload(path, entry.file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      setStatus({ status: "extracting" });
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("import-pdf-to-library", {
        body: { storagePath: path },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      setStatus({ status: "done", paper: res.data.paper as PaperRef });
    } catch (err: any) {
      setStatus({ status: "error", error: err.message || (pt ? "Falha ao processar" : "Failed to process") });
    }
  };

  const handleSelect = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const newEntries: PdfEntry[] = Array.from(files)
      .filter((f) => f.name.toLowerCase().endsWith(".pdf"))
      .map((file) => ({ file, status: "pending" as const }));
    if (!newEntries.length) {
      toast.error(pt ? "Apenas PDFs são aceitos" : "Only PDFs are accepted");
      return;
    }
    const startIndex = entries.length;
    setEntries((prev) => [...prev, ...newEntries]);
    setProcessing(true);
    for (let i = 0; i < newEntries.length; i++) {
      await processFile(newEntries[i], startIndex + i);
    }
    setProcessing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doneEntries = entries.filter((e) => e.status === "done" && e.paper);

  const confirmAdd = async () => {
    if (!user || !doneEntries.length) return;
    setSaving(true);
    try {
      await insertToLibrary(
        user,
        pt ? `PDFs enviados (${doneEntries.length})` : `Uploaded PDFs (${doneEntries.length})`,
        doneEntries.map((e) => e.paper!)
      );
      toast.success(pt ? "Adicionado à biblioteca!" : "Added to library!");
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-sm text-foreground font-medium">
          {pt ? "Clique para enviar PDFs" : "Click to upload PDFs"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {pt ? "Metadados extraídos automaticamente com IA · máx. 15MB por arquivo" : "Metadata auto-extracted with AI · max 15MB per file"}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleSelect(e.target.files)}
        />
      </div>

      {entries.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
              {e.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              {e.status === "error" && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
              {(e.status === "uploading" || e.status === "extracting" || e.status === "pending") && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">{e.paper?.title || e.file.name}</p>
                {e.status === "uploading" && <p className="text-xs text-muted-foreground">{pt ? "Enviando..." : "Uploading..."}</p>}
                {e.status === "extracting" && <p className="text-xs text-muted-foreground">{pt ? "Extraindo metadados..." : "Extracting metadata..."}</p>}
                {e.status === "error" && <p className="text-xs text-destructive">{e.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button onClick={confirmAdd} disabled={!doneEntries.length || processing || saving} className="w-full">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {pt ? `Adicionar à Biblioteca (${doneEntries.length})` : `Add to Library (${doneEntries.length})`}
      </Button>
    </div>
  );
}

// ── Zotero / Mendeley quick connect ──

function ProviderTab({
  pt, user, provider, onDone,
}: { pt: boolean; user: { id: string } | null; provider: "zotero" | "mendeley"; onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("reference_manager_connections")
        .select("id")
        .eq("provider", provider)
        .maybeSingle();
      setConnectionId((data as any)?.id || null);
      setLoading(false);
    })();
  }, [user, provider]);

  const pull = async (connId: string) => {
    setPulling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("sync-references", {
        body: { connectionId: connId, action: "pull" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data as any;
      toast.success(
        pt ? `${result.pulled || 0} referências importadas!` : `${result.pulled || 0} references imported!`
      );
      onDone();
    } catch (err: any) {
      toast.error(err.message || (pt ? "Falha na sincronização" : "Sync failed"));
    } finally {
      setPulling(false);
    }
  };

  const connectAndPull = async () => {
    if (!user || !apiKey.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("reference_manager_connections")
        .insert({
          user_id: user.id,
          provider,
          api_key: apiKey.trim(),
          user_library_id: provider === "zotero" ? libraryId.trim() || null : null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast.success(pt ? "Conectado!" : "Connected!");
      setConnectionId((data as any).id);
      await pull((data as any).id);
    } catch (err: any) {
      if (err.code === "23505") {
        toast.error(pt ? "Conexão com esse provedor já existe" : "Connection with this provider already exists");
      } else {
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (connectionId) {
    return (
      <div className="space-y-4 text-center py-4">
        <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
        <p className="text-sm text-foreground">
          {pt ? `Sua conta ${provider === "zotero" ? "Zotero" : "Mendeley"} já está conectada.` : `Your ${provider === "zotero" ? "Zotero" : "Mendeley"} account is already connected.`}
        </p>
        <Button onClick={() => pull(connectionId)} disabled={pulling} className="w-full">
          {pulling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {pt ? "Importar referências agora" : "Import references now"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {pt ? "Gerencie a conexão (desconectar, sincronização completa) abaixo, na seção Gerenciadores Bibliográficos." : "Manage the connection (disconnect, full sync) below in the Reference Managers section."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>
          {provider === "zotero"
            ? "API Key (zotero.org/settings/keys)"
            : (pt ? "Token de Acesso (Mendeley OAuth)" : "Access Token (Mendeley OAuth)")}
        </Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={provider === "zotero" ? "Zotero API Key" : "Mendeley Access Token"}
        />
      </div>
      {provider === "zotero" && (
        <div>
          <Label>User ID / Library ID</Label>
          <Input
            value={libraryId}
            onChange={(e) => setLibraryId(e.target.value)}
            placeholder={pt ? "Seu User ID numérico do Zotero" : "Your numeric Zotero User ID"}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {pt ? "Encontre em zotero.org/settings/keys" : "Find at zotero.org/settings/keys"}
          </p>
        </div>
      )}
      <Button onClick={connectAndPull} disabled={saving || !apiKey.trim()} className="w-full">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {pt ? "Conectar e Importar" : "Connect and Import"}
      </Button>
    </div>
  );
}

// ── Importar .bib/.ris ──

function BibRisTab({ pt, user, onDone }: { pt: boolean; user: { id: string } | null; onDone: () => void }) {
  const [preview, setPreview] = useState<PaperRef[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      let papers: PaperRef[] = [];
      const ext = file.name.toLowerCase();
      if (ext.endsWith(".ris")) papers = parseRIS(content);
      else if (ext.endsWith(".bib") || ext.endsWith(".bibtex")) papers = parseBibTeX(content);
      else if (ext.endsWith(".csv")) papers = parseCSV(content);
      else {
        toast.error(pt ? "Formato não suportado. Use .ris, .bib ou .csv" : "Unsupported format. Use .ris, .bib or .csv");
        return;
      }
      if (!papers.length) {
        toast.error(pt ? "Nenhum paper encontrado no arquivo" : "No papers found in file");
        return;
      }
      setPreview(papers);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!preview || !user) return;
    setImporting(true);
    try {
      await insertToLibrary(user, pt ? `Importado (${preview.length} papers)` : `Imported (${preview.length} papers)`, preview.map((p) => ({ ...p, source: "import" })));
      toast.success(pt ? `${preview.length} papers importados!` : `${preview.length} papers imported!`);
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  if (preview) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {preview.length} {pt ? "papers encontrados no arquivo" : "papers found in file"}
        </p>
        <div className="border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
          {preview.slice(0, 50).map((p, i) => (
            <div key={i} className="px-3 py-2">
              <p className="text-sm font-medium leading-tight">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {Array.isArray(p.authors) ? p.authors.slice(0, 3).join(", ") : ""} {p.year && `(${p.year})`}
              </p>
            </div>
          ))}
          {preview.length > 50 && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              +{preview.length - 50} {pt ? "mais" : "more"}...
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPreview(null)}>{pt ? "Cancelar" : "Cancel"}</Button>
          <Button onClick={confirmImport} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            {pt ? "Importar" : "Import"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => fileRef.current?.click()}
    >
      <FileText className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
      <p className="text-sm text-foreground font-medium">
        {pt ? "Clique para enviar .ris, .bib ou .csv" : "Click to upload .ris, .bib or .csv"}
      </p>
      <input ref={fileRef} type="file" accept=".ris,.bib,.bibtex,.csv" className="hidden" onChange={handleSelect} />
    </div>
  );
}

// ── Colar ID ──

function PasteIdTab({ pt, user, onDone }: { pt: boolean; user: { id: string } | null; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaperRef | null>(null);
  const [adding, setAdding] = useState(false);

  const search = async (raw?: string) => {
    const v = (raw ?? value).trim();
    if (!v) return;
    const idType = detectIdType(v);
    if (!idType) {
      toast.error(pt ? "Não reconhecido como DOI, PMID ou arXiv" : "Not recognized as a DOI, PMID or arXiv id");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("lookup-paper-id", {
        body: { idType, value: cleanIdValue(v, idType) },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      setResult(res.data.paper as PaperRef);
    } catch (err: any) {
      toast.error(err.message || (pt ? "Não encontrado" : "Not found"));
    } finally {
      setLoading(false);
    }
  };

  const confirmAdd = async () => {
    if (!user || !result) return;
    setAdding(true);
    try {
      await insertToLibrary(user, result.title, [result]);
      toast.success(pt ? "Adicionado à biblioteca!" : "Added to library!");
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pt ? "Buscar metadados por DOI, PMID ou URL do arXiv" : "Search metadata by DOI, PMID or arXiv URL"}
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="10.1038/s41522-018-0073-2"
        />
        <Button onClick={() => search()} disabled={loading || !value.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {!result && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">{pt ? "Tente um destes exemplos:" : "Try one of these examples:"}</p>
          <div className="grid grid-cols-3 gap-2">
            {ID_EXAMPLES.map((ex) => (
              <button
                key={ex.type}
                type="button"
                onClick={() => { setValue(ex.value); search(ex.value); }}
                className="rounded-lg border border-border p-2 text-left hover:border-primary/40 transition-colors"
              >
                <p className="text-xs font-semibold text-foreground">{ex.labelKey}</p>
                <p className="text-[11px] text-muted-foreground truncate">{ex.value}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm font-semibold text-foreground leading-snug">{result.title}</p>
          <p className="text-xs text-muted-foreground">
            {Array.isArray(result.authors) ? result.authors.slice(0, 4).join(", ") : ""} {result.year && `(${result.year})`}
          </p>
          {result.journal && <p className="text-xs text-muted-foreground italic">{result.journal}</p>}
          {result.abstract && <p className="text-xs text-muted-foreground line-clamp-3">{result.abstract}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>{pt ? "Buscar outro" : "Search another"}</Button>
            <Button size="sm" onClick={confirmAdd} disabled={adding}>
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pt ? "Adicionar à Biblioteca" : "Add to Library"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
