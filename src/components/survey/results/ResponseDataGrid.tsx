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
import { Download, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";

const ResponseDataGrid = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
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

  const columns = useMemo(() => {
    if (!questions) return [];
    return questions.map((q: any, i: number) => ({
      id: q.id,
      varName: `Q${i + 1}_${q.question_type}`,
      questionText: q.question_text || `Question ${i + 1}`,
    }));
  }, [questions]);

  // Build choice coding map for coded export
  const choiceCodingMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    if (!questions) return map;
    questions.forEach((q: any) => {
      if (q.question_type === "multiple_choice" && Array.isArray(q.choices)) {
        const coding: Record<string, string> = {};
        (q.choices as any[]).forEach((c: any, idx: number) => {
          coding[c.text || c] = String(idx);
        });
        map[q.id] = coding;
      }
    });
    return map;
  }, [questions]);

  const formatValue = (value: string, questionId: string) => {
    if (!useCodedValues || !value) return value;
    const coding = choiceCodingMap[questionId];
    if (!coding) return value;
    // Handle multi-value separated by "; "
    const parts = value.split("; ");
    return parts.map(p => coding[p] !== undefined ? coding[p] : p).join("; ");
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

  const exportCSV = (delimiter = ",", ext = "csv") => {
    const { headers, data } = buildExportData();
    const escape = (v: string) => v.includes(delimiter) || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    const csvContent = [headers.map(escape).join(delimiter), ...data.map((row) => row.map(escape).join(delimiter))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `survey_data.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    const { headers, data } = buildExportData();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    XLSX.writeFile(wb, "survey_data.xlsx");
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
            <DropdownMenuItem onClick={exportXLSX}>Excel (.xlsx)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                    <TableCell key={col.id} className="text-xs max-w-[250px] truncate">{row[col.id] || "—"}</TableCell>
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
