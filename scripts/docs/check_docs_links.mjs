import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import markdownLinkCheck from 'markdown-link-check';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const roots = [
  path.join(repoRoot, 'docs', 'README.md'),
  path.join(repoRoot, 'docs', 'projects', 'veterinary-medical-records'),
  path.join(repoRoot, 'docs', 'shared'),
];

async function collectMarkdownFiles(targetPath) {
  let stats;
  try {
    stats = await fs.stat(targetPath);
  } catch {
    return [];
  }
  if (stats.isFile()) {
    return targetPath.endsWith('.md') ? [targetPath] : [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }
  return result.stdout ?? '';
}

async function collectChangedMarkdownFiles(baseRef) {
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`],
    ['diff', '--name-only', '--diff-filter=ACMR'],
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  ];

  const changed = new Set();
  for (const command of commands) {
    const output = gitOutput(command);
    for (const line of output.split(/\r?\n/)) {
      const relativePath = line.trim().replaceAll('\\', '/');
      if (!relativePath || !relativePath.startsWith('docs/') || !relativePath.endsWith('.md')) {
        continue;
      }
      changed.add(path.join(repoRoot, relativePath));
    }
  }

  const existing = [];
  for (const filePath of changed) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        existing.push(filePath);
      }
    } catch {
      // ignore deleted/moved files from diff set
    }
  }

  return existing.sort((left, right) => left.localeCompare(right));
}

function runLinkCheck(filePath, markdownContent) {
  return new Promise((resolve) => {
    markdownLinkCheck(
      markdownContent,
      {
        baseUrl: pathToFileURL(path.dirname(filePath)).toString(),
        configFile: path.join(repoRoot, '.markdown-link-check.json'),
      },
      (error, results = []) => {
        if (error) {
          resolve({ filePath, error, broken: [] });
          return;
        }

        const broken = results.filter((result) => result.status === 'dead');
        resolve({ filePath, error: null, broken });
      },
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  const changedOnly = args.includes('--changed-only');
  const baseRefIndex = args.indexOf('--base-ref');
  const baseRef = baseRefIndex >= 0 && args[baseRefIndex + 1] ? args[baseRefIndex + 1] : 'main';

  let files;
  if (changedOnly) {
    files = await collectChangedMarkdownFiles(baseRef);
  } else {
    const filesNested = await Promise.all(roots.map((targetPath) => collectMarkdownFiles(targetPath)));
    files = filesNested.flat().sort((left, right) => left.localeCompare(right));
  }

  if (files.length === 0) {
    if (changedOnly) {
      console.log(`No changed markdown files found under docs scope (base-ref=${baseRef}).`);
    } else {
      console.log('No markdown files found under canonical docs scope.');
    }
    return;
  }

  let hasErrors = false;
  for (const filePath of files) {
    const markdownContent = await fs.readFile(filePath, 'utf8');
    const result = await runLinkCheck(filePath, markdownContent);
    const relativePath = path.relative(repoRoot, filePath).replaceAll('\\', '/');

    if (result.error) {
      hasErrors = true;
      console.error(`ERROR ${relativePath}: ${result.error.message}`);
      continue;
    }

    if (result.broken.length === 0) {
      console.log(`OK ${relativePath}`);
      continue;
    }

    hasErrors = true;
    console.error(`BROKEN ${relativePath}`);
    for (const brokenLink of result.broken) {
      console.error(`  - ${brokenLink.link} (${brokenLink.statusCode ?? 'no-status'})`);
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  }
}

await main();
