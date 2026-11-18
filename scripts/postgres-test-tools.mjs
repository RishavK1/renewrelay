import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
export function postgresTool(command, args, { env, archivePath } = {}) {
  const container = process.env.RR_TEST_PG_CONTAINER;
  if (!container) return execFileSync(command, args, { env, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
  if (!/^renewrelay-[a-z0-9-]+$/.test(container)) throw new Error("Use an isolated RenewRelay test container");
  let input;
  const mapped = [...args];
  const fileIndex = mapped.indexOf("-f");
  if (command === "psql" && fileIndex >= 0) { input = readFileSync(mapped[fileIndex + 1]); mapped[fileIndex + 1] = "-"; }
  if (archivePath) for (let index = 0; index < mapped.length; index++) if (mapped[index] === archivePath) mapped[index] = "/tmp/" + archivePath.split("/").slice(-2).join("-");
  const options = ["exec", "-i", "-e", `PGUSER=${env.PGUSER}`, "-e", `PGPASSWORD=${env.PGPASSWORD}`, "-e", `PGDATABASE=${env.PGDATABASE}`, container, command, ...mapped];
  return execFileSync("docker", options, { input, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
}
