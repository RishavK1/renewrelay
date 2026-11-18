# RenewRelay — section 6 pricing plan

18 November 2026. Pricing planning only; no pricing UI or checkout changes made.
The separate authorized navbar sticky fix is implemented locally. No testing,
commit, push or deployment is included.

## Recommendation and sequence

Pricing should follow section 5. Visitors have seen the product, workflow,
coordination problem and operational controls; the next question is what access
costs and how to try it. Use pricing next, then plan FAQ and final/footer content
separately. Do not extend the feature sequence with another similar grid.

One Team subscription is consistent with the product specification. Display the
trial as a way to evaluate that product, not a permanent Free subscription or a
second paid tier. No artificial three-tier table, “most popular” claim, yearly
switch or discount without an approved offering and matching provider setup.

## Exact proposed copy

Heading: **One plan. A clearer renewal process.**
Lead: **Start with a 14-day trial. Move to Team when you’re ready to manage more
renewals with your agency.**

Trial panel:
- Title: **Try RenewRelay**
- Emphasis: **14 days**
- Support: **10 active renewal items · 3 team seats**
- Explanation: **Bring in a few client renewals and try the full decision-to-outcome workflow.**
- Action: **Start your free trial**

Team card:
- Title: **Team**
- Price recommendation for review: **₹1,499 / workspace / month**
- Support: **100 active renewal items · 5 team seats, including the owner**
- Explanation: **One shared workspace for your agency’s renewal work.**
- Action: **Start your free trial**, consistent with the public signup journey.
  Selecting a public card does not create or charge a subscription.

The ₹1,499 India pilot price is recorded in the original product spec and README
as a proposal. It has not been commercially approved by the current conversation
or verified against a real Razorpay plan. Do not publish it as final. Use it only
as labeled proposed content in design review. Tax inclusion/exclusion, invoicing,
merchant details and final provider amount require a business decision before
public pricing. Do not add “+ GST” or “tax included” by assumption.

## Layout and hierarchy

Within the existing 1200px container, center the heading and lead (max 660px).
Start pricing content 40px below. Two unequal columns in a 1000px centered group:
~36% quiet trial explanation, ~64% dominant Team card; 32px gap. This is one
paid plan with its evaluation path, not two equally competing packages.

```text
               One plan. A clearer renewal process.
                 Start with a 14-day trial…

  Try RenewRelay                 ┌─────────────────────────────────┐
  14 days                        │ Team                            │
  10 items / 3 seats             │ ₹1,499 / workspace / month*     │
  Try the actual workflow.       │ 100 items / 5 seats             │
                                 │ Renewal and decision features   │
  [Start your free trial]        │ [Start your free trial]         │
                                 └─────────────────────────────────┘
                *Amount and tax wording pending approval
```

The starred proposal note belongs in design review, not the final public card.
Once approved, replace it with the correct tax/renewal disclosure. Do not ship
“pending approval” as real commercial copy.

Use Snow section background, white Team card, fine border, 24px corners and a
quiet Sky accent along the card's top. Trial explanation has no competing heavy
border/shadow. H2 44px desktop / 30px mobile; price 48px / 40px, not larger than
the product's hero. Body/feature rows 16px, details 14px. Preserve Manrope, Lucide
checks, standard pills, focus and hover. Desktop padding 96–112px, mobile 64px.

## Feature list grounded in the product

Group the list into five readable rows, with at most one short explanation each:

1. Client and service renewal records — dates, terms and assigned teammates.
2. Private client decisions — approval, decline or question with verification.
3. Reminders and follow-up visibility — including outstanding or failed delivery context.
4. Recorded outcomes and invoice tracking — provider work and invoice status stay separate.
5. Import, export and decision history — preserve context and let agencies take their data out.

Do not say invoice collection, registrar auto-renewal, unlimited seats, unlimited
active records, AI, lifetime access, custom branded sending or live integrations.
The agency's subscription payment is separate from client service quotes.

## Terms immediately below the plan

Use short readable text rows rather than hiding essential limits in tooltips:

- Seat limit includes the owner; pending invitations reserve seats.
- Trial access is time-limited. After expiry, reading/export remain; operational
  changes and outbound actions depend on current entitlement.
- Cancellation is scheduled at term end; paid access continues through the paid
  period. Do not imply an immediate cancellation/refund or guaranteed refund terms.
- Currency is INR and cadence is monthly, subject to final approved provider plan.
- Subscription activation follows server-confirmed payment evidence, not a success
  redirect. Checkout behavior belongs to the app, not marketing demo controls.

Public trial card may say “No card required” only after signup/checkout behavior
is verified for the actual release. It is a spec proposal, not a tested claim now.
Code grounding: packages/domain/billing/policy.ts (10/3, 100/5, read-only modes),
packages/domain/workspaces.ts (14-day trial) and billing/service.ts (at-term cancel).
No new provider tests were run for this plan. Existing release/provider gaps remain.

## Motion, hover and mobile

- Static pricing amounts; no count-up, pulsing price, countdown or fake scarcity.
- No hover-selected tier, background tracking the cursor or automatic expansion.
  Main card remains stable while button colors respond using shared variants.
- No slider or billing-period toggle: only one monthly price is proposed.
- No special library is needed for a card and feature list; use existing local
  primitives. The earlier Aceternity components already supply the page's expressive
  moments; pricing emphasizes an understandable purchase decision.
- Below 768px, stack trial explanation then Team card, with full-width actions,
  readable limits and tax text. Avoid a horizontal feature comparison table.
- Essential content is present immediately. Any optional one-time entrance is
  limited to a subtle opacity change; reduced motion is static.

## Implementation boundary

Pricing remains unbuilt until the user authorizes the next section. At that point,
connect the navbar Pricing item and hero See plans action to #pricing. Login and
signup remain explicitly inactive until their actual app destinations exist.
Do not create a Razorpay plan, charge, deploy or push as part of marketing work.
Before public launch, approve final amount/tax treatment and verify checkout,
cancellation and displayed terms against the actual merchant configuration.

The conversion aim is informed trial starts and eventual qualified upgrades,
not maximizing clicks through confusing plans. Evaluate comprehension of the
per-workspace price and included limits; no conversion increase is asserted.

## Subsequent implementation decision

The user agreed to this plan and authorized coding. ₹1,499/workspace/month is now
the agreed marketing amount, superseding the proposal-only status above. Tax
wording and a matching real provider plan are still unconfirmed. The local page
states that tax details will be supplied before a paid subscription; complete
that disclosure before release rather than treating this as tax-complete pricing.
The pricing section and in-page navigation are implemented. No subscription was
created, activated, charged or tested. FAQ/footer remain separate future work.
