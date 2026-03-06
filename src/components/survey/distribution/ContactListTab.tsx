import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Upload, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const statusBadge: Record<string, string> = {
  not_sent: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  responded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const ContactListTab = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", institution: "" });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["survey-contacts", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_contacts")
        .select("*")
        .eq("survey_id", surveyId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const addContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("survey_contacts").insert({
        survey_id: surveyId,
        user_id: user!.id,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-contacts", surveyId] });
      setShowAdd(false);
      setForm({ first_name: "", last_name: "", email: "", institution: "" });
      toast.success(locale === "pt" ? "Contato adicionado" : "Contact added");
    },
    onError: () => toast.error("Failed to add contact"),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("survey_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-contacts", surveyId] });
    },
  });

  const handleCsvUpload = () => {
    toast.info(locale === "pt" ? "Upload CSV — em breve" : "CSV Upload — coming soon");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              {locale === "pt" ? "Lista de Contatos" : "Contact List"}
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {contacts.length} {locale === "pt" ? "contatos" : "contacts"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCsvUpload}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {locale === "pt" ? "Adicionar" : "Add"}
            </Button>
          </div>
        </div>

        {/* Contacts table */}
        {contacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm">
              {locale === "pt" ? "Nenhum contato adicionado" : "No contacts added yet"}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                    {locale === "pt" ? "Nome" : "Name"}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                    Email
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                    {locale === "pt" ? "Instituição" : "Institution"}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                    Status
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.institution || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className={`text-[10px] ${statusBadge[c.status] || ""}`}>
                        {c.status === "not_sent"
                          ? locale === "pt" ? "Não enviado" : "Not Sent"
                          : c.status === "sent"
                          ? locale === "pt" ? "Enviado" : "Sent"
                          : locale === "pt" ? "Respondido" : "Responded"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteContact.mutate(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add contact dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "pt" ? "Adicionar Contato" : "Add Contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{locale === "pt" ? "Nome" : "First Name"}</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{locale === "pt" ? "Sobrenome" : "Last Name"}</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{locale === "pt" ? "Instituição" : "Institution"}</Label>
              <Input
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addContact.mutate()} disabled={!form.email || addContact.isPending}>
              {locale === "pt" ? "Adicionar" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactListTab;
