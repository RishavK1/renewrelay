import type { TrackingMode } from "./contracts";
export function canReadTracking(mode: TrackingMode, role: "owner" | "admin" | "member") { return mode === "deliveries" || role === "owner"; }
export function alertTitle(event: string) { return event === "cycle.blocked" ? "Provider blocker reported" : event === "cycle.activated_overdue" ? "Renewal activated overdue" : "Recorded renewal alert"; }
export function deliveryKind(kind: string) { return ({ invitation: "Decision request", reminder: "Reminder", resend: "Resent request", reissue: "Reissued link" } as Record<string, string>)[kind] ?? "Other delivery kind"; }
export function deliveryStatus(status: string): { label: string; tone: "neutral" | "success" | "warning" | "danger"; description: string } {
  switch (status) {
    case "pending": return { label: "Pending", tone: "neutral", description: "Waiting for a delivery attempt. The scheduled time is not a delivery confirmation." };
    case "leased": return { label: "Processing", tone: "neutral", description: "A worker has claimed this delivery. The result is not yet confirmed." };
    case "sent": return { label: "Sent", tone: "neutral", description: "Sending was reported. Delivery to the recipient has not been confirmed by this status." };
    case "delivered": return { label: "Delivered", tone: "success", description: "Delivery was reported by the provider. This does not confirm reading or a client decision." };
    case "failed": return { label: "Failed", tone: "danger", description: "A delivery failure was recorded. Review the related request before deciding what to do next." };
    case "uncertain": return { label: "Uncertain", tone: "warning", description: "The sending result needs reconciliation. Do not assume failure or send a duplicate from this screen." };
    case "suppressed": return { label: "Suppressed", tone: "danger", description: "Delivery was suppressed. Review the reported diagnostic and the related request." };
    case "delayed": return { label: "Delayed", tone: "warning", description: "The provider reported a delay. This is not a confirmed delivery or a client response." };
    case "canceled": return { label: "Canceled", tone: "neutral", description: "This delivery was canceled. Its status does not establish the renewal outcome." };
    default: return { label: "Other recorded status", tone: "neutral", description: "This status is not recognized here. Review its recorded value; no outcome is inferred." };
  }
}
export function trackingAccessFailure(code: string) { return ["unauthenticated", "email_unverified", "mfa_required", "forbidden", "not_found", "workspace_deleting"].includes(code); }
