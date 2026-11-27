#!/usr/bin/env node
// PostToolUse hook (Edit|Write): format the single file that was just changed.
// Never blocks: any missing tool or formatter error is ignored (exit code is always 0).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const frontendDir = path.join(root, 'src', 'frontend');

function run(cmd, args, cwd) {
  try {
    const r = spawnSync(cmd, args, { cwd, stdio: 'ignore', shell: process.platform === 'win32', timeout: 50_000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function q(p) {
  // Quote paths for the Windows shell (spaces in paths).
  return process.platform === 'win32' ? `"${p}"` : p;
}

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path || input?.tool_response?.filePath;
if (!filePath || !existsSync(filePath)) process.exit(0);

const abs = path.resolve(filePath);
const rel = path.relative(root, abs);
if (rel.startsWith('..') || path.isAbsolute(rel)) process.exit(0); // outside the repo
const relPosix = rel.split(path.sep).join('/');
const ext = path.extname(abs).toLowerCase();

// C#: whitespace-only formatting (fast, no build, works without a .sln)
if (ext === '.cs') {
  run('dotnet', ['format', 'whitespace', '.', '--folder', '--include', q(relPosix)], root);
}

// Frontend: Prettier (+ ESLint --fix for TS/JS), only once the Vite app and its node_modules exist
const frontendExts = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md', '.html'];
if (frontendExts.includes(ext) && relPosix.startsWith('src/frontend/')) {
  const relToFrontend = path.relative(frontendDir, abs);
  if (existsSync(path.join(frontendDir, 'node_modules', 'prettier'))) {
    run('npx', ['--no-install', 'prettier', '--write', q(relToFrontend)], frontendDir);
  }
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext) && existsSync(path.join(frontendDir, 'node_modules', 'eslint'))) {
    run('npx', ['--no-install', 'eslint', '--fix', q(relToFrontend)], frontendDir);
  }
}

// Bicep
if (ext === '.bicep') {
  run('az', ['bicep', 'format', '--file', q(abs)], root);
}

process.exit(0);
