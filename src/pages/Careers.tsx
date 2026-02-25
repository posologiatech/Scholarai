import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { MapPin, Briefcase, Clock, Heart, Zap, Globe, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const Careers = () => {
  const { locale } = useLanguage();

  const perks = locale === "pt"
    ? [
        { icon: Globe, title: "100% Remoto", desc: "Trabalhe de qualquer lugar do mundo" },
        { icon: Clock, title: "Horário Flexível", desc: "Organize seu tempo como preferir" },
        { icon: GraduationCap, title: "Aprendizado Contínuo", desc: "Budget anual para cursos e conferências" },
        { icon: Heart, title: "Saúde & Bem-estar", desc: "Plano de saúde e auxílio bem-estar" },
      ]
    : [
        { icon: Globe, title: "Fully Remote", desc: "Work from anywhere in the world" },
        { icon: Clock, title: "Flexible Hours", desc: "Organize your time as you prefer" },
        { icon: GraduationCap, title: "Continuous Learning", desc: "Annual budget for courses and conferences" },
        { icon: Heart, title: "Health & Wellness", desc: "Health plan and wellness benefits" },
      ];

  const positions = locale === "pt"
    ? [
        { title: "Engenheiro(a) de IA Senior", team: "Engenharia", location: "Remoto", type: "Tempo integral" },
        { title: "Desenvolvedor(a) Full-Stack", team: "Engenharia", location: "Remoto", type: "Tempo integral" },
        { title: "Designer de Produto", team: "Design", location: "Remoto", type: "Tempo integral" },
        { title: "Cientista de Dados", team: "IA & ML", location: "Remoto", type: "Tempo integral" },
        { title: "Especialista em Customer Success", team: "Operações", location: "Remoto", type: "Tempo integral" },
      ]
    : [
        { title: "Senior AI Engineer", team: "Engineering", location: "Remote", type: "Full-time" },
        { title: "Full-Stack Developer", team: "Engineering", location: "Remote", type: "Full-time" },
        { title: "Product Designer", team: "Design", location: "Remote", type: "Full-time" },
        { title: "Data Scientist", team: "AI & ML", location: "Remote", type: "Full-time" },
        { title: "Customer Success Specialist", team: "Operations", location: "Remote", type: "Full-time" },
      ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          {/* Hero */}
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">
              {locale === "pt" ? "Carreiras" : "Careers"}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {locale === "pt"
                ? "Junte-se a nós na missão de democratizar o acesso à pesquisa científica. Estamos construindo o futuro da descoberta acadêmica com inteligência artificial."
                : "Join us in the mission to democratize access to scientific research. We're building the future of academic discovery with artificial intelligence."}
            </p>
          </div>

          {/* Perks */}
          <div className="mb-16">
            <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground">
              {locale === "pt" ? "Por que trabalhar conosco?" : "Why work with us?"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {perks.map((perk) => (
                <div key={perk.title} className="rounded-2xl border border-border bg-card p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <perk.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-1 font-display font-semibold text-foreground">{perk.title}</h3>
                  <p className="text-sm text-muted-foreground">{perk.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Open positions */}
          <div>
            <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground">
              {locale === "pt" ? "Vagas Abertas" : "Open Positions"}
            </h2>
            <div className="space-y-3">
              {positions.map((pos) => (
                <div
                  key={pos.title}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{pos.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {pos.team}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {pos.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {pos.type}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    {locale === "pt" ? "Candidatar-se" : "Apply"}
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-muted/50 p-8 text-center">
              <p className="text-muted-foreground">
                {locale === "pt"
                  ? "Não encontrou a vaga ideal? Envie seu currículo para "
                  : "Didn't find the right role? Send your resume to "}
                <a href="mailto:careers@scholarai.com" className="font-medium text-primary hover:underline">
                  careers@scholarai.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Careers;
