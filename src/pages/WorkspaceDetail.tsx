import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Users, Plus, Loader2, Crown, MessageSquare, History,
  Send, Trash2, UserPlus, Settings, Sparkles, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
  accepted: boolean;
  created_at: string;
}

interface Annotation {
  id: string;
  paper_id: string;
  paper_title: string | null;
  user_id: string;
  content: string;
  annotation_type: string;
  created_at: string;
  user_email?: string;
}

interface Activity {
  id: string;
  user_id: string;
  action: string;
  paper_id: string | null;
  paper_title: string | null;
  details: any;
  created_at: string;
  user_email?: string;
}

const WorkspaceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt";

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>("reviewer");

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("reviewer");
  const [inviting, setInviting] = useState(false);

  // Annotation state
  const [newAnnotation, setNewAnnotation] = useState("");
  const [annotationPaperId, setAnnotationPaperId] = useState("");
  const [annotationPaperTitle, setAnnotationPaperTitle] = useState("");
  const [addingAnnotation, setAddingAnnotation] = useState(false);

  // AI Summary state
  const [showSummarySelector, setShowSummarySelector] = useState(false);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set());
  const [summarizing, setSummarizing] = useState(false);
  const [summaries, setSummaries] = useState<Array<{
    id: string;
    title: string;
    content: string;
    date: string;
    annotationIds: string[];
  }>>([]);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);

  useEffect(() => {
    if (id) loadWorkspace();
  }, [id]);

  const loadWorkspace = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      // Fetch workspace
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", id)
        .single();

      if (wsErr) throw wsErr;
      setWorkspace(ws);

      // Fetch members with email from user_approvals
      const { data: membersData } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", id);

      const enrichedMembers = membersData || [];
      // Get emails from user_approvals for each member
      if (enrichedMembers.length > 0) {
        const userIds = enrichedMembers.map((m) => m.user_id);
        const { data: approvals } = await supabase
          .from("user_approvals")
          .select("user_id, email")
          .in("user_id", userIds);

        const emailMap: Record<string, string> = {};
        approvals?.forEach((a) => {
          if (a.email) emailMap[a.user_id] = a.email;
        });

        enrichedMembers.forEach((m) => {
          if (!m.email && emailMap[m.user_id]) {
            m.email = emailMap[m.user_id];
          }
        });
      }

      setMembers(enrichedMembers);
      const me = enrichedMembers.find((m) => m.user_id === user.id);
      if (me) setMyRole(me.role);
      if (ws.owner_id === user.id) setMyRole("owner");

      // Fetch annotations
      const { data: annData } = await supabase
        .from("workspace_annotations")
        .select("*")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false });

      setAnnotations(annData || []);

      // Fetch activity
      const { data: actData } = await supabase
        .from("workspace_activity")
        .select("*")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

      setActivity(actData || []);
    } catch (err) {
      console.error("Error loading workspace:", err);
      toast.error(pt ? "Erro ao carregar workspace" : "Failed to load workspace");
      navigate("/workspaces");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !id || !user) return;
    setInviting(true);
    try {
      // Find user by email in user_approvals
      const { data: targetUser } = await supabase
        .from("user_approvals")
        .select("user_id")
        .eq("email", inviteEmail.trim())
        .single();

      if (!targetUser) {
        toast.error(pt ? "Usuário não encontrado com esse email" : "User not found with that email");
        setInviting(false);
        return;
      }

      const { error } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: id,
          user_id: targetUser.user_id,
          email: inviteEmail.trim(),
          role: inviteRole as any,
          invited_by: user.id,
          accepted: true, // Auto-accept for now
        });

      if (error) {
        if (error.code === "23505") {
          toast.error(pt ? "Usuário já é membro" : "User is already a member");
        } else {
          throw error;
        }
        setInviting(false);
        return;
      }

      // Log activity
      await supabase.from("workspace_activity").insert({
        workspace_id: id,
        user_id: user.id,
        action: "member_invited",
        details: { email: inviteEmail.trim(), role: inviteRole },
      });

      toast.success(pt ? "Membro adicionado!" : "Member added!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("reviewer");
      loadWorkspace();
    } catch (err: any) {
      console.error("Error inviting:", err);
      toast.error(err.message || "Error");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === workspace?.owner_id) return;
    try {
      await supabase.from("workspace_members").delete().eq("id", memberId);
      toast.success(pt ? "Membro removido" : "Member removed");
      loadWorkspace();
    } catch (err) {
      toast.error(pt ? "Erro ao remover membro" : "Failed to remove member");
    }
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim() || !id || !user) return;
    setAddingAnnotation(true);
    try {
      await supabase.from("workspace_annotations").insert({
        workspace_id: id,
        paper_id: annotationPaperId || "general",
        paper_title: annotationPaperTitle || null,
        user_id: user.id,
        content: newAnnotation.trim(),
        annotation_type: "comment",
      });

      await supabase.from("workspace_activity").insert({
        workspace_id: id,
        user_id: user.id,
        action: "annotation_added",
        paper_id: annotationPaperId || null,
        paper_title: annotationPaperTitle || null,
      });

      toast.success(pt ? "Anotação adicionada!" : "Annotation added!");
      setNewAnnotation("");
      setAnnotationPaperId("");
      setAnnotationPaperTitle("");
      loadWorkspace();
    } catch (err) {
      toast.error(pt ? "Erro ao adicionar anotação" : "Failed to add annotation");
    } finally {
      setAddingAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async (annId: string) => {
    try {
      await supabase.from("workspace_annotations").delete().eq("id", annId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annId));
      toast.success(pt ? "Anotação removida" : "Annotation removed");
    } catch {
      toast.error(pt ? "Erro" : "Error");
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

  const actionLabel = (action: string) => {
    const labels: Record<string, Record<string, string>> = {
      member_invited: { pt: "convidou um membro", en: "invited a member" },
      annotation_added: { pt: "adicionou uma anotação", en: "added an annotation" },
      screening_include: { pt: "incluiu um paper na triagem", en: "included a paper in screening" },
      screening_exclude: { pt: "excluiu um paper da triagem", en: "excluded a paper from screening" },
    };
    return labels[action]?.[locale] || action;
  };

  const getMemberEmail = (userId: string) => {
    const m = members.find((m) => m.user_id === userId);
    return m?.email || userId.slice(0, 8);
  };

  const canManage = myRole === "owner" || myRole === "advisor";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/workspaces")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold text-foreground truncate">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{workspace.description}</p>
          )}
        </div>
        <Badge variant="outline" className={`${roleColor(myRole)} text-xs`}>
          {myRole === "owner" && <Crown className="h-3 w-3 mr-1" />}
          {roleLabel(myRole)}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {pt ? "Membros" : "Members"}
            <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">
              {members.filter((m) => m.accepted).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="annotations" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {pt ? "Anotações" : "Annotations"}
            <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">
              {annotations.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            {pt ? "Atividade" : "Activity"}
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          {canManage && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {pt ? "Convidar Membro" : "Invite Member"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{pt ? "Convidar Membro" : "Invite Member"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={pt ? "email@exemplo.com" : "email@example.com"}
                    />
                  </div>
                  <div>
                    <Label>{pt ? "Função" : "Role"}</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advisor">{pt ? "Orientador" : "Advisor"}</SelectItem>
                        <SelectItem value="coauthor">{pt ? "Co-autor" : "Co-author"}</SelectItem>
                        <SelectItem value="reviewer">{pt ? "Revisor" : "Reviewer"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inviteRole === "advisor"
                        ? pt ? "Pode gerenciar membros e ver tudo" : "Can manage members and see everything"
                        : inviteRole === "coauthor"
                        ? pt ? "Pode editar e anotar papers" : "Can edit and annotate papers"
                        : pt ? "Pode visualizar e comentar" : "Can view and comment"}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    {pt ? "Cancelar" : "Cancel"}
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {pt ? "Convidar" : "Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <div className="space-y-2">
            {members
              .filter((m) => m.accepted)
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {(m.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.email || m.user_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pt ? "Desde" : "Since"} {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${roleColor(m.role)}`}>
                      {m.role === "owner" && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                      {roleLabel(m.role)}
                    </Badge>
                    {canManage && m.user_id !== workspace.owner_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(m.id, m.user_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </TabsContent>

        {/* Annotations Tab */}
        <TabsContent value="annotations" className="space-y-4">
          {/* Add annotation */}
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{pt ? "ID do Paper (opcional)" : "Paper ID (optional)"}</Label>
                <Input
                  value={annotationPaperId}
                  onChange={(e) => setAnnotationPaperId(e.target.value)}
                  placeholder="DOI or paper ID"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">{pt ? "Título do Paper" : "Paper Title"}</Label>
                <Input
                  value={annotationPaperTitle}
                  onChange={(e) => setAnnotationPaperTitle(e.target.value)}
                  placeholder={pt ? "Título do artigo..." : "Paper title..."}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={newAnnotation}
                onChange={(e) => setNewAnnotation(e.target.value)}
                placeholder={pt ? "Adicione uma anotação ou comentário..." : "Add an annotation or comment..."}
                rows={2}
                className="text-sm"
              />
              <Button
                size="icon"
                className="h-auto shrink-0"
                onClick={handleAddAnnotation}
                disabled={addingAnnotation || !newAnnotation.trim()}
              >
                {addingAnnotation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Annotation list */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {annotations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {pt ? "Nenhuma anotação ainda" : "No annotations yet"}
                </p>
              ) : (
                annotations.map((ann) => (
                  <div key={ann.id} className="rounded-lg border border-border/40 bg-card p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        {ann.paper_title && (
                          <p className="text-xs font-medium text-primary truncate">{ann.paper_title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {getMemberEmail(ann.user_id)} · {new Date(ann.created_at).toLocaleString()}
                        </p>
                      </div>
                      {ann.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleDeleteAnnotation(ann.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{ann.content}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {pt ? "Nenhuma atividade registrada" : "No activity recorded"}
                </p>
              ) : (
                activity.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
                    <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center mt-0.5">
                      <History className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{getMemberEmail(act.user_id)}</span>{" "}
                        {actionLabel(act.action)}
                        {act.paper_title && (
                          <span className="text-primary"> — {act.paper_title}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(act.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkspaceDetail;
