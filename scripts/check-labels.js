#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const contributingPath = path.join(repoRoot, "CONTRIBUTING.md");
const manifestPath = path.join(repoRoot, ".github", "label-manifest.json");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

const contributing = fs.readFileSync(contributingPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const manifestSet = new Set(manifest);

const sectionMatch = contributing.match(/\*\*Browse labels:\*\*([\s\S]*?)\n### 2\./);
if (!sectionMatch) {
  fail("Could not find 'Browse labels' section in CONTRIBUTING.md");
  process.exit(1);
}

const labels = [];
for (const line of sectionMatch[1].split("\n")) {
  const m = line.match(/^\s*-\s*`([^`]+)`\s+—/);
  if (m) labels.push(m[1]);
}

if (labels.length === 0) {
  fail("No labels parsed from CONTRIBUTING.md browse labels section");
}

for (const label of labels) {
  if (!manifestSet.has(label)) {
    fail(`CONTRIBUTING.md references label "${label}" missing from .github/label-manifest.json`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Label manifest: OK (${labels.length} documented labels verified)`);
