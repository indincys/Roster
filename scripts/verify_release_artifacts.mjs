#!/usr/bin/env node
/* global URL, console, process */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const desktopPackagePath = path.join(repoRoot, "apps", "desktop", "package.json");
const builderConfigPath = path.join(repoRoot, "electron-builder.yml");
const releaseWorkflowPath = path.join(repoRoot, ".github", "workflows", "release.yml");
const releaseDir = path.join(repoRoot, "apps", "desktop", "release");
const appPath = path.join(releaseDir, "mac-arm64", "短视频运营工作台.app");
const plistPath = path.join(appPath, "Contents", "Info.plist");
const resourcesPath = path.join(appPath, "Contents", "Resources");
const requiredFfmpegPlatforms = ["darwin", "win32"];
const strictReleaseReady = process.argv.includes("--strict") || process.env.ROSTER_RELEASE_STRICT === "1";
const checks = [];
const warnings = [];

function readPath(object, pathParts) {
  let current = object;
  for (const part of pathParts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function targetEntries(config, platform) {
  return normalizeArray(readPath(config, [platform, "target"])).map((entry) =>
    typeof entry === "string" ? { target: entry, arch: [] } : entry && typeof entry === "object" ? entry : {}
  );
}

function targetHasArch(config, platform, target, arch) {
  return targetEntries(config, platform).some((entry) => {
    if (entry.target !== target) {
      return false;
    }
    const arches = normalizeArray(entry.arch);
    return arches.length === 0 || arches.includes(arch);
  });
}

function passOrFailEqual(name, actual, expected) {
  if (actual === expected) {
    pass(name, String(actual));
  } else {
    fail(name, `expected=${expected}, actual=${actual}`);
  }
}

function passOrFailAbsent(name, actual) {
  if (actual === undefined || actual === null || actual === "") {
    pass(name, "absent");
  } else {
    fail(name, `must be absent, actual=${actual}`);
  }
}

function isPlaceholderPublishValue(value) {
  return (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.includes("your-") ||
    value.includes("example")
  );
}

async function exists(filePath) {
  return stat(filePath).then(() => true, () => false);
}

async function fileSize(filePath) {
  return stat(filePath).then((value) => value.size);
}

async function fileDigest(filePath, algorithm) {
  const hash = createHash(algorithm);
  hash.update(await readFile(filePath));
  return hash.digest(algorithm === "sha512" ? "base64" : "hex");
}

async function listFiles(rootPath) {
  const entries = await readdir(rootPath, { recursive: true, withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const parentPath = entry.parentPath ?? entry.path ?? rootPath;
    files.push(path.join(parentPath, entry.name));
  }
  return files;
}

function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function pass(name, detail = null) {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

function warn(name, detail) {
  warnings.push({ name, detail });
}

async function requireFile(name, filePath) {
  if (await exists(filePath)) {
    pass(name, path.relative(repoRoot, filePath));
  } else {
    fail(name, `missing ${path.relative(repoRoot, filePath)}`);
  }
}

async function inspectFfmpegResources(rootPath, label) {
  const files = await listFiles(rootPath);
  const normalized = files.map((filePath) => {
    const relativePath = path.relative(rootPath, filePath);
    const basename = path.basename(filePath).toLowerCase();
    return { filePath, relativePath, basename };
  });
  const ffmpegBinaries = normalized.filter((file) => file.basename === "ffmpeg" || file.basename === "ffmpeg.exe");
  const ffprobeBinaries = normalized.filter((file) => file.basename === "ffprobe" || file.basename === "ffprobe.exe");
  const platformDirs = Array.from(
    new Set(
      normalized
        .map((file) => {
          const parts = file.relativePath.split(path.sep);
          return parts.length > 1 ? parts[0] : null;
        })
        .filter(Boolean)
    )
  ).sort();
  const nonExecutablePosix = [];
  for (const binary of [...ffmpegBinaries, ...ffprobeBinaries]) {
    if (binary.basename.endsWith(".exe")) {
      continue;
    }
    const mode = (await stat(binary.filePath)).mode;
    if ((mode & 0o111) === 0) {
      nonExecutablePosix.push(binary.relativePath);
    }
  }

  return {
    label,
    exists: await exists(rootPath),
    files: normalized.length,
    platformDirs,
    ffmpeg: ffmpegBinaries.map((file) => file.relativePath).sort(),
    ffprobe: ffprobeBinaries.map((file) => file.relativePath).sort(),
    missingPlatformTools: requiredFfmpegPlatforms.flatMap((platformName) => {
      const executableSuffix = platformName === "win32" ? ".exe" : "";
      return ["ffmpeg", "ffprobe"]
        .filter((toolName) =>
          !normalized.some(
            (file) =>
              file.relativePath === path.join(platformName, `${toolName}${executableSuffix}`) ||
              file.relativePath === path.posix.join(platformName, `${toolName}${executableSuffix}`)
          )
        )
        .map((toolName) => `${platformName}/${toolName}${executableSuffix}`);
    }),
    nonExecutablePosix
  };
}

function describeFfmpegInspection(inspection) {
  return [
    `${inspection.label}: files=${inspection.files}`,
    `platformDirs=${inspection.platformDirs.length ? inspection.platformDirs.join(",") : "none"}`,
    `ffmpeg=${inspection.ffmpeg.length ? inspection.ffmpeg.join(",") : "missing"}`,
    `ffprobe=${inspection.ffprobe.length ? inspection.ffprobe.join(",") : "missing"}`,
    inspection.missingPlatformTools.length ? `missingPlatformTools=${inspection.missingPlatformTools.join(",")}` : null,
    inspection.nonExecutablePosix.length ? `nonExecutable=${inspection.nonExecutablePosix.join(",")}` : null
  ]
    .filter(Boolean)
    .join("; ");
}

async function plistValue(key) {
  const { stdout } = await execFileAsync("plutil", ["-extract", key, "raw", "-o", "-", plistPath]);
  return stdout.trim();
}

async function commandStatus(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args);
    return { ok: true, output: `${stdout}${stderr}`.trim() };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`.trim()
    };
  }
}

async function main() {
  const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));
  const builderConfig = yaml.load(await readFile(builderConfigPath, "utf8"));
  if (!builderConfig || typeof builderConfig !== "object") {
    fail("electron-builder.yml", "must parse to an object");
  } else {
    pass("electron-builder.yml", "loaded");
  }
  const releaseWorkflow = yaml.load(await readFile(releaseWorkflowPath, "utf8").catch(() => ""));
  if (releaseWorkflow && typeof releaseWorkflow === "object") {
    pass("GitHub release workflow", ".github/workflows/release.yml");
  } else {
    fail("GitHub release workflow", "missing or invalid .github/workflows/release.yml");
  }
  const expectedBundleId = builderConfig?.appId;
  const expectedVersion = desktopPackage.version;
  const expectedCategory = builderConfig?.mac?.category;
  const expectedIcon = path.basename(builderConfig?.mac?.icon ?? "icon.icns");

  if (desktopPackage.build === undefined) {
    pass("desktop package builder config removed", "using repository electron-builder.yml");
  } else {
    fail("desktop package builder config removed", "apps/desktop/package.json must not contain build config");
  }
  passOrFailEqual("builder appId", builderConfig?.appId, "com.roster.shortvideo.workbench");
  passOrFailEqual("builder productName", builderConfig?.productName, "短视频运营工作台");
  passOrFailEqual("builder asar", builderConfig?.asar, true);
  if (
    normalizeArray(builderConfig?.asarUnpack).includes("**/*.node") &&
    normalizeArray(builderConfig?.asarUnpack).includes("resources/ffmpeg/**") &&
    normalizeArray(builderConfig?.asarUnpack).includes("node_modules/better-sqlite3/**")
  ) {
    pass("builder asarUnpack", normalizeArray(builderConfig?.asarUnpack).join(","));
  } else {
    fail("builder asarUnpack", "must include **/*.node, resources/ffmpeg/**, and node_modules/better-sqlite3/**");
  }
  if (targetHasArch(builderConfig, "mac", "dmg", "arm64") && targetHasArch(builderConfig, "mac", "zip", "arm64")) {
    pass("builder mac targets", "dmg arm64 + zip arm64");
  } else {
    fail("builder mac targets", "must include dmg arm64 and zip arm64");
  }
  passOrFailEqual("builder mac identity", builderConfig?.mac?.identity, "YourApp Self-Signed");
  passOrFailEqual("builder mac hardenedRuntime", builderConfig?.mac?.hardenedRuntime, false);
  passOrFailEqual("builder mac gatekeeperAssess", builderConfig?.mac?.gatekeeperAssess, false);
  passOrFailEqual("builder mac notarize", builderConfig?.mac?.notarize, false);
  if (targetHasArch(builderConfig, "win", "nsis", "x64")) {
    pass("builder win target", "nsis x64");
  } else {
    fail("builder win target", "must include nsis x64");
  }
  const winTargetNames = targetEntries(builderConfig, "win").map((entry) => entry.target);
  if (!winTargetNames.includes("portable")) {
    pass("builder win portable target omitted", winTargetNames.join(",") || "none");
  } else {
    fail("builder win portable target omitted", "portable is not a current release target");
  }
  passOrFailAbsent("builder win certificateFile", builderConfig?.win?.certificateFile);
  passOrFailAbsent("builder win certificatePassword", builderConfig?.win?.certificatePassword);
  passOrFailEqual("builder nsis perMachine", builderConfig?.nsis?.perMachine, false);
  passOrFailEqual("builder nsis differentialPackage", builderConfig?.nsis?.differentialPackage, true);
  passOrFailEqual("builder publish provider", builderConfig?.publish?.provider, "github");
  passOrFailEqual("builder publish releaseType", builderConfig?.publish?.releaseType, "release");
  if (isPlaceholderPublishValue(builderConfig?.publish?.owner) || isPlaceholderPublishValue(builderConfig?.publish?.repo)) {
    warn("builder publish GitHub repository", "electron-builder.yml publish.owner and publish.repo must be replaced with the real GitHub release repository");
  } else {
    pass("builder publish GitHub repository", `${builderConfig.publish.owner}/${builderConfig.publish.repo}`);
  }

  await requireFile("app bundle", appPath);
  await requireFile("app.asar", path.join(resourcesPath, "app.asar"));
  await requireFile(
    "better-sqlite3 native module",
    path.join(resourcesPath, "app.asar.unpacked", "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node")
  );
  await requireFile("custom app icon", path.join(resourcesPath, "icon.icns"));

  if (await exists(plistPath)) {
    const bundleId = await plistValue("CFBundleIdentifier");
    const version = await plistValue("CFBundleShortVersionString");
    const icon = await plistValue("CFBundleIconFile");
    const category = await plistValue("LSApplicationCategoryType");
    if (bundleId === expectedBundleId) {
      pass("bundle id", bundleId);
    } else {
      fail("bundle id", `expected=${expectedBundleId}, actual=${bundleId}`);
    }
    if (version === expectedVersion) {
      pass("bundle version", version);
    } else {
      fail("bundle version", `expected=${expectedVersion}, actual=${version}`);
    }
    if (icon === expectedIcon) {
      pass("bundle icon", icon);
    } else {
      fail("bundle icon", `expected=${expectedIcon}, actual=${icon}`);
    }
    if (category === expectedCategory) {
      pass("bundle category", category);
    } else {
      fail("bundle category", `expected=${expectedCategory}, actual=${category}`);
    }
  } else {
    fail("Info.plist", "missing");
  }

  const releaseFiles = await readdir(releaseDir).catch(() => []);
  const dmgName = releaseFiles.find((name) => name.endsWith(".dmg"));
  const zipName = releaseFiles.find((name) => name.endsWith(".zip"));
  const manifestPath = path.join(releaseDir, "latest.json");
  if (dmgName) {
    const dmgPath = path.join(releaseDir, dmgName);
    pass("macOS DMG artifact", `${dmgName} (${await fileSize(dmgPath)} bytes)`);
    if (await exists(path.join(releaseDir, `${dmgName}.blockmap`))) {
      pass("macOS DMG blockmap", `${dmgName}.blockmap`);
    } else {
      fail("macOS DMG blockmap", "missing");
    }
    const hdiutilVerify = await commandStatus("hdiutil", ["verify", dmgPath]);
    if (hdiutilVerify.ok && hdiutilVerify.output.includes("is VALID")) {
      pass("macOS DMG checksum", "hdiutil verify VALID");
    } else if (hdiutilVerify.ok) {
      fail("macOS DMG checksum", hdiutilVerify.output || "hdiutil verify did not report VALID");
    } else {
      fail("macOS DMG checksum", hdiutilVerify.output);
    }
  } else {
    fail("macOS DMG artifact", "missing");
  }
  if (zipName) {
    const zipPath = path.join(releaseDir, zipName);
    pass("macOS ZIP artifact", `${zipName} (${await fileSize(zipPath)} bytes)`);
    if (await exists(path.join(releaseDir, `${zipName}.blockmap`))) {
      pass("macOS ZIP blockmap", `${zipName}.blockmap`);
    } else {
      fail("macOS ZIP blockmap", "missing");
    }
    const unzipTest = await commandStatus("unzip", ["-tq", zipPath]);
    if (unzipTest.ok) {
      pass("macOS ZIP integrity", unzipTest.output || "unzip -tq passed");
    } else {
      fail("macOS ZIP integrity", unzipTest.output);
    }
  } else {
    fail("macOS ZIP artifact", "missing");
  }

  if (await exists(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.version && manifest.downloadUrl && Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0) {
      pass("update manifest", `version=${manifest.version}, artifacts=${manifest.artifacts.length}`);
    } else {
      fail("update manifest", "missing version/downloadUrl/artifacts");
    }
    if (manifest.version === expectedVersion && manifest.latestVersion === expectedVersion) {
      pass("update manifest version", expectedVersion);
    } else {
      fail("update manifest version", `expected=${expectedVersion}, version=${manifest.version}, latestVersion=${manifest.latestVersion}`);
    }
    if (isAbsoluteHttpUrl(manifest.downloadUrl)) {
      pass("update manifest downloadUrl", manifest.downloadUrl);
    } else {
      fail("update manifest downloadUrl", "must be an absolute http(s) URL");
    }
    const kinds = new Set(manifest.artifacts?.map((artifact) => artifact.kind));
    if (kinds.has("dmg") && kinds.has("zip")) {
      pass("update manifest mac artifact kinds", Array.from(kinds).sort().join(","));
    } else {
      fail("update manifest mac artifact kinds", "missing dmg or zip artifact");
    }
    if (!strictReleaseReady || kinds.has("nsis")) {
      pass("update manifest Windows artifact kind", kinds.has("nsis") ? "nsis" : "not required in non-strict mode");
    } else {
      fail("update manifest Windows artifact kind", "missing nsis artifact");
    }
    for (const artifact of manifest.artifacts ?? []) {
      const artifactPath = path.join(releaseDir, artifact.name ?? "");
      if (!(await exists(artifactPath))) {
        fail(`manifest artifact exists: ${artifact.name}`, "missing file");
        continue;
      }
      const actualSize = await fileSize(artifactPath);
      if (artifact.sizeBytes === actualSize) {
        pass(`manifest artifact size: ${artifact.name}`, String(actualSize));
      } else {
        fail(`manifest artifact size: ${artifact.name}`, `manifest=${artifact.sizeBytes}, actual=${actualSize}`);
      }
      const actualSha256 = await fileDigest(artifactPath, "sha256");
      if (artifact.sha256 === actualSha256) {
        pass(`manifest artifact sha256: ${artifact.name}`);
      } else {
        fail(`manifest artifact sha256: ${artifact.name}`, "digest mismatch");
      }
      const actualSha512 = await fileDigest(artifactPath, "sha512");
      if (artifact.sha512 === actualSha512) {
        pass(`manifest artifact sha512: ${artifact.name}`);
      } else {
        fail(`manifest artifact sha512: ${artifact.name}`, "digest mismatch");
      }
      if (isAbsoluteHttpUrl(artifact.url)) {
        pass(`manifest artifact url: ${artifact.name}`, artifact.url);
      } else {
        fail(`manifest artifact url: ${artifact.name}`, "must be an absolute http(s) URL");
      }
      if (artifact.blockmapUrl) {
        const blockmapName = `${artifact.name}.blockmap`;
        if ((await exists(path.join(releaseDir, blockmapName))) && isAbsoluteHttpUrl(artifact.blockmapUrl)) {
          pass(`manifest artifact blockmap: ${artifact.name}`, blockmapName);
        } else {
          fail(`manifest artifact blockmap: ${artifact.name}`, "missing blockmap file or absolute URL");
        }
      }
    }
  } else {
    fail("update manifest", "missing latest.json");
  }

  const sourceFfmpeg = await inspectFfmpegResources(path.join(repoRoot, "tools", "ffmpeg"), "tools/ffmpeg");
  const packagedFfmpeg = await inspectFfmpegResources(path.join(resourcesPath, "ffmpeg"), "Contents/Resources/ffmpeg");
  if (
    sourceFfmpeg.ffmpeg.length > 0 &&
    sourceFfmpeg.ffprobe.length > 0 &&
    sourceFfmpeg.missingPlatformTools.length === 0 &&
    sourceFfmpeg.nonExecutablePosix.length === 0 &&
    packagedFfmpeg.ffmpeg.length > 0 &&
    packagedFfmpeg.ffprobe.length > 0 &&
    packagedFfmpeg.missingPlatformTools.length === 0 &&
    packagedFfmpeg.nonExecutablePosix.length === 0
  ) {
    pass("bundled ffmpeg resources", `${describeFfmpegInspection(sourceFfmpeg)}; ${describeFfmpegInspection(packagedFfmpeg)}`);
  } else {
    warn(
      "bundled ffmpeg resources",
      [
        "release needs approved redistributable executable ffmpeg and ffprobe binaries in tools/ffmpeg and packaged Resources/ffmpeg",
        `requiredPlatformTools=${requiredFfmpegPlatforms.map((platformName) => `${platformName}/ffmpeg${platformName === "win32" ? ".exe" : ""}+ffprobe${platformName === "win32" ? ".exe" : ""}`).join(",")}`,
        describeFfmpegInspection(sourceFfmpeg),
        describeFfmpegInspection(packagedFfmpeg)
      ].join("; ")
    );
  }

  const codeSign = await commandStatus("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  if (codeSign.ok) {
    pass("codesign verification", codeSign.output);
  } else {
    warn(
      "codesign verification",
      `${codeSign.output}; release policy requires local self-signed identity YourApp Self-Signed, not Apple Developer ID/notarization`
    );
  }
  const identityList = await commandStatus("security", ["find-identity", "-v", "-p", "codesigning"]);
  if (identityList.ok && identityList.output.includes('"YourApp Self-Signed"')) {
    pass("macOS self-signed identity", "YourApp Self-Signed");
  } else {
    warn("macOS self-signed identity", "missing codesigning identity YourApp Self-Signed and encrypted .p12/CI injection must be provided externally");
  }

  const windowsExeFiles = releaseFiles.filter((name) => name.endsWith(".exe"));
  const nsisInstaller = windowsExeFiles.find((name) => !name.toLowerCase().includes("portable"));
  if (nsisInstaller) {
    pass("Windows NSIS artifact", nsisInstaller);
    if (await exists(path.join(releaseDir, `${nsisInstaller}.blockmap`))) {
      pass("Windows NSIS blockmap", `${nsisInstaller}.blockmap`);
    } else {
      fail("Windows NSIS blockmap", "missing");
    }
    if (/x64/i.test(nsisInstaller)) {
      pass("Windows NSIS architecture", nsisInstaller);
    } else {
      fail("Windows NSIS architecture", "installer filename must identify x64 artifact");
    }
  } else {
    warn(
      "Windows artifacts",
      [
        "missing NSIS installer .exe",
        "full Windows desktop verification must run on Windows"
      ].join("; ")
    );
  }

  warn(
    "live paid-provider success verification",
    "not checked by local release verifier; requires user-provided OpenAI-compatible/Anthropic/Gemini/OpenAI Image keys plus network-enabled Electron desktop acceptance"
  );

  const failed = checks.filter((check) => !check.ok);
  const strictFailures = strictReleaseReady ? warnings : [];
  const result = {
    ok: failed.length === 0 && strictFailures.length === 0,
    strict: strictReleaseReady,
    failedChecks: failed.map((check) => check.name),
    strictFailures: strictFailures.map((warning) => warning.name),
    checks,
    warnings
  };
  console.log(JSON.stringify(result, null, 2));
  if (failed.length > 0 || strictFailures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
