import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Download, ChevronDown, BrainCircuit, Paperclip } from "lucide-react";
import * as XLSX from "xlsx";
import { buildExportColumns, buildChoiceCodingMap, formatCodedValue, buildCodebookRows } from "@/lib/survey/codebook";
import { useSurveyDataMindExport } from "@/hooks/useSurveyDataMindExport";

const ResponseDataGrid = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { exportToDataMind, isExporting } = useSurveyDataMindExport(surveyId);
  const [useVariableNames, setUseVariableNames] = useState(false);
  const [useCodedValues, setUseCodedValues] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data: questions } = useQuery({
    queryKey: ["survey-q-grid", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_questions").select("*").eq("survey_id", surveyId).order("question_order");
      return data || [];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["survey-r-grid", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_responses").select("*").eq("survey_id", surveyId).order("started_at", { ascending: false });
      return data || [];
    },
  });

  const { data: answers } = useQuery({
    queryKey: ["survey-a-grid", surveyId, responses?.map((r) => r.id).join(",")],
    queryFn: async () => {
      const ids = responses?.map((r) => r.id) || [];
      if (!ids.length) return [];
      const { data } = await supabase.from("survey_answers").select("*").in("response_id", ids);
      return data || [];
    },
    enabled: !!responses?.length,
  });

  const columns = useMemo(() => buildExportColumns(questions || []), [questions]);

  // file_upload/signature answers are stored as a survey-uploads storage path, not text —
  // render those cells as a "download" action instead of the raw path string.
  const fileColumnIds = useMemo(
    () => new Set((questions || []).filter((q) => q.question_type === "file_upload" || q.question_type === "signature").map((q) => q.id)),
    [questions]
  );

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("survey-uploads").createSignedUrl(path, 3600);
    if (error || !data) {
      toast.error(locale === "pt" ? "Não foi possível gerar o link do arquivo" : "Could not generate the file link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  // Build choice coding map for coded export
  const choiceCodingMap = useMemo(() => buildChoiceCodingMap(questions || []), [questions]);

  const formatValue = (value: string, questionId: string) => {
    if (!useCodedValues || !value) return value;
    return formatCodedValue(value, questionId, choiceCodingMap);
  };

  const rows = useMemo(() => {
    if (!responses || !answers) return [];
    return responses.map((r) => {
      const rAnswers = answers.filter((a) => a.response_id === r.id);
      const row: Record<string, string> = {
        respondent_id: r.respondent_id || r.id.slice(0, 8),
        status: r.status,
        started_at: new Date(r.started_at).toLocaleString(),
        duration: r.duration_seconds ? `${r.duration_seconds}s` : "—",
      };
      columns.forEach((col) => {
        const ans = rAnswers.find((a) => a.question_id === col.id);
        if (!ans) { row[col.id] = ""; return; }
        let val = "";
        if (ans.answer_text) val = ans.answer_text;
        else if (ans.answer_numeric !== null) val = String(ans.answer_numeric);
        else if (Array.isArray(ans.answer_choices) && (ans.answer_choices as any[]).length)
          val = (ans.answer_choices as string[]).join("; ");
        else if (Array.isArray(ans.matrix_answers) && (ans.matrix_answers as any[]).length)
          val = (ans.matrix_answers as any[]).map((m: any) => `${m.row_id}:${m.column_id}`).join("; ");
        row[col.id] = formatValue(val, col.id);
      });
      return row;
    });
  }, [responses, answers, columns, useCodedValues, choiceCodingMap]);

  const pagedRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  const buildExportData = () => {
    const headers = ["Respondent ID", "Status", "Started At", "Duration", ...columns.map((c) => useVariableNames ? c.varName : c.questionText)];
    const data = rows.map((r) => [
      r.respondent_id, r.status, r.started_at, r.duration,
      ...columns.map((c) => r[c.id] || ""),
    ]);
    return { headers, data };
  };

  const downloadText = (filename: string, content: string, mime: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const toCSV = (headers: string[], data: string[][], delimiter = ",") => {
    const escape = (v: string) => v.includes(delimiter) || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    return [headers.map(escape).join(delimiter), ...data.map((row) => row.map(escape).join(delimiter))].join("\n");
  };

  const exportCSV = (delimiter = ",", ext = "csv") => {
    const { headers, data } = buildExportData();
    downloadText(`survey_data.${ext}`, toCSV(headers, data, delimiter), "text/csv");
  };

  const exportXLSX = () => {
    const { headers, data } = buildExportData();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    const codebookWs = XLSX.utils.aoa_to_sheet(buildCodebookRows(columns, questions || [], choiceCodingMap));
    XLSX.utils.book_append_sheet(wb, codebookWs, "Codebook");
    XLSX.writeFile(wb, "survey_data.xlsx");
  };

  // SPSS export: a coded CSV (variable names + numeric codes) paired with a
  // .sps syntax file that reads it and attaches variable/value labels \u2014
  // the standard REDCap-style approach since writing a binary .sav has no
  // supported JS library.
  const exportSPSS = () => {
    const headers = ["respondent_id", "status", "started_at", "duration", ...columns.map((c) => c.varName)];
    const data = rows.map((r) => [
      r.respondent_id, r.status, r.started_at, r.duration,
      ...columns.map((c) => {
        const coding = choiceCodingMap[c.id];
        const val = r[c.id] || "";
        if (!coding || !val) return val;
        return val.split("; ").map((p) => (coding[p] !== undefined ? coding[p] : p)).join("; ");
      }),
    ]);
    downloadText("survey_data_spss.csv", toCSV(headers, data), "text/csv");

    const varSpecs = headers
      .map((h, i) => {
        if (i < 4) return `    ${h} A30`;
        const col = columns[i - 4];
        const q = (questions || []).find((qq: any) => qq.id === col.id);
        const isNumeric = !!choiceCodingMap[col.id] || ["slider", "constant_sum"].includes(q?.question_type);
        return `    ${h} ${isNumeric ? "F8.2" : "A200"}`;
      })
      .join("\n");

    const varLabels = columns
      .map((c) => `  ${c.varName} "${c.questionText.replace(/"/g, "'").slice(0, 120)}"`)
      .join("\n");

    const valueLabelBlocks = columns
      .filter((c) => choiceCodingMap[c.id])
      .map((c) => {
        const entries = Object.entries(choiceCodingMap[c.id])
          .map(([label, code]) => `    ${code} "${label.replace(/"/g, "'")}"`)
          .join("\n");
        return `  /${c.varName}\n${entries}`;
      })
      .join("\n");

    const sps = `* Encoding: UTF-8.
* Generated by Scholar AI \u2014 pairs with survey_data_spss.csv.
GET DATA
  /TYPE=TXT
  /FILE='survey_data_spss.csv'
  /ENCODING='UTF8'
  /DELCASE=LINE
  /DELIMITERS=","
  /QUALIFIER='"'
  /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2
  /VARIABLES=
${varSpecs}.
CACHE.
EXECUTE.
DATASET NAME survey_data.

VARIABLE LABELS
${varLabels}.
${valueLabelBlocks ? `\nVALUE LABELS\n${valueLabelBlocks}.\n` : ""}`;

    downloadText("survey_data.sps", sps, "text/plain");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm">{locale === "pt" ? "Nomes de variáveis" : "Variable names"}</Label>
            <Switch checked={useVariableNames} onCheckedChange={setUseVariableNames} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">{locale === "pt" ? "Codificação numérica" : "Coded values"}</Label>
            <Switch checked={useCodedValues} onCheckedChange={setUseCodedValues} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportToDataMind} disabled={isExporting}>
            <BrainCircuit className="h-4 w-4" />
            {locale === "pt" ? "Analisar no DataMind" : "Analyze in DataMind"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                {locale === "pt" ? "Exportar" : "Export"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportCSV(",", "csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCSV("\t", "tsv")}>TSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportXLSX}>Excel (.xlsx) + codebook</DropdownMenuItem>
              <DropdownMenuItem onClick={exportSPSS}>
                {locale === "pt" ? "Sintaxe SPSS (.sps + .csv)" : "SPSS syntax (.sps + .csv)"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[60vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-muted/80 z-10 min-w-[100px]">ID</TableHead>
              <TableHead className="min-w-[80px]">Status</TableHead>
              <TableHead className="min-w-[140px]">{locale === "pt" ? "Início" : "Started"}</TableHead>
              <TableHead className="min-w-[80px]">{locale === "pt" ? "Duração" : "Duration"}</TableHead>
              {columns.map((col) => (
                <TableHead key={col.id} className="min-w-[150px] max-w-[250px]">
                  <span className="line-clamp-2 text-xs">{useVariableNames ? col.varName : col.questionText}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4 + columns.length} className="text-center py-8 text-muted-foreground">
                  {locale === "pt" ? "Nenhuma resposta ainda" : "No responses yet"}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs">{row.respondent_id}</TableCell>
                  <TableCell className="text-xs">{row.status}</TableCell>
                  <TableCell className="text-xs">{row.started_at}</TableCell>
                  <TableCell className="text-xs">{row.duration}</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.id} className="text-xs max-w-[250px] truncate">
                      {fileColumnIds.has(col.id) && row[col.id] ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 gap-1 text-xs"
                          onClick={() => downloadFile(row[col.id])}
                        >
                          <Paperclip className="h-3 w-3" />
                          {locale === "pt" ? "Baixar" : "Download"}
                        </Button>
                      ) : (
                        row[col.id] || "—"
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{locale === "pt" ? `Página ${page + 1} de ${totalPages}` : `Page ${page + 1} of ${totalPages}`}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              {locale === "pt" ? "Anterior" : "Previous"}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              {locale === "pt" ? "Próxima" : "Next"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponseDataGrid;
