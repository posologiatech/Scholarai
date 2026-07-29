import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Globe, Lock, Trash2, Loader2, GripVertical, ImageIcon, TableIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ChartRenderer from "@/components/datamind/ChartRenderer";

interface DashboardItem {
  id: string;
  item_type: string;
  title: string;
  content: any;
  position: { x: number; y: number; w: number; h: number };
}

interface DashboardData {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  share_token: string;
}

const DashboardItemCard = ({ item, onDelete }: { item: DashboardItem; onDelete: (id: string) => void }) => {
  if (item.item_type === "chart") {
    const interactiveChart = item.content?.chart;
    const imgSrc = item.content?.base64 || item.content;
    return (
      <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden h-full flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground truncate">{item.title}</span>
          </div>
          <button onClick={() => onDelete(item.id)} className="p-1 rounded hover:bg-destructive/10">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>
        {interactiveChart ? (
          <div className="flex-1 p-3 min-h-0">
            <ChartRenderer chart={interactiveChart} height="100%" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-3 bg-white dark:bg-muted/10">
            <img src={typeof imgSrc === "string" ? imgSrc : ""} alt={item.title} className="max-w-full max-h-full object-contain rounded" />
          </div>
        )}
      </div>
    );
  }

  // Table
  const headers: string[] = item.content?.headers || [];
  const rows: string[][] = item.content?.rows || [];

  return (
    <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          <TableIcon className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate">{item.title}</span>
        </div>
        <button onClick={() => onDelete(item.id)} className="p-1 rounded hover:bg-destructive/10">
          <Trash2 className="h-3 w-3 text-destructive" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/50 border-b border-border/50">
              {headers.map((h, i) => (
                <th key={i} className="py-2 px-3 text-left font-semibold text-foreground/80">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, ri) => (
              <tr key={ri} className={`border-b border-border/15 ${ri % 2 === 0 ? "" : "bg-muted/20"}`}>
                {row.map((cell, ci) => (
                  <td key={ci} className="py-1.5 px-3 text-foreground/90">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 20 && (
          <p className="text-xs text-muted-foreground text-center py-2">+ {rows.length - 20} linhas</p>
        )}
      </div>
    </div>
  );
};

const DataMindDashboardView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      setLoading(true);
      const { data: dash } = await supabase
        .from("datamind_dashboards" as any)
        .select("*")
        .eq("id", id)
        .single();

      if (!dash) { navigate("/datamind/dashboards"); return; }
      setDashboard(dash as any);
      setTitleValue((dash as any).title);

      const { data: itemsData } = await supabase
        .from("datamind_dashboard_items" as any)
        .select("*")
        .eq("dashboard_id", id)
        .order("created_at", { ascending: true });

      setItems((itemsData as any[]) || []);
      setLoading(false);
    };
    load();
  }, [id, user]);

  const saveTitle = async () => {
    if (!dashboard) return;
    setEditingTitle(false);
    await supabase.from("datamind_dashboards" as any).update({ title: titleValue } as any).eq("id", dashboard.id);
    setDashboard(prev => prev ? { ...prev, title: titleValue } : prev);
  };

  const togglePublic = async () => {
    if (!dashboard) return;
    const newVal = !dashboard.is_public;
    await supabase.from("datamind_dashboards" as any).update({ is_public: newVal } as any).eq("id", dashboard.id);
    setDashboard(prev => prev ? { ...prev, is_public: newVal } : prev);
    toast({ title: newVal ? "Dashboard público" : "Dashboard privado" });
  };

  const copyShareLink = () => {
    if (!dashboard) return;
    const url = `${window.location.origin}/shared/dashboard/${dashboard.share_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from("datamind_dashboard_items" as any).delete().eq("id", itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    );
  }

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/datamind/dashboards")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {editingTitle ? (
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                autoFocus
                className="h-8 text-lg font-bold w-64"
              />
            ) : (
              <h1
                className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => setEditingTitle(true)}
              >
                {dashboard?.title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {dashboard?.is_public ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={dashboard?.is_public || false} onCheckedChange={togglePublic} />
            </div>
            {dashboard?.is_public && (
              <Button variant="outline" size="sm" onClick={copyShareLink}>
                <Share2 className="h-3.5 w-3.5 mr-1" /> Compartilhar
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Nenhum item fixado ainda.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Use o botão 📌 nos outputs do DataMind para adicionar itens.</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 auto-rows-[200px]">
            {items.map((item) => {
              const pos = item.position || { x: 0, y: 0, w: 6, h: 4 };
              return (
                <div
                  key={item.id}
                  className="min-h-0"
                  style={{
                    gridColumn: `span ${Math.min(pos.w, 12)}`,
                    gridRow: `span ${Math.max(pos.h, 2)}`,
                  }}
                >
                  <DashboardItemCard item={item} onDelete={deleteItem} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default DataMindDashboardView;
