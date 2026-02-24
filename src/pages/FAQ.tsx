import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqData = {
  pt: [
    { q: "O ScholarAI é gratuito?", a: "Sim! Oferecemos um plano gratuito com buscas limitadas. Para uso mais intenso, temos planos pagos com mais funcionalidades." },
    { q: "Quais bases de dados o ScholarAI busca?", a: "Buscamos simultaneamente no Semantic Scholar (200M+ papers) e PubMed/NCBI, cobrindo praticamente toda a literatura científica publicada." },
    { q: "A IA pode alucinar ou inventar informações?", a: "Nosso sistema usa arquitetura RAG (Retrieval-Augmented Generation), o que significa que a IA sempre cita diretamente os artigos. Cada afirmação é rastreável até o paper original." },
    { q: "Posso usar para minha dissertação ou tese?", a: "Absolutamente! O ScholarAI é ideal para revisões de literatura acadêmica. Oferecemos exportação em BibTeX e RIS para facilitar a citação." },
    { q: "Como funciona a busca semântica?", a: "Em vez de buscar por palavras-chave exatas, nossa IA entende o significado da sua pergunta e encontra artigos relevantes mesmo que usem terminologia diferente." },
    { q: "Meus dados são seguros?", a: "Sim. Utilizamos criptografia de ponta a ponta e não compartilhamos seus dados de pesquisa com terceiros. Consulte nossa Política de Privacidade para mais detalhes." },
  ],
  en: [
    { q: "Is ScholarAI free?", a: "Yes! We offer a free plan with limited searches. For heavier use, we have paid plans with more features." },
    { q: "Which databases does ScholarAI search?", a: "We simultaneously search Semantic Scholar (200M+ papers) and PubMed/NCBI, covering virtually all published scientific literature." },
    { q: "Can the AI hallucinate or make up information?", a: "Our system uses RAG (Retrieval-Augmented Generation) architecture, meaning the AI always directly cites papers. Every claim is traceable to the original paper." },
    { q: "Can I use it for my dissertation or thesis?", a: "Absolutely! ScholarAI is ideal for academic literature reviews. We offer BibTeX and RIS export to facilitate citation." },
    { q: "How does semantic search work?", a: "Instead of searching for exact keywords, our AI understands the meaning of your question and finds relevant papers even if they use different terminology." },
    { q: "Is my data secure?", a: "Yes. We use end-to-end encryption and never share your research data with third parties. See our Privacy Policy for more details." },
  ],
};

const FAQ = () => {
  const { t, locale } = useLanguage();
  const faqs = faqData[locale];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-16 md:py-24">
        <div className="container mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl">{t("faq.title")}</h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">{t("faq.subtitle")}</p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="rounded-xl border border-border bg-card px-6">
                <AccordionTrigger className="text-left font-display font-semibold text-foreground hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;
