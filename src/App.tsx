import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Solutions from "./pages/Solutions";
import UseCases from "./pages/UseCases";
import UseCaseDetail from "./pages/UseCaseDetail";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Docs from "./pages/Docs";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import SearchResults from "./pages/SearchResults";
import Library from "./pages/Library";
import Extraction from "./pages/Extraction";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import PaperReport from "./pages/PaperReport";
import ReferenceCheck from "./pages/ReferenceCheck";
import Illustrations from "./pages/Illustrations";
import SystematicReview from "./pages/SystematicReview";
import SystematicReviewList from "./pages/SystematicReviewList";
import DataMind from "./pages/DataMind";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import Workspaces from "./pages/Workspaces";
import WritingAssistant from "./pages/WritingAssistant";
import MetaAnalysis from "./pages/MetaAnalysis";
import LiteratureAlerts from "./pages/LiteratureAlerts";
import RiskOfBias from "./pages/RiskOfBias";
import WorkspaceDetail from "./pages/WorkspaceDetail";
import DataMindDashboards from "./pages/DataMindDashboards";
import DataMindDashboardView from "./pages/DataMindDashboardView";
import SharedDashboard from "./pages/SharedDashboard";
import DataMindPipelines from "./pages/DataMindPipelines";
import ProtectedRoute from "./components/app/ProtectedRoute";
import CookieBanner from "./components/app/CookieBanner";
import NotFound from "./pages/NotFound";
import Surveys from "./pages/Surveys";
import SurveyBuilder from "./pages/SurveyBuilder";
import SurveyRespond from "./pages/SurveyRespond";
import Pricing from "./pages/Pricing";
import MyPlan from "./pages/MyPlan";
import AccountPrivacy from "./pages/AccountPrivacy";
import Support from "./pages/Support";
import SupportTicketDetail from "./pages/SupportTicketDetail";
import ParticipantPrivacy from "./pages/ParticipantPrivacy";
import ConsentRevoke from "./pages/ConsentRevoke";
import DataSUSPage from "./pages/DataSUS";
import Changelog from "./pages/Changelog";
import CoauthorshipNetwork from "./pages/CoauthorshipNetwork";
import ResearchProjects from "./pages/ResearchProjects";
import ResearchProjectDetail from "./pages/ResearchProjectDetail";
import ResearchFunding from "./pages/ResearchFunding";
import AdvisorDashboard from "./pages/AdvisorDashboard";
import OrcidCallback from "./pages/OrcidCallback";
import PublicProject from "./pages/PublicProject";
import OracleAgent from "./components/app/OracleAgent";
import AdminRoadmapDialog from "./components/app/AdminRoadmapDialog";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CookieBanner />
            <OracleAgent />
            <AdminRoadmapDialog />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route path="/solutions/*" element={<Solutions />} />
              <Route path="/use-cases" element={<UseCases />} />
              <Route path="/use-cases/:slug" element={<UseCaseDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/participant-privacy" element={<ParticipantPrivacy />} />
              <Route path="/my-plan" element={<ProtectedRoute><MyPlan /></ProtectedRoute>} />
              <Route path="/account/privacy" element={<ProtectedRoute><AccountPrivacy /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/support/:id" element={<ProtectedRoute><SupportTicketDetail /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
              <Route path="/extraction" element={<ProtectedRoute><Extraction /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/paper/:id" element={<ProtectedRoute><PaperReport /></ProtectedRoute>} />
              <Route path="/reference-check" element={<ProtectedRoute><ReferenceCheck /></ProtectedRoute>} />
              <Route path="/illustrations" element={<ProtectedRoute><Illustrations /></ProtectedRoute>} />
              <Route path="/systematic-review" element={<ProtectedRoute><SystematicReviewList /></ProtectedRoute>} />
              <Route path="/systematic-review/new" element={<ProtectedRoute><SystematicReview /></ProtectedRoute>} />
              <Route path="/datamind" element={<ProtectedRoute><DataMind /></ProtectedRoute>} />
              <Route path="/datamind/:id" element={<ProtectedRoute><DataMind /></ProtectedRoute>} />
              <Route path="/knowledge-graph" element={<ProtectedRoute><KnowledgeGraph /></ProtectedRoute>} />
              <Route path="/workspaces" element={<ProtectedRoute><Workspaces /></ProtectedRoute>} />
              <Route path="/writing" element={<ProtectedRoute><WritingAssistant /></ProtectedRoute>} />
              <Route path="/workspaces/:id" element={<ProtectedRoute><WorkspaceDetail /></ProtectedRoute>} />
              <Route path="/meta-analysis" element={<ProtectedRoute><MetaAnalysis /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><LiteratureAlerts /></ProtectedRoute>} />
              <Route path="/risk-of-bias" element={<ProtectedRoute><RiskOfBias /></ProtectedRoute>} />
              <Route path="/datamind/dashboards" element={<ProtectedRoute><DataMindDashboards /></ProtectedRoute>} />
              <Route path="/datamind/dashboard/:id" element={<ProtectedRoute><DataMindDashboardView /></ProtectedRoute>} />
              <Route path="/shared/dashboard/:token" element={<SharedDashboard />} />
              <Route path="/datamind/pipelines" element={<ProtectedRoute><DataMindPipelines /></ProtectedRoute>} />
              <Route path="/surveys" element={<ProtectedRoute><Surveys /></ProtectedRoute>} />
              <Route path="/surveys/:id/build" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/consent" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/visits" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/participants" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/compliance" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/flow" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/team" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/distribute" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/results" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/surveys/:id/preview" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
              <Route path="/survey/respond/:token" element={<SurveyRespond />} />
              <Route path="/consent/revoke/:signatureId" element={<ConsentRevoke />} />
              <Route path="/datasus" element={<ProtectedRoute><DataSUSPage /></ProtectedRoute>} />
              <Route path="/coauthorship" element={<ProtectedRoute><CoauthorshipNetwork /></ProtectedRoute>} />
              <Route path="/changelog" element={<ProtectedRoute><Changelog /></ProtectedRoute>} />
              <Route path="/research" element={<ProtectedRoute><ResearchProjects /></ProtectedRoute>} />
              <Route path="/research/funding" element={<ProtectedRoute><ResearchFunding /></ProtectedRoute>} />
              <Route path="/research/advisor" element={<ProtectedRoute><AdvisorDashboard /></ProtectedRoute>} />
              <Route path="/research/:id" element={<ProtectedRoute><ResearchProjectDetail /></ProtectedRoute>} />
              <Route path="/orcid/callback" element={<ProtectedRoute><OrcidCallback /></ProtectedRoute>} />
              <Route path="/p/:slug" element={<PublicProject />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
