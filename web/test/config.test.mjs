import assert from "node:assert/strict";
import test from "node:test";

import { resolveDataDir } from "../server/config.mjs";

test("uses DATA_DIR when provided for production persistence", () => {
  assert.equal(resolveDataDir({ rootDir: "/app", env: { DATA_DIR: "/var/data/miemie" } }), "/var/data/miemie");
});

test("falls back to local web data directory", () => {
  assert.equal(resolveDataDir({ rootDir: "/app", env: {} }), "/app/data");
});
