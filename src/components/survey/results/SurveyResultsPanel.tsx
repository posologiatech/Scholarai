import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Table2, Filter, ShieldAlert, Shield, ShieldCheck } from "lucide-react";
import ReportsDashboard from "./ReportsDashboard";
import ResponseDataGrid from "./ResponseDataGrid";
import RecruitmentFunnel from "./RecruitmentFunnel";
import DataQualityAlerts from "./DataQualityAlerts";
import AuditLogPanel from "./AuditLogPanel";
import DataIntegrityPanel from "./DataIntegrityPanel";

const SUBTABS = ["recruitment", "reports", "data", "quality", "integrity", "audit"] as const;

const SurveyResultsPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { subtab } = useParams<{ subtab?: string }>();
  const navigate = useNavigate();
  const activeTab = SUBTABS.includes(subtab as any) ? (subtab as (typeof SUBTABS)[number]) : "recruitment";

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-lg font-semibold mb-6">
          {locale === "pt" ? "Resultados" : "Results"}
        </h2>

        <Tabs
          value={activeTab}
          onValueChange={(v) => navigate(`/surveys/${surveyId}/results/${v}`, { replace: true })}
          className="space-y-6"
        >
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="recruitment" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              {locale === "pt" ? "Recrutamento" : "Recruitment"}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              {locale === "pt" ? "Relatórios" : "Reports"}
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" />
              {locale === "pt" ? "Dados" : "Data"}
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              {locale === "pt" ? "Qualidade" : "Quality"}
            </TabsTrigger>
            <TabsTrigger value="integrity" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {locale === "pt" ? "Integridade" : "Integrity"}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              {locale === "pt" ? "Auditoria" : "Audit"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recruitment">
            <RecruitmentFunnel surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsDashboard surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="data">
            <ResponseDataGrid surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="quality">
            <DataQualityAlerts surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="integrity">
            <DataIntegrityPanel surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogPanel surveyId={surveyId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SurveyResultsPanel;
