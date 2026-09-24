import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SetupError } from './errors.ts';

/**
 * Pinterest runs two completely separate environments. Sandbox is what trial
 * access gets you: the API shape is identical, but every board and pin you
 * create is a sandbox entity that only you can see. Production is the real
 * thing and requires standard access, granted by app review.
 */
export type PinterestEnv = 'sandbox' | 'production';

export interface PinterestConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  env: PinterestEnv;
  scopes: string[];
  /** Pre-supplied token, bypassing the cache. Usually empty. */
  accessToken: string | undefined;
  apiBase: string;
  tokenCachePath: string;
}

/** Authorization always happens on the www host, never the API host. */
export const AUTH_URL = 'https://www.pinterest.com/oauth/';

const API_BASE: Record<PinterestEnv, string> = {
  sandbox: 'https://api-sandbox.pinterest.com/v5',
  production: 'https://api.pinterest.com/v5',
};

export const DEFAULT_SCOPES = [
  'boards:read',
  'boards:write',
  'pins:read',
  'pins:write',
  'user_accounts:read',
];

/**
 * Minimal .env reader. Deliberately dependency-free — we only need
 * KEY=value lines, and real secrets belong in the shell environment anyway.
 * Values already present in process.env always win.
 */
export function loadDotEnv(path = join(process.cwd(), '.env')): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return; // No .env is fine; the shell environment may carry everything.
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SetupError(
      `Missing ${name}. Copy .env.example to .env and fill it in — see docs/PINTEREST_SETUP.md.`,
    );
  }
  return value;
}

export function loadConfig(): PinterestConfig {
  loadDotEnv();

  const env = (process.env['PINTEREST_ENV'] ?? 'sandbox') as PinterestEnv;
  if (env !== 'sandbox' && env !== 'production') {
    throw new SetupError(`PINTEREST_ENV must be "sandbox" or "production", got "${env}".`);
  }

  // Accept comma- or space-separated scopes; Pinterest wants them comma-joined.
  const rawScopes = process.env['PINTEREST_SCOPES'];
  const scopes = rawScopes
    ? rawScopes.split(/[,\s]+/).filter(Boolean)
    : [...DEFAULT_SCOPES];

  return {
    appId: required('PINTEREST_APP_ID'),
    appSecret: required('PINTEREST_APP_SECRET'),
    redirectUri: process.env['PINTEREST_REDIRECT_URI'] ?? 'http://localhost:8085/callback',
    env,
    scopes,
    accessToken: process.env['PINTEREST_ACCESS_TOKEN'] || undefined,
    apiBase: API_BASE[env],
    tokenCachePath: join(process.cwd(), '.pinterest-token.json'),
  };
}
