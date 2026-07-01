import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "./app.mjs";
import { resolveDataDir } from "./config.mjs";
import { FamilyStore } from "./familyStore.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const store = new FamilyStore({ dataDir: resolveDataDir({ rootDir }) });
await store.ready;

const server = createServer({
  store,
  publicDir: path.join(rootDir, "public"),
  familyCode: process.env.FAMILY_CODE ?? ""
});

server.listen(port, host, () => {
  console.log(`miemie PWA is running at http://${host}:${port}`);
});
