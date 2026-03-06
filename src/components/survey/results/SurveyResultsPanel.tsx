import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Table2, Download, BrainCircuit } from "lucide-react";
import ReportsDashboard from "./ReportsDashboard";
import ResponseDataGrid from "./ResponseDataGrid";

const SurveyResultsPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-lg font-semibold mb-6">
          {locale === "pt" ? "Dados & Análise" : "Data & Analysis"}
        </h2>

        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reports" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              {locale === "pt" ? "Relatórios" : "Reports"}
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" />
              {locale === "pt" ? "Dados" : "Data"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <ReportsDashboard surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="data">
            <ResponseDataGrid surveyId={surveyId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SurveyResultsPanel;
