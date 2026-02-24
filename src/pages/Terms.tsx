import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";

const Terms = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-3xl">
          <h1 className="mb-2 font-display text-4xl font-bold text-foreground">{t("terms.title")}</h1>
          <p className="mb-10 text-sm text-muted-foreground">{t("terms.lastUpdated")}: 24/02/2026</p>

          <div className="prose prose-sm max-w-none text-muted-foreground [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_p]:mb-4 [&_p]:leading-relaxed">
            <h2>1. Aceitação dos Termos / Acceptance of Terms</h2>
            <p>Ao utilizar o ScholarAI, você concorda com estes Termos de Serviço. Se não concordar, não utilize a plataforma. / By using ScholarAI, you agree to these Terms of Service. If you do not agree, do not use the platform.</p>

            <h2>2. Descrição do Serviço / Service Description</h2>
            <p>O ScholarAI é uma plataforma de pesquisa acadêmica com inteligência artificial que oferece busca semântica, extração de dados e síntese de artigos científicos. / ScholarAI is an AI-powered academic research platform offering semantic search, data extraction, and scientific paper synthesis.</p>

            <h2>3. Uso Aceitável / Acceptable Use</h2>
            <p>Você concorda em utilizar o ScholarAI apenas para fins legítimos de pesquisa acadêmica e profissional. É proibido usar a plataforma para violar direitos autorais. / You agree to use ScholarAI only for legitimate academic and professional research purposes. Using the platform to violate copyrights is prohibited.</p>

            <h2>4. Propriedade Intelectual / Intellectual Property</h2>
            <p>O conteúdo dos artigos científicos pertence aos seus respectivos autores e editoras. O ScholarAI apenas facilita o acesso a metadados e resumos disponíveis publicamente. / Scientific paper content belongs to respective authors and publishers. ScholarAI only facilitates access to publicly available metadata and abstracts.</p>

            <h2>5. Limitação de Responsabilidade / Limitation of Liability</h2>
            <p>O ScholarAI é fornecido "como está". Não garantimos a precisão absoluta dos resultados gerados por IA. Sempre verifique os dados originais. / ScholarAI is provided "as is." We do not guarantee absolute accuracy of AI-generated results. Always verify original data.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
