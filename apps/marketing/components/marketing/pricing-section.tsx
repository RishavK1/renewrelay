import { Check, Clock3, Users, Layers3 } from "lucide-react";
import { PreviewAction } from "../ui/preview-action";
import { teamFeatures, teamOffer } from "./pricing-content";

export function PricingSection() {
  const price = new Intl.NumberFormat("en-IN", { style: "currency", currency: teamOffer.currency, maximumFractionDigits: 0 }).format(teamOffer.monthlyPriceMinor / 100);

  return (
    <section id="pricing" className="pricing-section section-anchor" aria-labelledby="pricing-title">
      <div className="page-container">
        <div className="section-heading section-heading--centered">
          <h2 id="pricing-title">One plan. A clearer renewal process.</h2>
          <p>Start with a 14-day trial. Move to Team when you’re ready to manage more renewals with your agency.</p>
        </div>
        <div className="pricing-layout">
          <aside className="trial-summary" aria-labelledby="trial-title">
            <span className="trial-summary__icon" aria-hidden="true"><Clock3 size={24} strokeWidth={1.8} /></span>
            <h3 id="trial-title">Try RenewRelay</h3>
            <p className="trial-duration"><strong>{teamOffer.trial.days}</strong> days</p>
            <p className="trial-summary__description">Bring in a few client renewals and try the full decision-to-outcome workflow.</p>
            <ul className="trial-limits">
              <li><Layers3 size={17} aria-hidden="true" /><span>{teamOffer.trial.activeItems} active renewal items</span></li>
              <li><Users size={17} aria-hidden="true" /><span>{teamOffer.trial.seats} team seats</span></li>
            </ul>
            <PreviewAction variant="secondary">Start your free trial</PreviewAction>
            <p className="trial-summary__note">A trial of the product, with room to get started.</p>
          </aside>
          <article className="team-plan" aria-labelledby="team-plan-title">
            <div className="team-plan__header"><h3 id="team-plan-title">{teamOffer.name}</h3><span>For your agency</span></div>
            <p className="team-plan__description">One shared workspace for your agency’s renewal work.</p>
            <div className="team-plan__price"><strong>{price}</strong><span>per workspace<br />per month</span></div>
            <p className="team-plan__billing-note">Billed monthly in INR.</p>
            <div className="team-plan__limits">
              <p><Layers3 size={18} aria-hidden="true" /><strong>{teamOffer.activeItems}</strong> active renewal items</p>
              <p><Users size={18} aria-hidden="true" /><strong>{teamOffer.seats}</strong> team seats, including the owner</p>
            </div>
            <PreviewAction className="team-plan__action">Start your free trial</PreviewAction>
            <p className="team-plan__trial-note">{teamOffer.trial.days} days to try · {teamOffer.trial.activeItems} items · {teamOffer.trial.seats} seats</p>
            <div className="team-plan__features">
              <h4>Included in Team</h4>
              <ul>{teamFeatures.map(feature => <li key={feature.title}><span className="feature-check" aria-hidden="true"><Check size={16} strokeWidth={2} /></span><div><strong>{feature.title}</strong><p>{feature.detail}</p></div></li>)}</ul>
            </div>
            <p className="team-plan__tax-note">Tax details will be provided before any paid subscription.</p>
          </article>
        </div>
        <div className="pricing-terms" aria-label="Subscription details">
          <div><h3>Room for your team</h3><p>Seat limits include the owner. Pending invitations reserve a seat until accepted, revoked or expired.</p></div>
          <div><h3>Your records stay accessible</h3><p>After the trial ends, you can still read and export your records. Continue operational work with an active subscription.</p></div>
          <div><h3>Cancel at term end</h3><p>Schedule cancellation and keep paid access through the end of your current paid period.</p></div>
        </div>
      </div>
    </section>
  );
}
