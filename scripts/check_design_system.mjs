#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const frontendRoot = path.join(repoRoot, "frontend");
const srcRoot = path.join(frontendRoot, "src");

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
const INLINE_STYLE_RE = /style\s*=\s*\{\{/g;
const ICON_BUTTON_NO_LABEL_RE = /<IconButton(?![^>]*\bariaLabel\s*=)[^>]*>/g;

const HEX_ALLOWLIST = new Set([
  path.join("frontend", "src", "index.css"),
  path.join("frontend", "tailwind.config.cjs"),
]);

const INLINE_STYLE_ALLOWLIST = new Map([
  [path.join("frontend", "src", "App.tsx"), ["style={reviewSplitLayoutStyle}", "style={{ top:"]],
]);

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath);
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

const files = [
  ...walkFiles(srcRoot),
  path.join(frontendRoot, "tailwind.config.cjs"),
];

const findings = [];

for (const filePath of files) {
  const relativePath = relativeToRepo(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  if (!HEX_ALLOWLIST.has(relativePath)) {
    const hexMatches = [...content.matchAll(HEX_RE)];
    for (const match of hexMatches) {
      findings.push(
        `${relativePath}:${lineNumberAt(content, match.index)} hard-coded hex color ${match[0]} outside token allowlist`
      );
    }
  }

  const styleMatches = [...content.matchAll(INLINE_STYLE_RE)];
  if (styleMatches.length > 0) {
    const allowTokens = INLINE_STYLE_ALLOWLIST.get(relativePath) ?? [];
    for (const match of styleMatches) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(content.length, match.index + 80);
      const snippet = content.slice(start, end);
      const allowed = allowTokens.some((token) => snippet.includes(token));
      if (!allowed) {
        findings.push(
          `${relativePath}:${lineNumberAt(content, match.index)} inline style={{...}} is not allow-listed`
        );
      }
    }
  }

  const iconButtonMatches = [...content.matchAll(ICON_BUTTON_NO_LABEL_RE)];
  for (const match of iconButtonMatches) {
    findings.push(
      `${relativePath}:${lineNumberAt(content, match.index)} IconButton missing required ariaLabel`
    );
  }
}

if (findings.length > 0) {
  console.error("Design system check failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Design system check passed.");
