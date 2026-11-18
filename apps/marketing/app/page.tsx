import { ClosingCta } from "../components/marketing/closing-cta";
import { SiteFooter } from "../components/marketing/site-footer";
import { FaqSection } from "../components/marketing/faq-section";
import { PricingSection } from "../components/marketing/pricing-section";
import { AgencyControl } from "../components/marketing/agency-control";
import { ContextComparison } from "../components/marketing/context-comparison";
import { ProductPreview } from "../components/marketing/product-preview";
import { RenewalWorkflow } from "../components/marketing/renewal-workflow";
import { RenewalHero } from "../components/marketing/renewal-hero";
import { SiteHeader } from "../components/marketing/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <RenewalHero />
        <ProductPreview />
        <RenewalWorkflow />
        <ContextComparison />
        <AgencyControl />
        <PricingSection />
        <FaqSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
