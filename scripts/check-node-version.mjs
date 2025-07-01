#!/usr/bin/env node
// Verify Node.js version 22.x
const requiredMajor = '22';
const version = process.versions.node;
if (!version.startsWith(`${requiredMajor}.`)) {
  console.error(`Unsupported Node.js version ${version}. Required ${requiredMajor}.x`);
  process.exit(1);
}
