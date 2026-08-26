import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Mail, Palette, Users, Webhook } from "lucide-react";
import AnonymousLinkTab from "./AnonymousLinkTab";
import EmailComposerTab from "./EmailComposerTab";
import ContactListTab from "./ContactListTab";
import BrandingTab from "./BrandingTab";
import WebhookTab from "./WebhookTab";

const SUBTABS = ["link", "email", "contacts", "branding", "webhook"] as const;

const DistributionPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();
  const { subtab } = useParams<{ subtab?: string }>();
  const navigate = useNavigate();
  const activeTab = SUBTABS.includes(subtab as any) ? (subtab as (typeof SUBTABS)[number]) : "link";

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-lg font-semibold mb-6">
          {locale === "pt" ? "Distribuição" : "Distribution"}
        </h2>

        <Tabs
          value={activeTab}
          onValueChange={(v) => navigate(`/surveys/${surveyId}/distribute/${v}`, { replace: true })}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="link" className="gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              {locale === "pt" ? "Link Anônimo" : "Anonymous Link"}
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {locale === "pt" ? "E-mail" : "Email"}
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {locale === "pt" ? "Contatos" : "Contacts"}
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              {locale === "pt" ? "Identidade" : "Branding"}
            </TabsTrigger>
            <TabsTrigger value="webhook" className="gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              Webhook
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link">
            <AnonymousLinkTab surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="email">
            <EmailComposerTab surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="contacts">
            <ContactListTab surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="branding">
            <BrandingTab surveyId={surveyId} />
          </TabsContent>
          <TabsContent value="webhook">
            <WebhookTab surveyId={surveyId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DistributionPanel;
