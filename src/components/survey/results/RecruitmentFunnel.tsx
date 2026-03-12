import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileSignature, ClipboardList, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from "recharts";

const FUNNEL_COLORS = [
  "hsl(234, 89%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(30, 90%, 55%)",
  "hsl(152, 69%, 41%)",
];

const RecruitmentFunnel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();

  const { data: contacts } = useQuery({
    queryKey: ["recruitment-contacts", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_contacts").select("id").eq("survey_id", surveyId);
      return data || [];
    },
  });

  const { data: signatures } = useQuery({
    queryKey: ["recruitment-signatures", surveyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("consent_signatures")
        .select("id, consent_id")
        .in("consent_id", 
          (await supabase.from("study_consents").select("id").eq("survey_id", surveyId)).data?.map(c => c.id) || []
        );
      return data || [];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["recruitment-responses", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_responses").select("id, status").eq("survey_id", surveyId);
      return data || [];
    },
  });

  const totalInvited = contacts?.length || 0;
  const totalConsented = signatures?.length || 0;
  const totalInProgress = responses?.filter(r => r.status === "in_progress").length || 0;
  const totalComplete = responses?.filter(r => r.status === "complete").length || 0;

  const funnelData = [
    { name: locale === "pt" ? "Convidados" : "Invited", value: totalInvited || 1, fill: FUNNEL_COLORS[0] },
    { name: locale === "pt" ? "TCLEs Assinados" : "Consented", value: totalConsented || 0, fill: FUNNEL_COLORS[1] },
    { name: locale === "pt" ? "Em Coleta" : "In Progress", value: totalInProgress || 0, fill: FUNNEL_COLORS[2] },
    { name: locale === "pt" ? "Finalizados" : "Completed", value: totalComplete || 0, fill: FUNNEL_COLORS[3] },
  ];

  const stats = [
    { icon: Users, label: locale === "pt" ? "Convidados" : "Invited", value: totalInvited, color: "text-primary" },
    { icon: FileSignature, label: locale === "pt" ? "TCLEs" : "Consented", value: totalConsented, color: "text-[hsl(262,83%,58%)]" },
    { icon: ClipboardList, label: locale === "pt" ? "Em Coleta" : "In Progress", value: totalInProgress, color: "text-[hsl(30,90%,55%)]" },
    { icon: CheckCircle2, label: locale === "pt" ? "Completos" : "Completed", value: totalComplete, color: "text-[hsl(152,69%,41%)]" },
  ];

  const conversionRate = totalInvited > 0 ? Math.round((totalComplete / totalInvited) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <s.icon className={`h-7 w-7 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>{locale === "pt" ? "Funil de Recrutamento" : "Recruitment Funnel"}</span>
            <span className="text-muted-foreground font-normal">
              {locale === "pt" ? "Conversão:" : "Conversion:"} {conversionRate}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [v, locale === "pt" ? "Participantes" : "Participants"]} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {funnelData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecruitmentFunnel;
