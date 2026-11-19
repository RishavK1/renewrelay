"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, UsersRound } from "lucide-react";
import type { ClientView, ContactView } from "./contracts";

function Status({ archived }: { archived: boolean }) { return <span className="rr-clients__status" data-archived={archived}>{archived ? "Archived" : "Active"}</span>; }

export function ClientsList({ clients, canWrite, onAdd, nextCursor, onLoadMore }: { clients: ClientView[]; canWrite: boolean; onAdd: () => void; nextCursor?: string | null; onLoadMore?: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  return <>
    <div className="rr-clients__heading"><div className="rr-dashboard__page-heading"><h1 ref={title} tabIndex={-1}>Clients</h1><p>The people and businesses your agency looks after.</p></div><button type="button" className="rr-dashboard__primary" onClick={onAdd} disabled={!canWrite}><Plus size={17} aria-hidden="true" />Add client</button></div>
    {!clients.length ? <section className="rr-dashboard__state rr-dashboard__state--compact"><span className="rr-dashboard__state-icon" aria-hidden="true"><UsersRound size={25} strokeWidth={1.5} /></span><h2>No clients yet</h2><p>Add your first client to start organising their contacts and renewal details.</p>{!canWrite && <p className="rr-dashboard__state-note">This workspace currently permits reading and exporting only.</p>}</section> : <div className="rr-clients__list-panel">
      <div className="rr-clients__list-label" aria-hidden="true"><span>Client name</span><span>Status</span></div>
      <ul className="rr-clients__list">{clients.map(client => <li key={client.id}><Link href={`/clients/${client.id}`}><span className="rr-clients__monogram" aria-hidden="true">{client.name.charAt(0).toUpperCase()}</span><span>{client.name}</span><ArrowRight size={16} aria-hidden="true" /></Link><Status archived={!!client.archivedAt} /></li>)}</ul>
      {nextCursor && <button className="rr-clients__text-action" type="button" disabled={!onLoadMore} onClick={onLoadMore}>Load more clients</button>}
    </div>}
  </>;
}

export function ClientDetails({ client, contacts, canWrite, onRename, onAddContact, onEditContact, nextCursor, onLoadMore }: { client: ClientView; contacts: ContactView[]; canWrite: boolean; onRename: () => void; onAddContact: () => void; onEditContact: (contact: ContactView) => void; nextCursor?: string | null; onLoadMore?: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [client.id]);
  return <>
    <Link className="rr-clients__back" href="/clients"><ArrowLeft size={16} aria-hidden="true" />All clients</Link>
    <div className="rr-clients__heading"><div className="rr-dashboard__page-heading"><Status archived={!!client.archivedAt} /><h1 ref={title} tabIndex={-1}>{client.name}</h1><p>Contacts and renewal details, kept together.</p></div><button className="rr-clients__outline-action" type="button" disabled={!canWrite || !!client.archivedAt} onClick={onRename}>Edit client name</button></div>
    {client.archivedAt && <p className="rr-clients__information">This client is archived. Renaming and adding new contacts are unavailable.</p>}
    <div className="rr-clients__detail-grid">
      <section className="rr-clients__section" aria-labelledby="client-contacts-title"><div className="rr-clients__section-heading"><div><h2 id="client-contacts-title">Contacts</h2><p>Keep the right people within reach.</p></div><button className="rr-clients__outline-action" type="button" disabled={!canWrite || !!client.archivedAt} onClick={onAddContact}><Plus size={16} aria-hidden="true" />Add contact</button></div>
        {!contacts.length ? <div className="rr-clients__section-empty"><h3>No contacts added</h3><p>Add a name and email address. Saving a contact doesn’t send an email.</p></div> : <ul className="rr-clients__contacts">{contacts.map(contact => <li key={contact.id}><div><strong>{contact.name}</strong><span className="rr-clients__email">{contact.email}</span>{contact.archivedAt && <Status archived />}</div><button type="button" className="rr-clients__text-action" disabled={!canWrite || !!contact.archivedAt} aria-label={`Edit contact ${contact.name}`} onClick={() => onEditContact(contact)}>Edit</button></li>)}</ul>}
        {nextCursor && <button type="button" className="rr-clients__text-action" disabled={!onLoadMore} onClick={onLoadMore}>Load more contacts</button>}
      </section>
      <section className="rr-clients__section rr-clients__renewals" aria-labelledby="client-renewals-title"><div className="rr-clients__section-heading"><div><h2 id="client-renewals-title">Renewals</h2><p>Services your agency manages.</p></div>{canWrite && !client.archivedAt && <Link className="rr-clients__outline-action" href={`/renewals/new?client=${encodeURIComponent(client.id)}`}><Plus size={16} aria-hidden="true" />Add renewal</Link>}</div><div className="rr-clients__section-empty"><h3>Track a service for this client</h3><p>Record its provider, dates and terms.</p><Link className="rr-clients__back" href={`/renewals?client=${encodeURIComponent(client.id)}`}>View this client’s renewals</Link></div></section>
    </div>
  </>;
}
