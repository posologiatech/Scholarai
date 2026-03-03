import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Comment {
  id: string;
  user_id: string;
  user_email: string | null;
  content: string;
  created_at: string;
}

interface Props {
  conversationId: string;
  messageId: string;
}

const DataMindComments = ({ conversationId, messageId }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadComments();
  }, [open, messageId]);

  const loadComments = async () => {
    const { data } = await supabase
      .from("datamind_comments")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true });
    if (data) setComments(data);
  };

  const addComment = async () => {
    if (!text.trim() || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("datamind_comments")
      .insert({
        conversation_id: conversationId,
        message_id: messageId,
        user_id: user.id,
        user_email: user.email,
        content: text.trim(),
      })
      .select()
      .single();
    if (data) {
      setComments(prev => [...prev, data]);
      setText("");
    }
    if (error) toast({ title: "Erro", variant: "destructive" });
    setLoading(false);
  };

  const deleteComment = async (id: string) => {
    await supabase.from("datamind_comments").delete().eq("id", id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors relative"
        title="Comentários"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {comments.length > 0 && (
          <span className="absolute -top-1 -right-1 h-3.5 min-w-[14px] rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-medium">
            {comments.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-border/60 bg-card shadow-xl"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
              <span className="text-xs font-medium text-foreground">Comentários ({comments.length})</span>
              <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-muted/50">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto p-2 space-y-2">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Sem comentários ainda</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/30 p-2 group">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-medium text-primary">
                      {c.user_email?.split("@")[0] || "Usuário"}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {c.user_id === user?.id && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted/50 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-foreground/90">{c.content}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5 p-2 border-t border-border/40">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Adicionar comentário..."
                className="min-h-[32px] h-8 text-xs resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={addComment} disabled={!text.trim() || loading}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataMindComments;
