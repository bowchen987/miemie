import path from "node:path";

export function resolveDataDir({ rootDir, env = process.env }) {
  return env.DATA_DIR || path.join(rootDir, "data");
}
