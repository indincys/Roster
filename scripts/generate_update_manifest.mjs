#!/usr/bin/env node
/* global console, process */

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const desktopPackagePath = path.join(repoRoot, "apps", "desktop", "package.json");
const releaseDir = path.join(repoRoot, "apps", "desktop", "release");
const outputPath = process.env.OUTPUT_PATH
  ? path.resolve(process.env.OUTPUT_PATH)
  : path.join(releaseDir, "latest.json");
const downloadUrlPrefix = (process.env.DOWNLOAD_URL_PREFIX ?? "").replace(/\/+$/, "");
const releaseNotes = process.env.RELEASE_NOTES ?? "Local release manifest generated from packaged artifacts.";

function usage() {
  return [
    "Usage:",
    "  DOWNLOAD_URL_PREFIX=https://example.com/releases/v0.1.0 node scripts/generate_update_manifest.mjs",
    "",
    "Environment:",
    "  DOWNLOAD_URL_PREFIX  Base URL used for artifact download URLs.",
    "  RELEASE_NOTES        Optional release notes text.",
    "  OUTPUT_PATH          Optional manifest output path. Defaults to apps/desktop/release/latest.json."
  ].join("\n");
}

async function fileDigest(filePath, algorithm) {
  const hash = createHash(algorithm);
  hash.update(await readFile(filePath));
  return hash.digest(algorithm === "sha512" ? "base64" : "hex");
}

function inferArtifactKind(fileName) {
  if (fileName.endsWith(".dmg")) {
    return "dmg";
  }
  if (fileName.endsWith(".zip")) {
    return "zip";
  }
  if (fileName.endsWith(".exe")) {
    return "nsis";
  }
  if (fileName.toLowerCase().includes("portable")) {
    return "portable";
  }
  return "file";
}

function inferPlatform(fileName) {
  if (fileName.includes("-mac") || fileName.endsWith(".dmg") || (fileName.endsWith(".zip") && fileName.includes("arm64"))) {
    return "darwin";
  }
  if (fileName.endsWith(".exe")) {
    return "win32";
  }
  return "unknown";
}

function inferArch(fileName) {
  if (fileName.includes("arm64")) {
    return "arm64";
  }
  if (fileName.includes("x64")) {
    return "x64";
  }
  return "universal";
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return;
  }
  if (!downloadUrlPrefix) {
    throw new Error("DOWNLOAD_URL_PREFIX is required so update clients receive absolute artifact URLs.\n\n" + usage());
  }

  const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));
  const version = String(desktopPackage.version);
  const fileNames = await readdir(releaseDir);
  const artifactNames = fileNames
    .filter((name) => !name.endsWith(".blockmap"))
    .filter((name) => [".dmg", ".zip", ".exe"].includes(path.extname(name).toLowerCase()))
    .sort();
  if (artifactNames.length === 0) {
    throw new Error(`No release artifacts found in ${releaseDir}. Run npm --workspace @roster/desktop run dist first.`);
  }

  const artifacts = [];
  for (const fileName of artifactNames) {
    const artifactPath = path.join(releaseDir, fileName);
    const artifactStat = await stat(artifactPath);
    const blockmapPath = path.join(releaseDir, `${fileName}.blockmap`);
    const hasBlockmap = await stat(blockmapPath).then(() => true, () => false);
    artifacts.push({
      name: fileName,
      kind: inferArtifactKind(fileName),
      platform: inferPlatform(fileName),
      arch: inferArch(fileName),
      sizeBytes: artifactStat.size,
      sha256: await fileDigest(artifactPath, "sha256"),
      sha512: await fileDigest(artifactPath, "sha512"),
      url: `${downloadUrlPrefix}/${encodeURIComponent(fileName)}`,
      blockmapUrl: hasBlockmap ? `${downloadUrlPrefix}/${encodeURIComponent(`${fileName}.blockmap`)}` : null
    });
  }

  const preferred = artifacts.find((artifact) => artifact.platform === "darwin" && artifact.kind === "dmg") ?? artifacts[0];
  const manifest = {
    schemaVersion: 1,
    version,
    latestVersion: version,
    releaseDate: new Date().toISOString(),
    releaseNotes,
    downloadUrl: preferred.url,
    artifacts
  };

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, artifactCount: artifacts.length, downloadUrl: manifest.downloadUrl }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
