import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus, Users, Loader2, FolderOpen, Calendar, Crown,
} from "lucide-react";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  my_role?: string;
}

const Workspaces = () => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const pt = locale === "pt";

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get workspaces where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .eq("accepted", true);

      if (memberError) throw memberError;

      if (!memberData?.length) {
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      const wsIds = memberData.map((m) => m.workspace_id);
      const roleMap: Record<string, string> = {};
      memberData.forEach((m) => (roleMap[m.workspace_id] = m.role));

      const { data: wsData, error: wsError } = await supabase
        .from("workspaces")
        .select("*")
        .in("id", wsIds)
        .order("updated_at", { ascending: false });

      if (wsError) throw wsError;

      // Get member counts
      const { data: counts } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .in("workspace_id", wsIds)
        .eq("accepted", true);

      const countMap: Record<string, number> = {};
      counts?.forEach((c) => {
        countMap[c.workspace_id] = (countMap[c.workspace_id] || 0) + 1;
      });

      setWorkspaces(
        (wsData || []).map((ws) => ({
          ...ws,
          member_count: countMap[ws.id] || 1,
          my_role: roleMap[ws.id] || "reviewer",
        }))
      );
    } catch (err) {
      console.error("Error fetching workspaces:", err);
      toast.error(pt ? "Erro ao carregar workspaces" : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .rpc("create_workspace", {
          _name: newName.trim(),
          _description: newDesc.trim() || null,
        });

      if (error) throw error;

      const workspace = Array.isArray(data) ? data[0] : data;
      if (!workspace?.id) throw new Error(pt ? "Falha ao criar workspace" : "Failed to create workspace");

      toast.success(pt ? "Workspace criado!" : "Workspace created!");
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
      navigate(`/workspaces/${workspace.id}`);
    } catch (err: any) {
      console.error("Error creating workspace:", err);
      toast.error(err.message || "Error");
    } finally {
      setCreating(false);
    }
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, Record<string, string>> = {
      owner: { pt: "Dono", en: "Owner" },
      advisor: { pt: "Orientador", en: "Advisor" },
      coauthor: { pt: "Co-autor", en: "Co-author" },
      reviewer: { pt: "Revisor", en: "Reviewer" },
    };
    return labels[role]?.[locale] || role;
  };

  const roleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      advisor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      coauthor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      reviewer: "bg-green-500/10 text-green-600 border-green-500/20",
    };
    return colors[role] || "";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {pt ? "Workspaces Colaborativos" : "Collaborative Workspaces"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pt
              ? "Crie projetos compartilhados e trabalhe em equipe em suas pesquisas"
              : "Create shared projects and collaborate on your research"}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {pt ? "Novo Workspace" : "New Workspace"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{pt ? "Criar Workspace" : "Create Workspace"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{pt ? "Nome do projeto" : "Project name"}</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={pt ? "Ex: Revisão Sistemática - Diabetes" : "E.g.: Systematic Review - Diabetes"}
                />
              </div>
              <div>
                <Label>{pt ? "Descrição (opcional)" : "Description (optional)"}</Label>
                <Textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={pt ? "Descreva o objetivo do workspace..." : "Describe the workspace goal..."}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {pt ? "Cancelar" : "Cancel"}
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {pt ? "Criar" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {pt ? "Nenhum workspace ainda" : "No workspaces yet"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            {pt
              ? "Crie um workspace para colaborar com sua equipe de pesquisa. Convide orientadores, co-autores e revisores."
              : "Create a workspace to collaborate with your research team. Invite advisors, co-authors, and reviewers."}
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {pt ? "Criar primeiro workspace" : "Create first workspace"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => navigate(`/workspaces/${ws.id}`)}
              className="text-left p-5 rounded-xl border border-border/60 bg-card hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {ws.name}
                  </h3>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${roleColor(ws.my_role || "reviewer")}`}>
                  {ws.my_role === "owner" && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                  {roleLabel(ws.my_role || "reviewer")}
                </Badge>
              </div>

              {ws.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ws.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {ws.member_count} {pt ? "membro" : "member"}{(ws.member_count || 0) > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(ws.updated_at).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Workspaces;
