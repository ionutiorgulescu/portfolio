const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3030').replace(/\/$/, '');

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(messageFromBody(body, status));
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export type HttpOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

let inFlightRefresh: Promise<boolean> | null = null;

function isAuthPath(path: string): boolean {
  const pathname = path.split('?')[0] ?? path;
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

async function refreshAuthCookies(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = request<{ user: unknown }>('/auth/refresh', { method: 'POST' }, true)
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  return inFlightRefresh;
}

export async function http<T = unknown>(path: string, options: HttpOptions = {}): Promise<T> {
  return request<T>(path, options, false);
}

async function request<T>(path: string, options: HttpOptions, isRetry: boolean): Promise<T> {
  const { body, headers: headersInit, ...rest } = options;
  const headers = new Headers(headersInit);

  let encoded: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
      encoded = body;
    } else {
      encoded = JSON.stringify(body);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...rest,
    body: encoded,
    credentials: 'include',
    headers,
  });

  const parsed = await parseJsonBody(response);

  if (!response.ok) {
    if (response.status === 401 && !isRetry && !isAuthPath(path)) {
      const refreshed = await refreshAuthCookies();
      if (refreshed) {
        return request<T>(path, options, true);
      }
    }
    throw new HttpError(response.status, parsed);
  }

  return parsed as T;
}

function messageFromBody(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'string' && error) {
      return error;
    }
  }
  if (typeof body === 'string' && body) {
    return body;
  }
  return `Request failed with status ${status}`;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
