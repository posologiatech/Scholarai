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
import { QRCodeSVG } from "qrcode.react";

const AnonymousLinkTab = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

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

      {/* Real QR Code */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">QR Code</h3>
        </div>
        {surveyUrl ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <QRCodeSVG value={surveyUrl} size={200} level="M" includeMargin />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {locale === "pt"
                ? "Escaneie para acessar a pesquisa"
                : "Scan to access the survey"}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {locale === "pt" ? "Gerando link..." : "Generating link..."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AnonymousLinkTab;
