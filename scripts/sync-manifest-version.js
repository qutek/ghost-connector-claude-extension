// Syncs manifest.json's `version` field with package.json after changesets bumps package.json.
// Run as part of `version-packages` script so both stay in lockstep.
"use strict";
const fs = require("node:fs");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const manifestPath = "manifest.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest.json version synced -> ${pkg.version}`);
} else {
  console.log(`manifest.json already at ${pkg.version}`);
}
