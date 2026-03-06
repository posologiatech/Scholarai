import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, QrCode, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const AnonymousLinkTab = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Get or create anonymous distribution
  const { data: distribution, isLoading } = useQuery({
    queryKey: ["survey-distribution-link", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_distributions")
        .select("*")
        .eq("survey_id", surveyId)
        .eq("type", "anonymous_link")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  const createLink = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("survey_distributions")
        .insert({ survey_id: surveyId, user_id: user!.id, type: "anonymous_link" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-distribution-link", surveyId] });
    },
  });

  const regenerateLink = useMutation({
    mutationFn: async () => {
      if (!distribution) return;
      const { error } = await supabase
        .from("survey_distributions")
        .update({ anonymous_token: crypto.randomUUID() })
        .eq("id", distribution.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-distribution-link", surveyId] });
      toast.success(locale === "pt" ? "Link regenerado" : "Link regenerated");
    },
  });

  useEffect(() => {
    if (!isLoading && !distribution) {
      createLink.mutate();
    }
  }, [isLoading, distribution]);

  const surveyUrl = distribution
    ? `${window.location.origin}/survey/respond/${distribution.anonymous_token}`
    : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    toast.success(locale === "pt" ? "Link copiado!" : "Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">
            {locale === "pt" ? "Link Anônimo" : "Anonymous Link"}
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {locale === "pt" ? "Sem autenticação" : "No auth required"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {locale === "pt"
            ? "Compartilhe este link com os respondentes. As respostas são coletadas anonimamente."
            : "Share this link with respondents. Responses are collected anonymously."}
        </p>

        {/* URL field */}
        <div className="flex gap-2">
          <Input value={surveyUrl} readOnly className="font-mono text-sm" />
          <Button variant="outline" onClick={copyToClipboard} className="shrink-0 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? (locale === "pt" ? "Copiado" : "Copied") : (locale === "pt" ? "Copiar" : "Copy")}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateLink.mutate()}
            disabled={regenerateLink.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {locale === "pt" ? "Regenerar Link" : "Regenerate Link"}
          </Button>
        </div>
      </Card>

      {/* QR Code placeholder */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">QR Code</h3>
        </div>
        <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/30">
          <div className="text-center text-muted-foreground">
            <QrCode className="h-16 w-16 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm">
              {locale === "pt"
                ? "QR Code para o link da pesquisa"
                : "QR Code for survey link"}
            </p>
            <p className="text-xs mt-1 text-muted-foreground/60">
              {locale === "pt" ? "Em breve" : "Coming soon"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AnonymousLinkTab;
