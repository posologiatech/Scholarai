import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Users, Plus, Trash2, Crown, GraduationCap, UserCheck, BookOpen, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  survey_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user_email?: string;
}

const roleConfig: Record<string, { label: string; labelEn: string; icon: React.ElementType; color: string }> = {
  coordinator: { label: "Coordenador(a)", labelEn: "Coordinator", icon: Crown, color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  collaborator: { label: "Pesquisador(a) Colaborador(a)", labelEn: "Collaborator", icon: UserCheck, color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  grad_student: { label: "Estudante de Graduação", labelEn: "Undergraduate Student", icon: BookOpen, color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  postgrad_student: { label: "Estudante de Pós-Graduação", labelEn: "Graduate Student", icon: GraduationCap, color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
};

interface Props {
  surveyId: string;
}

const TeamManager = ({ surveyId }: Props) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const queryClient = useQueryClient();
  const pt = locale === "pt";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("collaborator");
  const [foundUsers, setFoundUsers] = useState<{ id: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Fetch team members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["survey-team", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_team_members" as any)
        .select("*")
        .eq("survey_id", surveyId)
        .order("created_at");
      if (error) throw error;
      
      // Get user emails from user_approvals table
      const userIds = (data as any[])?.map((m: any) => m.user_id) || [];
      if (userIds.length === 0) return [];
      
      const { data: approvals } = await supabase
        .from("user_approvals")
        .select("user_id, email")
        .in("user_id", userIds);
      
      const emailMap: Record<string, string> = {};
      (approvals || []).forEach((a: any) => { emailMap[a.user_id] = a.email; });
      
      return (data as any[]).map((m: any) => ({
        ...m,
        user_email: emailMap[m.user_id] || "—",
      })) as TeamMember[];
    },
  });

  // Search users by email
  const handleSearch = async () => {
    if (!searchEmail.trim() || searchEmail.trim().length < 3) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from("user_approvals")
        .select("user_id, email")
        .ilike("email", `%${searchEmail.trim()}%`)
        .limit(10);
      
      const existingIds = new Set(members.map(m => m.user_id));
      const filtered = (data || [])
        .filter((u: any) => u.user_id !== user?.id && !existingIds.has(u.user_id))
        .map((u: any) => ({ id: u.user_id, email: u.email }));
      
      setFoundUsers(filtered);
    } catch {
      toast.error(pt ? "Erro ao buscar usuários" : "Error searching users");
    } finally {
      setSearching(false);
    }
  };

  // Add member
  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("survey_team_members" as any).insert({
        survey_id: surveyId,
        user_id: userId,
        role: selectedRole,
        added_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-team", surveyId] });
      toast.success(pt ? "Membro adicionado à equipe" : "Member added to team");
      setDialogOpen(false);
      setSearchEmail("");
      setFoundUsers([]);
    },
    onError: () => {
      toast.error(pt ? "Erro ao adicionar membro" : "Error adding member");
    },
  });

  // Remove member
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("survey_team_members" as any).delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-team", surveyId] });
      toast.success(pt ? "Membro removido" : "Member removed");
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {pt ? "Equipe de Pesquisa" : "Research Team"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pt
              ? "Adicione membros da equipe para colaborar na coleta de dados. Apenas usuários cadastrados podem ser adicionados."
              : "Add team members to collaborate on data collection. Only registered users can be added."}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {pt ? "Adicionar" : "Add"}
        </Button>
      </div>

      {/* Owner card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-primary/10 text-primary">
            <Crown className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {pt ? "Proprietário(a) da pesquisa" : "Survey owner"}
            </p>
          </div>
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            {pt ? "Proprietário" : "Owner"}
          </Badge>
        </CardContent>
      </Card>

      {/* Team members */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          {pt ? "Carregando..." : "Loading..."}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground mb-1">
              {pt ? "Nenhum membro na equipe" : "No team members yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pt
                ? "Adicione pesquisadores e estudantes para colaborar na coleta de dados."
                : "Add researchers and students to collaborate on data collection."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const rc = roleConfig[m.role] || roleConfig.collaborator;
            const RoleIcon = rc.icon;
            return (
              <Card key={m.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${rc.color}`}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{m.user_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {pt ? rc.label : rc.labelEn}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember.mutate(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add member dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? "Adicionar Membro" : "Add Team Member"}</DialogTitle>
            <DialogDescription>
              {pt
                ? "Busque pelo email de um usuário cadastrado na plataforma."
                : "Search by the email of a registered platform user."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder={pt ? "Papel na equipe" : "Team role"} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {pt ? config.label : config.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                placeholder={pt ? "Buscar por email..." : "Search by email..."}
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {foundUsers.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {foundUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addMember.mutate(u.id)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                  >
                    <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{u.email}</span>
                    <Plus className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {foundUsers.length === 0 && searchEmail.trim().length >= 3 && !searching && (
              <p className="text-xs text-muted-foreground text-center py-2">
                {pt ? "Nenhum usuário encontrado." : "No users found."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {pt ? "Fechar" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManager;
