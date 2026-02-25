import { useState } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, MessageCircle, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
  const { locale } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(locale === "pt" ? "Preencha todos os campos obrigatórios" : "Fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(locale === "pt" ? "Email inválido" : "Invalid email");
      return;
    }

    setSending(true);
    try {
      const resp = await supabase.functions.invoke("send-contact", {
        body: { name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() },
      });

      if (resp.error) throw resp.error;

      setSent(true);
      toast.success(locale === "pt" ? "Mensagem enviada com sucesso!" : "Message sent successfully!");
    } catch (err: any) {
      console.error("Contact error:", err);
      toast.error(locale === "pt" ? "Erro ao enviar. Tente novamente." : "Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const contactInfo = locale === "pt"
    ? [
        { icon: Mail, title: "Email", value: "contato@scholarai.com", href: "mailto:contato@scholarai.com" },
        { icon: MessageCircle, title: "Suporte", value: "suporte@scholarai.com", href: "mailto:suporte@scholarai.com" },
        { icon: MapPin, title: "Localização", value: "São Paulo, Brasil", href: null },
      ]
    : [
        { icon: Mail, title: "Email", value: "contact@scholarai.com", href: "mailto:contact@scholarai.com" },
        { icon: MessageCircle, title: "Support", value: "support@scholarai.com", href: "mailto:support@scholarai.com" },
        { icon: MapPin, title: "Location", value: "São Paulo, Brazil", href: null },
      ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">
              {locale === "pt" ? "Contato" : "Contact"}
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              {locale === "pt"
                ? "Tem alguma dúvida ou sugestão? Entre em contato conosco. Responderemos o mais rápido possível."
                : "Have a question or suggestion? Get in touch with us. We'll respond as soon as possible."}
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-5">
            {/* Contact info */}
            <div className="space-y-6 md:col-span-2">
              {contactInfo.map((info) => (
                <div key={info.title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <info.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{info.title}</h3>
                    {info.href ? (
                      <a href={info.href} className="text-sm text-primary hover:underline">{info.value}</a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{info.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="md:col-span-3">
              {sent ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 px-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-foreground">
                    {locale === "pt" ? "Mensagem enviada!" : "Message sent!"}
                  </h3>
                  <p className="text-muted-foreground">
                    {locale === "pt"
                      ? "Obrigado pelo contato. Responderemos em até 48 horas."
                      : "Thank you for reaching out. We'll respond within 48 hours."}
                  </p>
                  <Button variant="outline" className="mt-6" onClick={() => { setSent(false); setName(""); setEmail(""); setSubject(""); setMessage(""); }}>
                    {locale === "pt" ? "Enviar outra mensagem" : "Send another message"}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 md:p-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        {locale === "pt" ? "Nome *" : "Name *"}
                      </label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={locale === "pt" ? "Seu nome" : "Your name"} maxLength={100} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Email *
                      </label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={locale === "pt" ? "seu@email.com" : "your@email.com"} maxLength={255} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      {locale === "pt" ? "Assunto" : "Subject"}
                    </label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={locale === "pt" ? "Sobre o que deseja falar?" : "What would you like to discuss?"} maxLength={200} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      {locale === "pt" ? "Mensagem *" : "Message *"}
                    </label>
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={locale === "pt" ? "Escreva sua mensagem..." : "Write your message..."} rows={5} maxLength={2000} />
                  </div>
                  <Button type="submit" disabled={sending} className="w-full">
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {locale === "pt" ? "Enviar mensagem" : "Send message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
