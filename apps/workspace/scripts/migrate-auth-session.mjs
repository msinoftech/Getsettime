/**
 * One-off migration: replace direct supabase.auth.getSession() with getWorkspaceSession().
 * Run: node apps/workspace/scripts/migrate-auth-session.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');

const SKIP_FILES = new Set([
  path.normalize(path.join(workspaceRoot, 'src/lib/auth_session.ts')),
  path.normalize(path.join(workspaceRoot, 'src/providers/AuthProvider.tsx')),
  path.normalize(path.join(workspaceRoot, 'src/hooks/useRemoteSessionInvalidation.ts')),
  path.normalize(path.join(workspaceRoot, 'src/lib/auth_activity_log_client.ts')),
  path.normalize(path.join(workspaceRoot, 'src/lib/install_workspace_api_unauthorized_handler.ts')),
]);

const IMPORT_LINE = "import { getWorkspaceSession } from '@/src/lib/auth_session';";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, files);
    } else if (/\.(tsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function migrateFile(filePath) {
  const normalized = path.normalize(filePath);
  if (SKIP_FILES.has(normalized)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('supabase.auth.getSession()')) return false;

  const original = content;

  content = content.replace(
    /const\s*\{\s*supabase\s*\}\s*=\s*await\s*import\(['"]@\/lib\/supabaseClient['"]\);\s*\n\s*const\s*\{\s*\n?\s*data:\s*\{\s*session\s*\},?\s*\n?\s*\}\s*=\s*await\s*supabase\.auth\.getSession\(\);/g,
    'const { session } = await getWorkspaceSession();'
  );

  content = content.replace(
    /const\s*\{\s*\n\s*data:\s*\{\s*session\s*\},?\s*\n\s*\}\s*=\s*await\s*supabase\.auth\.getSession\(\);/g,
    'const { session } = await getWorkspaceSession();'
  );

  content = content.replace(
    /const\s*\{\s*data:\s*\{\s*session\s*\}\s*\}\s*=\s*await\s*supabase\.auth\.getSession\(\);/g,
    'const { session } = await getWorkspaceSession();'
  );

  if (content === original) return false;

  if (!content.includes(IMPORT_LINE)) {
    const useClientMatch = content.match(/^(['"])use client\1;?\s*\n/);
    if (useClientMatch) {
      content = content.replace(useClientMatch[0], `${useClientMatch[0]}${IMPORT_LINE}\n`);
    } else {
      content = `${IMPORT_LINE}\n${content}`;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

const targets = [path.join(workspaceRoot, 'src'), path.join(workspaceRoot, 'app')];
let changed = 0;
for (const root of targets) {
  for (const file of walk(root)) {
    if (migrateFile(file)) {
      changed++;
      console.log('updated', path.relative(workspaceRoot, file));
    }
  }
}
console.log(`Done. ${changed} file(s) updated.`);
