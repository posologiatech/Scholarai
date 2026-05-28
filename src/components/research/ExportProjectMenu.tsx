import { useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Download, FileArchive, FileText, ChevronDown, Loader2, GraduationCap } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const toCSV = (rows: any[]) => {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return keys.join(";") + "\n" + rows.map(r => keys.map(k => esc(r[k])).join(";")).join("\n");
};

const lattesXML = (project: any, pubs: any[], advisees: any[]) => {
  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<CURRICULO-VITAE SISTEMA-ORIGEM-XML="ARCA-Research">
  <PROJETOS-DE-PESQUISA>
    <PROJETO-DE-PESQUISA NOME-DO-PROJETO="${esc(project.title)}"
      ANO-INICIO="${project.start_date ? new Date(project.start_date).getFullYear() : ""}"
      ANO-FIM="${project.end_date ? new Date(project.end_date).getFullYear() : ""}"
      SITUACAO="${esc(project.status)}">
      <DESCRICAO-DO-PROJETO-DE-PESQUISA>${esc(project.description ?? project.objectives ?? "")}</DESCRICAO-DO-PROJETO-DE-PESQUISA>
      <PALAVRAS-CHAVE>${(project.keywords ?? []).map((k: string, i: number) => `<PALAVRA-CHAVE-${i+1}>${esc(k)}</PALAVRA-CHAVE-${i+1}>`).join("")}</PALAVRAS-CHAVE>
    </PROJETO-DE-PESQUISA>
  </PROJETOS-DE-PESQUISA>
  <PRODUCAO-BIBLIOGRAFICA>
    ${pubs.map(p => `<TRABALHO TITULO="${esc(p.title)}" ANO="${p.year ?? ""}" VEICULO="${esc(p.venue ?? "")}" DOI="${esc(p.doi ?? "")}" STATUS="${esc(p.status)}"/>`).join("\n    ")}
  </PRODUCAO-BIBLIOGRAFICA>
  <ORIENTACOES>
    ${advisees.map(a => `<ORIENTACAO NOME="${esc(a.full_name)}" NIVEL="${esc(a.level)}" TITULO="${esc(a.thesis_title ?? "")}" INICIO="${esc(a.start_date ?? "")}" FIM="${esc(a.end_date ?? "")}"/>`).join("\n    ")}
  </ORIENTACOES>
</CURRICULO-VITAE>`;
};

const sucupiraCSV = (project: any, pubs: any[], advisees: any[]) => {
  const rows = [
    ...pubs.map(p => ({
      tipo: "PRODUCAO_BIBLIOGRAFICA",
      categoria: p.status,
      ano: p.year ?? "",
      titulo: p.title,
      veiculo: p.venue ?? "",
      doi: p.doi ?? "",
      projeto: project.title,
    })),
    ...advisees.map(a => ({
      tipo: "ORIENTACAO",
      categoria: a.level,
      ano: a.start_date ? new Date(a.start_date).getFullYear() : "",
      titulo: a.thesis_title ?? "",
      veiculo: a.institution ?? "",
      doi: "",
      projeto: project.title,
    })),
  ];
  return "\uFEFF" + toCSV(rows);
};

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

export const ExportProjectMenu = ({ project }: { project: any }) => {
  const { locale } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAll = async () => {
    const id = project.id;
    const [tasks, meetings, refs, members, schedule, pubs, advisees, budget, expenses, docs, outputs, logbook, comments, versions] = await Promise.all([
      supabase.from("research_tasks").select("*").eq("project_id", id),
      supabase.from("research_meetings").select("*").eq("project_id", id),
      supabase.from("research_project_references").select("*").eq("project_id", id),
      supabase.from("research_project_members").select("*").eq("project_id", id),
      supabase.from("research_schedule_items").select("*").eq("project_id", id),
      supabase.from("research_publications").select("*").eq("project_id", id),
      supabase.from("research_advisees").select("*").eq("project_id", id),
      supabase.from("research_budget_items").select("*").eq("project_id", id),
      supabase.from("research_expenses").select("*").eq("project_id", id),
      supabase.from("research_documents").select("*").eq("project_id", id),
      supabase.from("research_outputs").select("*").eq("project_id", id),
      supabase.from("research_logbook_entries").select("*").eq("project_id", id),
      supabase.from("research_comments").select("*").eq("project_id", id),
      supabase.from("research_overview_versions").select("id,created_at,summary,content").eq("project_id", id).order("created_at"),
    ]);
    return {
      project,
      tasks: tasks.data ?? [], meetings: meetings.data ?? [], refs: refs.data ?? [],
      members: members.data ?? [], schedule: schedule.data ?? [], pubs: pubs.data ?? [],
      advisees: advisees.data ?? [], budget: budget.data ?? [], expenses: expenses.data ?? [],
      docs: docs.data ?? [], outputs: outputs.data ?? [], logbook: logbook.data ?? [],
      comments: comments.data ?? [], versions: versions.data ?? [],
    };
  };

  const exportZip = async () => {
    setBusy("zip");
    try {
      const d = await fetchAll();
      const zip = new JSZip();
      zip.file("project.json", JSON.stringify(d.project, null, 2));
      zip.file("overview.md", d.project.full_content ?? "");
      zip.file("README.md", `# ${d.project.title}\n\n${d.project.description ?? ""}\n\nExportado em ${new Date().toISOString()}\n\nConteúdo:\n- overview.md — corpo do projeto\n- data/*.csv — tabelas de dados\n- versions/ — histórico do overview\n- lattes.xml, sucupira.csv — formatos oficiais`);

      const data = zip.folder("data")!;
      const csvSets: [string, any[]][] = [
        ["tasks", d.tasks], ["meetings", d.meetings], ["references", d.refs],
        ["members", d.members], ["schedule", d.schedule], ["publications", d.pubs],
        ["advisees", d.advisees], ["budget", d.budget], ["expenses", d.expenses],
        ["documents", d.docs], ["outputs", d.outputs], ["logbook", d.logbook],
        ["comments", d.comments],
      ];
      for (const [name, rows] of csvSets) {
        data.file(`${name}.csv`, "\uFEFF" + toCSV(rows));
        data.file(`${name}.json`, JSON.stringify(rows, null, 2));
      }

      const versions = zip.folder("versions")!;
      d.versions.forEach((v: any, i: number) => {
        versions.file(`${String(i+1).padStart(3, "0")}_${v.created_at.slice(0,10)}.md`, `<!-- ${v.summary ?? ""} -->\n\n${v.content ?? ""}`);
      });

      zip.file("lattes.xml", lattesXML(d.project, d.pubs, d.advisees));
      zip.file("sucupira.csv", sucupiraCSV(d.project, d.pubs, d.advisees));

      const blob = await zip.generateAsync({ type: "blob" });
      const safe = (d.project.title || "projeto").replace(/[^\w\-]+/g, "_").slice(0, 60);
      download(blob, `${safe}_${new Date().toISOString().slice(0,10)}.zip`);
      toast.success(locale === "pt" ? "ZIP exportado" : "ZIP exported");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(null); }
  };

  const exportLattes = async () => {
    setBusy("lattes");
    try {
      const [pubs, advisees] = await Promise.all([
        supabase.from("research_publications").select("*").eq("project_id", project.id),
        supabase.from("research_advisees").select("*").eq("project_id", project.id),
      ]);
      const xml = lattesXML(project, pubs.data ?? [], advisees.data ?? []);
      download(new Blob([xml], { type: "application/xml" }), `lattes_${project.id.slice(0,8)}.xml`);
      toast.success("Lattes XML exportado");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const exportSucupira = async () => {
    setBusy("sucupira");
    try {
      const [pubs, advisees] = await Promise.all([
        supabase.from("research_publications").select("*").eq("project_id", project.id),
        supabase.from("research_advisees").select("*").eq("project_id", project.id),
      ]);
      const csv = sucupiraCSV(project, pubs.data ?? [], advisees.data ?? []);
      download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `sucupira_${project.id.slice(0,8)}.csv`);
      toast.success("Sucupira CSV exportado");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {locale === "pt" ? "Exportar" : "Export"}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">{locale === "pt" ? "Formatos disponíveis" : "Available formats"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportZip} className="gap-2">
          <FileArchive className="h-4 w-4" /> {locale === "pt" ? "ZIP completo do projeto" : "Full project ZIP"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportLattes} className="gap-2">
          <GraduationCap className="h-4 w-4" /> Lattes (XML)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportSucupira} className="gap-2">
          <FileText className="h-4 w-4" /> Sucupira (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportProjectMenu;
