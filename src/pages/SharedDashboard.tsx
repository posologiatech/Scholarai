import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { GraduationCap, ImageIcon, TableIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ChartRenderer from "@/components/datamind/ChartRenderer";

interface DashboardItem {
  id: string;
  item_type: string;
  title: string;
  content: any;
  position: { x: number; y: number; w: number; h: number };
}

const SharedDashboard = () => {
  const { token } = useParams<{ token: string }>();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data: dash } = await supabase
        .from("datamind_dashboards" as any)
        .select("id, title, is_public")
        .eq("share_token", token)
        .eq("is_public", true)
        .single();

      if (!dash) { setNotFound(true); setLoading(false); return; }
      setTitle((dash as any).title);

      const { data: itemsData } = await supabase
        .from("datamind_dashboard_items" as any)
        .select("*")
        .eq("dashboard_id", (dash as any).id)
        .order("created_at", { ascending: true });

      setItems((itemsData as any[]) || []);
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Dashboard não encontrado ou não é público.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <span className="text-xs text-muted-foreground ml-auto">Powered by DataMind</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">Dashboard vazio.</p>
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
                  {item.item_type === "chart" ? (
                    <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden h-full flex flex-col">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground truncate">{item.title}</span>
                      </div>
                      {item.content?.chart ? (
                        <div className="flex-1 p-3 min-h-0">
                          <ChartRenderer chart={item.content.chart} height="100%" />
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center p-3 bg-white dark:bg-muted/10">
                          <img src={typeof item.content === "string" ? item.content : item.content?.base64 || ""} alt={item.title} className="max-w-full max-h-full object-contain rounded" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden h-full flex flex-col">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
                        <TableIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground truncate">{item.title}</span>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-muted/50 border-b border-border/50">
                              {(item.content?.headers || []).map((h: string, i: number) => (
                                <th key={i} className="py-2 px-3 text-left font-semibold text-foreground/80">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(item.content?.rows || []).slice(0, 50).map((row: string[], ri: number) => (
                              <tr key={ri} className={`border-b border-border/15 ${ri % 2 === 0 ? "" : "bg-muted/20"}`}>
                                {row.map((cell: string, ci: number) => (
                                  <td key={ci} className="py-1.5 px-3 text-foreground/90">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SharedDashboard;
