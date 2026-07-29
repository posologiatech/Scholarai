import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Lock, ShieldCheck, Download, FileDown } from "lucide-react";
import { buildProtocolDocument, downloadProtocolPDF, type Pico } from "@/lib/systematicReview/protocol";

interface ProtocolPanelProps {
  question: string;
  pico: Pico;
  criteria: { name: string; description: string; enabled?: boolean }[];
  searchStrategy?: string;
  prosperoId: string;
  onProsperoIdChange: (id: string) => void;
  locked: boolean;
  lockedAt: string | null;
  protocolDocument: string | null;
  onRegisterProtocol: () => Promise<void>;
}

const ProtocolPanel = ({
  question,
  pico,
  criteria,
  searchStrategy,
  prosperoId,
  onProsperoIdChange,
  locked,
  lockedAt,
  protocolDocument,
  onRegisterProtocol,
}: ProtocolPanelProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const [registering, setRegistering] = useState(false);
  const enabledCriteria = criteria.filter((c) => c.enabled !== false);
  const canRegister = question.trim().length > 0 && enabledCriteria.length > 0;

  const handleRegister = async () => {
    if (!canRegister) return;
    const confirmed = confirm(
      pt
        ? "Registrar o protocolo bloqueia permanentemente a pergunta de pesquisa, o PICO, os critérios de triagem e a estratégia de busca. Deseja continuar?"
        : "Registering the protocol permanently locks the research question, PICO, screening criteria and search strategy. Continue?",
    );
    if (!confirmed) return;
    setRegistering(true);
    try {
      await onRegisterProtocol();
    } finally {
      setRegistering(false);
    }
  };

  const currentDocument = protocolDocument || (lockedAt
    ? buildProtocolDocument({ question, pico, criteria: enabledCriteria, searchStrategy, prosperoId, lockedAt, locale })
    : "");

  const downloadMarkdown = () => {
    const blob = new Blob([currentDocument], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "protocolo.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (locked) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {pt ? "Protocolo registrado" : "Protocol registered"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {pt ? "Registrado em" : "Registered on"} {lockedAt && new Date(lockedAt).toLocaleString(locale)}
          {prosperoId ? ` · ${pt ? "ID externo" : "External ID"}: ${prosperoId}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadMarkdown} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            {pt ? "Baixar .md" : "Download .md"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadProtocolPDF(currentDocument, locale as "pt" | "en")} className="gap-1.5 text-xs">
            <FileDown className="h-3.5 w-3.5" />
            {pt ? "Baixar PDF" : "Download PDF"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {pt ? "Registro de protocolo" : "Protocol registration"}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {pt
          ? "Registre o protocolo antes de iniciar a triagem para travar a priori a pergunta, o PICO, os critérios e a estratégia de busca — como exige registro em PROSPERO."
          : "Register the protocol before screening begins to lock the question, PICO, criteria and search strategy a priori — as required by PROSPERO-style registration."}
      </p>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {pt ? "ID de registro externo (opcional, ex.: PROSPERO)" : "External registration ID (optional, e.g. PROSPERO)"}
        </label>
        <input
          value={prosperoId}
          onChange={(e) => onProsperoIdChange(e.target.value)}
          placeholder="CRDXXXXXXXXX"
          className="mt-1 w-full max-w-xs rounded border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <Button size="sm" onClick={handleRegister} disabled={!canRegister || registering} className="gap-1.5">
        <Lock className="h-3.5 w-3.5" />
        {pt ? "Registrar protocolo" : "Register protocol"}
      </Button>
      {!canRegister && (
        <p className="text-xs text-muted-foreground">
          {pt ? "Defina a pergunta e ao menos um critério de triagem para registrar." : "Set the question and at least one screening criterion to register."}
        </p>
      )}
    </div>
  );
};

export default ProtocolPanel;
