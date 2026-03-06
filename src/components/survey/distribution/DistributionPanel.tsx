import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Mail, Users } from "lucide-react";
import AnonymousLinkTab from "./AnonymousLinkTab";
import EmailComposerTab from "./EmailComposerTab";
import ContactListTab from "./ContactListTab";

const DistributionPanel = ({ surveyId }: { surveyId: string }) => {
  const { locale } = useLanguage();

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-lg font-semibold mb-6">
          {locale === "pt" ? "Distribuição" : "Distribution"}
        </h2>

        <Tabs defaultValue="link" className="space-y-6">
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
        </Tabs>
      </div>
    </div>
  );
};

export default DistributionPanel;
