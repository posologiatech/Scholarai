import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Lightbulb, Rocket, ArrowRight } from "lucide-react";

interface Entry {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  module: string | null;
}

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const AdminRoadmapDialog = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;

    // Only show once per session
    const key = "roadmap_shown_session";
    if (sessionStorage.getItem(key)) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("system_changelog" as any)
        .select("id, title, description, status, priority, category, module")
        .in("status", ["planned", "idea"])
        .order("created_at", { ascending: false })
        .limit(10);

      const items = ((data as any[]) || []).sort(
        (a: Entry, b: Entry) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );

      if (items.length > 0) {
        setEntries(items);
        setOpen(true);
        sessionStorage.setItem(key, "1");
      }
    };
    fetch();
  }, [isAdmin, adminLoading]);

  if (!isAdmin) return null;

  const planned = entries.filter((e) => e.status === "planned");
  const ideas = entries.filter((e) => e.status === "idea");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Roadmap de Atualizações
          </DialogTitle>
          <DialogDescription>
            {planned.length + ideas.length} itens pendentes no pipeline de desenvolvimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-72 overflow-y-auto py-2">
          {planned.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Planejados ({planned.length})
              </h3>
              <div className="space-y-1.5">
                {planned.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-blue-500/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{e.title}</p>
                      {e.module && <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">{e.module}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ideas.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" /> Ideias ({ideas.length})
              </h3>
              <div className="space-y-1.5">
                {ideas.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-amber-500/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{e.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setOpen(false); navigate("/changelog"); }}>
            Ver pipeline completo <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminRoadmapDialog;
