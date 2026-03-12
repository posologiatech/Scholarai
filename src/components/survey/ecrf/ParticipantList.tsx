import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Users, UserCircle, FileText } from "lucide-react";
import ParticipantDetail from "./ParticipantDetail";

interface Participant {
  id: string;
  survey_id: string;
  user_id: string;
  participant_code: string;
  consent_signature_id: string | null;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface ParticipantListProps {
  surveyId: string;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  withdrawn: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  screening: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const ParticipantList = ({ surveyId }: ParticipantListProps) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["study-participants", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_participants")
        .select("*")
        .eq("survey_id", surveyId)
        .order("created_at");
      if (error) throw error;
      return data as Participant[];
    },
    enabled: !!surveyId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("study_participants").insert({
        survey_id: surveyId,
        user_id: user!.id,
        participant_code: newCode || `P${String(participants.length + 1).padStart(3, "0")}`,
        metadata: newNotes ? { notes: newNotes } : {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-participants", surveyId] });
      setShowAdd(false);
      setNewCode("");
      setNewNotes("");
      toast.success(locale === "pt" ? "Participante adicionado!" : "Participant added!");
    },
    onError: () => toast.error(locale === "pt" ? "Erro ao adicionar" : "Failed to add"),
  });

  const filtered = participants.filter((p) =>
    p.participant_code.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedId) {
    const participant = participants.find((p) => p.id === selectedId);
    if (participant) {
      return (
        <ParticipantDetail
          participant={participant}
          surveyId={surveyId}
          onBack={() => setSelectedId(null)}
        />
      );
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {locale === "pt" ? "Participantes" : "Participants"}
            </h2>
            <Badge variant="secondary" className="ml-2">{participants.length}</Badge>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                {locale === "pt" ? "Adicionar" : "Add"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {locale === "pt" ? "Novo Participante" : "New Participant"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{locale === "pt" ? "Código do Participante" : "Participant Code"}</Label>
                  <Input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder={`P${String(participants.length + 1).padStart(3, "0")}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {locale === "pt"
                      ? "Código anônimo para identificação. Gerado automaticamente se vazio."
                      : "Anonymous identification code. Auto-generated if empty."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{locale === "pt" ? "Notas (opcional)" : "Notes (optional)"}</Label>
                  <Textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  {locale === "pt" ? "Cadastrar Participante" : "Register Participant"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={locale === "pt" ? "Buscar por código..." : "Search by code..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <UserCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {locale === "pt"
                ? "Nenhum participante cadastrado ainda"
                : "No participants registered yet"}
            </p>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {locale === "pt" ? "Código" : "Code"}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">TCLE</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {locale === "pt" ? "Cadastro" : "Registered"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium">{p.participant_code}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={statusColors[p.status] || ""}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.consent_signature_id ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <FileText className="h-3 w-3 mr-1" />
                          {locale === "pt" ? "Assinado" : "Signed"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {locale === "pt" ? "Pendente" : "Pending"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantList;
