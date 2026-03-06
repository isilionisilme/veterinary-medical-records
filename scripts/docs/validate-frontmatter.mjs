#!/usr/bin/env node
/**
 * Frontmatter validator for canonical wiki documentation.
 * Validates required fields and enum values per the D5-C schema.
 *
 * Usage: node scripts/docs/validate-frontmatter.mjs [--fix-dates]
 * Exit code: 0 if all valid, 1 if errors found.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

// --- Schema ---

const VALID_TYPES = [
  "index",
  "reference",
  "explanation",
  "how-to",
  "tutorial",
  "adr",
  "changelog",
  "audit",
  "plan",
];
const VALID_STATUSES = ["active", "archived", "draft", "completed"];
const VALID_AUDIENCES = ["all", "contributor", "staff-engineer"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- File discovery ---

const CANONICAL_ROOTS = [
  path.join(repoRoot, "docs", "README.md"),
  path.join(repoRoot, "docs", "shared"),
  path.join(repoRoot, "docs", "projects", "veterinary-medical-records"),
];

const EXCLUDED_PATTERNS = [
  /04-delivery[/\\]plans[/\\]/,
  /D4R-A_INVENTORY\.md$/,
];

async function collectFiles(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return target.endsWith(".md") ? [target] : [];

  const entries = await fs.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

async function discoverFiles() {
  const all = [];
  for (const root of CANONICAL_ROOTS) {
    all.push(...(await collectFiles(root)));
  }
  return all.filter(
    (f) => !EXCLUDED_PATTERNS.some((re) => re.test(f.replace(/\\/g, "/"))),
  );
}

// --- Frontmatter parsing (no external deps) ---

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\S+):\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      // Strip surrounding quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      fields[m[1]] = val;
    }
  }
  return fields;
}

// --- Validation ---

function validate(filePath, fm) {
  const errors = [];
  const rel = path.relative(repoRoot, filePath).replace(/\\/g, "/");

  if (!fm) {
    errors.push(`${rel}: missing frontmatter block`);
    return errors;
  }

  // Required fields
  for (const field of ["title", "type", "status", "audience", "last-updated"]) {
    if (!fm[field]) {
      errors.push(`${rel}: missing required field '${field}'`);
    }
  }

  // Enum validation
  if (fm.type && !VALID_TYPES.includes(fm.type)) {
    errors.push(
      `${rel}: invalid type '${fm.type}' (expected: ${VALID_TYPES.join(", ")})`,
    );
  }
  if (fm.status && !VALID_STATUSES.includes(fm.status)) {
    errors.push(
      `${rel}: invalid status '${fm.status}' (expected: ${VALID_STATUSES.join(", ")})`,
    );
  }
  if (fm.audience && !VALID_AUDIENCES.includes(fm.audience)) {
    errors.push(
      `${rel}: invalid audience '${fm.audience}' (expected: ${VALID_AUDIENCES.join(", ")})`,
    );
  }
  if (fm["last-updated"] && !DATE_RE.test(fm["last-updated"])) {
    errors.push(
      `${rel}: invalid last-updated '${fm["last-updated"]}' (expected YYYY-MM-DD)`,
    );
  }

  return errors;
}

// --- Main ---

const allFiles = await discoverFiles();
let totalErrors = 0;

for (const file of allFiles) {
  const content = await fs.readFile(file, "utf-8");
  const fm = parseFrontmatter(content);
  const errors = validate(file, fm);
  for (const err of errors) {
    console.error(`ERROR: ${err}`);
    totalErrors++;
  }
}

console.log(
  `\nValidated ${allFiles.length} files. ${totalErrors === 0 ? "All passed." : `${totalErrors} error(s) found.`}`,
);
process.exit(totalErrors === 0 ? 0 : 1);
