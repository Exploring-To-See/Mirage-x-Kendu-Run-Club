import { getAccessToken } from './auth.ts';
import { loadConfig, type PinterestConfig } from './config.ts';

export class PinterestApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly path: string,
  ) {
    super(`Pinterest API ${status} on ${path}: ${body}`);
    this.name = 'PinterestApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/** A page of results. Pinterest paginates with an opaque `bookmark` cursor. */
export interface Page<T> {
  items: T[];
  bookmark?: string;
}

const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PinterestClient {
  constructor(readonly config: PinterestConfig = loadConfig()) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body } = options;

    const url = new URL(`${this.config.apiBase}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Fetched per attempt so a mid-loop refresh is picked up.
      const token = await getAccessToken(this.config);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      const text = await response.text();

      // 429 is the documented rate limit; trial access is metered per day, so
      // honour Retry-After rather than hammering.
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new PinterestApiError(response.status, text, path);
      }

      const retryAfter = Number(response.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2 ** attempt * 500;

      lastError = new PinterestApiError(response.status, text, path);
      await sleep(backoff);
    }

    throw lastError ?? new Error(`Pinterest request to ${path} failed.`);
  }

  /** Fetch one page of a list endpoint. */
  async page<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): Promise<Page<T>> {
    const raw = await this.request<{ items: T[]; bookmark?: string }>(path, { query });
    return { items: raw.items ?? [], ...(raw.bookmark ? { bookmark: raw.bookmark } : {}) };
  }

  /**
   * Walk every page of a list endpoint. `limit` caps total items so a board
   * with 10,000 pins cannot quietly burn the whole rate-limit budget.
   */
  async *paginate<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
    limit = 500,
  ): AsyncGenerator<T> {
    let bookmark: string | undefined;
    let yielded = 0;

    do {
      const page = await this.page<T>(path, { page_size: 25, ...query, bookmark });
      for (const item of page.items) {
        yield item;
        if (++yielded >= limit) return;
      }
      bookmark = page.bookmark;
    } while (bookmark);
  }

  async collect<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
    limit = 500,
  ): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this.paginate<T>(path, query, limit)) out.push(item);
    return out;
  }
}
