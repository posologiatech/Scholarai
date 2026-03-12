import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Calendar, Save } from "lucide-react";

interface Visit {
  id: string;
  survey_id: string;
  user_id: string;
  label: string;
  visit_order: number;
  target_days: number | null;
  created_at: string;
}

interface VisitManagerProps {
  surveyId: string;
}

const genId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const VisitManager = ({ surveyId }: VisitManagerProps) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const queryClient = useQueryClient();

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["study-visits", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_visits")
        .select("*")
        .eq("survey_id", surveyId)
        .order("visit_order");
      if (error) throw error;
      return data as Visit[];
    },
    enabled: !!surveyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (visitsList: Visit[]) => {
      // Delete removed visits
      const existingIds = visits.map((v) => v.id);
      const newIds = visitsList.map((v) => v.id);
      const toDelete = existingIds.filter((id) => !newIds.includes(id));
      
      if (toDelete.length) {
        await supabase.from("study_visits").delete().in("id", toDelete);
      }

      // Upsert all visits
      for (const visit of visitsList) {
        await supabase.from("study_visits").upsert(visit, { onConflict: "id" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-visits", surveyId] });
      toast.success(locale === "pt" ? "Visitas salvas!" : "Visits saved!");
    },
    onError: () => toast.error(locale === "pt" ? "Erro ao salvar" : "Save failed"),
  });

  const [localVisits, setLocalVisits] = useState<Visit[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && visits.length > 0) {
    setLocalVisits(visits);
    setInitialized(true);
  }
  if (!initialized && !isLoading && visits.length === 0) {
    setInitialized(true);
  }

  const addVisit = useCallback(() => {
    setLocalVisits((prev) => [
      ...prev,
      {
        id: genId(),
        survey_id: surveyId,
        user_id: user!.id,
        label: prev.length === 0 ? "Baseline (T0)" : `Visita ${prev.length} (T${prev.length})`,
        visit_order: prev.length,
        target_days: prev.length === 0 ? 0 : prev.length * 30,
        created_at: new Date().toISOString(),
      },
    ]);
  }, [surveyId, user]);

  const removeVisit = useCallback((id: string) => {
    setLocalVisits((prev) =>
      prev.filter((v) => v.id !== id).map((v, i) => ({ ...v, visit_order: i }))
    );
  }, []);

  const updateVisit = useCallback((id: string, updates: Partial<Visit>) => {
    setLocalVisits((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {locale === "pt" ? "Visitas / Timepoints" : "Visits / Timepoints"}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addVisit}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {locale === "pt" ? "Adicionar Visita" : "Add Visit"}
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate(localVisits)} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {locale === "pt" ? "Salvar" : "Save"}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Defina os timepoints do estudo para coletas longitudinais. Cada visita representa um momento de coleta (ex: Baseline, 30 dias, 90 dias)."
            : "Define study timepoints for longitudinal data collection. Each visit represents a collection moment."}
        </p>

        {localVisits.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {locale === "pt"
                ? "Nenhuma visita configurada. Para estudos transversais, não é necessário."
                : "No visits configured. Not required for cross-sectional studies."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={addVisit}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {locale === "pt" ? "Adicionar Primeira Visita" : "Add First Visit"}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {localVisits.map((visit, idx) => (
              <Card key={visit.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                      T{idx}
                    </span>
                    <Input
                      value={visit.label}
                      onChange={(e) => updateVisit(visit.id, { label: e.target.value })}
                      className="flex-1 font-medium"
                      placeholder={locale === "pt" ? "Nome da visita" : "Visit name"}
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        {locale === "pt" ? "Dias após T0:" : "Days after T0:"}
                      </Label>
                      <Input
                        type="number"
                        value={visit.target_days ?? ""}
                        onChange={(e) => updateVisit(visit.id, { target_days: e.target.value ? Number(e.target.value) : null })}
                        className="w-20 h-8 text-xs"
                        placeholder="0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeVisit(visit.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitManager;
