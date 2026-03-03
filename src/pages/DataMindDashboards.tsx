import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Share2, Lock, Globe, LayoutDashboard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

const DataMindDashboards = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboards = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("datamind_dashboards" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const dashList = (data as any[]) || [];

    // Get item counts
    for (const d of dashList) {
      const { count } = await supabase
        .from("datamind_dashboard_items" as any)
        .select("id", { count: "exact", head: true })
        .eq("dashboard_id", d.id);
      d.item_count = count || 0;
    }

    setDashboards(dashList);
    setLoading(false);
  };

  useEffect(() => { fetchDashboards(); }, [user]);

  const createNew = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("datamind_dashboards" as any)
      .insert({ user_id: user.id, title: "Novo Dashboard" } as any)
      .select("id")
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      navigate(`/datamind/dashboard/${(data as any).id}`);
    }
  };

  const deleteDashboard = async (id: string) => {
    await supabase.from("datamind_dashboards" as any).delete().eq("id", id);
    setDashboards(prev => prev.filter(d => d.id !== id));
    toast({ title: "Dashboard excluído" });
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/shared/dashboard/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboards</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus dashboards de análise do DataMind</p>
          </div>
          <Button onClick={createNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Dashboard
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-20">
            <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum dashboard ainda.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Fixe gráficos e tabelas do DataMind para criar dashboards.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((d) => (
              <Card
                key={d.id}
                className="cursor-pointer hover:border-primary/40 transition-colors group"
                onClick={() => navigate(`/datamind/dashboard/${d.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base truncate">{d.title}</CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.is_public && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyShareLink(d.share_token); }}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteDashboard(d.id); }}
                        className="p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{d.item_count} {d.item_count === 1 ? "item" : "itens"}</span>
                    <span className="flex items-center gap-1">
                      {d.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {d.is_public ? "Público" : "Privado"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Atualizado em {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
};

export default DataMindDashboards;
