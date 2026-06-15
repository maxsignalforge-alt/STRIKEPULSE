import { createServer } from "node:http";

import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key.trim()]) {
      process.env[key.trim()] = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const PORT = Number(process.env.PORT || 8787);
const APP_VERSION = "0.1.0-prototype";
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const POLYGON_BASE_URL = "https://api.polygon.io";
const PROVIDER_MODE = process.env.PROVIDER_MODE || "mock";

const rangeConfig = {
  "1m": { resolution: "1", seconds: 60 * 90, polygonMultiplier: 1, polygonTimespan: "minute" },
  "5m": { resolution: "5", seconds: 60 * 5 * 90, polygonMultiplier: 5, polygonTimespan: "minute" },
  "15m": { resolution: "15", seconds: 60 * 15 * 90, polygonMultiplier: 15, polygonTimespan: "minute" },
  "1h": { resolution: "60", seconds: 60 * 60 * 90, polygonMultiplier: 1, polygonTimespan: "hour" }
};

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "http://127.0.0.1:4173",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(payload);
}

function getMarketDataKey() {
  if (providerKind() === "polygon") {
    return process.env.POLYGON_API_KEY || process.env.MARKET_DATA_API_KEY || "";
  }
  return process.env.FINNHUB_API_KEY || process.env.MARKET_DATA_API_KEY || "";
}

function providerKind() {
  const mode = String(PROVIDER_MODE || "mock").toLowerCase();
  if (["polygon", "massive", "polygon.io"].includes(mode)) return "polygon";
  if (mode === "finnhub") return "finnhub";
  return mode;
}

function cleanSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(symbol)) {
    throw new Error("Invalid symbol");
  }
  return symbol;
}

function cleanRange(value) {
  const range = String(value || "1m").trim();
  return rangeConfig[range] ? range : "1m";
}

function cleanOptionsTicker(value) {
  const ticker = String(value || "").trim().toUpperCase();
  if (!/^O:[A-Z][A-Z0-9.\-]{0,14}\d{6}[CP]\d{8}$/.test(ticker)) {
    throw new Error("Invalid options ticker");
  }
  return ticker;
}

function cleanAsOf(value) {
  const asOf = String(value || "").trim();
  if (!asOf) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error("Invalid as_of date");
  }
  return asOf;
}

function cleanInt(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function cleanChoice(value, allowed, fallback) {
  const option = String(value || "").trim();
  return allowed.includes(option) ? option : fallback;
}

function cleanTimestampFilter(value) {
  const timestamp = String(value || "").trim();
  if (!timestamp) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp) || /^\d{13,19}$/.test(timestamp)) return timestamp;
  throw new Error("Invalid timestamp filter");
}

function cleanBool(value, fallback = true) {
  const option = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(option)) return "true";
  if (["false", "0", "no"].includes(option)) return "false";
  return fallback ? "true" : "false";
}

function cleanMarket(value) {
  return cleanChoice(value, ["stocks", "otc", "crypto", "fx", "indices"], "stocks");
}

function cleanTickerType(value) {
  const type = String(value || "").trim().toUpperCase();
  if (!type) return "";
  if (!/^[A-Z0-9_]{1,24}$/.test(type)) throw new Error("Invalid ticker type");
  return type;
}

function cleanSearch(value) {
  const search = String(value || "").trim().toUpperCase();
  if (!search) return "";
  if (!/^[A-Z0-9 .:\-]{1,32}$/.test(search)) throw new Error("Invalid search");
  return search;
}

async function fetchFinnhub(path, params) {
  const token = getMarketDataKey();
  if (!token) {
    const error = new Error("Market data provider key is not configured");
    error.status = 503;
    throw error;
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  url.searchParams.set("token", token);

  const response = await fetch(url, {
    headers: { "accept": "application/json" }
  });
  if (!response.ok) {
    const error = new Error(`Finnhub returned ${response.status}`);
    error.status = 502;
    throw error;
  }
  return response.json();
}

async function fetchPolygon(path, params = {}) {
  const token = getMarketDataKey();
  if (!token) {
    const error = new Error("Market data provider key is not configured");
    error.status = 503;
    throw error;
  }

  const url = new URL(`${POLYGON_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  url.searchParams.set("apiKey", token);

  const response = await fetch(url, {
    headers: { "accept": "application/json" }
  });
  if (!response.ok) {
    const error = new Error(`Polygon returned ${response.status}`);
    error.status = 502;
    throw error;
  }
  return response.json();
}

async function getFinnhubQuote(symbol) {
  const quote = await fetchFinnhub("/quote", { symbol });
  if (!Number.isFinite(quote.c) || quote.c <= 0) {
    const error = new Error("Quote response did not include a current price");
    error.status = 502;
    throw error;
  }
  return {
    provider: "finnhub",
    symbol,
    price: quote.c,
    change: Number.isFinite(quote.d) ? quote.d : 0,
    changePercent: Number.isFinite(quote.dp) ? quote.dp : 0,
    high: quote.h,
    low: quote.l,
    open: quote.o,
    previousClose: quote.pc,
    timestamp: quote.t ? new Date(quote.t * 1000).toISOString() : new Date().toISOString()
  };
}

async function getPolygonQuote(symbol) {
  try {
    const result = await fetchPolygon(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);
    const ticker = result.ticker || {};
    const lastTrade = ticker.lastTrade || {};
    const day = ticker.day || {};
    const prevDay = ticker.prevDay || {};
    const price = lastTrade.p || day.c;
    if (!Number.isFinite(price) || price <= 0) {
      const error = new Error("Polygon snapshot did not include a current price");
      error.status = 502;
      throw error;
    }
    return {
      provider: "polygon",
      symbol,
      price,
      change: Number.isFinite(ticker.todaysChange) ? ticker.todaysChange : 0,
      changePercent: Number.isFinite(ticker.todaysChangePerc) ? ticker.todaysChangePerc : 0,
      high: day.h,
      low: day.l,
      open: day.o,
      previousClose: prevDay.c,
      timestamp: new Date().toISOString()
    };
  } catch {
    const fallback = await getPolygonCandles(symbol, "1m");
    const latest = fallback.candles.at(-1);
    const previous = fallback.candles.at(-2) || latest;
    const change = latest.close - previous.close;
    return {
      provider: "polygon",
      source: "aggregate-fallback",
      symbol,
      price: latest.close,
      change,
      changePercent: previous.close ? (change / previous.close) * 100 : 0,
      high: latest.high,
      low: latest.low,
      open: latest.open,
      previousClose: previous.close,
      timestamp: latest.time
    };
  }
}

async function getFinnhubCandles(symbol, range) {
  const config = rangeConfig[range];
  const to = Math.floor(Date.now() / 1000);
  const from = to - config.seconds;
  const result = await fetchFinnhub("/stock/candle", {
    symbol,
    resolution: config.resolution,
    from,
    to
  });

  if (result.s !== "ok" || !Array.isArray(result.c) || !result.c.length) {
    const error = new Error("No candle data returned by provider");
    error.status = 502;
    throw error;
  }

  return {
    provider: "finnhub",
    symbol,
    range,
    resolution: config.resolution,
    candles: result.c.map((close, index) => ({
      open: result.o[index],
      high: result.h[index],
      low: result.l[index],
      close,
      volume: result.v[index],
      time: result.t[index] ? new Date(result.t[index] * 1000).toISOString() : null
    })).filter(candle =>
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
    )
  };
}

async function getPolygonAggregateCandles(ticker, range, labelKey = "symbol") {
  const config = rangeConfig[range];
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await fetchPolygon(
    `/v2/aggs/ticker/${ticker}/range/${config.polygonMultiplier}/${config.polygonTimespan}/${fromDate}/${toDate}`,
    { adjusted: "true", sort: "asc", limit: "500" }
  );
  const bars = Array.isArray(result.results) ? result.results.slice(-120) : [];
  if (!["OK", "DELAYED"].includes(result.status) || !bars.length) {
    const error = new Error("No candle data returned by Polygon");
    error.status = 502;
    throw error;
  }
  const candles = bars.map(bar => ({
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    time: bar.t ? new Date(bar.t).toISOString() : null
  })).filter(candle =>
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
  if (!candles.length) {
    const error = new Error("Polygon candle response did not include valid OHLC bars");
    error.status = 502;
    throw error;
  }
  return {
    provider: "polygon",
    [labelKey]: ticker,
    range,
    resolution: `${config.polygonMultiplier}${config.polygonTimespan}`,
    candles
  };
}

async function getPolygonCandles(symbol, range) {
  return getPolygonAggregateCandles(symbol, range, "symbol");
}

async function getPolygonOptionCandles(optionsTicker, range) {
  return getPolygonAggregateCandles(optionsTicker, range, "contract");
}

async function getLiveQuote(symbol) {
  const provider = providerKind();
  if (provider === "polygon") return getPolygonQuote(symbol);
  if (provider === "finnhub") return getFinnhubQuote(symbol);
  const error = new Error(`Unsupported provider mode: ${PROVIDER_MODE}`);
  error.status = 400;
  throw error;
}

async function getLiveCandles(symbol, range) {
  const provider = providerKind();
  if (provider === "polygon") return getPolygonCandles(symbol, range);
  if (provider === "finnhub") return getFinnhubCandles(symbol, range);
  const error = new Error(`Unsupported provider mode: ${PROVIDER_MODE}`);
  error.status = 400;
  throw error;
}

async function getPolygonOptionContract(optionsTicker, asOf = "") {
  const result = await fetchPolygon(`/v3/reference/options/contracts/${optionsTicker}`, asOf ? { as_of: asOf } : {});
  if (!result.results) {
    const error = new Error("No option contract details returned by Polygon");
    error.status = 502;
    throw error;
  }
  return {
    provider: "polygon",
    contract: result.results,
    requestId: result.request_id,
    status: result.status
  };
}

async function getOptionContract(optionsTicker, asOf = "") {
  if (providerKind() === "polygon") return getPolygonOptionContract(optionsTicker, asOf);
  const error = new Error("Option contract reference is only implemented for Polygon/Massive mode");
  error.status = 400;
  throw error;
}

async function getOptionCandles(optionsTicker, range) {
  if (providerKind() === "polygon") return getPolygonOptionCandles(optionsTicker, range);
  const error = new Error("Option contract candles are only implemented for Polygon/Massive mode");
  error.status = 400;
  throw error;
}

async function getPolygonOptionTrades(optionsTicker, searchParams) {
  const params = {
    limit: cleanInt(searchParams.get("limit"), 100, 1, 500),
    sort: cleanChoice(searchParams.get("sort"), ["timestamp"], "timestamp"),
    order: cleanChoice(searchParams.get("order"), ["asc", "desc"], "desc")
  };
  for (const key of ["timestamp", "timestamp.lt", "timestamp.lte", "timestamp.gt", "timestamp.gte"]) {
    const value = cleanTimestampFilter(searchParams.get(key));
    if (value) params[key] = value;
  }
  const result = await fetchPolygon(`/v3/trades/${optionsTicker}`, params);
  return {
    provider: "polygon",
    contract: optionsTicker,
    trades: Array.isArray(result.results) ? result.results : [],
    requestId: result.request_id,
    status: result.status,
    nextUrl: result.next_url
  };
}

async function getOptionTrades(optionsTicker, searchParams) {
  if (providerKind() === "polygon") return getPolygonOptionTrades(optionsTicker, searchParams);
  const error = new Error("Option contract trades are only implemented for Polygon/Massive mode");
  error.status = 400;
  throw error;
}

async function getPolygonOptionSma(optionsTicker, searchParams) {
  const params = {
    timespan: cleanChoice(searchParams.get("timespan"), ["minute", "hour", "day", "week", "month", "quarter", "year"], "day"),
    adjusted: cleanBool(searchParams.get("adjusted"), true),
    window: cleanInt(searchParams.get("window"), 50, 2, 250),
    series_type: cleanChoice(searchParams.get("series_type"), ["open", "high", "low", "close"], "close"),
    order: cleanChoice(searchParams.get("order"), ["asc", "desc"], "desc"),
    limit: cleanInt(searchParams.get("limit"), 10, 1, 500)
  };
  const includeUnderlying = cleanBool(searchParams.get("include_underlying"), false);
  if (includeUnderlying === "true") params.include_underlying = "true";
  for (const key of ["timestamp", "timestamp.lt", "timestamp.lte", "timestamp.gt", "timestamp.gte"]) {
    const value = cleanTimestampFilter(searchParams.get(key));
    if (value) params[key] = value;
  }
  const result = await fetchPolygon(`/v1/indicators/sma/${optionsTicker}`, params);
  return {
    provider: "polygon",
    contract: optionsTicker,
    indicator: "sma",
    values: result.results?.values || [],
    underlying: includeUnderlying === "true" ? result.results?.underlying : undefined,
    requestId: result.request_id,
    status: result.status,
    nextUrl: result.next_url
  };
}

async function getOptionSma(optionsTicker, searchParams) {
  if (providerKind() === "polygon") return getPolygonOptionSma(optionsTicker, searchParams);
  const error = new Error("Option contract SMA is only implemented for Polygon/Massive mode");
  error.status = 400;
  throw error;
}

function polygonIndicatorParams(searchParams, indicator) {
  const params = {
    timespan: cleanChoice(searchParams.get("timespan"), ["minute", "hour", "day", "week", "month", "quarter", "year"], "day"),
    adjusted: cleanBool(searchParams.get("adjusted"), true),
    series_type: cleanChoice(searchParams.get("series_type"), ["open", "high", "low", "close"], "close"),
    order: cleanChoice(searchParams.get("order"), ["asc", "desc"], "desc"),
    limit: cleanInt(searchParams.get("limit"), 10, 1, 500)
  };
  if (["sma", "ema", "rsi"].includes(indicator)) {
    params.window = cleanInt(searchParams.get("window"), 50, 2, 250);
  }
  if (indicator === "macd") {
    params.short_window = cleanInt(searchParams.get("short_window"), 12, 2, 100);
    params.long_window = cleanInt(searchParams.get("long_window"), 26, 3, 250);
    params.signal_window = cleanInt(searchParams.get("signal_window"), 9, 2, 100);
    if (params.short_window >= params.long_window) {
      params.short_window = 12;
      params.long_window = 26;
    }
  }
  const includeUnderlying = cleanBool(searchParams.get("include_underlying"), false);
  if (includeUnderlying === "true") params.include_underlying = "true";
  for (const key of ["timestamp", "timestamp.lt", "timestamp.lte", "timestamp.gt", "timestamp.gte"]) {
    const value = cleanTimestampFilter(searchParams.get(key));
    if (value) params[key] = value;
  }
  return { params, includeUnderlying };
}

async function getPolygonOptionIndicator(optionsTicker, indicator, searchParams) {
  const { params, includeUnderlying } = polygonIndicatorParams(searchParams, indicator);
  const result = await fetchPolygon(`/v1/indicators/${indicator}/${optionsTicker}`, params);
  return {
    provider: "polygon",
    contract: optionsTicker,
    indicator,
    values: result.results?.values || [],
    underlying: includeUnderlying === "true" ? result.results?.underlying : undefined,
    requestId: result.request_id,
    status: result.status,
    nextUrl: result.next_url
  };
}

async function getOptionIndicator(optionsTicker, indicator, searchParams) {
  if (providerKind() !== "polygon") {
    const error = new Error("Option contract indicators are only implemented for Polygon/Massive mode");
    error.status = 400;
    throw error;
  }
  if (!["ema", "macd", "rsi"].includes(indicator)) {
    const error = new Error("Unsupported option indicator");
    error.status = 400;
    throw error;
  }
  return getPolygonOptionIndicator(optionsTicker, indicator, searchParams);
}

async function getReferenceTickers(searchParams) {
  if (providerKind() !== "polygon") {
    const error = new Error("Ticker reference search is only implemented for Polygon/Massive mode");
    error.status = 400;
    throw error;
  }
  const params = {
    market: cleanMarket(searchParams.get("market")),
    active: cleanBool(searchParams.get("active"), true),
    limit: cleanInt(searchParams.get("limit"), 25, 1, 100),
    sort: cleanChoice(searchParams.get("sort"), ["ticker", "name", "market", "locale", "primary_exchange", "type", "currency_symbol"], "ticker"),
    order: cleanChoice(searchParams.get("order"), ["asc", "desc"], "asc")
  };
  const search = cleanSearch(searchParams.get("search"));
  if (search) params.search = search;
  const type = cleanTickerType(searchParams.get("type"));
  if (type) params.type = type;
  const result = await fetchPolygon("/v3/reference/tickers", params);
  return {
    provider: "polygon",
    tickers: Array.isArray(result.results) ? result.results : [],
    requestId: result.request_id,
    status: result.status,
    nextUrl: result.next_url
  };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function sanitizeAiPayload(input) {
  const allowed = {
    symbol: input.symbol,
    direction: input.direction,
    qualityGate: input.qualityGate,
    qualityBlockers: Array.isArray(input.qualityBlockers) ? input.qualityBlockers.slice(0, 4) : [],
    nineSig: input.nineSig,
    contract: input.contract,
    entryStatus: input.entryStatus,
    entryTrigger: input.entryTrigger,
    stop: input.stop,
    target: input.target,
    premium: input.premium,
    journalTags: Array.isArray(input.journalTags) ? input.journalTags.slice(0, 12) : []
  };

  return Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined && value !== null)
  );
}

function mockMarketContext() {
  return {
    provider: "mock",
    spy: { trend: "Bullish", score: 78 },
    qqq: { trend: "Bullish", score: 84 },
    vix: { state: "Calm", score: 74 },
    breadth: { state: "Positive", score: 69 },
    updatedAt: new Date().toISOString()
  };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        app: "STRIKEPULSE API",
        version: APP_VERSION,
        providerMode: PROVIDER_MODE,
        marketDataConfigured: Boolean(getMarketDataKey())
      });
    }

    if (req.method === "GET" && url.pathname === "/api/market/context") {
      return json(res, 200, mockMarketContext());
    }

    if (req.method === "GET" && url.pathname === "/api/market/quote") {
      const symbol = cleanSymbol(url.searchParams.get("symbol"));
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Live quotes are disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getLiveQuote(symbol));
    }

    if (req.method === "GET" && url.pathname === "/api/market/candles") {
      const symbol = cleanSymbol(url.searchParams.get("symbol"));
      const range = cleanRange(url.searchParams.get("range"));
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Live candles are disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getLiveCandles(symbol, range));
    }

    if (req.method === "GET" && url.pathname === "/api/options/contract") {
      const optionsTicker = cleanOptionsTicker(url.searchParams.get("contract"));
      const asOf = cleanAsOf(url.searchParams.get("as_of"));
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Option contract reference is disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getOptionContract(optionsTicker, asOf));
    }

    if (req.method === "GET" && url.pathname === "/api/options/candles") {
      const optionsTicker = cleanOptionsTicker(url.searchParams.get("contract"));
      const range = cleanRange(url.searchParams.get("range"));
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Option contract candles are disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getOptionCandles(optionsTicker, range));
    }

    if (req.method === "GET" && url.pathname === "/api/options/trades") {
      const optionsTicker = cleanOptionsTicker(url.searchParams.get("contract"));
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Option contract trades are disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getOptionTrades(optionsTicker, url.searchParams));
    }

    if (req.method === "GET" && url.pathname === "/api/options/sma") {
      const optionsTicker = cleanOptionsTicker(url.searchParams.get("contract"));
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Option contract SMA is disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getOptionSma(optionsTicker, url.searchParams));
    }

    if (req.method === "GET" && ["/api/options/ema", "/api/options/macd", "/api/options/rsi"].includes(url.pathname)) {
      const optionsTicker = cleanOptionsTicker(url.searchParams.get("contract"));
      const indicator = url.pathname.split("/").at(-1);
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: `Option contract ${indicator.toUpperCase()} is disabled while PROVIDER_MODE=mock`
        });
      }
      return json(res, 200, await getOptionIndicator(optionsTicker, indicator, url.searchParams));
    }

    if (req.method === "GET" && url.pathname === "/api/reference/tickers") {
      if (PROVIDER_MODE === "mock") {
        return json(res, 409, {
          ok: false,
          providerMode: PROVIDER_MODE,
          message: "Ticker reference search is disabled while PROVIDER_MODE=mock"
        });
      }
      return json(res, 200, await getReferenceTickers(url.searchParams));
    }

    if (req.method === "GET" && url.pathname === "/api/user/state") {
      return json(res, 501, {
        ok: false,
        message: "Cloud sync is not connected yet. Add Supabase auth before reading user state.",
        localFallback: true
      });
    }

    if (req.method === "POST" && url.pathname === "/api/ai/setup-review") {
      const input = await readJson(req);
      const sanitized = sanitizeAiPayload(input);
      return json(res, 200, {
        mode: "mock-ai",
        sanitized,
        review: `${sanitized.symbol || "This setup"} is ${sanitized.qualityGate || "unrated"}. Review entry, stop, premium risk, and blockers before taking action.`,
        privacy: "Only sanitized trade context was accepted. Personal identity and brokerage fields are ignored."
      });
    }

    if (req.method === "POST" && url.pathname === "/api/push/subscribe") {
      return json(res, 501, {
        ok: false,
        message: "Push subscriptions are not connected yet. Use Firebase Cloud Messaging, Web Push, or Twilio in a later phase."
      });
    }

    if (req.method === "POST" && url.pathname === "/api/checkout/create-session") {
      return json(res, 501, {
        ok: false,
        message: "Checkout is not connected yet. Create Stripe Checkout sessions server-side in a later phase."
      });
    }

    if (req.method === "POST" && url.pathname === "/api/user/state") {
      return json(res, 501, {
        ok: false,
        message: "Cloud sync is not connected yet. Local prototype storage remains the source of truth.",
        acceptedKeys: [
          "preferences",
          "watchlists",
          "alerts",
          "journalEntries",
          "paperAccount",
          "signalHistory"
        ]
      });
    }

    if (req.method === "POST" && ["/api/journal", "/api/alerts", "/api/paper-trades"].includes(url.pathname)) {
      return json(res, 501, {
        ok: false,
        message: "Authenticated Supabase writes are not connected yet.",
        route: url.pathname
      });
    }

    return json(res, 404, { ok: false, message: "Not found" });
  } catch (error) {
    return json(res, error.status || 500, {
      ok: false,
      message: "Server error",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`STRIKEPULSE API listening on http://127.0.0.1:${PORT}`);
});
