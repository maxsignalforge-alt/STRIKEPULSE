# STRIKEPULSE

Privacy-first market scanner, signal dashboard, and AI analysis workstation built for discipline, not hype.

STRIKEPULSE is a prototype trading workstation for options traders. It ranks setups, checks option contract quality, plans entries/stops, tracks premium risk, manages alerts, and supports AI-style review without promising outcomes.

## Current STRIKEPULSE Status Checkpoint

This checkpoint documents the current local prototype state for a GitHub-safe progress save. It does not enable cloud sync, broker connectivity, trade execution, or Phase 2 behavior.

- Mission Briefing: active daily command screen that summarizes market weather, Eagle briefing, lightning opportunities, danger signals, replay focus, graveyard lesson, trader streak, confidence, and daily focus.
- Eagle Scout: active explainable-signal layer. Signals show grade, confidence, risk, confluences passed/failed, risk zone, target zone, similar winners, similar failures, replay examples, personal memory, and smart next-step actions.
- Lightning Strike: active proprietary signal layer with Strike In, Strike Out, A+ setup, reject, graveyard, and replay marker concepts wired into the chart and signal explanations.
- Paper Trade: active local demo-money simulator. No real orders. Paper positions can open/close, track simulated P/L, process grade, history, and Proof Engine links.
- Journal: active local journal with personal-info redaction, outcomes, tags, signal links, paper-trade lesson prefills, and replay handoff after completed outcomes.
- Replay: active local Signal Replay and Trade Replay foundation with candle-by-candle style playback, signal score comparison, predicted-vs-actual outcome, Eagle Score changes, and Lightning/Graveyard learning moments.
- Signal Graveyard: active local failed/rejected setup review system that records why signals failed or should have been avoided.
- Proof Engine: active local educational statistics layer. Tracks signal IDs, linked journal entries, linked paper trades, replay references, success rates, Eagle Score accuracy, Strike In/Out reads, and common failure reasons.
- Trade DNA: active local trader-pattern layer. Builds best/worst setups, recurring mistakes, discipline score, sample confidence, and personalized improvement recommendations from paper trades, journal entries, replays, and signal memory.
- Pilot Status: active local trader-readiness layer. Scores discipline, patience, rule adherence, overtrading risk, emotional risk, and readiness; it influences Mission Briefing, Eagle Scout, Journal reminders, and Trade DNA coaching.
- Chart Intelligence: active local-first screenshot analysis workflow. Users can upload/paste PNG/JPG chart screenshots, tag visible chart evidence, compare it to Eagle Scout context, and receive an educational correlation read without uploading screenshots by default.

## Current Guardrails

- No broker integration.
- No trade execution.
- No broker credentials are stored.
- `cloudSyncEnabled` remains `false`.
- Educational decision support only.
- Paper Trading uses fake demo money only.
- Local storage remains the source of truth for journal, paper trades, preferences, alerts, signal memory, and replay data.
- Do not start Supabase Phase 2 or database migrations without explicit approval.

## Known Environment Issues

- `node --check app.js` is currently blocked on this Windows machine with `Access is denied`.
- `git` is currently not available on PATH in this shell, so commits/pushes may need GitHub Desktop, Git Bash, the GitHub website, or a terminal where Git is installed.
- Local app load verification has been done through a Python static server when the Windows sandbox allows it.

## GitHub-Safe Commit And Push Instructions

If `git` is unavailable in this terminal, use GitHub Desktop:

1. Open GitHub Desktop.
2. Choose `File` -> `Add Local Repository`.
3. Select `C:\Users\guita\Documents\Codex\2026-05-31\can-we-pull-up-all-the`.
4. Review the changed files. For this checkpoint, include `README.md` and any already-intended STRIKEPULSE app files from the current working session.
5. In the Summary box, enter:

```text
Document STRIKEPULSE progress checkpoint and guardrails
```

6. Click `Commit to main` or commit to your current branch.
7. Click `Push origin`.

If using the GitHub website/browser:

1. Open the GitHub repository in your browser.
2. Open `README.md`.
3. Click the pencil/edit button.
4. Paste the updated README content from this local file.
5. Use this commit message:

```text
Document STRIKEPULSE progress checkpoint and guardrails
```

6. Choose `Commit directly to the main branch` if you are working solo, or create a branch/PR if you want review.
7. Click `Commit changes`.

If Git becomes available in a terminal:

```bash
git status
git add README.md
git commit -m "Document STRIKEPULSE progress checkpoint and guardrails"
git push
```

## Positioning

STRIKEPULSE is signal intelligence for disciplined options traders: spot momentum, filter weak contracts, build the trade plan, and review the decision loop before real money is at risk.

Public-facing copy should stay sharp, premium, and compliance-safe:

- Lead with scanner, Quality Gate, 9-Sig, paper trading, alerts, journal, and privacy-first AI review.
- Avoid wealth promises, guaranteed wins, unrealistic profit screenshots, or language that implies financial advice.
- Emphasize process: fewer impulsive trades, cleaner plans, better review loops, and no broker credentials required for the prototype.
- Keep demo-money language clear so users know Paper Trading uses fake capital only.

## Recovered Context

- The product name is now `STRIKEPULSE`.
- Maple is the separate GPT assistant helping build the app, not the in-app AI persona.
- The in-app AI should stay professionally labeled as `AI Market Analysis` or `STRIKEPULSE AI` for the MVP.
- The product concept combines three views of the same workflow: market scanner, AI-powered signal platform, and trading dashboard.
- Core MVP target: login, dashboard, symbol search, live quotes, candlestick chart, Strike Score, watchlist, signal history, and AI analysis.
- Planned platform services discussed in ChatGPT: Supabase for auth/database, Polygon/Massive or an equivalent market data provider, OpenAI for AI analysis, GitHub, and Vercel.
- Local browser data saved under the old SignalForge storage keys is migrated to STRIKEPULSE keys on app startup.

## Current Prototype Strengths

- Paper Trading is already in the app with fake demo money, simulated option buys/closes, open P/L, realized P/L, win rate, average P/L, process grade, risky-entry tracking, and resettable demo capital.
- Risk Manager sizes trades from account size, risk percent, entry, stop, and target; outputs max position, dollar risk, risk/reward, suggested contracts, and blocks simulated entries below 2:1 reward/risk.
- Asset Profiles are extensible through a profile registry and ticker mapping; current profile types cover leveraged ETFs, index ETFs, large-cap stocks, small-cap momentum, semiconductor/tech, energy/oil, and commodity ETFs.
- Three STRIKEPULSE themes are available from Preferences: `STRIKEPULSE Midnight`, `Pro Terminal`, and `Volatility Desk`.
- The app already includes a setup scanner, setup tape, market context, options edge, contract selector, premium tracker, quality gate, alerts, journal, local data export, and AI privacy preview.
- Journal notes are local-only in the prototype and redact common personal-info patterns before saving.

## Notification Status

- In-app alerts exist through Alert Builder.
- Setup Radar scans for brewing setups and writes events to Notification Center.
- Browser notifications can be enabled by the user and tested from the app.
- Alert and notification history is stored locally in prototype storage.
- Phone push is not production-ready yet. It needs user accounts, backend subscriptions, rate limits, and a push provider such as PWA Web Push, Firebase Cloud Messaging, Twilio, or a similar service.

## Supabase Phase 1 Auth

Supabase authentication scaffolding is wired for sign up, login, logout, and session persistence through the browser Supabase client.

To enable it locally, update `config.js`:

```js
supabase: {
  enabled: true,
  url: "https://your-project.supabase.co",
  anonKey: "your-public-anon-key",
  authMode: "supabase-js",
  localFallback: true,
  cloudSyncEnabled: false
}
```

Phase 1 enables Supabase authentication only. Journal entries and paper-trading history continue to use local browser storage while cloud sync remains disabled.

## World-Class Product Gaps

The foundation is strong for a prototype, but these are the gaps to close before STRIKEPULSE can compete seriously:

1. Live market data with provider failover, stale-data warnings, and candle/quote validation.
2. Authenticated accounts with secure cloud sync for watchlists, alerts, journal, paper trading, and preferences.
3. Production-grade notifications: phone push, browser push, alert cooldowns, quiet hours, and alert audit history.
4. More realistic Paper Trading: bid/ask fills, slippage, partial closes, bracket exits, trade notes, and performance analytics.
5. Transparent signal methodology docs for Strike Score, Quality Gate, 9-Sig, contract selection, stop logic, and risk limits.
6. Backend-powered AI analysis with sanitized payloads, rate limits, logging controls, and no personal-data sharing by default.
7. Strong onboarding, mobile polish, accessibility, legal pages, privacy policy, terms, and trading risk disclosures.

## Known Future Bug Risks

- Current data is mock/enriched; any live-data integration must handle provider outages, stale quotes, malformed candles, market holidays, and delayed feeds.
- Browser notifications only work while permissions and browser support allow them; production alerts need backend delivery and retry/audit logic.
- Paper Trading is still a simulator; realistic fills need bid/ask execution, slippage, liquidity checks, partial exits, and order-state handling.
- Local prototype storage can be cleared by the browser or device; accounts/cloud sync are required before users rely on saved alerts, journal notes, or paper trades.
- AI review currently falls back to local mock analysis if the backend is offline; production AI needs server-side keys, rate limits, abuse controls, and strict payload validation.
- Legal, privacy, and risk disclosures need final review before launch.

## Refinement Priorities

1. Replace mock market data with live quote/candle/provider flows behind the backend.
2. Add Supabase auth and cloud sync for watchlists, paper trades, alerts, preferences, and signal history.
3. Make Paper Trading more realistic with fills, slippage, bid/ask execution, partial closes, and per-trade notes.
4. Convert the current AI preview into backend-powered STRIKEPULSE AI analysis with sanitized payloads only.
5. Add mobile-first polish, onboarding, empty states, and score-explainability docs before public testing.

## Run Locally

Because the app uses ES modules, serve it over localhost:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

Optional backend scaffold:

```bash
node backend/server.mjs
```

If Node is unavailable or blocked on Windows, use the Python fallback:

```bash
py backend/server.py
```

Backend health check:

```text
http://127.0.0.1:8787/health
```

## Current Files

- `index.html`: UI markup and layout
- `app.js`: app behavior, charting, scoring, alerts, journal, AI privacy preview
- `data.js`: mock ticker data and market context
- `config.js`: provider mode, pricing, feature flags, refresh cadence, alert settings
- `logo.svg`: STRIKEPULSE eagle shield logo
- `terms.html`: prototype Terms of Use draft for launch readiness
- `privacy.html`: prototype Privacy Policy draft for launch readiness
- `risk-disclosure.html`: prototype trading/options Risk Disclosure draft
- `backend/server.mjs`: dependency-free backend scaffold for future provider, AI, push, and Stripe integrations
- `backend/server.py`: Python backend fallback for machines where Node is unavailable
- `strikepulse_signal_engine.py`: pure backend-safe weighted scoring utilities for trend, momentum, RSI, MACD, volume, volatility, market breadth, news sentiment, options flow, 9-Sig, and signal verdicts
- `database.sql`: Supabase-ready schema with row-level security policies
- `.env.example`: future server-side environment variable template

## Pricing Position

- Free: `$0/mo` for demo workflow, education mode, and paper-trading habit building.
- Pro: `$29/mo` for the daily scanner, Quality Gate, 9-Sig, alerts, journal, and paper trading.
- Elite AI: `$59/mo` for privacy-first AI review, journal coaching, and deeper signal explanations.
- Desk: `$149/mo` future tier for live premium data, advanced alerts, cloud sync, expanded replay, and higher refresh limits.

No surprise upgrades. Cancel anytime. Before paid public launch, confirm market-data redistribution rights, Stripe checkout, account auth, refund/cancellation flow, Terms of Use, Privacy Policy, and financial-risk disclosures. Do not sell live provider data to users until the provider plan and license explicitly allow it.

## Supabase Auth Readiness

The app now includes a non-destructive account shell:

- Header `Sign In` button opens the STRIKEPULSE Account modal.
- App Health shows `Account` and cloud-sync readiness.
- `Sync Now` remains gated while `cloudSyncEnabled` is `false`; journal entries and paper-trading history stay local during Phase 1.
- Current localStorage functionality remains the source of truth, so no existing journal, alert, preference, or paper-trading behavior is broken.

Required Supabase variables:

```bash
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_public_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_side_only
```

`SUPABASE_ANON_KEY` may be used by the frontend for Supabase Auth. `SUPABASE_SERVICE_ROLE_KEY` must stay backend-only and must never be placed in browser-delivered files.

`POST /api/user/state` is backend scaffolding for a future authenticated backup of local journal entries, paper account state, and paper trade history. During Phase 1, `cloudSyncEnabled` remains `false`, so STRIKEPULSE keeps journal and paper trading in local fallback mode.

## Mock Data Notice

The app defaults to mock/enriched prototype data. The backend now includes Polygon/Massive and Finnhub live-data provider hooks for quote and candle data, but they stay disabled until `PROVIDER_MODE` is changed from `mock` and a server-side provider key is configured.

Adapter methods:

- `getQuote(symbol)`
- `getCandles(symbol, range)`
- `getOptionChain(symbol)`
- `getMarketContext()`
- `getEvents(symbol)`
- `getOptionsFlow(symbol)`

Backend market-data endpoints:

- `GET /api/market/context`
- `GET /api/market/breadth`
- `GET /api/integrations/audit`
- `GET /api/events/calendar?symbol=NVDA&sector=Semiconductors&days=14`
- `GET /api/market/quote?symbol=NVDA`
- `GET /api/market/candles?symbol=NVDA&range=1m`
- `GET /api/options/contract?contract=O:NVDA260116C00220000`
- `GET /api/options/candles?contract=O:NVDA260601C00152500&range=1m`
- `GET /api/options/trades?contract=O:NVDA260601C00152500&limit=25`
- `GET /api/options/sma?contract=O:NVDA260601C00152500&timespan=minute&window=20&limit=10`
- `GET /api/options/ema?contract=O:NVDA260601C00152500&timespan=minute&window=20&limit=10`
- `GET /api/options/macd?contract=O:NVDA260601C00152500&timespan=minute&short_window=12&long_window=26&signal_window=9&limit=10`
- `GET /api/options/rsi?contract=O:NVDA260601C00152500&timespan=minute&window=14&limit=10`
- `GET /api/reference/tickers?market=stocks&search=NVDA&limit=5`
- `GET /api/signal/live-options?contract=O:NVDA260601C00152500`
- `POST /api/signal/analyze`

Signal engine output:

- `verdict`: `STRONG BUY`, `BUY`, `WAIT`, or `AVOID`
- `confidence`: weighted 0-100 score
- `grade`: `A+`, `A`, `B`, `C`, or `D`
- `scoreBreakdown`: factor-by-factor weighted scoring for trend, momentum, RSI, MACD, volume, volatility, market breadth, news sentiment, and options flow

Recommended Polygon/Massive setup:

```bash
PROVIDER_MODE=polygon
POLYGON_API_KEY=your_server_side_key
POLYGON_CACHE_TTL_SECONDS=45
LIVE_OPTIONS_SIGNAL_TTL_SECONDS=20
```

When Polygon/Massive plan access allows it, STRIKEPULSE derives market breadth from grouped daily stock bars. If that endpoint is unavailable, empty, or plan-blocked, the backend falls back to sector ETF proxy breadth and exposes the fallback reason in `/api/market/breadth` and `/api/market/context`.

Economic calendar setup:

```bash
ECONOMIC_CALENDAR_PROVIDER=finnhub
ECONOMIC_CALENDAR_API_KEY=your_server_side_finnhub_key
```

Finnhub fallback setup:

```bash
PROVIDER_MODE=finnhub
FINNHUB_API_KEY=your_server_side_key
```

Keep market-data and economic-calendar keys on the backend only. Do not put provider keys in `index.html`, `app.js`, `config.js`, or any browser-delivered file. `PROVIDER_MODE=mock` remains the safe default for demos without paid data. The cache TTL settings reduce provider rate-limit pressure during active chart and options-intelligence refreshes.

## Security Principles

- Never expose market data, AI, broker, or push-service API keys in frontend code.
- Route live market data, AI calls, billing, and phone push through a backend.
- Do not send personal user data to AI providers by default.
- Keep AI Privacy Mode on by default.
- Do not store brokerage credentials, payment data, or real account balances in `localStorage`.
- Treat Paper Trading balances as fake demo money only.
- Sanitize all external provider/news content before rendering it.
- Redact common personal-info patterns from local journal notes before saving.
- Add rate limits for alerts and AI calls before launch.

## Cloud Sync Plan

`database.sql` defines the Supabase tables needed for authenticated state:

- `profiles`
- `watchlists`
- `alerts`
- `journal_entries`
- `paper_accounts`
- `paper_trades`
- `signal_history`
- `user_preferences`

Backend cloud-sync routes are scaffolded for future use:

- `GET /api/user/state`
- `POST /api/user/state`
- `POST /api/journal`
- `POST /api/alerts`
- `POST /api/paper-trades`

`POST /api/user/state` is reserved for backing up `journal_entries`, `paper_accounts`, and `paper_trades` after Phase 2 is explicitly approved. The direct `/api/journal`, `/api/alerts`, and `/api/paper-trades` routes still return local-fallback responses.

The App Health panel includes a `Sync Now` button, but cloud sync is disabled during Phase 1. Local storage remains the source of truth for journal, alerts, preferences, and paper trading.

## Compliance Principles

- Educational decision support only.
- Not financial advice.
- Options are high risk and can expire worthless.
- No setup, score, alert, or AI summary guarantees an outcome.
- Users are responsible for their own trades, risk decisions, gains, and losses.
- This is not a ticket to financial freedom, wealth, or becoming a millionaire.
- `terms.html`, `privacy.html`, and `risk-disclosure.html` are prototype launch-readiness drafts. Have qualified legal counsel review them before commercial launch.

## Next Integration Steps

1. Test live Polygon/Massive quote/candle flows once a server-side API key is available.
2. Add backend API proxy for AI calls.
3. Add Supabase auth and database tables for profiles, watchlists, signals, and AI analysis history.
4. Add provider failover, stale-data detection, and API rate-limit handling.
5. Add cloud sync for alerts, journal, preferences, and watchlists.
6. Add phone push via PWA push, Firebase Cloud Messaging, Twilio, or an equivalent provider.
7. Build score-transparency docs for Quality Gate, 9-Sig, contract scoring, and stop logic.
