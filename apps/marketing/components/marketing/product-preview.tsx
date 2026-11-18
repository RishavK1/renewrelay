import { ArrowDown } from "lucide-react";
import { Tabs } from "../ui/tabs";
import { ClientDecisionPreview, RenewalOverview, TeamFollowThroughPreview } from "./renewal-illustrations";

export function ProductPreview() {
  return (
    <section id="product" className="product-section section-anchor" aria-labelledby="product-title">
      <div className="page-container">
        <div className="section-heading section-heading--centered">
          <h2 id="product-title">One workspace for every client renewal.</h2>
          <p>See what needs attention, what your clients have decided, and what your team needs to do next.</p>
        </div>
        <div className="product-showcase">
          <Tabs label="Explore RenewRelay" tabs={[
            { title: "Renewal overview", value: "overview", content: <RenewalOverview />, caption: "Dates, responsibility and outstanding work, together." },
            { title: "Client view", value: "client", content: <ClientDecisionPreview />, caption: "Give clients the details they need to make a decision." },
            { title: "Team follow-through", value: "team", content: <TeamFollowThroughPreview />, caption: "A client response is the start of the next action." },
          ]} />
        </div>
        <p className="example-disclosure">Illustrative product preview · Sample data</p>
        <a className="section-text-link" href="#how-it-works">See how a renewal moves forward <ArrowDown size={17} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
