import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root=dirname(dirname(fileURLToPath(import.meta.url)));await mkdir(join(root,'.next'),{recursive:true});const directory=await mkdtemp(join(root,'.next','account-unit-'));after(()=>rm(directory,{recursive:true,force:true}));const output=join(directory,'account.mjs');
await build({stdin:{contents:`export * from "./packages/ui/account/contracts";export * from "./packages/ui/account/policy";export { AccountSessions } from "./packages/ui/account/account-sessions";export { AccountSecurity, PersonalExport } from "./packages/ui/account/account-data";export { AccountDeletion } from "./packages/ui/account/account-delete";export { DashboardShell } from "./packages/ui/dashboard/dashboard-shell";`,resolveDir:root},outfile:output,bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic',logLevel:'silent'});
const ui=await import(pathToFileURL(output).href);const action=async()=>{throw Error('Static render cannot call a service')};const render=(C,props)=>renderToStaticMarkup(createElement(C,props));
const profile={id:'sample',name:'Sample',email:'sample@agency.example',emailVerified:true,image:null,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',twoFactorEnabled:true};const access={recentAuth:true,mfaVerified:true};const eligibility={eligible:true,retainedMemberships:0,requirement:'Resolve all retained memberships',scope:'Database identity scope'};
const session={id:'opaque-session',createdAt:'2026-11-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z',mfaVerifiedAt:null,ipAddress:null,userAgent:null};
test('session and UUID page cursors remain distinct route contracts',()=>{
 assert.equal(ui.sessionPageInput.safeParse({after:'opaque-session',limit:'100'}).success,true);
 assert.equal(ui.accountPageInput.safeParse({after:'opaque-session',limit:'100'}).success,false);
 for(const limit of ['0','101','01','1.5'])assert.equal(ui.sessionPageInput.safeParse({limit}).success,false);
 assert.equal(ui.sessionPageInput.safeParse({after:'x'.repeat(129)}).success,false);
});
test('revocation accepts a single session OR all, never all others or mixed bodies',()=>{
 assert.equal(ui.revokeSessionsInput.safeParse({sessionId:'opaque-session'}).success,true);assert.equal(ui.revokeSessionsInput.safeParse({all:true}).success,true);
 for(const body of [{all:false},{all:true,sessionId:'session'},{otherSessions:true},{}])assert.equal(ui.revokeSessionsInput.safeParse(body).success,false);
});
test('unknown-result revoke retry is limited to a known different current session',()=>{
 assert.equal(ui.canRetryRevoke({sessionId:'other'},'current'),true);assert.equal(ui.canRetryRevoke({sessionId:'current'},'current'),false);assert.equal(ui.canRetryRevoke({sessionId:'other'},null),false);assert.equal(ui.canRetryRevoke({all:true},'current'),false);
 assert.equal(ui.endsKnownSession({all:true},null),true);assert.equal(ui.endsKnownSession({sessionId:'current'},'current'),true);
});
test('deletion requires zero retained memberships plus recent auth AND MFA',()=>{
 assert.equal(ui.canDeleteAccount(access,eligibility),true);assert.equal(ui.canDeleteAccount(access,{...eligibility,retainedMemberships:1}),false);assert.equal(ui.canDeleteAccount(access,null),false);assert.equal(ui.canDeleteAccount({...access,mfaVerified:false},eligibility),false);assert.equal(ui.canDeleteAccount({...access,recentAuth:false},eligibility),false);
 assert.equal(ui.mfaRecovery({...profile,twoFactorEnabled:false}),'/setup-authenticator');assert.equal(ui.mfaRecovery(profile),'/two-factor');
});
test('deletion schema preserves current password and exact confirmation without version fields',()=>{
 const body={confirmEmail:'Sample@agency.example',password:' legacy password ',confirm:true};assert.deepEqual(ui.deleteAccountInput.parse(body),body);
 assert.equal(ui.deleteAccountInput.safeParse({...body,password:''}).success,false);assert.equal(ui.deleteAccountInput.safeParse({...body,password:'x'.repeat(1025)}).success,false);assert.equal(ui.deleteAccountInput.safeParse({...body,confirm:false}).success,false);assert.equal(ui.deleteAccountInput.safeParse({...body,expectedVersion:1}).success,false);
});
test('session list does not invent current badge, last-active, location or device recognition',()=>{
 const html=render(ui.AccountSessions,{profile,access,initialPage:{items:[session],nextCursor:null},currentSessionId:null,read:action,revoke:action});assert.ok(html.includes('current sign-in is not identified'));assert.ok(html.includes('Not recorded'));assert.ok(!html.includes('Last active'));assert.ok(!html.includes('London'));
});
test('blocked deletion renders retention scope and disabled credential entry',()=>{
 const html=render(ui.AccountDeletion,{profile,access,initialEligibility:{...eligibility,eligible:false,retainedMemberships:3},read:action,action,preview:true});assert.ok(html.includes('Blocked by retained memberships'));assert.ok(!html.includes('id="account-delete-password"'));assert.ok(html.includes('removed memberships'));assert.ok(!html.includes('Restore account'));
});
test('activity safely renders unknown event/details and retains the raw event',()=>{
 const html=render(ui.AccountSecurity,{profile,initialPage:{items:[{id:'event',event:'unknown.<script>',details:{text:'<script>alert(1)</script>'},createdAt:profile.createdAt}],nextCursor:null},read:action});assert.ok(html.includes('Account security event'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));
});
test('personal navigation works with no workspace and leaves workspace controls out',()=>{
 const html=render(ui.DashboardShell,{workspace:null,activeSection:'Account',personal:{name:profile.name,email:profile.email,section:'Overview'},children:'Account page'});assert.ok(html.includes('Account navigation'));assert.ok(html.includes('href="/account/sessions"'));assert.ok(!html.includes('href="/settings"'));assert.ok(!html.includes('Workspace access'));
 const member=render(ui.DashboardShell,{workspace:{id:'sample',name:'Sample workspace',timezone:'UTC',role:'member'},children:'Workspace'});assert.ok(member.includes('href="/account"'));
});
test('account UI never calls APIs, stores credentials or imports server routes',async()=>{
 for(const file of ['account-delete.tsx','account-sessions.tsx','account-data.tsx']){const text=await readFile(join(root,'packages/ui/account',file),'utf8');assert.doesNotMatch(text,/\bfetch\s*\(|localStorage|sessionStorage|from.*domain\//)}
 const text=await readFile(join(root,'packages/ui/account/account-delete.tsx'),'utf8');assert.ok(text.includes('setPassword("")'));assert.ok(!text.includes('JSON.stringify'));assert.ok(!text.includes('state.frozen'));
});
