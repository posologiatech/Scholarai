import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { GraduationCap, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppSidebar from "./AppSidebar";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { locale } = useLanguage();
  const [approved, setApproved] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

  useEffect(() => {
    if (!user) {
      setCheckingApproval(false);
      return;
    }

    const checkApproval = async () => {
      // Admins are always approved
      if (isAdmin) {
        setApproved(true);
        setCheckingApproval(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_approvals")
        .select("approved")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking approval:", error);
        // If no record exists yet (trigger delay), treat as pending
        setApproved(false);
      } else if (data) {
        setApproved(data.approved);
      } else {
        // No record yet
        setApproved(false);
      }
      setCheckingApproval(false);
    };

    checkApproval();
  }, [user, isAdmin]);

  if (loading || checkingApproval) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (approved === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 inline-flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <GraduationCap className="h-8 w-8 text-primary" />
            ScholarAI
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>

            <h1 className="mb-2 font-display text-xl font-bold text-foreground">
              {locale === "pt" ? "Conta pendente de aprovação" : "Account pending approval"}
            </h1>

            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {locale === "pt"
                ? "Sua conta foi criada com sucesso! Um administrador precisa aprovar seu acesso antes que você possa utilizar a plataforma. Você receberá acesso assim que for aprovado."
                : "Your account was created successfully! An administrator needs to approve your access before you can use the platform. You'll get access as soon as you're approved."}
            </p>

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              {locale === "pt"
                ? "💡 Dica: entre em contato com o administrador para agilizar a aprovação."
                : "💡 Tip: contact the administrator to speed up approval."}
            </div>

            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {locale === "pt" ? "Sair" : "Sign out"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AppSidebar>{children}</AppSidebar>;
};

export default ProtectedRoute;
