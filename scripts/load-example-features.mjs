#!/usr/bin/env node
// Load a hand-authored backlog into a project via the running LocalForge
// HTTP API. This goes through the same code path as the UI, so timestamps,
// validation, and dependency FK constraints all behave exactly as they
// would for a manually-created feature.
//
// Usage:
//   node scripts/load-example-features.mjs <projectId> [--spec <path>] [--base-url <url>]
//   node scripts/load-example-features.mjs <projectId> [specPath] [baseUrl]   (legacy positional form)
//
// Examples:
//   # Default DreamForgeIdeas backlog at project id 2:
//   node scripts/load-example-features.mjs 2
//
//   # Author Landing fallback when the AI Bootstrapper failed:
//   node scripts/load-example-features.mjs 3 --spec docs/author-landing-features.json
//
//   # Custom backlog against a non-default port:
//   node scripts/load-example-features.mjs 4 --spec docs/my-spec.json --base-url http://localhost:3737
//
// Prerequisites:
//   - LocalForge dev server running (npm run dev)
//   - The target project already exists in LocalForge
//   - The spec JSON file exists; default is docs/example-app-features.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SPEC = path.resolve(
  __dirname,
  "..",
  "docs",
  "example-app-features.json",
);
const DEFAULT_BASE_URL = "http://localhost:7777";

function parseArgs(argv) {
  const out = { positional: [], spec: null, baseUrl: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--spec" || a === "-s") {
      out.spec = argv[++i];
    } else if (a === "--base-url" || a === "-b") {
      out.baseUrl = argv[++i];
    } else if (a.startsWith("--spec=")) {
      out.spec = a.slice("--spec=".length);
    } else if (a.startsWith("--base-url=")) {
      out.baseUrl = a.slice("--base-url=".length);
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(
    "usage: node scripts/load-example-features.mjs <projectId> [--spec <path>] [--base-url <url>]",
  );
  process.exit(0);
}

const projectIdArg = args.positional[0];
if (!projectIdArg || !/^[0-9]+$/.test(projectIdArg)) {
  console.error(
    "usage: node scripts/load-example-features.mjs <projectId> [--spec <path>] [--base-url <url>]",
  );
  process.exit(2);
}
const projectId = Number.parseInt(projectIdArg, 10);

// Backward compatibility: the original interface accepted positional args
// as `<projectId> [specPath] [baseUrl]` (when specPath was just a baseUrl
// it was actually parsed as baseUrl since `docs/...json` doesn't start with
// http). To keep the existing DreamForgeIdeas docs accurate we still accept
// the second-positional form, but flags take precedence.
let specPath = args.spec;
let baseUrl = args.baseUrl;
if (!specPath && args.positional[1] && /\.json$/i.test(args.positional[1])) {
  specPath = args.positional[1];
}
if (!baseUrl) {
  // Old positional form: `<projectId> [baseUrl]` — second positional is a
  // URL, not a JSON path.
  const positionalUrl = args.positional.find((p) => /^https?:\/\//i.test(p));
  baseUrl = positionalUrl ?? DEFAULT_BASE_URL;
}
specPath = specPath ? path.resolve(specPath) : DEFAULT_SPEC;

let raw;
try {
  raw = fs.readFileSync(specPath, "utf8");
} catch (err) {
  console.error(`could not read spec at ${specPath}: ${err.message}`);
  process.exit(1);
}
let spec;
try {
  spec = JSON.parse(raw);
} catch (err) {
  console.error(`spec at ${specPath} is not valid JSON: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(spec.features) || spec.features.length === 0) {
  console.error(`no features found in ${specPath}`);
  process.exit(1);
}

console.log(`loading spec from ${path.relative(process.cwd(), specPath)}`);
console.log(`target: ${baseUrl}, project ${projectId}`);

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`POST ${url} → ${res.status}: ${data.error ?? text}`);
  }
  return data;
}

// Phase 1: create features. Map each spec key → real DB id so we can wire
// dependencies in phase 2.
const keyToId = new Map();

console.log(`Creating ${spec.features.length} features in project ${projectId}...`);
for (const f of spec.features) {
  const created = await postJson(`${baseUrl}/api/projects/${projectId}/features`, {
    title: f.title,
    description: f.description,
    acceptanceCriteria: f.acceptanceCriteria,
    category: f.category,
    priority: f.priority,
  });
  const id = created?.feature?.id;
  if (typeof id !== "number") {
    throw new Error(`unexpected response for ${f.key}: ${JSON.stringify(created)}`);
  }
  keyToId.set(f.key, id);
  console.log(`  + #${id}  [${f.key}]  ${f.title}`);
}

// Phase 2: wire dependencies. The dependencies endpoint expects the full
// list each time — we built each feature's full prereq set up front so
// one POST per feature is enough.
console.log("\nWiring dependencies...");
let depCount = 0;
for (const f of spec.features) {
  if (!Array.isArray(f.dependsOn) || f.dependsOn.length === 0) continue;
  const featureId = keyToId.get(f.key);
  const dependsOn = f.dependsOn.map((k) => {
    const id = keyToId.get(k);
    if (typeof id !== "number") {
      throw new Error(`unknown dependency key "${k}" referenced by "${f.key}"`);
    }
    return id;
  });
  await postJson(`${baseUrl}/api/features/${featureId}/dependencies`, {
    dependsOn,
  });
  depCount += dependsOn.length;
  console.log(
    `  • #${featureId} (${f.key}) depends on ${f.dependsOn.join(", ")} ` +
      `→ [${dependsOn.join(", ")}]`,
  );
}

console.log(
  `\nDone. Created ${spec.features.length} features and ${depCount} dependency links in project ${projectId}.`,
);
