import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Table2, Filter, ShieldAlert } from "lucide-react";
import ReportsDashboard from "./ReportsDashboard";
import ResponseDataGrid from "./ResponseDataGrid";
import RecruitmentFunnel from "./RecruitmentFunnel";
import DataQualityAlerts from "./DataQualityAlerts";

const SurveyResultsPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-lg font-semibold mb-6">
          {locale === "pt" ? "Dados & Análise" : "Data & Analysis"}
        </h2>

        <Tabs defaultValue="recruitment" className="space-y-6">
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
        </Tabs>
      </div>
    </div>
  );
};

export default SurveyResultsPanel;
