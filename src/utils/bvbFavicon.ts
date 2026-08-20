const GOOGLE_FAVICON = 'https://www.google.com/s2/favicons';

/** Legal-form tokens that never appear in the company website host. */
const LEGAL_TOKENS = new Set([
  'sa',
  'srl',
  'nv',
  'plc',
  'pcl',
  'ltd',
  'se',
  'ag',
  'spa',
  'inc',
]);

/** Romanian issuer acronyms that prefix the actual brand (SN, CNTEE, …). */
const PREFIX_ACRONYMS = new Set(['sngn', 'sntgn', 'speeh', 'cntee', 'sntee']);

const CITY_TOKENS = new Set([
  'arad',
  'baia',
  'bistrita',
  'brasov',
  'buc',
  'bucur',
  'bucuresti',
  'cluj',
  'constanta',
  'craiova',
  'galati',
  'iasi',
  'mare',
  'medias',
  'napoca',
  'oradea',
  'pitesti',
  'ploiesti',
  'romania',
  'romaniei',
  'sibiu',
  'slatina',
  'timisoara',
]);

const STOP_TOKENS = new Set([
  'and',
  'communications',
  'company',
  'corp',
  'corporation',
  'de',
  'din',
  'franchise',
  'generale',
  'group',
  'groupe',
  'grup',
  'holding',
  'holdings',
  'international',
  'limited',
  'of',
  'properties',
  'public',
  'rafinare',
  'si',
  'societe',
  'systems',
  'the',
]);

/** Short filler words from BVB short names (e.g. "Aquila Part Prod Com"). */
const FILLER_TOKENS = new Set(['com', 'part', 'prod']);

/** Known BVB issuers whose website cannot be deduced from the Yahoo name. */
const DOMAIN_OVERRIDES_BY_TICKER: Record<string, string> = {
  'TVBETETF.RO': 'patriafonduri.ro',
  'WINE.RO': 'chateau-purcari.com',
};

const DOMAIN_OVERRIDES_BY_NAME: Record<string, string> = {
  'fdi etf bet patria tradeville': 'patriafonduri.ro',
  'purcari wineries': 'chateau-purcari.com',
  'purcari wineries pcl': 'chateau-purcari.com',
  'purcari wineries public company limited': 'chateau-purcari.com',
};

export function isBvbListing(ticker: string, currency?: string): boolean {
  const normalized = ticker.trim().toUpperCase();
  if (normalized.endsWith('-USD')) return false;
  return normalized.endsWith('.RO') || currency === 'RON';
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

function tokenizeCompanyName(name: string): string[] {
  const normalized = stripDiacritics(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ');

  return normalized
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !LEGAL_TOKENS.has(token))
    .filter((token) => !PREFIX_ACRONYMS.has(token))
    .filter((token) => !CITY_TOKENS.has(token))
    .filter((token) => !STOP_TOKENS.has(token))
    .filter((token) => !FILLER_TOKENS.has(token));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeNameKey(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function overrideDomain(ticker?: string, name?: string): string | null {
  if (ticker) {
    const mapped = DOMAIN_OVERRIDES_BY_TICKER[ticker.trim().toUpperCase()];
    if (mapped) return mapped;
  }
  if (name) {
    const mapped = DOMAIN_OVERRIDES_BY_NAME[normalizeNameKey(name)];
    if (mapped) return mapped;
  }
  return null;
}

function domainsForHost(host: string): string[] {
  const normalized = host.replace(/^www\./, '');
  return unique([normalized, `www.${normalized}`]);
}

/** Guess likely website hosts from a BVB issuer name (Yahoo shortName / longName). */
export function deduceBvbDomains(name: string, ticker?: string): string[] {
  const override = overrideDomain(ticker, name);
  if (override) return domainsForHost(override);

  const tokens = tokenizeCompanyName(name);
  if (tokens.length === 0) return [];

  const joined = tokens.join('');
  const first = tokens[0];
  const domains = [`${joined}.ro`, `www.${joined}.ro`];

  if (first && first !== joined) {
    domains.push(`${first}.ro`);
  }
  if (joined.length >= 4) {
    domains.push(`${joined}.com`);
  }

  return unique(domains.filter((domain) => domain.replace(/^www\./, '').split('.')[0].length >= 3));
}

export function bvbFaviconUrls(name: string, ticker?: string): string[] {
  return deduceBvbDomains(name, ticker).map(
    (domain) => `${GOOGLE_FAVICON}?domain=${encodeURIComponent(domain)}&sz=128`,
  );
}
