import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";

import DiscoverPreviewSection from "@/components/landing/DiscoverPreviewSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import WorkflowSection from "@/components/landing/WorkflowSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />

        <DiscoverPreviewSection />
        <FeaturesSection />
        <WorkflowSection />
        <ComparisonSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
