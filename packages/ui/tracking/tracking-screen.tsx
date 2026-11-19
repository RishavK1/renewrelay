"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { AuthNotice } from "../auth/auth-fields";
import { useDecisionAction } from "../decisions/use-preview-action";
import { settingsInstant } from "../settings/policy";
import type { AlertRow, DeliveryRow, RelatedRenewal, TrackingData, TrackingRead, TrackingRelated } from "./contracts";
import { alertTitle, deliveryKind, deliveryStatus, trackingAccessFailure } from "./policy";
function Related({ record }: { record?: RelatedRenewal }) {
  return record ? <div className="rr-tracking__related"><strong>{record.service}</strong>{record.clientName && <span>{record.clientName}</span>}<Link className="rr-clients__outline-action" href={`/renewals/${encodeURIComponent(record.cycleId)}`}>Open renewal</Link></div> : <p className="rr-tracking__muted">Related renewal details aren’t loaded. <Link href="/renewals">Browse renewals</Link></p>;
}
function Alert({ row, related }: { row: AlertRow; related?: RelatedRenewal }) {
  return <li><div className="rr-tracking__row-title"><h3>{alertTitle(row.event)}</h3><span className="rr-tracking__badge">Recorded event</span></div><p className="rr-tracking__time">Recorded {settingsInstant(row.createdAt)}</p><Related record={related} /><details className="rr-tracking__details"><summary>Recorded references</summary><dl><div><dt>Event</dt><dd>{row.event}</dd></div><div><dt>Renewal reference</dt><dd>{row.entityId}</dd></div><div><dt>Alert reference</dt><dd>{row.id}</dd></div></dl></details></li>;
}
function Delivery({ row, related }: { row: DeliveryRow; related?: RelatedRenewal }) {
  const status = deliveryStatus(row.status);
  return <li><div className="rr-tracking__row-title"><h3>{deliveryKind(row.kind)}</h3><span className="rr-tracking__badge" data-tone={status.tone}>{status.label}</span></div><p className="rr-tracking__meaning">{status.description}</p><dl className="rr-tracking__metadata"><div><dt>Scheduled attempt</dt><dd>{settingsInstant(row.runAt)}</dd></div><div><dt>Attempts recorded</dt><dd>{row.attempts}</dd></div></dl><Related record={related} /><details className="rr-tracking__details"><summary>Delivery details and diagnostic</summary><dl><div><dt>Recorded status</dt><dd>{row.status}</dd></div><div><dt>Recorded kind</dt><dd>{row.kind}</dd></div><div><dt>Last reported diagnostic</dt><dd>{row.lastError ?? "No diagnostic recorded"}</dd></div><div><dt>Request reference</dt><dd>{row.requestId}</dd></div><div><dt>Delivery reference</dt><dd>{row.id}</dd></div></dl><p>A diagnostic can remain after a later status change. It is not a separate confirmation of the current delivery outcome.</p></details></li>;
}
export function TrackingScreen({ initial, related, read, pageSize = 25, onLoadSamples }: { initial: TrackingData; related: TrackingRelated; read: TrackingRead; pageSize?: number; onLoadSamples?: () => void }) {
  const [data, setData] = useState(initial), [pageNumber, setPageNumber] = useState(1), [updated, setUpdated] = useState(false);
  const state = useDecisionAction(read, () => false);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const alerts = data.mode === "alerts", blocked = !!state.failure && trackingAccessFailure(state.failure.code);
  const title = alerts ? "Renewal alerts" : "Delivery tracking";
  async function load(next: boolean) {
    setUpdated(false);
    const result = await state.run({ limit: pageSize, ...(next && data.page.nextCursor ? { after: data.page.nextCursor } : {}) });
    if (result?.status === "success" && result.mode === data.mode) { setData(result); setPageNumber(n => next ? n + 1 : 1); setUpdated(true); listHeading.current?.focus({ preventScroll: true }); }
  }
  return <div className="rr-tracking" aria-busy={state.pending}>
    <div className="rr-dashboard__page-heading"><h1>{title}</h1><p>{alerts ? "Review recorded overdue activations and provider blockers." : "Follow the recorded sending status of client decision messages."}</p></div>
    <nav className="rr-tracking__toolbar" aria-label={`${title} actions`}><button className="rr-clients__outline-action" disabled={state.pending || state.remaining > 0} onClick={() => load(false)}>{state.pending ? "Loading records…" : "Refresh from first page"}</button><Link className="rr-clients__outline-action" href="/renewals">All renewals</Link>{alerts && <Link className="rr-clients__outline-action" href="/deliveries">Delivery tracking</Link>}</nav>
    <section className="rr-tracking__scope"><h2>{alerts ? "A record of what happened" : "Sending and decisions are separate"}</h2><p>{alerts ? "These owner-only events record when a renewal was activated overdue or a provider blocker was reported. A condition may already be resolved. Open the renewal to check its current state." : "This list covers client decision deliveries, not workspace invitations, internal reminders or every outgoing email. Sent, delivered and client approval are different states. Scheduled attempt time may reflect a retry."}</p></section>
    {state.failure && <AuthNotice error>{blocked ? state.failure.message : "Records couldn’t refresh. The previous page remains below; its status may have changed."}{state.remaining > 0 && <span className="rr-tracking__retry" role="status">Try again in {state.remaining} seconds.</span>}{state.failure.code === "unauthenticated" && <Link className="rr-auth__notice-link" href="/login">Sign in again</Link>}{state.failure.code === "email_unverified" && <Link className="rr-auth__notice-link" href="/check-email">Verify email</Link>}{state.failure.code === "mfa_required" && <Link className="rr-auth__notice-link" href="/two-factor">Verify your sign-in</Link>}{state.failure.code === "workspace_deleting" && <Link className="rr-auth__notice-link" href="/settings/deletion">Review workspace recovery</Link>}</AuthNotice>}
    {!blocked && <section aria-labelledby="tracking-list-heading"><div className="rr-tracking__list-heading"><h2 ref={listHeading} tabIndex={-1} id="tracking-list-heading">{alerts ? "Recorded alerts" : "Decision deliveries"}</h2><p>Page {pageNumber} · {data.page.items.length} {data.page.items.length === 1 ? "record" : "records"} returned</p></div><p className="rr-tracking__order">Records follow the server’s reference order, not newest-first order. Counts describe this page only.</p>{data.page.items.length ? <ul className="rr-tracking__list">{data.mode === "alerts" ? data.page.items.map(row => <Alert key={row.id} row={row} related={related.cycles[row.entityId]} />) : data.page.items.map(row => <Delivery key={row.id} row={row} related={related.requests[row.requestId]} />)}</ul> : <div className="rr-tracking__empty"><h3>{alerts ? "No alert records returned" : "No delivery records returned"}</h3><p>{alerts ? "This does not establish that every renewal is on track. Check the renewal list for current work." : "Create a decision request from a renewal when appropriate. Delivery records do not include all email types."}</p>{onLoadSamples && <button className="rr-dashboard__primary" onClick={onLoadSamples}>Load sample activity</button>}</div>}<div className="rr-tracking__pagination">{data.page.nextCursor && <button className="rr-dashboard__primary" disabled={state.pending || state.remaining > 0} onClick={() => load(true)}>Load next page</button>}{pageNumber > 1 && <button className="rr-clients__outline-action" disabled={state.pending || state.remaining > 0} onClick={() => load(false)}>Back to first page</button>}</div></section>}
    {updated && <p className="rr-tracking__feedback" role="status">{title} updated.</p>}
  </div>;
}
