type SharedMenuRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  email: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export function isSharedMenuEnabled(): boolean {
  return process.env.SHARED_MENU_SOURCE === 'service';
}

function buildSharedMenuUrl(path: string, query?: SharedMenuRequestOptions['query']): string {
  const baseUrl = process.env.SHARED_MENU_SERVICE_URL;
  if (!baseUrl) {
    throw new Error('SHARED_MENU_SERVICE_URL is not configured');
  }

  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function sharedMenuRequest<T>(options: SharedMenuRequestOptions): Promise<T> {
  const token = process.env.SHARED_MENU_SERVICE_TOKEN;
  if (!token) {
    throw new Error('SHARED_MENU_SERVICE_TOKEN is not configured');
  }

  const url = buildSharedMenuUrl(options.path, options.query);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': token,
      'X-User-Email': options.email.toLowerCase(),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Shared menu service request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
