import { useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Trash2, AtSign, Reply, Check, Undo2 } from "lucide-react";
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

const TAB_FOR_ENTITY: Record<EntityType, string | null> = {
  project: null,
  task: "tasks",
  meeting: "meetings",
  agenda_item: "schedule",
  schedule_item: "schedule",
};

function projectLink(projectId: string, entityType: EntityType) {
  const tab = TAB_FOR_ENTITY[entityType];
  return tab ? `/research/${projectId}?tab=${tab}` : `/research/${projectId}`;
}

export const CommentThread = ({ projectId, entityType, entityId, compact = false, className }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt";
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(!compact);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

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

  const memberName = (userId: string | null) => {
    if (!userId) return null;
    const m: any = members.find((x: any) => x.user_id === userId);
    return m?.full_name ?? m?.invited_email ?? null;
  };

  const authorName = memberName(user?.id ?? null) ?? user?.email ?? (pt ? "Alguém" : "Someone");

  const threads = useMemo(() => {
    const roots = comments.filter((c: any) => !c.parent_id);
    return roots.map((root: any) => ({
      root,
      replies: comments.filter((c: any) => c.parent_id === root.id),
    }));
  }, [comments]);

  const visibleThreads = showResolved ? threads : threads.filter((t) => !t.root.resolved_at);
  const resolvedCount = threads.length - threads.filter((t) => !t.root.resolved_at).length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: [...queryKey, "count"] });
  };

  const notifyMentions = async (mentionIds: string[], body: string) => {
    const unique = Array.from(new Set(mentionIds)).filter((id) => id && id !== user?.id);
    const title = pt ? `${authorName} mencionou você em um comentário` : `${authorName} mentioned you in a comment`;
    for (const recipientId of unique) {
      await (supabase as any).rpc("notify_comment_event", {
        _project_id: projectId,
        _recipient_id: recipientId,
        _type: "mention",
        _title: title,
        _body: body.slice(0, 140),
        _link: projectLink(projectId, entityType),
      });
    }
    return unique;
  };

  const notifyReply = async (rootAuthorId: string, body: string) => {
    const title = pt ? `${authorName} respondeu seu comentário` : `${authorName} replied to your comment`;
    await (supabase as any).rpc("notify_comment_event", {
      _project_id: projectId,
      _recipient_id: rootAuthorId,
      _type: "comment_reply",
      _title: title,
      _body: body.slice(0, 140),
      _link: projectLink(projectId, entityType),
    });
  };

  const send = async (body: string, mentions: string[], parentId: string | null, rootAuthorId?: string | null) => {
    const { error } = await supabase.from("research_comments").insert({
      project_id: projectId,
      entity_type: entityType,
      entity_id: entityId,
      parent_id: parentId,
      author_id: user!.id,
      body,
      mentions,
    });
    if (error) return toast.error(error.message);

    const notified = await notifyMentions(mentions, body);
    if (parentId && rootAuthorId && rootAuthorId !== user?.id && !notified.includes(rootAuthorId)) {
      await notifyReply(rootAuthorId, body);
    }

    setReplyingTo(null);
    invalidate();
  };

  const remove = async (id: string) => {
    await supabase.from("research_comments").delete().eq("id", id);
    invalidate();
  };

  const toggleResolved = async (id: string, resolved: boolean) => {
    await (supabase as any).rpc("set_comment_resolved", { _comment_id: id, _resolved: resolved });
    invalidate();
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    return parts.map((p, i) =>
      p.startsWith("@")
        ? <span key={i} className="text-primary font-medium">{p.replace(/_/g, " ")}</span>
        : <span key={i}>{p}</span>
    );
  };

  const renderComment = (c: any, isReply: boolean) => {
    const author = members.find((m: any) => m.user_id === c.author_id);
    const name = author?.full_name ?? author?.invited_email ?? (c.author_id === user?.id ? (pt ? "Você" : "You") : "—");
    const initials = (name || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
    const isMine = c.author_id === user?.id;
    return (
      <div key={c.id} className="flex gap-2 group">
        <Avatar className={cn("shrink-0", isReply ? "h-6 w-6" : "h-7 w-7")}>
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
          {pt ? "Discussão" : "Discussion"}
          {comments.length > 0 && <span>· {comments.length}</span>}
        </h4>
        <div className="flex items-center gap-2">
          {resolvedCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setShowResolved((v) => !v)}>
              {showResolved
                ? (pt ? "Ocultar resolvidos" : "Hide resolved")
                : (pt ? `Mostrar resolvidos (${resolvedCount})` : `Show resolved (${resolvedCount})`)}
            </Button>
          )}
          {compact && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setExpanded(false)}>
              {pt ? "Recolher" : "Collapse"}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {visibleThreads.map(({ root, replies }) => (
          <div key={root.id} className={cn("space-y-2 rounded-md p-1.5 -m-1.5", root.resolved_at && "opacity-60")}>
            {renderComment(root, false)}
            <div className="pl-9 flex items-center gap-1 -mt-1">
              {root.resolved_at ? (
                <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/30">
                  <Check className="h-2.5 w-2.5" />{pt ? "Resolvido" : "Resolved"}
                </Badge>
              ) : null}
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-muted-foreground gap-1" onClick={() => setReplyingTo(replyingTo === root.id ? null : root.id)}>
                <Reply className="h-3 w-3" />{pt ? "Responder" : "Reply"}
              </Button>
              <Button
                variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-muted-foreground gap-1"
                onClick={() => toggleResolved(root.id, !root.resolved_at)}
              >
                {root.resolved_at ? <><Undo2 className="h-3 w-3" />{pt ? "Reabrir" : "Reopen"}</> : <><Check className="h-3 w-3" />{pt ? "Resolver" : "Resolve"}</>}
              </Button>
            </div>

            {replies.length > 0 && (
              <div className="pl-9 space-y-2 border-l-2 border-border/40 ml-3.5">
                {replies.map((r: any) => renderComment(r, true))}
              </div>
            )}

            {replyingTo === root.id && (
              <div className="pl-9">
                <CommentComposer
                  members={members}
                  small
                  autoFocus
                  placeholder={pt ? "Escreva uma resposta…" : "Write a reply…"}
                  onSend={(body, mentions) => send(body, mentions, root.id, root.author_id)}
                />
              </div>
            )}
          </div>
        ))}
        {visibleThreads.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{pt ? "Nenhum comentário ainda." : "No comments yet."}</p>
        )}
      </div>

      <CommentComposer
        members={members}
        placeholder={pt ? "Escreva um comentário…  use @ para mencionar  ·  ⌘/Ctrl+Enter para enviar" : "Write a comment…  use @ to mention  ·  ⌘/Ctrl+Enter to send"}
        onSend={(body, mentions) => send(body, mentions, null)}
      />
    </div>
  );
};

/** Shared composer for both the root discussion input and inline thread replies. */
const CommentComposer = ({ members, onSend, placeholder, autoFocus, small }: {
  members: any[];
  onSend: (body: string, mentions: string[]) => void;
  placeholder: string;
  autoFocus?: boolean;
  small?: boolean;
}) => {
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m: any) =>
      (m.full_name ?? m.invited_email ?? "").toLowerCase().includes(q)
    ).slice(0, 5);
  }, [mentionQuery, members]);

  const onBodyChange = (val: string) => {
    setBody(val);
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

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    const mentionRegex = /@(\S+)/g;
    const mentionedNames = Array.from(trimmed.matchAll(mentionRegex)).map((m) => m[1].replace(/_/g, " "));
    const mentions = members
      .filter((m: any) => mentionedNames.some((n) =>
        (m.full_name ?? m.invited_email ?? "").toLowerCase() === n.toLowerCase()))
      .map((m: any) => m.user_id)
      .filter(Boolean);

    onSend(trimmed, mentions);
    setBody("");
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => onBodyChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        rows={small ? 1 : 2}
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
        <Button size="sm" onClick={submit} disabled={!body.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
