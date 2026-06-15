# STRIKEPULSE Backend Scaffold

This folder contains dependency-free backend scaffolds for live data, AI calls, push notifications, and Stripe checkout.

It intentionally does not contain real API keys. Keep paid provider credentials in `.env.local` or server environment variables only.

## Run

Preferred Node runtime:

```bash
node backend/server.mjs
```

Python fallback for Windows machines where the bundled Node app alias is blocked:

```bash
py backend/server.py
```

Default URL:

```text
http://127.0.0.1:8787
```

## Endpoints

- `GET /health`
  - API health/version/provider mode/key configured state

- `GET /api/market/context`
  - live/proxy market context response when `PROVIDER_MODE` is active
  - derives SPY, QQQ, sector ETF confirmation, and volatility context from the configured provider where possible
  - uses a volatility ETF proxy when direct VIX/index access is unavailable
  - uses Polygon/Massive grouped daily bars for provider-derived breadth when entitled
  - falls back to `sector-etf-proxy` breadth when grouped breadth is unavailable or plan-blocked

- `GET /api/market/breadth`
  - isolated breadth check for provider-derived advance/decline context
  - returns source, score, state, advancers/decliners, and fallback reason when proxy breadth is used

- `GET /api/integrations/audit`
  - reports current provider status, supplied data, local cache/rate-limit protection, known plan limitations, missing data, and ranked missing integrations by expected signal impact

- `GET /api/events/calendar?symbol=NVDA&sector=Semiconductors&days=14`
  - Finnhub-backed economic calendar when `ECONOMIC_CALENDAR_API_KEY` or `FINNHUB_API_KEY` is configured
  - falls back to local-curated economic/event calendar blockers when the provider is unavailable, unconfigured, plan-blocked, or empty
  - returns event risk score, risk level, applicable macro/sector events, event blockers, and missing live-calendar provider status
  - provider/source fields make it explicit whether data is `finnhub-economic-calendar` or `local-curated-prototype`

- `GET /api/market/quote?symbol=NVDA`
  - live quote proxy when `PROVIDER_MODE` is not `mock`
  - supports Polygon/Massive via `POLYGON_API_KEY`
  - supports Finnhub via `FINNHUB_API_KEY`
  - can also use `MARKET_DATA_API_KEY` as a generic fallback

- `GET /api/market/candles?symbol=NVDA&range=1m`
  - live candle proxy when `PROVIDER_MODE` is not `mock`
  - supported ranges: `1m`, `5m`, `15m`, `1h`

- `GET /api/options/contract?contract=O:NVDA260116C00220000`
  - Polygon/Massive option contract reference proxy
  - wraps `GET /v3/reference/options/contracts/{options_ticker}`
  - optional `as_of=YYYY-MM-DD`
  - returns contract type, exercise style, expiration date, strike price, shares per contract, underlying ticker, and exchange metadata when available

- `GET /api/options/candles?contract=O:NVDA260601C00152500&range=1m`
  - Polygon/Massive option contract OHLC bars
  - wraps `GET /v2/aggs/ticker/{optionsTicker}/range/{multiplier}/{timespan}/{from}/{to}`
  - supported ranges: `1m`, `5m`, `15m`, `1h`

- `GET /api/options/trades?contract=O:NVDA260601C00152500&limit=25`
  - Polygon/Massive option contract trade tape/history
  - wraps `GET /v3/trades/{optionsTicker}`
  - supported query controls: `limit`, `sort=timestamp`, `order=asc|desc`, `timestamp`, `timestamp.lt`, `timestamp.lte`, `timestamp.gt`, `timestamp.gte`
  - `limit` is capped at 500 by the STRIKEPULSE backend

- `GET /api/options/sma?contract=O:NVDA260601C00152500&timespan=minute&window=20&limit=10`
  - Polygon/Massive option contract SMA indicator
  - wraps `GET /v1/indicators/sma/{optionsTicker}`
  - supported query controls: `timespan`, `adjusted`, `window`, `series_type`, `order`, `limit`, timestamp filters, and `include_underlying`
  - `window` is capped at 250 and `limit` is capped at 500 by the STRIKEPULSE backend

- `GET /api/options/ema?contract=O:NVDA260601C00152500&timespan=minute&window=20&limit=10`
  - Polygon/Massive option contract EMA indicator
  - wraps `GET /v1/indicators/ema/{optionsTicker}`

- `GET /api/options/macd?contract=O:NVDA260601C00152500&timespan=minute&short_window=12&long_window=26&signal_window=9&limit=10`
  - Polygon/Massive option contract MACD indicator
  - wraps `GET /v1/indicators/macd/{optionsTicker}`

- `GET /api/options/rsi?contract=O:NVDA260601C00152500&timespan=minute&window=14&limit=10`
  - Polygon/Massive option contract RSI indicator
  - wraps `GET /v1/indicators/rsi/{optionsTicker}`

- `GET /api/reference/tickers?market=stocks&search=NVDA&limit=5`
  - Polygon/Massive supported ticker reference search
  - wraps `GET /v3/reference/tickers`
  - `limit` is capped at 100 by the STRIKEPULSE backend

- `GET /api/signal/live-options?contract=O:NVDA260601C00152500`
  - consolidated live option intelligence endpoint for the STRIKEPULSE app
  - gathers contract metadata, candles, SMA, EMA, MACD, RSI, and trade tape when the data plan allows it
  - returns partial feed failures without failing the whole signal response
  - returns `planBlocked.trades=true` when the provider blocks trade tape for the current data plan; STRIKEPULSE keeps scoring with neutral options-flow treatment instead of marking the setup as bad flow
  - runs the local `strikepulse_signal_engine.py` scoring module against the live option snapshot
  - uses short in-memory caching to reduce provider rate-limit pressure during active UI refreshes

- `POST /api/ai/setup-review`
  - accepts sanitized setup payloads only
  - currently returns mock AI review
  - future home for OpenAI or other AI provider calls

- `POST /api/signal/analyze`
  - runs the local `strikepulse_signal_engine.py` scoring module
  - accepts sanitized `market`, `indicators`, and `contract` snapshots only
  - returns verdict, confidence, score, grade, 9-Sig count, detailed weighted score breakdown, checks, blockers, rejection rules, and notes
  - weighted factors: trend, momentum, RSI, MACD, volume, volatility, market breadth, news sentiment, and options flow
  - accepts optional `market.eventRiskScore` and `market.eventBlockers` so high-impact calendar risk can reduce confidence or force a hard-stop rejection
  - verdict values: `STRONG BUY`, `BUY`, `WAIT`, `AVOID`, `REJECT`
  - `REJECT` is a hard-stop verdict for failed discipline rules such as reward/risk under 2:1, wide spreads, thin liquidity, hostile volatility, or a tape/breadth mismatch
  - no identity, brokerage login, account balance, or payment data is required

- `POST /api/push/subscribe`
  - placeholder for Web Push / Firebase / Twilio

- `POST /api/checkout/create-session`
  - placeholder for Stripe Checkout sessions
  - returns planned Free, Pro, Elite AI, and Desk plan metadata while checkout is not connected
  - future implementation must create checkout sessions server-side and never collect card data in browser code

- `GET /api/user/state`
  - reports cloud-sync mode and whether Supabase is configured
  - cloud reads are still deferred; localStorage remains the source of truth

- `POST /api/user/state`
  - authenticated Supabase backup endpoint for local journal entries, paper account state, and paper trade history
  - requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `Authorization: Bearer <supabase_access_token>`
  - returns local-fallback status when Supabase is unconfigured or the user is not signed in

- `POST /api/journal`
  - direct write route is deferred; use `POST /api/user/state` for manual backup

- `POST /api/alerts`
  - direct write route is deferred; alerts stay local for now

- `POST /api/paper-trades`
  - direct write route is deferred; use `POST /api/user/state` for manual backup

## Security Rules

- Never expose provider, AI, Stripe, or push credentials in browser code.
- Keep Polygon, Finnhub, or other market-data keys in backend environment variables only.
- Accept only sanitized AI payloads from the frontend.
- Ignore identity, brokerage, account balance, phone, email, and payment fields unless a future authenticated backend explicitly needs them.
- Rate-limit AI, alert, and checkout endpoints before launch.
- Add authentication before storing user alerts, journal entries, practice account data, or preferences in the cloud.

## Live Market Data

Mock mode stays the default:

```bash
PROVIDER_MODE=mock
```

Recommended STRIKEPULSE analytics provider:

```bash
PROVIDER_MODE=polygon
POLYGON_API_KEY=your_server_side_key
POLYGON_CACHE_TTL_SECONDS=45
LIVE_OPTIONS_SIGNAL_TTL_SECONDS=20
```

Economic calendar provider:

```bash
ECONOMIC_CALENDAR_PROVIDER=finnhub
ECONOMIC_CALENDAR_API_KEY=your_server_side_finnhub_key
```

Legacy/lightweight provider option:

```bash
PROVIDER_MODE=finnhub
FINNHUB_API_KEY=your_server_side_key
```

Provider aliases `polygon`, `massive`, and `polygon.io` all route to the Polygon-compatible adapter. Do not add these keys to `index.html`, `app.js`, `config.js`, or any browser-delivered file.

## Supabase Auth / Cloud Sync

The frontend has an account modal and App Health account status. `POST /api/user/state` can back up local journal entries, paper account state, and paper trade history once Supabase credentials and a user session token are available.

```bash
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_public_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_side_only
```

Use `SUPABASE_ANON_KEY` only for frontend auth. Keep `SUPABASE_SERVICE_ROLE_KEY` backend-only for future server-side sync/admin operations. The current sync adapter forwards the user's bearer token to Supabase REST so row-level security remains active. If Supabase is unavailable, unconfigured, or missing a token, STRIKEPULSE keeps local journal and paper trading data as the source of truth.
