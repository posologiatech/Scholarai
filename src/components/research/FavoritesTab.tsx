import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Plus, Trash2, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

type Fav = { id: string; title: string; url: string; description: string | null; category: string | null };

const faviconFor = (url: string) => {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
  catch { return ""; }
};

export default function FavoritesTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const [favs, setFavs] = useState<Fav[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", description: "", category: "" });

  const load = async () => {
    const { data } = await supabase.from("research_favorites").select("*")
      .eq("project_id", projectId).order("position").order("created_at");
    setFavs((data as Fav[]) || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    let url = form.url.trim();
    if (!form.title.trim() || !url) return toast.error(locale === "pt" ? "Título e URL obrigatórios" : "Title and URL required");
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    const { error } = await supabase.from("research_favorites").insert({
      project_id: projectId, created_by: user!.id, title: form.title.trim(), url,
      description: form.description.trim() || null, category: form.category.trim() || null,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ title: "", url: "", description: "", category: "" }); load();
  };

  const remove = async (id: string) => {
    await supabase.from("research_favorites").delete().eq("id", id);
    setFavs(favs.filter(f => f.id !== id));
  };

  const categories = Array.from(new Set(favs.map(f => f.category || (locale === "pt" ? "Geral" : "General"))));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" />{locale === "pt" ? "Favoritos" : "Favorites"}</h2>
          <p className="text-sm text-muted-foreground">{locale === "pt" ? "Links importantes do projeto — drives, planilhas, repositórios, referências." : "Important project links."}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{locale === "pt" ? "Novo link" : "New link"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{locale === "pt" ? "Adicionar favorito" : "Add favorite"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{locale === "pt" ? "Título" : "Title"}</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus /></div>
              <div><Label>URL</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
              <div><Label>{locale === "pt" ? "Categoria" : "Category"}</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder={locale === "pt" ? "Ex.: Drive, Repositório…" : "e.g. Drive…"} /></div>
              <div><Label>{locale === "pt" ? "Descrição" : "Description"}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter><Button onClick={add}>{locale === "pt" ? "Adicionar" : "Add"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {favs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          {locale === "pt" ? "Nenhum link salvo ainda." : "No links yet."}
        </Card>
      ) : (
        <div className="space-y-5">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {favs.filter(f => (f.category || (locale === "pt" ? "Geral" : "General")) === cat).map(f => (
                  <Card key={f.id} className="p-3 group hover:shadow-md hover:border-primary/40 transition-all">
                    <div className="flex items-start gap-3">
                      <img src={faviconFor(f.url)} alt="" className="h-8 w-8 rounded shrink-0 mt-0.5 bg-muted" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
                      <div className="flex-1 min-w-0">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:text-primary flex items-center gap-1 truncate">
                          {f.title}<ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        </a>
                        <p className="text-xs text-muted-foreground truncate">{new URL(f.url).hostname}</p>
                        {f.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.description}</p>}
                      </div>
                      <button onClick={() => remove(f.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
