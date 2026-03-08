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
            <p>Utilizamos cookies organizados em três categorias: / We use cookies organized in three categories:</p>
            <p><strong>Essenciais (sempre ativos):</strong> Necessários para autenticação (Supabase Auth), preferência de idioma e estado da interface. Sem eles, o sistema não funciona. / <strong>Essential (always active):</strong> Required for authentication (Supabase Auth), language preference, and UI state. Without them, the system does not work.</p>
            <p><strong>Funcionais (opcionais):</strong> Salvam suas buscas recentes, status de onboarding e preferências de interface para melhorar sua experiência. / <strong>Functional (optional):</strong> Save your recent searches, onboarding status, and interface preferences to improve your experience.</p>
            <p><strong>Analíticos (opcionais):</strong> Nos ajudam a entender como a plataforma é utilizada — páginas visitadas, funcionalidades mais usadas e tempo de sessão. Dados anonimizados, sem compartilhamento com terceiros. / <strong>Analytical (optional):</strong> Help us understand how the platform is used — pages visited, most-used features, and session duration. Anonymized data, no third-party sharing.</p>
            <p>Você pode gerenciar suas preferências de cookies a qualquer momento através do banner exibido na primeira visita ou pelo link "Configurações de Cookies" no rodapé do site. / You can manage your cookie preferences at any time through the banner displayed on your first visit or via the "Cookie Settings" link in the site footer.</p>

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
