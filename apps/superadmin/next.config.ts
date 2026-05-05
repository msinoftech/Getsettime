import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

/**
 * Superadmin runs as a separate Next app and does not automatically load
 * apps/workspace/.env.local. Merge those (and monorepo root env) so SMTP
 * and other shared secrets work without duplicating them for superadmin.
 */
function mergeEnvFromFile(absolutePath: string) {
  try {
    if (!fs.existsSync(absolutePath)) return;
    const text = fs.readFileSync(absolutePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      const cur = process.env[key];
      if (cur === undefined || cur === "") {
        process.env[key] = val;
      }
    }
  } catch {
    /* ignore */
  }
}

const appDir = __dirname;
mergeEnvFromFile(path.join(appDir, "../../.env"));
mergeEnvFromFile(path.join(appDir, "../../.env.local"));
mergeEnvFromFile(path.join(appDir, "../workspace/.env"));
mergeEnvFromFile(path.join(appDir, "../workspace/.env.local"));

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
