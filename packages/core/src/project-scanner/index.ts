/**
 * Project Scanner — collects raw facts about the project.
 * No interpretation. The coding agent is the intelligence.
 *
 * Outputs two things:
 * 1. deps — every dependency name from package.json
 * 2. structure — every folder, config file, and source file count
 *
 * The agent reads these and understands what they mean.
 */

import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';

export interface ProjectScan {
  hasFiles: boolean;
  packageJson: any | null;
  deps: string[];
  structure: string[];
  language: string;
}

export async function scanProject(projectRoot: string): Promise<ProjectScan> {
  const scan: ProjectScan = {
    hasFiles: false,
    packageJson: null,
    deps: [],
    structure: [],
    language: '',
  };

  // Read package.json
  try {
    const raw = await readFile(join(projectRoot, 'package.json'), 'utf-8');
    scan.packageJson = JSON.parse(raw);
  } catch {
    return scan;
  }

  // Collect ALL dependency names — no filtering, no interpreting
  const allDeps = {
    ...(scan.packageJson.dependencies || {}),
    ...(scan.packageJson.devDependencies || {}),
  };
  scan.deps = Object.keys(allDeps);

  // Detect language (this is the one fact we need for the brief parser)
  if (allDeps['typescript'] || await fileExists(join(projectRoot, 'tsconfig.json'))) {
    scan.language = 'TypeScript';
  } else {
    scan.language = 'JavaScript';
  }

  // Scan folder structure — collect what exists
  scan.structure = await scanStructure(projectRoot);
  scan.hasFiles = scan.structure.length > 0;

  return scan;
}

async function scanStructure(root: string): Promise<string[]> {
  const found: string[] = [];

  // Check top-level entries (dirs + config files)
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        found.push(entry.name + '/');

        // One level deeper for key dirs
        try {
          const subEntries = await readdir(join(root, entry.name), { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isDirectory() && !sub.name.startsWith('.')) {
              found.push(entry.name + '/' + sub.name + '/');
            }
          }
        } catch {}
      } else if (entry.isFile()) {
        // Config files and dotfiles that matter
        if (/^(\.env|\.env\.\w+|tsconfig.*|docker-compose.*|Dockerfile|vercel\.json|railway\.(json|toml)|middleware\.(ts|js)|next\.config\.\w+|vite\.config\.\w+|tailwind\.config\.\w+|prisma|drizzle)/.test(entry.name)) {
          found.push(entry.name);
        }
      }
    }
  } catch {}

  // Count source files
  const srcDirs = ['src', 'app', 'services', 'lib', 'server', 'pages'];
  for (const dir of srcDirs) {
    if (await fileExists(join(root, dir))) {
      const count = await countFiles(join(root, dir));
      if (count > 0) found.push(`~${count} source files in ${dir}/`);
    }
  }

  return found;
}

async function countFiles(dir: string, depth = 0): Promise<number> {
  if (depth > 3) return 0;
  let count = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isFile() && /\.(ts|tsx|js|jsx|vue|svelte|py|go|rs)$/.test(entry.name)) {
        count++;
      } else if (entry.isDirectory()) {
        count += await countFiles(join(dir, entry.name), depth + 1);
      }
    }
  } catch {}
  return count;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function formatScanOutput(scan: ProjectScan): string {
  const lines: string[] = [];
  lines.push('  Detected:');

  if (scan.deps.length === 0 && !scan.hasFiles) {
    lines.push('  └── Empty project');
    return lines.join('\n');
  }

  if (scan.language) {
    lines.push(`  ├── ${scan.language}`);
  }

  if (scan.deps.length > 0) {
    const display = scan.deps.slice(0, 8).join(', ');
    const more = scan.deps.length > 8 ? ` +${scan.deps.length - 8} more` : '';
    lines.push(`  ├── Deps: ${display}${more}`);
  }

  const folders = scan.structure.filter(s => s.endsWith('/'));
  const configs = scan.structure.filter(s => !s.endsWith('/') && !s.startsWith('~'));
  const fileCounts = scan.structure.filter(s => s.startsWith('~'));

  if (folders.length > 0) {
    const display = folders.slice(0, 6).join(', ');
    lines.push(`  ├── Folders: ${display}`);
  }

  if (configs.length > 0) {
    lines.push(`  ├── Config: ${configs.join(', ')}`);
  }

  if (fileCounts.length > 0) {
    lines.push(`  └── ${fileCounts.join(', ')}`);
  } else {
    // Fix last ├── to └──
    if (lines.length > 1) {
      lines[lines.length - 1] = lines[lines.length - 1].replace('├──', '└──');
    }
  }

  return lines.join('\n');
}
