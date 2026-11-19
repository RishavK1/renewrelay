"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ClientView, ContactView } from "../../../../packages/ui/clients/contracts";
import type { RenewalDetailRecord } from "../../../../packages/ui/renewals/contracts";
import { organizationSamples } from "../renewals/organization-fixtures";
import type { PreviewHistoryRow } from "../../../../packages/ui/renewals/organization-contracts";
import { followThroughSamples } from "../renewals/follow-through-fixtures";
import { refreshPreviewRecord, sampleRenewals } from "../renewals/renewal-fixtures";
import type { DecisionPreviewRecord } from "../../../../packages/ui/decisions/contracts";

import type { DeliveryRow } from "../../../../packages/ui/tracking/contracts";

type Store = { trackingDeliveries: DeliveryRow[]; loadTrackingSamples: () => void; revokedDecisionIds: string[]; revokeDecisionLinks: (ids: string[]) => void; history: PreviewHistoryRow[]; deliveryFailedRequestIds: string[]; appendHistory: (event: { entityId: string; event: string; details: unknown; actorId?: string | null }) => void; loadOrganizationSamples: () => void; clients: ClientView[]; contacts: ContactView[]; renewals: RenewalDetailRecord[]; decisions: DecisionPreviewRecord[]; saveDecision: (record: DecisionPreviewRecord) => void; loadDecisionSamples: () => void; loadFollowThroughSamples: () => void; saveRenewal: (renewal: RenewalDetailRecord) => void; loadRenewals: (clientId?: string) => void; saveClient: (client: ClientView) => void; saveContact: (contact: ContactView) => void; loadSamples: () => void; clear: () => void };
const Context = createContext<Store | null>(null);
const samples: ClientView[] = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Acme Studio", version: 1, archivedAt: null },
  { id: "10000000-0000-4000-8000-000000000002", name: "Harbor & Co.", version: 1, archivedAt: null },
  { id: "10000000-0000-4000-8000-000000000003", name: "Fieldwork Design", version: 2, archivedAt: "2026-11-01T00:00:00.000Z" },
];

export function ClientPreviewProvider({ children }: { children: ReactNode }) {
  const [trackingDeliveries, setTrackingDeliveries] = useState<DeliveryRow[]>([]);
  const [revokedDecisionIds, setRevokedDecisionIds] = useState<string[]>([]);
  const [history, setHistory] = useState<PreviewHistoryRow[]>([]);
  const [deliveryFailedRequestIds, setDeliveryFailedRequestIds] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientView[]>([]);
  const [contacts, setContacts] = useState<ContactView[]>([]);
  const [renewals, setRenewals] = useState<RenewalDetailRecord[]>([]);
  const [decisions, setDecisions] = useState<DecisionPreviewRecord[]>([]);
  return <Context.Provider value={{ trackingDeliveries, loadTrackingSamples: () => {
      const sample = organizationSamples(samples[0]!.id);
      setClients(samples.map(row => ({ ...row }))); setRenewals(sample.renewals); setDecisions(sample.decisions);
      setContacts([{ id: "20000000-0000-4000-8000-000000000001", clientId: samples[0]!.id, name: "Alex Morgan", email: "alex@acme.example", version: 1, archivedAt: null }]);
      setHistory([...sample.history, ...sample.renewals.slice(0, 4).map((row, i) => ({ id: `a1000000-0000-4000-8000-00000000000${i + 1}`, entityId: row.cycle.id, event: i % 2 ? "cycle.blocked" : "cycle.activated_overdue", actorId: "preview-owner", createdAt: "2026-11-18T09:00:00Z", details: {} }))]);
      const request = sample.decisions[0];
      setTrackingDeliveries(request ? ["pending", "sent", "failed", "uncertain", "delivered", "suppressed", "delayed", "canceled", "leased"].map((status, i) => ({ id: `d1000000-0000-4000-8000-00000000000${i + 1}`, requestId: request.id, kind: i % 2 ? "reminder" : "invitation", status, attempts: status === "pending" ? 0 : 1, runAt: "2026-11-18T09:00:00Z", lastError: status === "failed" ? "provider_rejected" : status === "uncertain" ? "reconciliation_required" : null })) : []);
      setDeliveryFailedRequestIds(sample.deliveryFailedRequestIds); setRevokedDecisionIds([]);
    }, revokedDecisionIds, revokeDecisionLinks: ids => setRevokedDecisionIds(previous => [...new Set([...previous, ...ids])]), clients, contacts, renewals, decisions, history, deliveryFailedRequestIds,
    appendHistory: event => setHistory(previous => [...previous, { ...event, actorId: event.actorId === undefined ? "preview-owner" : event.actorId, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]),
    loadOrganizationSamples: () => {
      const sample = organizationSamples(samples[0]!.id);
      setClients(samples.map(row => ({ ...row })));
      setContacts([{ id: "20000000-0000-4000-8000-000000000001", clientId: samples[0]!.id, name: "Alex Morgan", email: "alex@acme.example", version: 1, archivedAt: null }]);
      setRenewals(sample.renewals); setDecisions(sample.decisions); setHistory(sample.history); setDeliveryFailedRequestIds(sample.deliveryFailedRequestIds); setRevokedDecisionIds([]); setTrackingDeliveries([]);
    },
    saveDecision: record => setDecisions(previous => previous.some(row => row.id === record.id) ? previous.map(row => row.id === record.id ? record : row) : [...previous.map(row => row.cycleId === record.cycleId ? { ...row, superseded: true } : row), record]),
    saveRenewal: renewal => setRenewals(previous => previous.some(row => row.cycle.id === renewal.cycle.id) ? previous.map(row => row.cycle.id === renewal.cycle.id ? renewal : row) : [...previous, renewal]),
    loadRenewals: clientId => { const client = clients.find(row => row.id === clientId && !row.archivedAt) ?? clients.find(row => !row.archivedAt) ?? samples[0]!; if (!clients.some(row => row.id === client.id)) setClients(previous => [...previous, client]); setRenewals(sampleRenewals(client.id)); setDecisions([]); setHistory([]); setDeliveryFailedRequestIds([]); setRevokedDecisionIds([]); setTrackingDeliveries([]); },
    saveClient: client => setClients(previous => previous.some(row => row.id === client.id) ? previous.map(row => row.id === client.id ? client : row) : [...previous, client]),
    saveContact: contact => {
      const before = contacts.find(row => row.id === contact.id);
      if (before && (before.email !== contact.email || !before.archivedAt && contact.archivedAt)) {
        const affected = decisions.filter(row => row.contactId === contact.id && !row.superseded && renewals.some(renewal => renewal.cycle.id === row.cycleId && !renewal.cycle.closedAt));
        const ids = new Set(affected.map(row => row.cycleId));
        if (affected.length) setHistory(previous => [...previous, ...affected.map(request => ({ id: crypto.randomUUID(), entityId: request.cycleId, event: "decision.recipient_revoked", actorId: "preview-owner", createdAt: new Date().toISOString(), details: { requestId: request.id, contactId: contact.id } }))]);
        setDecisions(previous => previous.map(row => ids.has(row.cycleId) ? { ...row, superseded: true } : row));
        setRenewals(previous => previous.map(row => ids.has(row.cycle.id) ? refreshPreviewRecord({ ...row, cycle: { ...row.cycle, state: "open", intendedAction: null, nextActionOn: row.cycle.respondBy ?? row.cycle.noticeBy ?? row.cycle.expiryOn, version: row.cycle.version + 1 } }) : row));
      }
      setContacts(previous => previous.some(row => row.id === contact.id) ? previous.map(row => row.id === contact.id ? contact : row) : [...previous, contact]);
    },
    loadFollowThroughSamples: () => {
      const sample = followThroughSamples(samples[0]!.id);
      setClients(samples.map(row => ({ ...row })));
      setContacts([{ id: "20000000-0000-4000-8000-000000000001", clientId: samples[0]!.id, name: "Alex Morgan", email: "alex@acme.example", version: 1, archivedAt: null }]);
      setRenewals(sample.renewals); setDecisions(sample.decisions); setHistory([]); setDeliveryFailedRequestIds([]); setRevokedDecisionIds([]); setTrackingDeliveries([]);
    },
    loadDecisionSamples: () => {
      setClients(samples.map(row => ({ ...row })));
      setContacts([{ id: "20000000-0000-4000-8000-000000000001", clientId: samples[0]!.id, name: "Alex Morgan", email: "alex@acme.example", version: 1, archivedAt: null }]);
      setRenewals(sampleRenewals(samples[0]!.id)); setDecisions([]); setHistory([]); setDeliveryFailedRequestIds([]); setRevokedDecisionIds([]); setTrackingDeliveries([]);
    },
    loadSamples: () => {
      setClients(samples.map(row => ({ ...row })));
      setRenewals([]);
      setDecisions([]); setHistory([]); setDeliveryFailedRequestIds([]); setRevokedDecisionIds([]); setTrackingDeliveries([]);
      setContacts([{ id: "20000000-0000-4000-8000-000000000001", clientId: samples[0]!.id, name: "Alex Morgan", email: "alex@acme.example", version: 1, archivedAt: null }]);
    }, clear: () => { setClients([]); setContacts([]); setRenewals([]); setDecisions([]); setHistory([]); setDeliveryFailedRequestIds([]); setRevokedDecisionIds([]); setTrackingDeliveries([]); },
  }}>{children}</Context.Provider>;
}
export function useClientPreview() {
  const store = useContext(Context);
  if (!store) throw new Error("Client UI previews require ClientPreviewProvider.");
  return store;
}
