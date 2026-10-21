/**
 * Pesquisa web genérica para o Daily Agent.
 * Fonte de inspiração apenas — nunca fonte de verdade nutricional.
 *
 * Providers (por ordem):
 * 1) Tavily se TAVILY_API_KEY
 * 2) Brave se BRAVE_SEARCH_API_KEY
 * 3) DuckDuckGo HTML (sem key)
 *
 * Desactivar: WEB_SEARCH_ENABLED=false
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.WEB_SEARCH_TIMEOUT_MS || 4500);
const MAX_RESULTS = 6;

function isEnabled() {
  const raw = String(process.env.WEB_SEARCH_ENABLED || 'true').toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

function providerName() {
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.BRAVE_SEARCH_API_KEY) return 'brave';
  return 'duckduckgo';
}

/**
 * Remove instruções hostis / HTML e limita tamanho.
 * Conteúdo externo = dados, nunca instruções.
 */
function sanitizeExternalText(text, maxLen = 400) {
  let t = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Neutralizar tentativas de prompt injection comuns
  t = t.replace(
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    '[conteúdo externo omitido]',
  );
  t = t.replace(/system\s*prompt|you\s+are\s+now|jailbreak/gi, '[conteúdo externo omitido]');
  t = t.replace(/esqueça\s+(as\s+)?instruções|ignore\s+as\s+instruções/gi, '[conteúdo externo omitido]');
  if (t.length > maxLen) t = `${t.slice(0, maxLen - 1)}…`;
  return t;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(query, { maxResults = MAX_RESULTS } = {}) {
  const key = process.env.TAVILY_API_KEY;
  const res = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      include_answer: false,
      max_results: maxResults,
    }),
  });
  if (!res.ok) throw new Error(`tavily_http_${res.status}`);
  const json = await res.json();
  const results = Array.isArray(json.results) ? json.results : [];
  return results.map((r, i) => ({
    rank: i + 1,
    title: sanitizeExternalText(r.title, 120),
    snippet: sanitizeExternalText(r.content || r.snippet, 320),
    url: String(r.url || '').slice(0, 500),
    source: 'tavily',
  }));
}

async function searchBrave(query, { maxResults = MAX_RESULTS } = {}) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key,
    },
  });
  if (!res.ok) throw new Error(`brave_http_${res.status}`);
  const json = await res.json();
  const results = json?.web?.results || [];
  return results.map((r, i) => ({
    rank: i + 1,
    title: sanitizeExternalText(r.title, 120),
    snippet: sanitizeExternalText(r.description, 320),
    url: String(r.url || '').slice(0, 500),
    source: 'brave',
  }));
}

/**
 * DuckDuckGo HTML — sem API key. Frágil mas suficiente para inspiração.
 */
async function searchDuckDuckGo(query, { maxResults = MAX_RESULTS } = {}) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; BlackHouseAgent/1.0; +https://blackhouse.app.br)',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`ddg_http_${res.status}`);
  const html = await res.text();
  const results = [];
  const re =
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)/gi;
  let m;
  while ((m = re.exec(html)) && results.length < maxResults) {
    const rawHref = m[1];
    let href = rawHref;
    // DDG envolve redirects: //duckduckgo.com/l/?uddg=...
    const uddg = /uddg=([^&]+)/.exec(rawHref);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {
        href = rawHref;
      }
    }
    results.push({
      rank: results.length + 1,
      title: sanitizeExternalText(m[2], 120),
      snippet: sanitizeExternalText(m[3], 320),
      url: String(href || '').slice(0, 500),
      source: 'duckduckgo',
    });
  }

  // Fallback mais permissivo se o HTML mudou
  if (!results.length) {
    const loose = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = loose.exec(html)) && results.length < maxResults) {
      results.push({
        rank: results.length + 1,
        title: sanitizeExternalText(lm[1], 120),
        snippet: '',
        url: '',
        source: 'duckduckgo',
      });
    }
  }

  return results;
}

/**
 * @param {string} query
 * @param {{ maxResults?: number }} [opts]
 * @returns {Promise<{ ok: boolean, provider: string, query: string, results: object[], error?: string, latency_ms: number }>}
 */
async function searchWeb(query, opts = {}) {
  const started = Date.now();
  const q = String(query || '').trim().slice(0, 220);
  if (!isEnabled()) {
    return {
      ok: false,
      provider: 'disabled',
      query: q,
      results: [],
      error: 'web_search_disabled',
      latency_ms: Date.now() - started,
    };
  }
  if (!q) {
    return {
      ok: false,
      provider: providerName(),
      query: q,
      results: [],
      error: 'empty_query',
      latency_ms: Date.now() - started,
    };
  }

  const maxResults = Math.min(Number(opts.maxResults) || MAX_RESULTS, 8);
  const provider = providerName();

  try {
    let results = [];
    if (provider === 'tavily') results = await searchTavily(q, { maxResults });
    else if (provider === 'brave') results = await searchBrave(q, { maxResults });
    else results = await searchDuckDuckGo(q, { maxResults });

    return {
      ok: true,
      provider,
      query: q,
      results,
      latency_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      provider,
      query: q,
      results: [],
      error: err?.name === 'AbortError' ? 'timeout' : err?.message || 'search_failed',
      latency_ms: Date.now() - started,
    };
  }
}

module.exports = {
  isEnabled,
  providerName,
  sanitizeExternalText,
  searchWeb,
};
