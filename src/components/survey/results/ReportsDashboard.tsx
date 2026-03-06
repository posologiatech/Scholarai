import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, FileDown, Users, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface QuestionData {
  id: string;
  question_text: string;
  question_type: string;
  choices: any[];
  matrix_rows: any[];
  matrix_columns: any[];
  settings: any;
}

const COLORS = [
  "hsl(234, 89%, 60%)", "hsl(262, 83%, 58%)", "hsl(152, 69%, 41%)",
  "hsl(30, 90%, 55%)", "hsl(350, 80%, 55%)", "hsl(190, 80%, 45%)",
  "hsl(45, 90%, 50%)", "hsl(280, 60%, 50%)",
];

const calcMean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const calcSD = (values: number[], mean: number) => {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
};

const ReportsDashboard = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const navigate = useNavigate();

  const { data: questions } = useQuery({
    queryKey: ["survey-questions-report", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("question_order");
      return (data || []) as QuestionData[];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["survey-responses-report", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", surveyId);
      return data || [];
    },
  });

  const { data: answers } = useQuery({
    queryKey: ["survey-answers-report", surveyId],
    queryFn: async () => {
      const responseIds = responses?.map((r) => r.id) || [];
      if (!responseIds.length) return [];
      const { data } = await supabase
        .from("survey_answers")
        .select("*")
        .in("response_id", responseIds);
      return data || [];
    },
    enabled: !!responses?.length,
  });

  const totalResponses = responses?.length || 0;
  const completedResponses = responses?.filter((r) => r.status === "complete").length || 0;
  const avgDuration = useMemo(() => {
    const durations = responses?.filter((r) => r.duration_seconds).map((r) => r.duration_seconds!) || [];
    return durations.length ? Math.round(calcMean(durations)) : 0;
  }, [responses]);

  const handleExportDataMind = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Login required"); return; }

      // Build CSV from answers
      if (!questions?.length || !responses?.length) {
        toast.error(locale === "pt" ? "Sem dados para exportar" : "No data to export");
        return;
      }

      const headers = ["respondent_id", ...questions.map((q) => `Q_${q.question_text.slice(0, 40).replace(/[,\n]/g, " ")}`)];
      const rows = responses.map((r) => {
        const responseAnswers = answers?.filter((a) => a.response_id === r.id) || [];
        const vals = questions!.map((q) => {
          const ans = responseAnswers.find((a) => a.question_id === q.id);
          if (!ans) return "";
          if (ans.answer_text) return `"${ans.answer_text.replace(/"/g, '""')}"`;
          if (ans.answer_numeric !== null) return String(ans.answer_numeric);
          if (Array.isArray(ans.answer_choices) && (ans.answer_choices as any[]).length)
            return `"${(ans.answer_choices as string[]).join("; ")}"`;
          return "";
        });
        return [r.respondent_id || r.id, ...vals].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });

      // Upload to datamind-files bucket
      const fileName = `survey_${surveyId}_${Date.now()}.csv`;
      const filePath = `${user.id}/${fileName}`;
      const { error: uploadErr } = await supabase.storage.from("datamind-files").upload(filePath, blob);
      if (uploadErr) throw uploadErr;

      // Create conversation
      const { data: conv, error: convErr } = await supabase
        .from("datamind_conversations")
        .insert({ user_id: user.id, title: `Survey Analysis - ${fileName}` })
        .select("id")
        .single();
      if (convErr) throw convErr;

      // Create file record
      await supabase.from("datamind_files").insert({
        user_id: user.id,
        conversation_id: conv.id,
        file_name: fileName,
        file_path: filePath,
        file_size: blob.size,
      });

      // Create initial message
      await supabase.from("datamind_messages").insert({
        conversation_id: conv.id,
        role: "system",
        content: `Survey data file loaded: ${fileName} (${totalResponses} responses, ${questions.length} questions). Ready for analysis.`,
      });

      toast.success(locale === "pt" ? "Dados enviados para DataMind!" : "Data sent to DataMind!");
      navigate(`/datamind/${conv.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Export failed");
    }
  };

  const renderQuestionChart = (q: QuestionData) => {
    const qAnswers = answers?.filter((a) => a.question_id === q.id) || [];
    if (!qAnswers.length) return null;

    if (q.question_type === "multiple_choice") {
      const counts: Record<string, number> = {};
      (q.choices || []).forEach((c: any) => (counts[c.text] = 0));
      qAnswers.forEach((a) => {
        if (a.answer_text && counts[a.answer_text] !== undefined) counts[a.answer_text]++;
        (a.answer_choices as any[] || []).forEach((c: string) => {
          if (counts[c] !== undefined) counts[c]++;
        });
      });
      const chartData = Object.entries(counts).map(([name, value]) => ({
        name: name.length > 25 ? name.slice(0, 25) + "…" : name,
        value,
        pct: qAnswers.length ? Math.round((value / qAnswers.length) * 100) : 0,
      }));

      return (
        <div className="space-y-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v, locale === "pt" ? "Respostas" : "Responses"]} />
              <Bar dataKey="value" fill="hsl(234, 89%, 60%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-right">n = {qAnswers.length}</p>
        </div>
      );
    }

    if (q.question_type === "slider" || q.question_type === "constant_sum") {
      const values = qAnswers.map((a) => Number(a.answer_numeric)).filter((v) => !isNaN(v));
      const mean = calcMean(values);
      const sd = calcSD(values, mean);
      const buckets: Record<string, number> = {};
      values.forEach((v) => {
        const bucket = String(Math.floor(v / 10) * 10);
        buckets[bucket] = (buckets[bucket] || 0) + 1;
      });
      const chartData = Object.entries(buckets)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([name, value]) => ({ name, value }));

      return (
        <div className="space-y-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
            <span>n = {values.length}</span>
            <span>{locale === "pt" ? "Média" : "Mean"}: {mean.toFixed(2)}</span>
            <span>SD: {sd.toFixed(2)}</span>
          </div>
        </div>
      );
    }

    if (q.question_type === "matrix_table") {
      const matrixData = (q.matrix_rows || []).map((row: any) => {
        const rowData: any = { name: row.text.length > 20 ? row.text.slice(0, 20) + "…" : row.text };
        (q.matrix_columns || []).forEach((col: any) => (rowData[col.text] = 0));
        qAnswers.forEach((a) => {
          const ma = (a.matrix_answers as any[]) || [];
          ma.forEach((m: any) => {
            if (m.row_id === row.id) {
              const colObj = (q.matrix_columns || []).find((c: any) => c.id === m.column_id);
              if (colObj) rowData[colObj.text] = (rowData[colObj.text] || 0) + 1;
            }
          });
        });
        return rowData;
      });

      // Map Likert columns to numeric values for stats
      const colTexts = (q.matrix_columns || []).map((c: any) => c.text);
      const allValues: number[] = [];
      matrixData.forEach((row: any) => {
        colTexts.forEach((col: string, idx: number) => {
          for (let i = 0; i < (row[col] || 0); i++) allValues.push(idx + 1);
        });
      });
      const mean = calcMean(allValues);
      const sd = calcSD(allValues, mean);

      return (
        <div className="space-y-2">
          <ResponsiveContainer width="100%" height={Math.max(180, matrixData.length * 40)}>
            <BarChart data={matrixData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {colTexts.map((col, i) => (
                <Bar key={col} dataKey={col} stackId="a" fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
            <span>n = {qAnswers.length}</span>
            <span>{locale === "pt" ? "Média" : "Mean"}: {mean.toFixed(2)}</span>
            <span>SD: {sd.toFixed(2)}</span>
          </div>
        </div>
      );
    }

    if (q.question_type === "text_entry") {
      const texts = qAnswers.map((a) => a.answer_text).filter(Boolean);
      return (
        <div className="space-y-1 max-h-48 overflow-auto">
          {texts.slice(0, 10).map((t, i) => (
            <div key={i} className="text-sm bg-muted/50 px-3 py-1.5 rounded">{t}</div>
          ))}
          {texts.length > 10 && (
            <p className="text-xs text-muted-foreground">+{texts.length - 10} {locale === "pt" ? "mais" : "more"}</p>
          )}
          <p className="text-xs text-muted-foreground border-t pt-2">n = {texts.length}</p>
        </div>
      );
    }

    return <p className="text-sm text-muted-foreground">{qAnswers.length} {locale === "pt" ? "respostas" : "responses"}</p>;
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalResponses}</p>
              <p className="text-xs text-muted-foreground">{locale === "pt" ? "Total de Respostas" : "Total Responses"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
            <div>
              <p className="text-2xl font-bold">{completedResponses}</p>
              <p className="text-xs text-muted-foreground">{locale === "pt" ? "Completas" : "Completed"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Clock className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold">{avgDuration ? `${Math.floor(avgDuration / 60)}m${avgDuration % 60}s` : "—"}</p>
              <p className="text-xs text-muted-foreground">{locale === "pt" ? "Duração Média" : "Avg Duration"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportDataMind}>
          <BrainCircuit className="h-4 w-4" />
          {locale === "pt" ? "Analisar no DataMind" : "Analyze in DataMind"}
        </Button>
      </div>

      {/* Question charts */}
      {!questions?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {locale === "pt" ? "Nenhuma questão encontrada" : "No questions found"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {questions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium leading-tight">
                  {q.question_text || (locale === "pt" ? "Questão sem título" : "Untitled Question")}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderQuestionChart(q)}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsDashboard;
