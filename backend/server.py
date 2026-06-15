from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from strikepulse_signal_engine import (
    ContractSnapshot,
    IndicatorSnapshot,
    MarketSnapshot,
    build_signal_report,
    report_to_dict,
)


APP_VERSION = "0.1.0-prototype"
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
POLYGON_BASE_URL = "https://api.polygon.io"
HOST = "127.0.0.1"
POLYGON_CACHE = {}
POLYGON_CACHE_TTL_SECONDS = int(os.environ.get("POLYGON_CACHE_TTL_SECONDS", "45"))
LIVE_OPTIONS_SIGNAL_CACHE = {}
LIVE_OPTIONS_SIGNAL_TTL_SECONDS = int(os.environ.get("LIVE_OPTIONS_SIGNAL_TTL_SECONDS", "20"))

RANGE_CONFIG = {
    "1m": {"resolution": "1", "seconds": 60 * 90, "polygon_multiplier": 1, "polygon_timespan": "minute"},
    "5m": {"resolution": "5", "seconds": 60 * 5 * 90, "polygon_multiplier": 5, "polygon_timespan": "minute"},
    "15m": {"resolution": "15", "seconds": 60 * 15 * 90, "polygon_multiplier": 15, "polygon_timespan": "minute"},
    "1h": {"resolution": "60", "seconds": 60 * 60 * 90, "polygon_multiplier": 1, "polygon_timespan": "hour"},
}

LOCAL_ECONOMIC_EVENTS = [
    {
        "id": "weekly-jobless-claims",
        "title": "Weekly Jobless Claims",
        "category": "jobs",
        "severity": "medium",
        "date": "2026-06-04",
        "time": "08:30",
        "timezone": "America/New_York",
        "affectedSymbols": ["SPY", "QQQ", "TQQQ", "NVDA", "AMD", "AAPL", "META", "TSLA"],
        "affectedSectors": ["Index ETF", "Megacap Tech", "Semiconductors", "EVs"],
        "blockerWindowHours": 2,
        "source": "local-curated",
    },
    {
        "id": "oil-inventory-risk",
        "title": "Oil Inventory / Energy Headline Risk",
        "category": "energy",
        "severity": "high",
        "date": "2026-06-04",
        "time": "10:30",
        "timezone": "America/New_York",
        "affectedSymbols": ["XLE", "XOM", "CVX", "USO"],
        "affectedSectors": ["Energy", "Commodity ETF"],
        "blockerWindowHours": 4,
        "source": "local-curated",
    },
    {
        "id": "jobs-report-risk",
        "title": "Jobs Report Risk",
        "category": "jobs",
        "severity": "high",
        "date": "2026-06-05",
        "time": "08:30",
        "timezone": "America/New_York",
        "affectedSymbols": ["SPY", "QQQ", "TQQQ", "NVDA", "AMD", "AAPL", "META", "TSLA"],
        "affectedSectors": ["Index ETF", "Megacap Tech", "Semiconductors", "EVs"],
        "blockerWindowHours": 6,
        "source": "local-curated",
    },
    {
        "id": "inflation-risk-placeholder",
        "title": "Inflation Data Watch",
        "category": "inflation",
        "severity": "high",
        "date": "2026-06-10",
        "time": "08:30",
        "timezone": "America/New_York",
        "affectedSymbols": ["SPY", "QQQ", "TQQQ", "NVDA", "AMD", "AAPL", "META", "TSLA"],
        "affectedSectors": ["Index ETF", "Megacap Tech", "Semiconductors", "EVs"],
        "blockerWindowHours": 8,
        "source": "local-curated",
    },
]

EVENT_SEVERITY_WEIGHT = {"low": 8, "medium": 18, "high": 35}


def load_env_file(path):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(".env.local")
load_env_file(".env")

PORT = int(os.environ.get("PORT", "8787"))
PROVIDER_MODE = os.environ.get("PROVIDER_MODE", "mock")
ECONOMIC_CALENDAR_PROVIDER = os.environ.get("ECONOMIC_CALENDAR_PROVIDER", "finnhub")


def market_data_key():
    provider = provider_kind()
    if provider == "polygon":
        return os.environ.get("POLYGON_API_KEY") or os.environ.get("MARKET_DATA_API_KEY") or ""
    return os.environ.get("FINNHUB_API_KEY") or os.environ.get("MARKET_DATA_API_KEY") or ""


def economic_calendar_key():
    return os.environ.get("ECONOMIC_CALENDAR_API_KEY") or os.environ.get("FINNHUB_API_KEY") or ""


def supabase_url():
    return (os.environ.get("SUPABASE_URL") or "").rstrip("/")


def supabase_anon_key():
    return os.environ.get("SUPABASE_ANON_KEY") or ""


def provider_kind():
    mode = (PROVIDER_MODE or "mock").lower()
    if mode in ("polygon", "massive", "polygon.io"):
        return "polygon"
    if mode == "finnhub":
        return "finnhub"
    return mode


def clean_symbol(value):
    symbol = (value or "").strip().upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,14}", symbol):
        raise ValueError("Invalid symbol")
    return symbol


def clean_range(value):
    return value if value in RANGE_CONFIG else "1m"


def clean_options_ticker(value):
    ticker = (value or "").strip().upper()
    if not re.fullmatch(r"O:[A-Z][A-Z0-9.\-]{0,14}\d{6}[CP]\d{8}", ticker):
        raise ValueError("Invalid options ticker")
    return ticker


def clean_as_of(value):
    if not value:
        return ""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Invalid as_of date")
    return value


def clean_int(value, default, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def clean_choice(value, allowed, default):
    return value if value in allowed else default


def clean_timestamp_filter(value):
    if not value:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) or re.fullmatch(r"\d{13,19}", value):
        return value
    raise ValueError("Invalid timestamp filter")


def clean_bool(value, default=True):
    if value in ("true", "1", "yes"):
        return "true"
    if value in ("false", "0", "no"):
        return "false"
    return "true" if default else "false"


def clean_market(value):
    return clean_choice(value, {"stocks", "otc", "crypto", "fx", "indices"}, "stocks")


def clean_ticker_type(value):
    if not value:
        return ""
    if not re.fullmatch(r"[A-Z0-9_]{1,24}", value.upper()):
        raise ValueError("Invalid ticker type")
    return value.upper()


def clean_search(value):
    text = (value or "").strip().upper()
    if not text:
        return ""
    if not re.fullmatch(r"[A-Z0-9 .:\-]{1,32}", text):
        raise ValueError("Invalid search")
    return text


def clean_sector(value):
    text = (value or "").strip()
    if not text:
        return ""
    if not re.fullmatch(r"[A-Za-z0-9 /&.\-]{1,40}", text):
        raise ValueError("Invalid sector")
    return text


def json_response(handler, status, body):
    payload = json.dumps(body, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("cache-control", "no-store")
    handler.send_header("access-control-allow-origin", os.environ.get("ALLOWED_ORIGIN", "http://127.0.0.1:4173"))
    handler.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
    handler.send_header("access-control-allow-headers", "content-type, authorization")
    handler.end_headers()
    handler.wfile.write(payload)


def bearer_token(handler):
    header = handler.headers.get("authorization", "")
    match = re.fullmatch(r"Bearer\s+(.+)", header.strip(), re.IGNORECASE)
    return match.group(1).strip() if match else ""


def supabase_configured():
    return bool(supabase_url() and supabase_anon_key())


def stable_client_id(prefix, item):
    raw = json.dumps(item, sort_keys=True, default=str)
    return f"{prefix}_{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]}"


def supabase_request(path, method="GET", token="", body=None, prefer="return=minimal"):
    if not supabase_configured():
        raise RuntimeError("Supabase is not configured")
    if not token:
        raise RuntimeError("Supabase access token is required")
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": supabase_anon_key(),
        "authorization": f"Bearer {token}",
        "accept": "application/json",
        "content-type": "application/json",
    }
    if prefer:
        headers["prefer"] = prefer
    request = Request(f"{supabase_url()}{path}", data=data, method=method, headers=headers)
    try:
        with urlopen(request, timeout=12) as response:
            content = response.read().decode("utf-8")
            return json.loads(content) if content else None
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Supabase HTTP {error.code}: {detail}")


def supabase_user(token):
    return supabase_request("/auth/v1/user", token=token, prefer="")


def money_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").replace("$", "").replace(",", "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def clean_sync_text(value, limit=500):
    return str(value or "")[:limit]


def journal_sync_row(user_id, entry):
    client_id = clean_sync_text(entry.get("id") or stable_client_id("journal", entry), 80)
    return {
        "user_id": user_id,
        "client_id": client_id,
        "symbol": clean_sync_text(entry.get("symbol"), 20).upper() or "UNKNOWN",
        "signal": clean_sync_text(entry.get("signal"), 60),
        "contract": clean_sync_text(entry.get("contract"), 180),
        "outcome": clean_sync_text(entry.get("outcome"), 60),
        "entry_trigger": clean_sync_text(entry.get("entryTrigger") or entry.get("entry_trigger"), 240),
        "stop": clean_sync_text(entry.get("stop"), 80),
        "target": clean_sync_text(entry.get("target"), 80),
        "note": clean_sync_text(entry.get("note"), 4000),
        "tags": [clean_sync_text(tag, 80) for tag in (entry.get("tags") or [])[:12]],
    }


def paper_account_row(user_id, account):
    return {
        "user_id": user_id,
        "starting_cash": money_number(account.get("startingCash")) or 25000,
        "cash": money_number(account.get("cash")) or 0,
        "realized_pnl": money_number(account.get("realizedPnl")) or 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def paper_trade_sync_row(user_id, account_id, trade):
    action = str(trade.get("action") or "BUY").upper()
    if action not in ("BUY", "SELL", "CLOSE"):
        action = "BUY"
    client_id = clean_sync_text(trade.get("id") or stable_client_id("paper", trade), 80)
    return {
        "user_id": user_id,
        "client_id": client_id,
        "paper_account_id": account_id,
        "symbol": clean_sync_text(trade.get("symbol"), 20).upper() or "UNKNOWN",
        "contract": clean_sync_text(trade.get("contract") or trade.get("optionTicker"), 180),
        "action": action,
        "quantity": max(1, int(money_number(trade.get("qty") or trade.get("quantity")) or 1)),
        "entry_premium": money_number(trade.get("entryPremium")),
        "exit_premium": money_number(trade.get("exitPremium") or trade.get("lastPremium")),
        "pnl": money_number(trade.get("pnl")) or 0,
        "process_grade": clean_sync_text(trade.get("grade") or trade.get("processGrade"), 20),
        "process_score": int(money_number(trade.get("processScore")) or 0),
        "plan": trade.get("plan") if isinstance(trade.get("plan"), dict) else {},
        "notes": clean_sync_text(trade.get("notes") or "; ".join(trade.get("issues") or []), 1000),
    }


def supabase_sync_state(handler, payload):
    token = bearer_token(handler)
    if not supabase_configured():
        return {
            "ok": False,
            "localFallback": True,
            "message": "Supabase is not configured. Local journal and paper trading remain active.",
            "synced": {"journalEntries": 0, "paperTrades": 0},
        }
    if not token:
        return {
            "ok": False,
            "localFallback": True,
            "message": "Supabase session token is missing. Local journal and paper trading remain active.",
            "synced": {"journalEntries": 0, "paperTrades": 0},
        }

    user = supabase_user(token)
    user_id = user.get("id")
    if not user_id:
        raise RuntimeError("Supabase user response did not include an id")

    journal_entries = [item for item in (payload.get("journalEntries") or []) if isinstance(item, dict)]
    paper_account = payload.get("paperAccount") if isinstance(payload.get("paperAccount"), dict) else {}
    paper_history = [item for item in (paper_account.get("history") or []) if isinstance(item, dict)]

    if journal_entries:
        rows = [journal_sync_row(user_id, entry) for entry in journal_entries[:500]]
        supabase_request(
            "/rest/v1/journal_entries?on_conflict=user_id,client_id",
            method="POST",
            token=token,
            body=rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    account_rows = supabase_request(
        "/rest/v1/paper_accounts?on_conflict=user_id",
        method="POST",
        token=token,
        body=[paper_account_row(user_id, paper_account)],
        prefer="resolution=merge-duplicates,return=representation",
    ) or []
    account_id = account_rows[0].get("id") if account_rows else None

    if paper_history:
        rows = [paper_trade_sync_row(user_id, account_id, trade) for trade in paper_history[:1000]]
        supabase_request(
            "/rest/v1/paper_trades?on_conflict=user_id,client_id",
            method="POST",
            token=token,
            body=rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    return {
        "ok": True,
        "localFallback": False,
        "message": "Journal entries and paper trades synced to Supabase.",
        "synced": {
            "journalEntries": len(journal_entries),
            "paperTrades": len(paper_history),
            "paperAccount": bool(account_id),
        },
    }


def fetch_finnhub(path, params):
    token = market_data_key()
    if not token:
        raise RuntimeError("Market data provider key is not configured")
    query = urlencode({**params, "token": token})
    request = Request(f"{FINNHUB_BASE_URL}{path}?{query}", headers={"accept": "application/json"})
    with urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_finnhub_economic_calendar(from_date, to_date):
    token = economic_calendar_key()
    if not token:
        raise RuntimeError("Economic calendar provider key is not configured")
    query = urlencode({"from": from_date, "to": to_date, "token": token})
    request = Request(f"{FINNHUB_BASE_URL}/calendar/economic?{query}", headers={"accept": "application/json"})
    try:
        with urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        if error.code == 403:
            raise RuntimeError(f"403 plan-blocked: Economic calendar provider rejected this plan/key. {detail}")
        raise RuntimeError(f"Economic calendar provider HTTP {error.code}: {detail}")


def fetch_polygon(path, params):
    token = market_data_key()
    if not token:
        raise RuntimeError("Market data provider key is not configured")
    cache_query = urlencode(sorted(params.items()), doseq=True)
    cache_key = (path, cache_query)
    now = time.time()
    cached = POLYGON_CACHE.get(cache_key)
    if cached and now - cached["created_at"] < POLYGON_CACHE_TTL_SECONDS:
        return cached["body"]
    query = urlencode({**params, "apiKey": token})
    request = Request(f"{POLYGON_BASE_URL}{path}?{query}", headers={"accept": "application/json"})
    try:
        with urlopen(request, timeout=12) as response:
            body = json.loads(response.read().decode("utf-8"))
            POLYGON_CACHE[cache_key] = {"created_at": now, "body": body}
            return body
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        message = detail
        try:
            parsed = json.loads(detail)
            message = parsed.get("message") or parsed.get("error") or detail
        except json.JSONDecodeError:
            pass
        if error.code == 403:
            raise RuntimeError(f"403 plan-blocked: {message or 'Provider plan does not include this endpoint'}")
        raise RuntimeError(f"Provider HTTP {error.code}: {message}")


def finnhub_quote(symbol):
    quote = fetch_finnhub("/quote", {"symbol": symbol})
    price = quote.get("c")
    if not isinstance(price, (int, float)) or price <= 0:
        raise RuntimeError("Quote response did not include a current price")
    return {
        "provider": "finnhub",
        "symbol": symbol,
        "price": price,
        "change": quote.get("d", 0),
        "changePercent": quote.get("dp", 0),
        "high": quote.get("h"),
        "low": quote.get("l"),
        "open": quote.get("o"),
        "previousClose": quote.get("pc"),
        "timestamp": datetime.fromtimestamp(quote.get("t", time.time()), timezone.utc).isoformat(),
    }


def polygon_quote(symbol):
    try:
        result = fetch_polygon(f"/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}", {})
        ticker = result.get("ticker") or {}
        last_trade = ticker.get("lastTrade") or {}
        day = ticker.get("day") or {}
        prev_day = ticker.get("prevDay") or {}
        price = last_trade.get("p") or day.get("c")
        if not isinstance(price, (int, float)) or price <= 0:
            raise RuntimeError("Polygon snapshot did not include a current price")
        return {
            "provider": "polygon",
            "symbol": symbol,
            "price": price,
            "change": ticker.get("todaysChange", 0),
            "changePercent": ticker.get("todaysChangePerc", 0),
            "high": day.get("h"),
            "low": day.get("l"),
            "open": day.get("o"),
            "previousClose": prev_day.get("c"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        fallback = polygon_candles(symbol, "1m")
        latest = fallback["candles"][-1]
        previous = fallback["candles"][-2] if len(fallback["candles"]) > 1 else latest
        change = latest["close"] - previous["close"]
        change_percent = (change / previous["close"]) * 100 if previous["close"] else 0
        return {
            "provider": "polygon",
            "source": "aggregate-fallback",
            "symbol": symbol,
            "price": latest["close"],
            "change": change,
            "changePercent": change_percent,
            "high": latest["high"],
            "low": latest["low"],
            "open": latest["open"],
            "previousClose": previous["close"],
            "timestamp": latest["time"],
        }


def finnhub_candles(symbol, range_name):
    config = RANGE_CONFIG[range_name]
    to_ts = int(time.time())
    from_ts = to_ts - config["seconds"]
    result = fetch_finnhub(
        "/stock/candle",
        {"symbol": symbol, "resolution": config["resolution"], "from": from_ts, "to": to_ts},
    )
    closes = result.get("c") or []
    if result.get("s") != "ok" or not closes:
        raise RuntimeError("No candle data returned by provider")
    candles = []
    for index, close in enumerate(closes):
        candle = {
            "open": result["o"][index],
            "high": result["h"][index],
            "low": result["l"][index],
            "close": close,
            "volume": result["v"][index],
            "time": datetime.fromtimestamp(result["t"][index], timezone.utc).isoformat(),
        }
        if all(isinstance(candle[key], (int, float)) for key in ("open", "high", "low", "close")):
            candles.append(candle)
    return {
        "provider": "finnhub",
        "symbol": symbol,
        "range": range_name,
        "resolution": config["resolution"],
        "candles": candles,
    }


def polygon_aggregate_candles(ticker, range_name, label_key="symbol"):
    config = RANGE_CONFIG[range_name]
    today = datetime.now(timezone.utc).date()
    from_date = (today - timedelta(days=7)).isoformat()
    to_date = today.isoformat()
    result = fetch_polygon(
        f"/v2/aggs/ticker/{ticker}/range/{config['polygon_multiplier']}/{config['polygon_timespan']}/{from_date}/{to_date}",
        {"adjusted": "true", "sort": "asc", "limit": "500"},
    )
    bars = result.get("results") or []
    if result.get("status") not in ("OK", "DELAYED") or not bars:
        raise RuntimeError("No candle data returned by Polygon")
    candles = []
    for bar in bars[-120:]:
        candle = {
            "open": bar.get("o"),
            "high": bar.get("h"),
            "low": bar.get("l"),
            "close": bar.get("c"),
            "volume": bar.get("v"),
            "time": datetime.fromtimestamp((bar.get("t") or 0) / 1000, timezone.utc).isoformat(),
        }
        if all(isinstance(candle[key], (int, float)) for key in ("open", "high", "low", "close")):
            candles.append(candle)
    if not candles:
        raise RuntimeError("Polygon candle response did not include valid OHLC bars")
    return {
        "provider": "polygon",
        label_key: ticker,
        "range": range_name,
        "resolution": f"{config['polygon_multiplier']}{config['polygon_timespan']}",
        "candles": candles,
    }


def polygon_candles(symbol, range_name):
    return polygon_aggregate_candles(symbol, range_name, "symbol")


def polygon_option_candles(options_ticker, range_name):
    return polygon_aggregate_candles(options_ticker, range_name, "contract")


def live_quote(symbol):
    provider = provider_kind()
    if provider == "polygon":
        return polygon_quote(symbol)
    if provider == "finnhub":
        return finnhub_quote(symbol)
    raise RuntimeError(f"Unsupported provider mode: {PROVIDER_MODE}")


def live_candles(symbol, range_name):
    provider = provider_kind()
    if provider == "polygon":
        return polygon_candles(symbol, range_name)
    if provider == "finnhub":
        return finnhub_candles(symbol, range_name)
    raise RuntimeError(f"Unsupported provider mode: {PROVIDER_MODE}")


def polygon_option_contract(options_ticker, as_of=""):
    params = {"as_of": as_of} if as_of else {}
    result = fetch_polygon(f"/v3/reference/options/contracts/{options_ticker}", params)
    contract = result.get("results") or {}
    if not contract:
        raise RuntimeError("No option contract details returned by Polygon")
    return {
        "provider": "polygon",
        "contract": contract,
        "requestId": result.get("request_id"),
        "status": result.get("status"),
    }


def option_contract(options_ticker, as_of=""):
    if provider_kind() != "polygon":
        raise RuntimeError("Option contract reference is only implemented for Polygon/Massive mode")
    return polygon_option_contract(options_ticker, as_of)


def option_candles(options_ticker, range_name):
    if provider_kind() != "polygon":
        raise RuntimeError("Option contract candles are only implemented for Polygon/Massive mode")
    return polygon_option_candles(options_ticker, range_name)


def polygon_option_trades(options_ticker, query):
    params = {
        "limit": clean_int(query.get("limit", ["100"])[0], 100, 1, 500),
        "sort": clean_choice(query.get("sort", ["timestamp"])[0], {"timestamp"}, "timestamp"),
        "order": clean_choice(query.get("order", ["desc"])[0], {"asc", "desc"}, "desc"),
    }
    for key in ("timestamp", "timestamp.lt", "timestamp.lte", "timestamp.gt", "timestamp.gte"):
        value = clean_timestamp_filter(query.get(key, [""])[0])
        if value:
            params[key] = value
    result = fetch_polygon(f"/v3/trades/{options_ticker}", params)
    return {
        "provider": "polygon",
        "contract": options_ticker,
        "trades": result.get("results") or [],
        "requestId": result.get("request_id"),
        "status": result.get("status"),
        "nextUrl": result.get("next_url"),
    }


def option_trades(options_ticker, query):
    if provider_kind() != "polygon":
        raise RuntimeError("Option contract trades are only implemented for Polygon/Massive mode")
    return polygon_option_trades(options_ticker, query)


def polygon_option_sma(options_ticker, query):
    params = {
        "timespan": clean_choice(query.get("timespan", ["day"])[0], {"minute", "hour", "day", "week", "month", "quarter", "year"}, "day"),
        "adjusted": clean_bool(query.get("adjusted", ["true"])[0], True),
        "window": clean_int(query.get("window", ["50"])[0], 50, 2, 250),
        "series_type": clean_choice(query.get("series_type", ["close"])[0], {"open", "high", "low", "close"}, "close"),
        "order": clean_choice(query.get("order", ["desc"])[0], {"asc", "desc"}, "desc"),
        "limit": clean_int(query.get("limit", ["10"])[0], 10, 1, 500),
    }
    include_underlying = clean_bool(query.get("include_underlying", ["false"])[0], False)
    if include_underlying == "true":
        params["include_underlying"] = "true"
    for key in ("timestamp", "timestamp.lt", "timestamp.lte", "timestamp.gt", "timestamp.gte"):
        value = clean_timestamp_filter(query.get(key, [""])[0])
        if value:
            params[key] = value
    result = fetch_polygon(f"/v1/indicators/sma/{options_ticker}", params)
    return {
        "provider": "polygon",
        "contract": options_ticker,
        "indicator": "sma",
        "values": ((result.get("results") or {}).get("values") or []),
        "underlying": ((result.get("results") or {}).get("underlying")) if include_underlying == "true" else None,
        "requestId": result.get("request_id"),
        "status": result.get("status"),
        "nextUrl": result.get("next_url"),
    }


def option_sma(options_ticker, query):
    if provider_kind() != "polygon":
        raise RuntimeError("Option contract SMA is only implemented for Polygon/Massive mode")
    return polygon_option_sma(options_ticker, query)


def polygon_indicator_params(query, indicator):
    params = {
        "timespan": clean_choice(query.get("timespan", ["day"])[0], {"minute", "hour", "day", "week", "month", "quarter", "year"}, "day"),
        "adjusted": clean_bool(query.get("adjusted", ["true"])[0], True),
        "series_type": clean_choice(query.get("series_type", ["close"])[0], {"open", "high", "low", "close"}, "close"),
        "order": clean_choice(query.get("order", ["desc"])[0], {"asc", "desc"}, "desc"),
        "limit": clean_int(query.get("limit", ["10"])[0], 10, 1, 500),
    }
    if indicator in ("sma", "ema", "rsi"):
        params["window"] = clean_int(query.get("window", ["50"])[0], 50, 2, 250)
    if indicator == "macd":
        params["short_window"] = clean_int(query.get("short_window", ["12"])[0], 12, 2, 100)
        params["long_window"] = clean_int(query.get("long_window", ["26"])[0], 26, 3, 250)
        params["signal_window"] = clean_int(query.get("signal_window", ["9"])[0], 9, 2, 100)
        if params["short_window"] >= params["long_window"]:
            params["short_window"] = 12
            params["long_window"] = 26
    include_underlying = clean_bool(query.get("include_underlying", ["false"])[0], False)
    if include_underlying == "true":
        params["include_underlying"] = "true"
    for key in ("timestamp", "timestamp.lt", "timestamp.lte", "timestamp.gt", "timestamp.gte"):
        value = clean_timestamp_filter(query.get(key, [""])[0])
        if value:
            params[key] = value
    return params, include_underlying


def polygon_option_indicator(options_ticker, indicator, query):
    params, include_underlying = polygon_indicator_params(query, indicator)
    result = fetch_polygon(f"/v1/indicators/{indicator}/{options_ticker}", params)
    results = result.get("results") or {}
    return {
        "provider": "polygon",
        "contract": options_ticker,
        "indicator": indicator,
        "values": results.get("values") or [],
        "underlying": results.get("underlying") if include_underlying == "true" else None,
        "requestId": result.get("request_id"),
        "status": result.get("status"),
        "nextUrl": result.get("next_url"),
    }


def option_indicator(options_ticker, indicator, query):
    if provider_kind() != "polygon":
        raise RuntimeError("Option contract indicators are only implemented for Polygon/Massive mode")
    if indicator not in ("ema", "macd", "rsi"):
        raise ValueError("Unsupported option indicator")
    return polygon_option_indicator(options_ticker, indicator, query)


def reference_tickers(query):
    if provider_kind() != "polygon":
        raise RuntimeError("Ticker reference search is only implemented for Polygon/Massive mode")
    params = {
        "market": clean_market(query.get("market", ["stocks"])[0]),
        "active": clean_bool(query.get("active", ["true"])[0], True),
        "limit": clean_int(query.get("limit", ["25"])[0], 25, 1, 100),
        "sort": clean_choice(query.get("sort", ["ticker"])[0], {"ticker", "name", "market", "locale", "primary_exchange", "type", "currency_symbol"}, "ticker"),
        "order": clean_choice(query.get("order", ["asc"])[0], {"asc", "desc"}, "asc"),
    }
    search = clean_search(query.get("search", [""])[0])
    if search:
        params["search"] = search
    ticker_type = clean_ticker_type(query.get("type", [""])[0])
    if ticker_type:
        params["type"] = ticker_type
    result = fetch_polygon("/v3/reference/tickers", params)
    return {
        "provider": "polygon",
        "tickers": result.get("results") or [],
        "requestId": result.get("request_id"),
        "status": result.get("status"),
        "nextUrl": result.get("next_url"),
    }


def trend_from_change(change_percent):
    if change_percent >= 0.35:
        return "Bullish"
    if change_percent <= -0.35:
        return "Bearish"
    return "Neutral"


def score_from_change(change_percent, bullish=True):
    base = 50 + (change_percent * 10 if bullish else -change_percent * 10)
    return int(max(5, min(95, round(base))))


def context_quote(symbol):
    quote = live_quote(symbol)
    change = safe_float(quote.get("changePercent"), 0)
    return {
        "symbol": symbol,
        "trend": trend_from_change(change),
        "score": score_from_change(change),
        "changePercent": round(change, 2),
        "price": quote.get("price"),
        "source": quote.get("source") or quote.get("provider"),
    }


def vix_context():
    candidates = ("I:VIX", "VIX")
    last_error = None
    for ticker in candidates:
        try:
            candles = polygon_aggregate_candles(ticker, "15m", "symbol")["candles"]
            latest = candles[-1]
            previous = candles[-8] if len(candles) >= 8 else candles[0]
            value = latest["close"]
            change = ((latest["close"] - previous["close"]) / previous["close"]) * 100 if previous["close"] else 0
            state = "Calm" if value < 16 and change <= 4 else "Elevated" if value >= 20 or change >= 8 else "Watch"
            score = 82 if state == "Calm" else 48 if state == "Watch" else 28
            return {
                "symbol": ticker,
                "state": state,
                "score": score,
                "value": round(value, 2),
                "changePercent": round(change, 2),
                "source": "polygon-aggregate",
            }
        except Exception as error:
            last_error = str(error)
    for ticker in ("VXX", "UVXY"):
        try:
            quote = context_quote(ticker)
            change = safe_float(quote.get("changePercent"), 0)
            state = "Calm" if change <= -1 else "Elevated" if change >= 1.5 else "Watch"
            score = 78 if state == "Calm" else 46 if state == "Watch" else 30
            return {
                "symbol": ticker,
                "state": state,
                "score": score,
                "changePercent": round(change, 2),
                "source": "volatility-etf-proxy",
                "note": "Direct VIX was unavailable; using volatility ETF proxy.",
            }
        except Exception as error:
            last_error = str(error)
    return {
        "state": "Unknown",
        "score": 55,
        "source": "unavailable",
        "error": last_error,
    }


def sector_proxy_context():
    sector_map = {
        "Semiconductors": "SMH",
        "Index ETF": "QQQ",
        "Megacap Tech": "XLK",
        "Energy": "XLE",
        "Commodity ETF": "USO",
        "EVs": "TSLA",
        "Fintech": "ARKF",
        "Healthcare": "XLV",
        "Aerospace": "ITA",
    }
    sectors = {}
    details = {}
    for sector, ticker in sector_map.items():
        try:
            quote = context_quote(ticker)
            sectors[sector] = "Aligned" if quote["score"] >= 58 else "Fighting" if quote["score"] <= 42 else "Mixed"
            details[sector] = quote
        except Exception as error:
            sectors[sector] = "Mixed"
            details[sector] = {"symbol": ticker, "source": "unavailable", "error": str(error)}
    return sectors, details


def breadth_proxy_from_sectors(sectors):
    values = list(sectors.values())
    aligned = values.count("Aligned")
    fighting = values.count("Fighting")
    total = len(values) or 1
    score = int(round(50 + ((aligned - fighting) / total) * 35))
    state = "Positive" if score >= 60 else "Negative" if score <= 40 else "Mixed"
    return {
        "state": state,
        "score": max(5, min(95, score)),
        "source": "sector-etf-proxy",
        "note": "Proxy breadth from sector ETFs; true advance/decline and new highs/new lows are not connected yet.",
    }


def recent_market_dates(max_days=7):
    day = datetime.now(timezone.utc).date()
    dates = []
    while len(dates) < max_days:
        if day.weekday() < 5:
            dates.append(day.isoformat())
        day -= timedelta(days=1)
    return dates


def polygon_grouped_daily_breadth():
    if provider_kind() != "polygon":
        raise RuntimeError("Grouped market breadth requires Polygon/Massive provider mode")

    last_error = None
    for market_date in recent_market_dates():
        try:
            result = fetch_polygon(f"/v2/aggs/grouped/locale/us/market/stocks/{market_date}", {"adjusted": "true"})
        except Exception as error:
            last_error = error
            continue

        bars = [
            bar for bar in result.get("results", [])
            if isinstance(bar.get("o"), (int, float))
            and isinstance(bar.get("c"), (int, float))
            and isinstance(bar.get("v"), (int, float))
            and bar.get("v", 0) > 0
        ]
        if not bars:
            last_error = RuntimeError(f"No grouped daily bars returned for {market_date}")
            continue

        advancers = sum(1 for bar in bars if bar["c"] > bar["o"])
        decliners = sum(1 for bar in bars if bar["c"] < bar["o"])
        unchanged = len(bars) - advancers - decliners
        up_volume = sum(bar["v"] for bar in bars if bar["c"] > bar["o"])
        down_volume = sum(bar["v"] for bar in bars if bar["c"] < bar["o"])
        total_volume = up_volume + down_volume
        advancer_ratio = advancers / len(bars)
        up_volume_ratio = up_volume / total_volume if total_volume else advancer_ratio
        score = int(round((advancer_ratio * 65 + up_volume_ratio * 35) * 100))
        score = max(5, min(95, score))
        state = "Positive" if score >= 60 else "Negative" if score <= 40 else "Mixed"

        return {
            "state": state,
            "score": score,
            "source": "polygon-grouped-daily",
            "asOf": market_date,
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "total": len(bars),
            "advanceDeclineRatio": round(advancers / max(1, decliners), 2),
            "upVolumeRatio": round(up_volume_ratio, 3),
            "note": "Provider breadth from grouped daily bars. Advance/decline uses close vs open until previous-close breadth is connected.",
        }

    raise RuntimeError(str(last_error) if last_error else "Grouped daily breadth was unavailable")


def live_breadth_context(sectors=None):
    try:
        return polygon_grouped_daily_breadth()
    except Exception as error:
        fallback = breadth_proxy_from_sectors(sectors or {})
        fallback["fallbackReason"] = str(error)
        return fallback


def live_market_context():
    spy = context_quote("SPY")
    qqq = context_quote("QQQ")
    vix = vix_context() if provider_kind() == "polygon" else {"state": "Unknown", "score": 55, "source": "not-supported"}
    sectors, sector_details = sector_proxy_context()
    breadth = live_breadth_context(sectors)
    return {
        "provider": provider_kind(),
        "source": "live-provider-plus-proxy",
        "spy": spy,
        "qqq": qqq,
        "vix": vix,
        "breadth": breadth,
        "sectors": sectors,
        "sectorDetails": sector_details,
        "missing": {
            "advanceDecline": "connected" if breadth.get("source") == "polygon-grouped-daily" else "not-connected",
            "newHighsNewLows": "not-connected",
            "economicCalendar": "not-connected",
            "newsSentiment": "not-connected",
            "unusualOptionsActivity": "provider-plan-dependent",
        },
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def integration_audit():
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runtime": {
            "providerMode": PROVIDER_MODE,
            "providerKind": provider_kind(),
            "marketDataConfigured": bool(market_data_key()),
            "economicCalendarProvider": ECONOMIC_CALENDAR_PROVIDER,
            "economicCalendarConfigured": bool(economic_calendar_key()),
            "cache": {
                "polygonCacheTtlSeconds": POLYGON_CACHE_TTL_SECONDS,
                "liveOptionsSignalTtlSeconds": LIVE_OPTIONS_SIGNAL_TTL_SECONDS,
            },
        },
        "providers": [
            {
                "name": "Polygon / Massive",
                "status": "active" if provider_kind() == "polygon" and bool(market_data_key()) else "configured-inactive",
                "supplies": [
                    "Equity quotes",
                    "Equity candles",
                    "Option contract reference",
                    "Option contract candles",
                    "Option SMA/EMA/MACD/RSI",
                    "Reference ticker search",
                    "Option trade tape when plan-entitled",
                    "Market breadth via grouped daily stock bars when plan-entitled",
                ],
                "rateLimits": [
                    f"Local Polygon cache TTL: {POLYGON_CACHE_TTL_SECONDS}s",
                    f"Local live-options aggregate cache TTL: {LIVE_OPTIONS_SIGNAL_TTL_SECONDS}s",
                    "External provider limits depend on the active Polygon/Massive plan.",
                ],
                "planLimitations": [
                    "Option trade tape can return 403 plan-blocked on current entitlement.",
                    "Grouped daily stock bars may be plan-limited; STRIKEPULSE falls back to sector ETF proxy breadth.",
                    "Direct VIX/index access may depend on index-data entitlement; STRIKEPULSE falls back to volatility ETF proxy.",
                ],
                "missingData": [
                    "Unusual options activity classification",
                    "Option chain snapshots with Greeks",
                    "Put/call ratios",
                    "New highs/new lows breadth",
                    "Economic calendar",
                    "News sentiment",
                ],
            },
            {
                "name": "Finnhub",
                "status": "available-fallback" if os.environ.get("FINNHUB_API_KEY") or os.environ.get("MARKET_DATA_API_KEY") else "key-not-configured",
                "supplies": ["Equity quotes", "Equity candles"],
                "rateLimits": ["External provider limits depend on Finnhub plan."],
                "planLimitations": ["Not active unless PROVIDER_MODE=finnhub."],
                "missingData": ["Options flow", "Options contracts", "Options indicators", "Market breadth"],
            },
            {
                "name": "Mock / Local Enriched Data",
                "status": "active-fallback",
                "supplies": ["Demo ticker data", "Demo sector context", "Demo paper trading", "Local journal/alerts/preferences"],
                "rateLimits": ["None"],
                "planLimitations": ["Not real market data."],
                "missingData": ["Live breadth", "Live VIX", "Live sector confirmation", "Live event risk"],
            },
            {
                "name": "Finnhub Economic Calendar",
                "status": "configured" if economic_calendar_key() else "key-not-configured",
                "supplies": ["Economic calendar events", "Event actual/forecast/previous values when returned by provider"],
                "rateLimits": ["External provider limits depend on Finnhub plan."],
                "planLimitations": ["Economic-calendar access depends on Finnhub entitlement."],
                "missingData": ["Fed speaker calendar", "Company earnings calendar", "Oil inventory calendar if not present in provider feed"],
            },
            {
                "name": "AI Review",
                "status": "mock-only",
                "supplies": ["Sanitized setup review placeholder", "Journal coach placeholder"],
                "rateLimits": ["No production AI provider connected yet."],
                "planLimitations": ["Requires server-side OpenAI key, rate limits, and abuse controls before launch."],
                "missingData": ["Real AI explanation layer", "News summarization", "Pattern coaching over cloud history"],
            },
        ],
        "missingIntegrationsRanked": [
            {"rank": 1, "name": "Options flow / unusual options activity", "impact": "very-high", "reason": "Directly improves conviction, brewing alerts, and rejection quality."},
            {"rank": 2, "name": "New highs/new lows breadth", "impact": "very-high", "reason": "Completes breadth beyond advance/decline and improves regime shift detection."},
            {"rank": 3, "name": "Direct VIX / volatility regime", "impact": "high", "reason": "Improves premium-risk gating and options trade rejection."},
            {"rank": 4, "name": "Economic calendar", "impact": "high", "reason": "CPI, Fed, jobs, and inventory reports should become hard blockers or caution flags."},
            {"rank": 5, "name": "News sentiment", "impact": "medium-high", "reason": "Useful when filtered by symbol relevance and event severity."},
            {"rank": 6, "name": "Option chain with Greeks", "impact": "medium-high", "reason": "Improves contract selection, strike quality, and position sizing."},
            {"rank": 7, "name": "Cloud sync / production alerts", "impact": "product-high signal-medium", "reason": "Needed for launch and retention, but less important than signal context accuracy."},
        ],
    }


def parse_event_datetime(event):
    try:
        if event.get("datetimeUtc"):
            return datetime.fromisoformat(str(event["datetimeUtc"]).replace("Z", "+00:00")).astimezone(timezone.utc)
        return datetime.fromisoformat(f"{event['date']}T{event['time']}:00-04:00").astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def economic_event_severity(event):
    text = " ".join(str(event.get(key, "")) for key in ("title", "event", "category", "impact", "severity")).lower()
    if any(term in text for term in ("high", "cpi", "inflation", "fomc", "fed rate", "nonfarm", "payroll", "jobs report", "employment report", "unemployment", "pce", "gdp", "retail sales", "ism")):
        return "high"
    if any(term in text for term in ("medium", "jobless", "claims", "pmi", "consumer confidence", "housing", "durable goods", "factory orders")):
        return "medium"
    return str(event.get("severity") or "low").lower()


def normalize_finnhub_event(raw_event):
    title = raw_event.get("event") or raw_event.get("title") or raw_event.get("name") or "Economic Event"
    raw_time = raw_event.get("time") or raw_event.get("datetime") or raw_event.get("date")
    event_time = None
    if raw_time:
        try:
            value = str(raw_time).replace("Z", "+00:00")
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", value):
                value = f"{value}T08:30:00-04:00"
            event_time = datetime.fromisoformat(value).astimezone(timezone.utc)
        except ValueError:
            event_time = None
    if event_time is None:
        event_time = datetime.now(timezone.utc)
    severity = economic_event_severity({**raw_event, "title": title})
    category_text = f"{title} {raw_event.get('category', '')}".lower()
    category = "inflation" if any(term in category_text for term in ("cpi", "inflation", "pce")) else "jobs" if any(term in category_text for term in ("job", "employment", "payroll", "unemployment")) else "fed" if "fed" in category_text or "fomc" in category_text else "macro"
    broad_symbols = ["SPY", "QQQ", "TQQQ", "NVDA", "AMD", "AAPL", "META", "TSLA"]
    return {
        "id": f"finnhub-{re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:48]}-{event_time.date().isoformat()}",
        "title": title,
        "category": category,
        "severity": severity,
        "date": event_time.date().isoformat(),
        "time": event_time.strftime("%H:%M"),
        "timezone": "UTC",
        "datetimeUtc": event_time.isoformat(),
        "country": raw_event.get("country"),
        "actual": raw_event.get("actual"),
        "estimate": raw_event.get("estimate") or raw_event.get("forecast"),
        "previous": raw_event.get("prev") or raw_event.get("previous"),
        "unit": raw_event.get("unit"),
        "affectedSymbols": broad_symbols,
        "affectedSectors": ["Index ETF", "Megacap Tech", "Semiconductors", "EVs"],
        "blockerWindowHours": 8 if severity == "high" else 2,
        "source": "finnhub-economic-calendar",
    }


def provider_economic_events(from_date, to_date):
    if ECONOMIC_CALENDAR_PROVIDER.lower() != "finnhub":
        raise RuntimeError(f"Unsupported economic calendar provider: {ECONOMIC_CALENDAR_PROVIDER}")
    result = fetch_finnhub_economic_calendar(from_date, to_date)
    raw_events = result.get("economicCalendar") or result.get("economic_calendar") or result.get("events") or []
    return [normalize_finnhub_event(event) for event in raw_events if isinstance(event, dict)]


def event_applies(event, symbol="", sector=""):
    affected_symbols = set(event.get("affectedSymbols") or [])
    affected_sectors = set(event.get("affectedSectors") or [])
    return (
        not symbol and not sector
        or symbol in affected_symbols
        or sector in affected_sectors
        or "SPY" in affected_symbols and sector in ("Index ETF", "Megacap Tech", "Semiconductors")
    )


def economic_calendar(query):
    symbol = clean_symbol(query.get("symbol", ["SPY"])[0]) if query.get("symbol", [""])[0] else ""
    sector = clean_sector(query.get("sector", [""])[0])
    lookahead_days = clean_int(query.get("days", ["14"])[0], 14, 1, 60)
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=lookahead_days)
    from_date = now.date().isoformat()
    to_date = horizon.date().isoformat()
    provider = "local-curated"
    source = "local-curated-prototype"
    provider_status = "fallback"
    provider_error = ""
    source_events = LOCAL_ECONOMIC_EVENTS
    if economic_calendar_key():
        try:
            provider_events = provider_economic_events(from_date, to_date)
            if provider_events:
                source_events = provider_events
                provider = ECONOMIC_CALENDAR_PROVIDER.lower()
                source = "finnhub-economic-calendar"
                provider_status = "connected"
            else:
                provider = ECONOMIC_CALENDAR_PROVIDER.lower()
                source = "finnhub-economic-calendar-empty-fallback-local"
                provider_status = "empty-fallback"
        except Exception as error:
            provider_error = str(error)
            provider_status = "error-fallback"
    matching_events = []
    blockers = []
    risk_penalty = 0

    for event in source_events:
        event_time = parse_event_datetime(event)
        if event_time < now - timedelta(hours=1) or event_time > horizon:
            continue
        if not event_applies(event, symbol, sector):
            continue
        hours_until = (event_time - now).total_seconds() / 3600
        severity = event.get("severity", "low")
        blocker_window = safe_float(event.get("blockerWindowHours"), 2)
        event_payload = {
            **event,
            "datetimeUtc": event_time.isoformat(),
            "hoursUntil": round(hours_until, 1),
            "applies": True,
            "isBlocker": severity == "high" and 0 <= hours_until <= blocker_window,
        }
        matching_events.append(event_payload)
        if event_payload["isBlocker"]:
            blockers.append(f"{event['title']} inside {blocker_window:g}h event-risk window.")
        if hours_until <= 24:
            risk_penalty += EVENT_SEVERITY_WEIGHT.get(severity, 8)
        elif hours_until <= 72:
            risk_penalty += EVENT_SEVERITY_WEIGHT.get(severity, 8) * 0.45

    risk_score = int(max(0, min(100, round(100 - risk_penalty))))
    risk_level = "High" if risk_score <= 45 else "Moderate" if risk_score <= 70 else "Low"
    body = {
        "provider": provider,
        "source": source,
        "providerStatus": provider_status,
        "symbol": symbol,
        "sector": sector,
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "blockers": blockers,
        "events": matching_events,
        "missing": {
            "liveEconomicCalendarProvider": "connected" if provider_status == "connected" else "not-connected",
            "earningsCalendar": "not-connected",
            "fedSpeakerCalendar": "not-connected",
        },
        "updatedAt": now.isoformat(),
    }
    if provider_error:
        body["providerError"] = provider_error
    return body


def market_context():
    if PROVIDER_MODE != "mock" and market_data_key():
        try:
            return live_market_context()
        except Exception as error:
            fallback = mock_market_context()
            fallback["source"] = "mock-fallback"
            fallback["error"] = str(error)
            return fallback
    return mock_market_context()


def mock_market_context():
    return {
        "provider": "mock",
        "spy": {"trend": "Bullish", "score": 78},
        "qqq": {"trend": "Bullish", "score": 84},
        "vix": {"state": "Calm", "score": 74},
        "breadth": {"state": "Positive", "score": 69, "source": "mock-enriched"},
        "sectors": {
            "Semiconductors": "Aligned",
            "Index ETF": "Aligned",
            "Megacap Tech": "Mixed",
            "Energy": "Aligned",
            "Commodity ETF": "Mixed",
            "EVs": "Mixed",
            "Fintech": "Mixed",
            "Healthcare": "Fighting",
            "Aerospace": "Fighting",
        },
        "missing": {
            "advanceDecline": "not-connected",
            "newHighsNewLows": "not-connected",
            "economicCalendar": "not-connected",
            "newsSentiment": "not-connected",
            "unusualOptionsActivity": "not-connected",
        },
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def sanitize_ai_payload(input_payload):
    return {
        key: value
        for key, value in {
            "symbol": input_payload.get("symbol"),
            "direction": input_payload.get("direction"),
            "qualityGate": input_payload.get("qualityGate"),
            "qualityBlockers": (input_payload.get("qualityBlockers") or [])[:4],
            "nineSig": input_payload.get("nineSig"),
            "contract": input_payload.get("contract"),
            "entryStatus": input_payload.get("entryStatus"),
            "entryTrigger": input_payload.get("entryTrigger"),
            "stop": input_payload.get("stop"),
            "target": input_payload.get("target"),
            "premium": input_payload.get("premium"),
            "journalTags": (input_payload.get("journalTags") or [])[:12],
        }.items()
        if value is not None
    }


def safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default=None):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "1", "yes", "y")
    if value is None:
        return default
    return bool(value)


def analyze_signal_payload(payload):
    market_payload = payload.get("market") or {}
    indicator_payload = payload.get("indicators") or {}
    contract_payload = payload.get("contract") or {}

    market = MarketSnapshot(
        signal_confidence=clamp_score(market_payload.get("signalConfidence"), 0, 100),
        direction=(market_payload.get("direction") or payload.get("direction") or "Bullish"),
        entry_confirmed=safe_bool(market_payload.get("entryConfirmed"), False),
        reward_risk=max(0, safe_float(market_payload.get("rewardRisk"), 0)),
        market_aligned=safe_bool(market_payload.get("marketAligned"), False),
        breadth_aligned=safe_bool(market_payload.get("breadthAligned"), False),
        vix_supportive=safe_bool(market_payload.get("vixSupportive"), False),
        news_sentiment=optional_float(market_payload.get("newsSentiment")),
        market_regime=market_payload.get("marketRegime"),
        event_risk_score=optional_float(market_payload.get("eventRiskScore")),
        event_blockers=[
            str(item)[:180]
            for item in (market_payload.get("eventBlockers") or [])
            if isinstance(item, str)
        ][:5],
    )
    indicators = IndicatorSnapshot(
        price=max(0, safe_float(indicator_payload.get("price"), 0)),
        sma=optional_float(indicator_payload.get("sma")),
        ema=optional_float(indicator_payload.get("ema")),
        macd=optional_float(indicator_payload.get("macd")),
        macd_signal=optional_float(indicator_payload.get("macdSignal")),
        macd_histogram=optional_float(indicator_payload.get("macdHistogram")),
        rsi=optional_float(indicator_payload.get("rsi")),
    )
    contract = ContractSnapshot(
        spread=optional_float(contract_payload.get("spread")),
        midpoint=optional_float(contract_payload.get("midpoint")),
        volume=safe_int(contract_payload.get("volume")),
        open_interest=safe_int(contract_payload.get("openInterest")),
        implied_volatility=optional_float(contract_payload.get("impliedVolatility")),
        days_to_expiration=safe_int(contract_payload.get("daysToExpiration")),
        options_flow_score=optional_float(contract_payload.get("optionsFlowScore")),
    )
    return report_to_dict(build_signal_report(market, indicators, contract))


def latest_indicator_number(result, key="value"):
    values = (result.get("values") or [])
    if not values:
        return None
    value = values[0].get(key)
    return value if isinstance(value, (int, float)) else None


def try_feed(name, func):
    try:
        return {"ok": True, "data": func()}
    except Exception as error:
        return {"ok": False, "error": str(error)}


def live_options_signal(options_ticker):
    now = time.time()
    cached = LIVE_OPTIONS_SIGNAL_CACHE.get(options_ticker)
    if cached and now - cached["created_at"] < LIVE_OPTIONS_SIGNAL_TTL_SECONDS:
        body = json.loads(json.dumps(cached["body"]))
        body["cached"] = True
        return body

    query_defaults = {
        "timespan": ["minute"],
        "window": ["20"],
        "limit": ["1"],
        "short_window": ["12"],
        "long_window": ["26"],
        "signal_window": ["9"],
    }
    feeds = {
        "contract": try_feed("contract", lambda: option_contract(options_ticker)),
        "candles": try_feed("candles", lambda: option_candles(options_ticker, "1m")),
        "sma": try_feed("sma", lambda: option_sma(options_ticker, query_defaults)),
        "ema": try_feed("ema", lambda: option_indicator(options_ticker, "ema", query_defaults)),
        "macd": try_feed("macd", lambda: option_indicator(options_ticker, "macd", query_defaults)),
        "rsi": try_feed("rsi", lambda: option_indicator(options_ticker, "rsi", query_defaults)),
        "trades": try_feed("trades", lambda: option_trades(options_ticker, {"limit": ["5"]})),
    }
    data = {key: feed["data"] for key, feed in feeds.items() if feed["ok"]}
    failures = {key: feed["error"] for key, feed in feeds.items() if not feed["ok"]}
    plan_blocked = {
        key: "403" in message and "plan" in message.lower()
        for key, message in failures.items()
    }
    candles = (data.get("candles") or {}).get("candles") or []
    latest_candle = candles[-1] if candles else {}
    contract = (data.get("contract") or {}).get("contract") or {}
    expiration = contract.get("expiration_date")
    days_to_expiration = None
    if expiration:
        try:
            expiry_date = datetime.fromisoformat(f"{expiration}T00:00:00+00:00")
            days_to_expiration = max(0, int((expiry_date - datetime.now(timezone.utc)).total_seconds() // 86400) + 1)
        except ValueError:
            days_to_expiration = None

    indicator_price = latest_candle.get("close") or 0
    underlying = contract.get("underlying_ticker") or ""
    event_context = economic_calendar({
        "symbol": [underlying],
        "days": ["14"],
    }) if underlying else {"riskScore": 82, "blockers": []}
    analysis_payload = {
        "market": {
            "signalConfidence": 78,
            "direction": "Bullish" if (contract.get("contract_type") or "call") == "call" else "Bearish",
            "entryConfirmed": bool(candles),
            "rewardRisk": 2.2,
            "marketAligned": True,
            "breadthAligned": True,
            "vixSupportive": True,
            "newsSentiment": 55,
            "marketRegime": "Trending Bull",
            "eventRiskScore": event_context.get("riskScore"),
            "eventBlockers": event_context.get("blockers") or [],
        },
        "indicators": {
            "price": indicator_price,
            "sma": latest_indicator_number(data.get("sma") or {}),
            "ema": latest_indicator_number(data.get("ema") or {}),
            "macd": latest_indicator_number(data.get("macd") or {}, "value"),
            "macdSignal": latest_indicator_number(data.get("macd") or {}, "signal"),
            "macdHistogram": latest_indicator_number(data.get("macd") or {}, "histogram"),
            "rsi": latest_indicator_number(data.get("rsi") or {}),
        },
        "contract": {
            "spread": None,
            "midpoint": indicator_price,
            "volume": latest_candle.get("volume"),
            "openInterest": contract.get("open_interest"),
            "impliedVolatility": None,
            "daysToExpiration": days_to_expiration,
            "optionsFlowScore": 55 if plan_blocked.get("trades") else 55 if data.get("trades") else None,
        },
    }
    body = {
        "provider": "polygon",
        "contract": options_ticker,
        "cached": False,
        "feeds": data,
        "failures": failures,
        "planBlocked": plan_blocked,
        "analysis": analyze_signal_payload(analysis_payload),
    }
    LIVE_OPTIONS_SIGNAL_CACHE[options_ticker] = {"created_at": now, "body": body}
    return body


def optional_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def clamp_score(value, low, high):
    return max(low, min(high, safe_float(value, low)))


class StrikePulseHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        json_response(self, 204, {})

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            path = parsed.path

            if path == "/health":
                return json_response(
                    self,
                    200,
                    {
                        "ok": True,
                        "app": "STRIKEPULSE API",
                        "version": APP_VERSION,
                        "runtime": "python",
                        "providerMode": PROVIDER_MODE,
                        "marketDataConfigured": bool(market_data_key()),
                    },
                )

            if path == "/api/market/context":
                return json_response(self, 200, market_context())

            if path == "/api/market/breadth":
                if PROVIDER_MODE == "mock":
                    return json_response(self, 200, mock_market_context()["breadth"])
                breadth = live_breadth_context()
                if breadth.get("source") == "sector-etf-proxy":
                    fallback_reason = breadth.get("fallbackReason")
                    sectors, _sector_details = sector_proxy_context()
                    breadth = breadth_proxy_from_sectors(sectors)
                    if fallback_reason:
                        breadth["fallbackReason"] = fallback_reason
                return json_response(self, 200, breadth)

            if path == "/api/integrations/audit":
                return json_response(self, 200, integration_audit())

            if path == "/api/events/calendar":
                return json_response(self, 200, economic_calendar(params))

            if path == "/api/market/quote":
                symbol = clean_symbol(params.get("symbol", [""])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Live quotes are disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, live_quote(symbol))

            if path == "/api/market/candles":
                symbol = clean_symbol(params.get("symbol", [""])[0])
                range_name = clean_range(params.get("range", ["1m"])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Live candles are disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, live_candles(symbol, range_name))

            if path == "/api/options/contract":
                options_ticker = clean_options_ticker(params.get("contract", [""])[0])
                as_of = clean_as_of(params.get("as_of", [""])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Option contract reference is disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, option_contract(options_ticker, as_of))

            if path == "/api/options/candles":
                options_ticker = clean_options_ticker(params.get("contract", [""])[0])
                range_name = clean_range(params.get("range", ["1m"])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Option contract candles are disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, option_candles(options_ticker, range_name))

            if path == "/api/options/trades":
                options_ticker = clean_options_ticker(params.get("contract", [""])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Option contract trades are disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, option_trades(options_ticker, params))

            if path == "/api/options/sma":
                options_ticker = clean_options_ticker(params.get("contract", [""])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Option contract SMA is disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, option_sma(options_ticker, params))

            if path in ("/api/options/ema", "/api/options/macd", "/api/options/rsi"):
                options_ticker = clean_options_ticker(params.get("contract", [""])[0])
                indicator = path.rsplit("/", 1)[-1]
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": f"Option contract {indicator.upper()} is disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, option_indicator(options_ticker, indicator, params))

            if path == "/api/signal/live-options":
                options_ticker = clean_options_ticker(params.get("contract", [""])[0])
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Live options signals are disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, live_options_signal(options_ticker))

            if path == "/api/reference/tickers":
                if PROVIDER_MODE == "mock":
                    return json_response(self, 409, {"ok": False, "providerMode": PROVIDER_MODE, "message": "Ticker reference search is disabled while PROVIDER_MODE=mock"})
                return json_response(self, 200, reference_tickers(params))

            if path == "/api/user/state":
                return json_response(self, 200, {
                    "ok": True,
                    "mode": "supabase-cloud-sync" if supabase_configured() else "local-fallback",
                    "supabaseConfigured": supabase_configured(),
                    "message": "Cloud reads are not enabled yet. Local storage remains the source of truth.",
                    "localFallback": True,
                })

            return json_response(self, 404, {"ok": False, "message": "Not found"})
        except Exception as error:
            return json_response(self, 500, {"ok": False, "message": "Server error", "detail": str(error)})

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}") if length else {}

            if parsed.path == "/api/ai/setup-review":
                sanitized = sanitize_ai_payload(payload)
                return json_response(
                    self,
                    200,
                    {
                        "mode": "mock-ai",
                        "sanitized": sanitized,
                        "review": f"{sanitized.get('symbol', 'This setup')} is {sanitized.get('qualityGate', 'unrated')}. Review entry, stop, premium risk, and blockers before taking action.",
                        "privacy": "Only sanitized trade context was accepted. Personal identity and brokerage fields are ignored.",
                    },
                )

            if parsed.path == "/api/signal/analyze":
                return json_response(
                    self,
                    200,
                    {
                        "mode": "strikepulse-signal-engine",
                        "analysis": analyze_signal_payload(payload),
                        "privacy": "Only numeric market, indicator, and contract fields were accepted. No identity or brokerage fields are required.",
                    },
                )

            if parsed.path == "/api/push/subscribe":
                return json_response(self, 501, {"ok": False, "message": "Push subscriptions are not connected yet."})

            if parsed.path == "/api/checkout/create-session":
                return json_response(self, 501, {
                    "ok": False,
                    "message": "Checkout is not connected yet. Stripe Checkout should be created server-side before launch.",
                    "plans": [
                        {
                            "id": "free",
                            "name": "Free",
                            "priceUsdMonthly": 0,
                            "purpose": "Demo workflow, education mode, and paper-trading habit building.",
                        },
                        {
                            "id": "pro",
                            "name": "Pro",
                            "priceUsdMonthly": 29,
                            "purpose": "Daily decision desk for scanner, Quality Gate, 9-Sig, alerts, journal, and paper trading.",
                        },
                        {
                            "id": "elite-ai",
                            "name": "Elite AI",
                            "priceUsdMonthly": 59,
                            "purpose": "Privacy-first AI review, journal coaching, and deeper signal explanations.",
                        },
                        {
                            "id": "desk",
                            "name": "Desk",
                            "priceUsdMonthly": 149,
                            "purpose": "Future live-data tier after market-data redistribution and provider licensing are cleared.",
                        },
                    ],
                    "security": "Never collect or store card data in STRIKEPULSE frontend code.",
                })

            if parsed.path == "/api/user/state":
                result = supabase_sync_state(self, payload)
                return json_response(self, 200 if result.get("ok") else 202, result)

            if parsed.path in ("/api/journal", "/api/alerts", "/api/paper-trades"):
                return json_response(self, 202, {
                    "ok": False,
                    "localFallback": True,
                    "message": "Use /api/user/state for manual Supabase backup. Local storage remains active.",
                    "route": parsed.path,
                })

            return json_response(self, 404, {"ok": False, "message": "Not found"})
        except Exception as error:
            return json_response(self, 500, {"ok": False, "message": "Server error", "detail": str(error)})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), StrikePulseHandler)
    print(f"STRIKEPULSE API listening on http://{HOST}:{PORT} via Python")
    server.serve_forever()
