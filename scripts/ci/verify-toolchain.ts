#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

interface ToolchainConfig {
  node?: {
    default?: string;
    supported?: string[];
  };
  pnpm?: string;
}

interface PackageJsonShape {
  toolchain?: ToolchainConfig;
  engines?: {
    node?: string;
    pnpm?: string;
  };
}

interface Semver {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): Semver | null {
  // Ignore prerelease/build metadata so numeric comparison remains stable.
  const normalized = version.trim().replace(/[-+].*$/, '');
  const match = normalized.match(/^(?:v)?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareSemver(left: Semver, right: Semver): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function ensureSatisfiesRange(version: Semver, range: string): boolean {
  // Supports simple OR ranges with comparator pairs used in this repo,
  // e.g. ">=22.12.0 <23 || >=24.0.0 <25".
  const clauses = range
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const comparators = clause
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const passed = comparators.every((comparator) => {
      const opMatch = comparator.match(/^(>=|<=|>|<|=)(.+)$/);
      if (!opMatch) return false;

      const target = parseSemver(opMatch[2].includes('.') ? opMatch[2] : `${opMatch[2]}.0.0`);
      if (!target) return false;

      const order = compareSemver(version, target);
      switch (opMatch[1]) {
        case '>=':
          return order >= 0;
        case '<=':
          return order <= 0;
        case '>':
          return order > 0;
        case '<':
          return order < 0;
        case '=':
          return order === 0;
        default:
          return false;
      }
    });

    if (passed) return true;
  }

  return false;
}

function getLocalPnpmVersion(): string | null {
  const userAgent = process.env.npm_config_user_agent ?? '';
  const match = userAgent.match(/pnpm\/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function main(): void {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as PackageJsonShape;

  const nodeRange = pkg.engines?.node ?? '';
  const nodeVersionRaw = process.version;
  const nodeVersion = parseSemver(nodeVersionRaw);

  if (!nodeVersion || !nodeRange || !ensureSatisfiesRange(nodeVersion, nodeRange)) {
    const defaultNode = pkg.toolchain?.node?.default ?? '24';
      console.error('Error: Unsupported Node.js runtime for merge-gating checks.');
    console.error(`Detected: ${nodeVersionRaw}`);
    console.error(`Required: ${nodeRange || 'see package.json engines.node'}`);
    console.error(`Use nvm:  nvm install ${defaultNode} && nvm use ${defaultNode}`);
    console.error(`Use fnm:  fnm install ${defaultNode} && fnm use ${defaultNode}`);
    process.exit(1);
  }

  const expectedPnpm = pkg.toolchain?.pnpm ?? pkg.engines?.pnpm;
  const localPnpm = getLocalPnpmVersion();
  if (expectedPnpm && localPnpm !== expectedPnpm) {
    console.error('Error: Unsupported pnpm version for merge-gating checks.');
    console.error(`Detected: ${localPnpm ?? 'unknown'}`);
    console.error(`Required: ${expectedPnpm}`);
    console.error(`Use: corepack prepare pnpm@${expectedPnpm} --activate`);
    process.exit(1);
  }

  console.log(
    `Toolchain: Node ${nodeVersionRaw} and pnpm ${localPnpm ?? expectedPnpm ?? 'unknown'} supported`
  );
}

main();
