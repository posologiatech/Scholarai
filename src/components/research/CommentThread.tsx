import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Trash2, AtSign } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EntityType = "project" | "task" | "agenda_item" | "schedule_item" | "meeting";

interface Props {
  projectId: string;
  entityType: EntityType;
  entityId: string;
  /** Compact = collapsed by default with a counter button */
  compact?: boolean;
  className?: string;
}

export const CommentThread = ({ projectId, entityType, entityId, compact = false, className }: Props) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [expanded, setExpanded] = useState(!compact);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const queryKey = ["comments", projectId, entityType, entityId];

  const { data: comments = [] } = useQuery({
    queryKey,
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_comments")
        .select("*")
        .eq("project_id", projectId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: count } = useQuery({
    queryKey: [...queryKey, "count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("research_comments")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      return count ?? 0;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["project-members-mini", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("research_project_members")
        .select("user_id,full_name,invited_email")
        .eq("project_id", projectId);
      return data ?? [];
    },
  });

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m: any) =>
      (m.full_name ?? m.invited_email ?? "").toLowerCase().includes(q)
    ).slice(0, 5);
  }, [mentionQuery, members]);

  const onBodyChange = (val: string) => {
    setBody(val);
    // Detect @ mention
    const caret = textareaRef.current?.selectionStart ?? val.length;
    const upto = val.slice(0, caret);
    const m = upto.match(/@(\S*)$/);
    setMentionQuery(m ? m[1] : null);
  };

  const insertMention = (member: any) => {
    if (!textareaRef.current) return;
    const caret = textareaRef.current.selectionStart;
    const before = body.slice(0, caret).replace(/@(\S*)$/, "");
    const after = body.slice(caret);
    const name = (member.full_name ?? member.invited_email ?? "").replace(/\s+/g, "_");
    const newBody = `${before}@${name} ${after}`;
    setBody(newBody);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    // Extract mentions
    const mentionRegex = /@(\S+)/g;
    const mentionedNames = Array.from(trimmed.matchAll(mentionRegex)).map((m) => m[1].replace(/_/g, " "));
    const mentions = members
      .filter((m: any) => mentionedNames.some((n) =>
        (m.full_name ?? m.invited_email ?? "").toLowerCase() === n.toLowerCase()))
      .map((m: any) => m.user_id)
      .filter(Boolean);

    const { error } = await supabase.from("research_comments").insert({
      project_id: projectId,
      entity_type: entityType,
      entity_id: entityId,
      author_id: user!.id,
      body: trimmed,
      mentions,
    });
    if (error) return toast.error(error.message);
    setBody("");
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: [...queryKey, "count"] });
  };

  const remove = async (id: string) => {
    await supabase.from("research_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: [...queryKey, "count"] });
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    return parts.map((p, i) =>
      p.startsWith("@")
        ? <span key={i} className="text-primary font-medium">{p.replace(/_/g, " ")}</span>
        : <span key={i}>{p}</span>
    );
  };

  if (compact && !expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(true)}
        className={cn("h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground", className)}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {count ?? 0}
      </Button>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-lg border bg-muted/20 p-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {locale === "pt" ? "Discussão" : "Discussion"}
          {comments.length > 0 && <span>· {comments.length}</span>}
        </h4>
        {compact && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setExpanded(false)}>
            {locale === "pt" ? "Recolher" : "Collapse"}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {comments.map((c: any) => {
          const author = members.find((m: any) => m.user_id === c.author_id);
          const name = author?.full_name ?? author?.invited_email ?? (c.author_id === user?.id ? (locale === "pt" ? "Você" : "You") : "—");
          const initials = (name || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
          const isMine = c.author_id === user?.id;
          return (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{name}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                  {isMine && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 ml-auto" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{renderBody(c.body)}</p>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{locale === "pt" ? "Nenhum comentário ainda." : "No comments yet."}</p>
        )}
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder={locale === "pt" ? "Escreva um comentário…  use @ para mencionar  ·  ⌘/Ctrl+Enter para enviar" : "Write a comment…  use @ to mention  ·  ⌘/Ctrl+Enter to send"}
          rows={2}
          className="resize-none text-sm bg-background"
        />
        {filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-full max-w-xs rounded-lg border bg-popover shadow-lg z-10 overflow-hidden">
            {filteredMembers.map((m: any) => (
              <button
                key={m.user_id ?? m.invited_email}
                onClick={() => insertMention(m)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
              >
                <AtSign className="h-3 w-3 text-muted-foreground" />
                {m.full_name ?? m.invited_email}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={send} disabled={!body.trim()}>
            <Send className="h-3.5 w-3.5" />
            {locale === "pt" ? "Comentar" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
};
