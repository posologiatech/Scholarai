import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <GraduationCap className="h-8 w-8 text-primary" />
            ScholarAI
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">{t("auth.resetPassword.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetPassword.subtitle")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" />
              <p className="text-foreground">{t("auth.resetPassword.sent")}</p>
              <Link to="/login">
                <Button variant="ghost" className="mt-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("nav.login")}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.resetPassword.button")}
              </Button>
              <Link to="/login" className="mt-2 flex items-center justify-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-1 h-3 w-3" />
                {t("nav.login")}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
