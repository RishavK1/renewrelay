import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(root, ".next"), { recursive: true });
const directory = await mkdtemp(join(root, ".next", "import-unit-"));
after(() => rm(directory, { recursive: true, force: true }));
const output = join(directory, "imports.mjs");
await build({ stdin: { contents: `export * from "./packages/ui/imports/contracts";export * from "./packages/ui/imports/policy";export { ImportFlow } from "./packages/ui/imports/import-flow";export { parsePreviewCsv } from "./apps/marketing/components/imports/parse-preview-csv";export * from "./apps/marketing/components/imports/import-preview-engine";export { parseImport, csvColumns, maxCsvBytes } from "./packages/domain/renewals/imports";export { commitImport } from "./packages/contracts/renewals";`, resolveDir: root }, outfile: output, bundle: true, packages: "external", platform: "node", format: "esm", jsx: "automatic", logLevel: "silent" });
const ui = await import(pathToFileURL(output).href);
const clientId = "10000000-0000-4000-8000-000000000001";
const row = [clientId, "owner", "Hosting", "Example Hosting", "2027-12-20", "2027-12-10", "2027-12-01", "agency", "true", "false", "INR", "120000", "0", "12 months", "yearly", "draft"];
const csv = (...rows) => ui.importColumns.join(",") + "\r\n" + rows.map(r => r.join(",")).join("\r\n");
const access = { role: "owner", writable: true, deleting: false };
const batch = { importId: clientId, version: 1, committed: false, canCommit: true, rows: 2, remainingSlots: 2, expiresAt: "2099-01-01T00:00:00Z", warnings: [], errors: [], totalErrors: 0 };
const action = async () => { throw new Error("Static render must not perform an action"); };
test("browser fixture parser and limits match backend template and parsing", () => {
 assert.deepEqual(ui.importColumns, ui.csvColumns); assert.equal(ui.importMaxBytes, ui.maxCsvBytes);
 const quoted = [...row]; quoted[2] = '"Hosting, managed"';
 const inputs = [csv(row), '\uFEFF'+csv(quoted), csv([...row.slice(0,12), "", ...row.slice(13)]), csv([...row.slice(0,4), "invalid", ...row.slice(5)]), csv(row)+"\r\nwrong,shape", csv([...row.slice(0,15), ""])];
 for (const input of inputs) assert.deepEqual(ui.parsePreviewCsv(input), ui.parseImport(input));
});
test("malformed, header-only, wrong-header and over-row-limit files fail parity", () => {
 for (const input of [ui.importColumns.join(","), csv(row).replace("clientId", "clientName"), csv(row)+'\r\n"unclosed', csv(...Array(2001).fill(row))]) {
  assert.throws(() => ui.parsePreviewCsv(input)); assert.throws(() => ui.parseImport(input));
 }
 assert.throws(() => ui.parsePreviewCsv('x'.repeat(ui.importMaxBytes+1)), /2 MiB/);
});
test("normalized duplicate warnings are client-scoped and never merge records", () => {
 const a=ui.parsePreviewCsv(csv(row)).records[0], b={...a,line:3,input:{...a.input,provider:'  EXAMPLE   Hosting ',service:'Ｈosting'}};
 assert.deepEqual(ui.duplicateImportLines([a,b],[]),[2,3]);
 assert.deepEqual(ui.duplicateImportLines([a],[{...a.input,clientId:'10000000-0000-4000-8000-000000000002'}]),[]);
});
test("overdue implicit mode is an error; explicit draft remains a warning", () => {
 const old=[...row]; old[4]='2000-12-20';old[5]='2000-12-10';old[6]='2000-12-01';old[15]='';
 const parsed=ui.parsePreviewCsv(csv(old));
 const check=records=>ui.inspectImportRows(records,new Set([clientId]),new Set(['owner']),[],'2026-11-19');
 assert.equal(check(parsed.records).errors[0].field,'mode');
 old[15]='draft';const explicit=check(ui.parsePreviewCsv(csv(old)).records);assert.equal(explicit.errors.length,0);assert.match(explicit.warnings[0].message,/draft/);
});
test("reference checks and writable manager boundaries match preview requirements", () => {
 const records=ui.parsePreviewCsv(csv(row)).records;
 assert.deepEqual(ui.inspectImportRows(records,new Set(),new Set(),[],'2026-11-19').errors.map(x=>x.field),['clientId','operatorId']);
 assert.equal(ui.canPreviewImport({...access,role:'member'}),false);assert.equal(ui.canPreviewImport({...access,role:'admin'}),true);
 assert.equal(ui.canReadImportTemplate({...access,writable:false}),true);assert.equal(ui.canPreviewImport({...access,writable:false}),false);assert.equal(ui.canReadImportTemplate({...access,deleting:true}),false);
});
test("commit eligibility distinguishes expiry, capacity and exact duplicate payload", () => {
 assert.equal(ui.canCommitImport(access,batch),true);
 assert.equal(ui.canCommitImport(access,{...batch,remainingSlots:1}),false);
 assert.equal(ui.canCommitImport(access,{...batch,expiresAt:'2026-01-01T00:00:00Z'}),false);
 assert.equal(ui.needsImportPreview('import_changed'),true);assert.equal(ui.needsImportPreview('import_expired'),true);
 assert.deepEqual(ui.commitImport.parse({expectedVersion:1}),{expectedVersion:1,confirmPossibleDuplicates:false});
 assert.equal(ui.commitImport.safeParse({expectedVersion:1,skipErrors:true}).success,false);
});
test("upload screen exposes UTF-8/template requirements and restricts readonly actions", () => {
 const html=renderToStaticMarkup(createElement(ui.ImportFlow,{workspaceName:'Sample',timezone:'Asia/Kolkata',access:{...access,writable:false},action,templateAction:action,preview:true}));
 assert.ok(html.includes('UTF-8 CSV'));assert.ok(html.includes('2,000'));assert.ok(html.includes('2 MiB'));assert.ok(html.includes('read-only'));
 assert.match(html,/<input[^>]+type="file"[^>]+disabled=""/);assert.ok(html.includes('Download template'));assert.ok(!html.includes('multipart'));
});
test("UI source has no API/server imports or unsafe HTML and preview route remains guarded", async()=>{
 const source=await readFile(join(root,'packages/ui/imports/import-flow.tsx'),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|dangerouslySetInnerHTML|from.*domain\//);
 const layout=await readFile(join(root,'apps/marketing/app/(auth-preview)/layout.tsx'),'utf8');assert.ok(layout.includes('process.env.NODE_ENV !== "development"'));
});

test("reference guidance renders supplied labels and required IDs as safe text",()=>{
 const html=renderToStaticMarkup(createElement(ui.ImportFlow,{workspaceName:'Sample',timezone:'Asia/Kolkata',access,action,templateAction:action,references:{complete:false,clients:[{id:clientId,label:'<script>client</script>'}],operators:[{id:'owner',label:'owner@sample.example'}]}}));
 assert.ok(html.includes('&lt;script&gt;client&lt;/script&gt;'));assert.ok(!html.includes('<script>client</script>'));assert.ok(html.includes(clientId));assert.ok(html.includes('references loaded so far'));
});
