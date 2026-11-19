import ts from "typescript";
import { z } from "zod";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import vm from "node:vm";

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat().sort();
}
function walk(node, fn) { fn(node); ts.forEachChild(node, child => walk(child, fn)); }
const methods = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);
const inventory = [];
const sourceHashes = {};
for (const file of [...await files("apps/web/app/api"), ...await files("apps/web/app/d")].filter(p => p.endsWith("route.ts"))) {
  const text = await readFile(file, "utf8");
  sourceHashes[file] = createHash("sha256").update(text).digest("hex");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const bindings = { z };
  const declarations = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const name = statement.moduleSpecifier.text;
      if (!name.includes("contracts/") && !name.includes("domain/data-export") && !name.includes("domain/renewals/export")) continue;
      const path = name.startsWith("@renewrelay/") ? `packages/${name.slice(12)}.ts` : resolve(dirname(file), name + ".ts");
      const module = await import(pathToFileURL(resolve(path)).href);
      const imports = statement.importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports)) for (const binding of imports.elements) bindings[binding.name.text] = module[binding.propertyName?.text ?? binding.name.text];
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) declarations.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      declarations.set(declaration.name.text, declaration.initializer);
    }
  }
  function schema(node) {
    if (ts.isIdentifier(node) && !bindings[node.text] && declarations.has(node.text)) return schema(declarations.get(node.text));
    // Only repository-owned validator expressions run here, never request-supplied text.
    const code = ts.transpile(`(${node.getText(source)})`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
    const value = ts.isIdentifier(node) && bindings[node.text] ? bindings[node.text] : vm.runInNewContext(code, bindings, { timeout: 1000 });
    return { jsonSchema: z.toJSONSchema(value, { io: "input", unrepresentable: "any" }), validator: node.getText(source),
      semanticValidation: "Runtime Zod refinements and domain guards remain authoritative; see linked source." };
  }
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const method = declaration.name.getText(source);
      if (!methods.has(method)) continue;
      const path = "/" + dirname(file).replace("apps/web/app/", "").replace(/\[([^\]]+)\]/g, "{$1}");
      const entry = { method, path, source: file, authentication: path.includes("/auth/") ? "identity protocol" : path.includes("/webhooks/") ? "provider signature" : path.startsWith("/d") || path.includes("/decisions/") ? "request-scoped decision credential" : path.endsWith("/health") ? "public readiness" : "verified staff session; owner/admin MFA",
        authorization: "Server-side domain role and tenant guards; endpoint source is authoritative.",
        responses: { success: path.includes("/auth/") ? "Better Auth protocol" : path.includes("/webhooks/") ? "Empty provider acknowledgement" : path.includes(".csv") ? "text/csv" : path.startsWith("/d") ? "Redirect/private decision protocol" : "JSON data envelope",
          errors: "400 validation; 401 authentication; 403 permissions/origin/MFA; 404 unavailable resource; 409 stale version/idempotency; 410 expired; 413 size; 415 media type; 429 rate limit with Retry-After; 500/503 safe server failure. Protocol exceptions follow the linked identity, decision and webhook handler sources." } };
      const relative = path.replace(/^\/api\/v1\/workspaces\/\{wid\}/, "");
      entry.roles = !path.startsWith("/api/v1/workspaces/{wid}") ? []
        : /^\/(billing|ownership|workspace-deletion|timezone|data-lifecycle|renewal-alerts)(\/|$)/.test(relative) || relative === "/exports/data" ? ["owner"]
        : /^\/(members|invites|imports)(\/|$)/.test(relative) || relative === "/exports/renewals.csv" ? ["owner", "admin"] : ["owner", "admin", "member"];
      entry.pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map(match => ({ name: match[1], type: match[1].startsWith("...") ? "allowlisted identity action" : match[1] === "user" ? "opaque user ID" : match[1] === "token" ? "request credential" : "UUID" }));
      const init = declaration.initializer;
      const handler = ts.isCallExpression(init) ? declarations.get(init.arguments.at(-1).getText(source)) : undefined;
      if (!handler) throw new Error(`Unrecognized exported handler: ${file} ${method}`);
      walk(handler, node => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
        const name = node.expression.text;
        if (["write", "writeOptionalJson"].includes(name)) {
          entry.operation = node.arguments[1].text;
          entry.body = schema(node.arguments[2]);
          entry.body.optional = name === "writeOptionalJson";
          entry.headers = ["Origin", "Idempotency-Key", "Cookie"];
        } else if (name === "publicCommand") {
          entry.body = schema(node.arguments[1]); entry.headers = ["Origin", "Idempotency-Key"];
          if (path.includes("/session/")) entry.headers.push("Cookie", "X-CSRF-Token");
        } else if (name === "writeWithoutBody") {
          entry.operation = node.arguments[1].text; entry.body = { forbidden: true };
          entry.headers = ["Origin", "Idempotency-Key", "Cookie"];
        } else if (name === "query") entry.query = schema(node.arguments[1]);
        else if (name === "pagination") entry.query = { jsonSchema: { type: "object", properties: { limit: { type: "string", pattern: "^(100|[1-9][0-9]?)$" }, after: { type: "string", format: "uuid" } }, additionalProperties: false } };
        else if (name === "uploadCsv") { entry.body = { mediaType: "text/csv", maxBytes: 2097152, maxRows: 2000 }; entry.headers = ["Origin", "Cookie"]; }
      });
      if (path.includes("/auth/")) {
        const setName = method === "GET" ? "readPaths" : "writePaths";
        const set = declarations.get(setName);
        entry.allowlistedPaths = [...set.getText(source).matchAll(/"(\/api\/auth\/[^" ]+)"/g)].map(m => m[1]).sort();
        entry.headers = method === "POST" ? ["Origin", "Content-Type: application/json"] : [];
        entry.dynamicGet = "/api/auth/reset-password/{token}: 16–128 URL-safe characters";
        entry.contract = "Installed Better Auth 1.7.25 schema; allowlist and MFA adaptations in the linked route source. Listed paths are specific to this method; reset-link GET is the dynamic exception.";
      }
      inventory.push(entry);
    }
  }
}
for (const dir of ["packages/contracts", "packages/domain"]) for (const file of (await files(dir)).filter(f => f.endsWith(".ts"))) sourceHashes[file] = createHash("sha256").update(await readFile(file)).digest("hex");
const output = JSON.stringify({ format: "renewrelay-api-inventory-v1", description: "Machine-readable endpoint inventory with generated request JSON Schemas, protocol exceptions and source drift checks. Response envelopes are described, not exhaustive response field schemas. Runtime refinements are authoritative.", endpoints: inventory, sourceSha256: sourceHashes }, null, 2) + "\n";
const target = "packages/contracts/api-contract.json";
if (process.argv.includes("--write")) await writeFile(target, output);
else if (await readFile(target, "utf8") !== output) throw new Error("API contract drift: review changes and run npm run contracts:generate");
console.log(`API inventory verified: ${inventory.length} method/path entries`);
