import { build } from "esbuild";
await build({ entryPoints: { worker: "apps/worker/main.ts", web: "apps/web/server/start.ts" }, outdir: "dist", outExtension: { ".js": ".mjs" },
  platform: "node", target: "node22", format: "esm", bundle: true, packages: "external", sourcemap: false });
