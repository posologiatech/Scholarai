import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";

const Privacy = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-3xl">
          <h1 className="mb-2 font-display text-4xl font-bold text-foreground">{t("privacy.title")}</h1>
          <p className="mb-10 text-sm text-muted-foreground">{t("privacy.lastUpdated")}: 24/02/2026</p>

          <div className="prose prose-sm max-w-none text-muted-foreground [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_p]:mb-4 [&_p]:leading-relaxed">
            <h2>1. Dados Coletados / Data Collected</h2>
            <p>Coletamos dados necessários para o funcionamento do serviço: email, nome, histórico de buscas e preferências de uso. / We collect data necessary for service operation: email, name, search history, and usage preferences.</p>

            <h2>2. Uso dos Dados / Data Usage</h2>
            <p>Seus dados são usados exclusivamente para fornecer e melhorar o serviço. Não vendemos ou compartilhamos dados pessoais com terceiros para fins de marketing. / Your data is used exclusively to provide and improve the service. We do not sell or share personal data with third parties for marketing purposes.</p>

            <h2>3. Segurança / Security</h2>
            <p>Utilizamos criptografia e práticas de segurança padrão da indústria para proteger seus dados. Seus dados de pesquisa são armazenados de forma segura e acessíveis apenas por você. / We use encryption and industry-standard security practices to protect your data. Your research data is stored securely and accessible only by you.</p>

            <h2>4. Cookies</h2>
            <p>Utilizamos cookies essenciais para manter sua sessão e preferências de idioma. Não utilizamos cookies de rastreamento de terceiros. / We use essential cookies to maintain your session and language preferences. We do not use third-party tracking cookies.</p>

            <h2>5. Seus Direitos / Your Rights</h2>
            <p>Você pode solicitar a exclusão completa dos seus dados a qualquer momento. Para isso, entre em contato conosco. Em conformidade com a LGPD e GDPR. / You may request complete deletion of your data at any time. Contact us to do so. In compliance with LGPD and GDPR.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
