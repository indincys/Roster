#!/usr/bin/env node

import { rebuild } from "@electron/rebuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

await rebuild({
  buildPath: repoRoot,
  projectRootPath: repoRoot,
  electronVersion: "33.4.11",
  onlyModules: ["better-sqlite3"],
  force: true
});

