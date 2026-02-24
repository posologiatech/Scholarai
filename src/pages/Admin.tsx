import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import AppHeader from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Shield, Users, Trash2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

const Admin = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("user");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading]);

  useEffect(() => {
    if (isAdmin) fetchRoles();
  }, [isAdmin]);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setRoles(data as UserRole[]);
    setLoading(false);
  };

  const addRole = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);

    // Find user by email - we need an edge function for this
    // For now, use a simple approach: lookup from auth admin
    const { data: userData, error: userError } = await supabase
      .from("user_roles")
      .select("user_id")
      .limit(0);

    // We need to find user ID from email - let's use a different approach
    // Call a simple RPC or edge function
    toast.error(t("admin.addViaSupabase"));
    setAdding(false);
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.roleRemoved"));
      fetchRoles();
    }
  };

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="container max-w-4xl flex-1 py-12">
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{t("admin.title")}</h1>
            <p className="text-muted-foreground">{t("admin.subtitle")}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t("admin.totalAdmins")}</p>
            <p className="font-display text-2xl font-bold text-foreground">
              {roles.filter(r => r.role === 'admin').length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t("admin.totalUsers")}</p>
            <p className="font-display text-2xl font-bold text-foreground">
              {roles.filter(r => r.role === 'user').length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t("admin.totalRoles")}</p>
            <p className="font-display text-2xl font-bold text-foreground">
              {roles.length}
            </p>
          </div>
        </div>

        {/* Roles table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <Users className="h-5 w-5" />
              {t("admin.userRoles")}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      role.role === 'admin'
                        ? 'bg-primary/10 text-primary'
                        : role.role === 'moderator'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {role.role}
                    </div>
                    <span className="text-sm text-foreground font-mono">{role.user_id.slice(0, 8)}...</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(role.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {role.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRole(role.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {roles.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("admin.noRoles")}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {t("admin.manageNote")}
        </p>
      </main>
    </div>
  );
};

export default Admin;
