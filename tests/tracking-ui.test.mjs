import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
await mkdir(join(process.cwd(),'.next'),{recursive:true});
const root=process.cwd(),dir=await mkdtemp(join(root,'.next','tracking-unit-'));
after(()=>rm(dir,{recursive:true,force:true}));
const file=join(dir,'tracking.mjs');
await build({stdin:{contents:'export * from "./packages/ui/tracking/policy";export * from "./packages/ui/tracking/contracts";export {TrackingScreen} from "./packages/ui/tracking/tracking-screen";export {DashboardShell} from "./packages/ui/dashboard/dashboard-shell";',resolveDir:root},outfile:file,bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',logLevel:'silent'});
const ui=await import(pathToFileURL(file).href),related={cycles:{},requests:{}},read=async()=>{throw Error('Unexpected static read')};
const render=(component,props)=>renderToStaticMarkup(createElement(component,props));
const alert={id:'a1000000-0000-4000-8000-000000000001',entityId:'40000000-0000-4000-8000-000000000001',event:'cycle.blocked',createdAt:'2026-11-18T09:00:00Z'};
const delivery={id:'d1000000-0000-4000-8000-000000000001',requestId:'50000000-0000-4000-8000-000000000001',kind:'invitation',status:'uncertain',attempts:1,runAt:'2026-11-18T09:00:00Z',lastError:'reconciliation_required'};
function screen(mode,items,refs=related){return render(ui.TrackingScreen,{initial:{mode,page:{items,nextCursor:null}},related:refs,read});}
test('tracking uses shared strict UUID cursor and bounded limit contract',()=>{
 assert.equal(ui.trackingPageInput.parse({}).limit ?? 25,25);
 assert.equal(ui.trackingPageInput.safeParse({after:alert.id,limit:'100'}).success,true);
 for(const query of [{after:'opaque'},{limit:101},{limit:0},{status:'failed'},{kind:'reminder'}])assert.equal(ui.trackingPageInput.safeParse(query).success,false);
});
test('alerts remain owner-only while delivery reads include every staff role',()=>{
 for(const role of ['owner','admin','member']){assert.equal(ui.canReadTracking('alerts',role),role==='owner');assert.equal(ui.canReadTracking('deliveries',role),true);}
});
test('historical alerts never imply a current unresolved blocker or invented dismiss action',()=>{
 const html=screen('alerts',[alert]);assert.ok(html.includes('Provider blocker reported'));assert.ok(html.includes('condition may already be resolved'));assert.ok(html.includes('not newest-first'));assert.ok(!html.includes('Dismiss'));assert.ok(html.includes('Browse renewals'));assert.ok(!html.includes('href="/renewals/'+alert.entityId+'"'));
});
test('only separately supplied related records produce a direct renewal link',()=>{
 const html=screen('deliveries',[delivery],{cycles:{},requests:{[delivery.requestId]:{cycleId:alert.entityId,service:'Hosting',clientName:'Sample studio'}}});assert.ok(html.includes('href="/renewals/'+alert.entityId+'"'));assert.ok(html.includes('Hosting'));assert.ok(!html.includes('href="/renewals/'+delivery.requestId+'"'));
});
test('transport status meaning preserves sent/delivered/decision/uncertain boundaries',()=>{
 assert.ok(ui.deliveryStatus('sent').description.includes('has not been confirmed'));
 assert.ok(ui.deliveryStatus('delivered').description.includes('does not confirm reading'));
 assert.ok(ui.deliveryStatus('uncertain').description.includes('Do not assume failure'));
 assert.equal(ui.deliveryStatus('new-status').tone,'neutral');
 for(const status of ['pending','leased','sent','delivered','failed','uncertain','suppressed','delayed','canceled'])assert.notEqual(ui.deliveryStatus(status).label,'Other recorded status');
});
test('delivery projection does not fabricate recipients, provider ids, send controls or a timeline',()=>{
 const html=screen('deliveries',[delivery]);for(const label of ['Scheduled attempt','Attempts recorded','Last reported diagnostic','not a separate confirmation'])assert.ok(html.includes(label));
 for(const label of ['Retry delivery','Resend now','Delivered at','Recipient email','Provider message ID'])assert.ok(!html.includes(label));
});
test('unknown statuses and diagnostics render safely without silently becoming success',()=>{
 const html=screen('deliveries',[{...delivery,status:'<script>new</script>',kind:'<script>kind</script>',lastError:'<img src=x onerror=alert(1)>'}]);assert.ok(html.includes('Other recorded status'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
});
test('workspace navigation follows backend read roles for both sidebar and drawer',()=>{
 for(const role of ['owner','admin','member']){const html=render(ui.DashboardShell,{workspace:{id:'w',name:'Sample',timezone:'UTC',role},activeSection:'Deliveries',children:'Content'});assert.equal(html.includes('href="/alerts"'),role==='owner');assert.ok(html.includes('href="/deliveries"'));}
});
test('tracking browser components have no API mutations, provider tokens or persistence',async()=>{
 const source=(await Promise.all(['packages/ui/tracking/tracking-screen.tsx','apps/marketing/components/tracking/tracking-preview.tsx'].map(path=>readFile(join(root,path),'utf8')))).join('\n');
 for(const fragment of ['fetch(','localStorage','@server','messageCiphertext','providerId','recipientEmail'])assert.ok(!source.includes(fragment));
 assert.equal(ui.trackingAccessFailure('forbidden'),true);assert.equal(ui.trackingAccessFailure('workspace_deleting'),true);assert.equal(ui.trackingAccessFailure('temporarily_unavailable'),false);
});
