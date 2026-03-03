import { useState, useEffect } from "react";
import { Pin, Plus, Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Dashboard {
  id: string;
  title: string;
}

interface PinButtonProps {
  itemType: "chart" | "table";
  title: string;
  content: Record<string, unknown>;
  sourceMessageId?: string;
}

const DataMindDashboardPinButton = ({ itemType, title, content, sourceMessageId }: PinButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [pinning, setPinning] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      supabase
        .from("datamind_dashboards" as any)
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .then(({ data }) => {
          setDashboards((data as any[]) || []);
          setLoading(false);
        });
    }
  }, [open, user]);

  const pinToExisting = async (dashboardId: string) => {
    if (!user) return;
    setPinning(dashboardId);
    
    // Count existing items to determine position
    const { count } = await supabase
      .from("datamind_dashboard_items" as any)
      .select("id", { count: "exact", head: true })
      .eq("dashboard_id", dashboardId);

    const position = { x: ((count || 0) % 2) * 6, y: Math.floor((count || 0) / 2) * 4, w: 6, h: 4 };

    const { error } = await supabase.from("datamind_dashboard_items" as any).insert({
      dashboard_id: dashboardId,
      user_id: user.id,
      item_type: itemType,
      title,
      content,
      position,
      source_message_id: sourceMessageId || null,
    } as any);

    setPinning(null);
    if (error) {
      toast({ title: "Erro ao fixar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fixado!", description: `Item adicionado ao dashboard.` });
      setOpen(false);
    }
  };

  const createAndPin = async () => {
    if (!user || !newTitle.trim()) return;
    setCreating(true);

    const { data: dash, error: dashErr } = await supabase
      .from("datamind_dashboards" as any)
      .insert({ user_id: user.id, title: newTitle.trim() } as any)
      .select("id")
      .single();

    if (dashErr || !dash) {
      toast({ title: "Erro ao criar dashboard", description: dashErr?.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    const { error } = await supabase.from("datamind_dashboard_items" as any).insert({
      dashboard_id: (dash as any).id,
      user_id: user.id,
      item_type: itemType,
      title,
      content,
      position: { x: 0, y: 0, w: 6, h: 4 },
      source_message_id: sourceMessageId || null,
    } as any);

    setCreating(false);
    if (error) {
      toast({ title: "Erro ao fixar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dashboard criado!", description: `"${newTitle.trim()}" com o item fixado.` });
      setNewTitle("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          title="Fixar no Dashboard"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-sm font-medium mb-2">Fixar no Dashboard</p>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {dashboards.map((d) => (
              <button
                key={d.id}
                onClick={() => pinToExisting(d.id)}
                disabled={pinning === d.id}
                className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <span className="truncate">{d.title}</span>
                {pinning === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
              </button>
            ))}
            {dashboards.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhum dashboard ainda.</p>
            )}
          </div>
        )}

        <div className="border-t border-border/40 mt-2 pt-2">
          <div className="flex gap-1">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Novo dashboard..."
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && createAndPin()}
            />
            <Button size="sm" className="h-8 px-2" onClick={createAndPin} disabled={creating || !newTitle.trim()}>
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DataMindDashboardPinButton;
