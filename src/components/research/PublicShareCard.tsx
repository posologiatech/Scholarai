import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Globe, Copy, ExternalLink } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

export default function PublicShareCard({ project }: { project: any }) {
  const { locale } = useLanguage();
  const qc = useQueryClient();
  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);
  const [isPublic, setIsPublic] = useState(!!project.is_public);
  const [slug, setSlug] = useState(project.public_slug || "");

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

  const save = async (next: { is_public?: boolean; public_slug?: string }) => {
    const patch: any = {};
    if (next.is_public !== undefined) patch.is_public = next.is_public;
    if (next.public_slug !== undefined) patch.public_slug = next.public_slug || null;
    const { error } = await supabase.from("research_projects").update(patch).eq("id", project.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["research-project", project.id] });
    toast.success(t("Atualizado", "Updated"));
  };

  const togglePublic = async (val: boolean) => {
    setIsPublic(val);
    let s = slug;
    if (val && !s) { s = slugify(project.title) + "-" + project.id.slice(0, 6); setSlug(s); }
    await save({ is_public: val, public_slug: s });
  };

  const saveSlug = async () => {
    const s = slugify(slug);
    setSlug(s);
    await save({ public_slug: s });
  };

  const url = slug ? `${window.location.origin}/p/${slug}` : "";
  const copy = () => { navigator.clipboard.writeText(url); toast.success(t("Link copiado", "Link copied")); };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />{t("Página pública do projeto", "Public project page")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">{t("Tornar projeto visível publicamente", "Make project publicly visible")}</Label>
            <p className="text-xs text-muted-foreground">{t("Compartilhe progresso, publicações e cronograma.", "Share progress, publications and schedule.")}</p>
          </div>
          <Switch checked={isPublic} onCheckedChange={togglePublic} />
        </div>
        {isPublic && (
          <>
            <div>
              <Label className="text-xs">{t("Identificador (slug)", "Identifier (slug)")}</Label>
              <div className="flex gap-2">
                <Input value={slug} onChange={e => setSlug(e.target.value)} onBlur={saveSlug} placeholder="meu-projeto" />
                <Button size="sm" variant="outline" onClick={saveSlug}>{t("Salvar", "Save")}</Button>
              </div>
            </div>
            {url && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <code className="text-xs flex-1 truncate">{url}</code>
                <Button size="icon" variant="ghost" onClick={copy}><Copy className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
