import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { AUTH_URL, type PinterestConfig } from './config.ts';
import { SetupError } from './errors.ts';

export interface StoredToken {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Epoch milliseconds; refresh tokens last a year. */
  refreshExpiresAt: number;
  env: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

/**
 * Pinterest mandates PKCE with S256 — a `plain` challenge is rejected outright.
 * The verifier is base64url of 32 random bytes (43 chars, inside the 43–128
 * range the spec allows).
 */
export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  config: PinterestConfig,
  pkce: Pkce,
  state: string,
): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(','));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/**
 * The token endpoint authenticates the *app* with HTTP Basic, and takes its
 * parameters as form-encoded body fields. It does not accept JSON.
 */
async function postToken(
  config: PinterestConfig,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const basic = Buffer.from(`${config.appId}:${config.appSecret}`).toString('base64');

  const response = await fetch(`${config.apiBase}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Pinterest token request failed (${response.status}): ${text}`);
  }
  return JSON.parse(text) as TokenResponse;
}

function toStoredToken(
  raw: TokenResponse,
  config: PinterestConfig,
  previous?: StoredToken,
): StoredToken {
  const now = Date.now();
  const refreshToken = raw.refresh_token ?? previous?.refreshToken;
  if (!refreshToken) {
    throw new Error('Pinterest returned no refresh token and none was cached.');
  }

  return {
    accessToken: raw.access_token,
    refreshToken,
    scopes: raw.scope ? raw.scope.split(/[,\s]+/).filter(Boolean) : config.scopes,
    expiresAt: now + raw.expires_in * 1000,
    refreshExpiresAt: raw.refresh_token_expires_in
      ? now + raw.refresh_token_expires_in * 1000
      : (previous?.refreshExpiresAt ?? now + 365 * 24 * 60 * 60 * 1000),
    env: config.env,
  };
}

export async function exchangeCode(
  config: PinterestConfig,
  code: string,
  verifier: string,
): Promise<StoredToken> {
  const raw = await postToken(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  return toStoredToken(raw, config);
}

export async function refreshToken(
  config: PinterestConfig,
  stored: StoredToken,
): Promise<StoredToken> {
  if (Date.now() >= stored.refreshExpiresAt) {
    throw new SetupError(
      'Pinterest refresh token has expired. Re-run `npm run pinterest:authorize`.',
    );
  }

  const raw = await postToken(config, {
    grant_type: 'refresh_token',
    refresh_token: stored.refreshToken,
    // Ask for a rolling refresh token so long-lived jobs never fall off the
    // one-year cliff. Pinterest calls this "continuous refresh".
    refresh_on: 'true',
  });
  return toStoredToken(raw, config, stored);
}

export function saveToken(config: PinterestConfig, token: StoredToken): void {
  writeFileSync(config.tokenCachePath, `${JSON.stringify(token, null, 2)}\n`, 'utf8');
  // Live credentials — keep them off other users on the machine.
  chmodSync(config.tokenCachePath, 0o600);
}

export function readToken(config: PinterestConfig): StoredToken | undefined {
  try {
    const token = JSON.parse(readFileSync(config.tokenCachePath, 'utf8')) as StoredToken;
    if (token.env !== config.env) {
      throw new SetupError(
        `Cached token is for the "${token.env}" environment but PINTEREST_ENV is "${config.env}". ` +
          'Re-run `npm run pinterest:authorize`.',
      );
    }
    return token;
  } catch (error) {
    if (error instanceof Error && error.message.includes('PINTEREST_ENV')) throw error;
    return undefined;
  }
}

/**
 * Returns a usable access token, refreshing it when it is within an hour of
 * expiry so a long render job never dies mid-flight.
 */
export async function getAccessToken(config: PinterestConfig): Promise<string> {
  if (config.accessToken) return config.accessToken;

  const stored = readToken(config);
  if (!stored) {
    throw new SetupError(
      'No Pinterest token found. Run `npm run pinterest:authorize` to create one.',
    );
  }

  const oneHour = 60 * 60 * 1000;
  if (Date.now() < stored.expiresAt - oneHour) return stored.accessToken;

  const refreshed = await refreshToken(config, stored);
  saveToken(config, refreshed);
  return refreshed.accessToken;
}
