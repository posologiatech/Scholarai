import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Download, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const AccountPrivacy = () => {
  const { locale } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pt = locale === "pt";
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const invoke = async (action: "export" | "delete", confirm?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("account-data", {
      body: { action, confirm },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.message || data.error);
    return data;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await invoke("export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scholar-ai-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(pt ? "Exportação concluída" : "Export complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (pt ? "Erro ao exportar dados" : "Error exporting data"));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await invoke("delete", confirmText);
      toast.success(pt ? "Conta apagada. Sentiremos sua falta." : "Account deleted. We'll miss you.");
      await signOut();
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (pt ? "Erro ao apagar conta" : "Error deleting account"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-3xl flex-1 py-8 px-4">
        <div className="mb-8 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {pt ? "Privacidade e meus dados" : "Privacy and my data"}
            </h1>
            <p className="text-muted-foreground">
              {pt
                ? "Exerça seus direitos como titular de dados (LGPD Art. 18) sobre toda a sua conta."
                : "Exercise your rights as a data subject (LGPD Art. 18) over your entire account."}
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5 text-primary" />
              {pt ? "Exportar meus dados" : "Export my data"}
            </CardTitle>
            <CardDescription>
              {pt
                ? "Baixe uma cópia em JSON de todos os dados associados à sua conta (projetos, pesquisas, buscas salvas, conexões, e mais)."
                : "Download a JSON copy of all data tied to your account (projects, surveys, saved searches, connections, and more)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pt ? "Baixar meus dados" : "Download my data"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <Trash2 className="h-5 w-5" />
              {pt ? "Apagar minha conta" : "Delete my account"}
            </CardTitle>
            <CardDescription>
              {pt
                ? "Remove permanentemente sua conta e todos os dados associados. Esta ação não pode ser desfeita."
                : "Permanently removes your account and all associated data. This action cannot be undone."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {pt ? "Apagar minha conta" : "Delete my account"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    {pt ? "Tem certeza absoluta?" : "Are you absolutely sure?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        {pt
                          ? `Isso apagará permanentemente a conta ${user?.email}, incluindo projetos, pesquisas, buscas salvas e todo o restante. Não é possível desfazer.`
                          : `This will permanently delete the account ${user?.email}, including projects, surveys, saved searches, and everything else. This cannot be undone.`}
                      </p>
                      <p>
                        {pt
                          ? 'Digite "DELETE" para confirmar:'
                          : 'Type "DELETE" to confirm:'}
                      </p>
                      <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="DELETE"
                        autoComplete="off"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{pt ? "Cancelar" : "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      if (confirmText !== "DELETE" || deleting) { e.preventDefault(); return; }
                      handleDelete();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={confirmText !== "DELETE" || deleting}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (pt ? "Apagar permanentemente" : "Permanently delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AccountPrivacy;
