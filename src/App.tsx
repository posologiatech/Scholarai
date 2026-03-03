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
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Blog from "./pages/Blog";
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
import WorkspaceDetail from "./pages/WorkspaceDetail";
import ProtectedRoute from "./components/app/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route path="/solutions/*" element={<Solutions />} />
              <Route path="/use-cases" element={<UseCases />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
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
