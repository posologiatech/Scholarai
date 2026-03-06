import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Clock, Variable, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const pipedTextVars = [
  { label: "{{Contact.FirstName}}", desc: "First Name" },
  { label: "{{Contact.LastName}}", desc: "Last Name" },
  { label: "{{Contact.Email}}", desc: "Email" },
  { label: "{{Panel.Institution}}", desc: "Institution" },
  { label: "{{EmbeddedData.ProtocolNumber}}", desc: "Protocol Number" },
  { label: "{{SurveyLink}}", desc: "Survey Link" },
];

const EmailComposerTab = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const [fromName, setFromName] = useState("Research Team");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState(
    locale === "pt"
      ? "Convite para participar da pesquisa"
      : "Invitation to participate in our survey"
  );
  const [body, setBody] = useState(
    locale === "pt"
      ? `Prezado(a) Dr(a). {{Contact.LastName}},\n\nVocê está convidado(a) a participar da avaliação de acompanhamento do protocolo clínico {{EmbeddedData.ProtocolNumber}}.\n\nClique no link abaixo para iniciar:\n{{SurveyLink}}\n\nAtenciosamente,\n{{Contact.FirstName}} - Equipe de Pesquisa`
      : `Dear Dr. {{Contact.LastName}},\n\nYou are invited to participate in the follow-up assessment for the clinical protocol {{EmbeddedData.ProtocolNumber}}.\n\nClick the link below to start:\n{{SurveyLink}}\n\nBest regards,\n{{Contact.FirstName}} - Research Team`
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  const insertPipedText = (variable: string) => {
    setBody((prev) => prev + variable);
  };

  const handleSend = () => {
    setShowSuccess(true);
    toast.success(locale === "pt" ? "E-mails enviados com sucesso!" : "Emails sent successfully!");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <h3 className="font-semibold flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          {locale === "pt" ? "Compositor de E-mail" : "Email Composer"}
        </h3>

        {/* From / Reply-To */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">
              {locale === "pt" ? "Nome do Remetente" : "From Name"}
            </Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">
              {locale === "pt" ? "E-mail de Resposta" : "Reply-To Email"}
            </Label>
            <Input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="reply@institution.edu"
              className="h-9"
            />
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label className="text-xs">{locale === "pt" ? "Assunto" : "Subject"}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
        </div>

        {/* Body with piped text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{locale === "pt" ? "Corpo do E-mail" : "Email Body"}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Variable className="h-3 w-3" />
                  {locale === "pt" ? "Inserir Variável" : "Insert Piped Text"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pipedTextVars.map((v) => (
                  <DropdownMenuItem key={v.label} onClick={() => insertPipedText(v.label)} className="text-xs">
                    <span className="font-mono text-primary mr-2">{v.label}</span>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSend} className="gap-2">
            <Send className="h-4 w-4" />
            {locale === "pt" ? "Enviar Agora" : "Send Now"}
          </Button>
          <Button variant="outline" onClick={() => setShowSchedule(true)} className="gap-2">
            <Clock className="h-4 w-4" />
            {locale === "pt" ? "Agendar" : "Schedule"}
          </Button>
        </div>
      </Card>

      {/* Schedule dialog */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "pt" ? "Agendar Envio" : "Schedule Send"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{locale === "pt" ? "Data e Hora" : "Date & Time"}</Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowSchedule(false);
                toast.success(
                  locale === "pt"
                    ? `Envio agendado para ${new Date(scheduleDate).toLocaleString()}`
                    : `Send scheduled for ${new Date(scheduleDate).toLocaleString()}`
                );
              }}
              disabled={!scheduleDate}
            >
              {locale === "pt" ? "Confirmar Agendamento" : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold">
              {locale === "pt" ? "E-mails Enviados!" : "Emails Sent!"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {locale === "pt"
                ? "Links únicos foram gerados e enviados para cada contato da lista selecionada."
                : "Unique survey links have been generated and sent to each contact in the selected list."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailComposerTab;
