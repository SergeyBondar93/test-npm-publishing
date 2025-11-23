#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const IGNORES = new Set(['node_modules', '.git']);

async function removeDist(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
    console.log(`removed: ${dir}`);
  } catch (err) {
    console.error(`failed to remove ${dir}:`, err.message);
  }
}

async function walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }

  for (const ent of entries) {
    if (ent.isDirectory()) {
      const name = ent.name;
      const full = path.join(dir, name);
      if (name === 'dist') {
        await removeDist(full);
        continue;
      }
      if (IGNORES.has(name)) continue;
      // limit traversal depth to avoid scanning system roots
      await walk(full);
    }
  }
}

async function main() {
  const root = process.cwd();
  console.log(`cleaning dist directories under ${root}`);
  await walk(root);
  console.log('clean complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
