import { appConfig } from './config.js';
import { symbols, marketContext } from './data.js';

    const defaultPreferences = {
      style: "scalp",
      risk: "100",
      expiry: "weekly",
      moneyness: "atm",
      theme: "strikepulse",
      radar: true,
      focus: false,
      privacy: true,
      onboarded: false
    };

    const themeLabels = {
      strikepulse: "STRIKEPULSE Midnight",
      "pro-terminal": "Pro Terminal",
      volatility: "Volatility Desk",
      massive: "Massive Data"
    };

    const legacyThemeMap = {
      emerald: "pro-terminal",
      "classic-blue": "strikepulse",
      "heritage-green": "pro-terminal"
    };

    function normalizeTheme(theme) {
      const currentTheme = legacyThemeMap[theme] || theme || defaultPreferences.theme;
      return themeLabels[currentTheme] ? currentTheme : defaultPreferences.theme;
    }
    function readStoredJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        localStorage.removeItem(key);
        return fallback;
      }
    }

    const legacyStorageKeys = [
      "signalforgePreferences",
      "signalforgeJournal",
      "signalforgeAlerts",
      "signalforgeFocus",
      "signalforgeSetupRadar",
      "signalforgeNotifiedSetups",
      "signalforgeNotifications",
      "signalforgePrivacyMode",
      "signalforgeShareJournalNotes",
      "signalforgePracticeAccount"
    ];

    const storageKeyMigrations = legacyStorageKeys.map(key => [
      key,
      key.replace("signalforge", "strikepulse")
    ]);

    function migrateLocalStorageKeys() {
      storageKeyMigrations.forEach(([legacyKey, currentKey]) => {
        if (localStorage.getItem(currentKey) === null && localStorage.getItem(legacyKey) !== null) {
          localStorage.setItem(currentKey, localStorage.getItem(legacyKey));
        }
      });
    }

    migrateLocalStorageKeys();

    let userPreferences = { ...defaultPreferences, ...readStoredJson("strikepulsePreferences", {}) };
    userPreferences.theme = normalizeTheme(userPreferences.theme);

    let currentSymbol = "NVDA";
    let activeRange = "1m";
    let zoomLevel = 1;
    let chartTouchDistance = null;
    let chartPanOffset = 0;
    let chartDragStart = null;
    let candles = [];
    let selectedJournalTags = [];
    let journalEntries = readStoredJson("strikepulseJournal", []);
    let alertEntries = readStoredJson("strikepulseAlerts", []);
    let focusMode = localStorage.getItem("strikepulseFocus") === "true";
    let setupRadarEnabled = localStorage.getItem("strikepulseSetupRadar") !== "false";
    let notifiedSetups = readStoredJson("strikepulseNotifiedSetups", {});
    let notificationEvents = readStoredJson("strikepulseNotifications", []);
    let privacyModeEnabled = localStorage.getItem("strikepulsePrivacyMode") !== "false";
    let shareJournalNotes = localStorage.getItem("strikepulseShareJournalNotes") === "true";
    let signalMemory = readStoredJson("strikepulseSignalMemory", []);
    if (!Array.isArray(signalMemory)) signalMemory = [];
    let signalLedger = readStoredJson("strikepulseSignalLedger", []);
    if (!Array.isArray(signalLedger)) signalLedger = [];
    let activeSignalContext = readStoredJson("strikepulseActiveSignalContext", null);
    if (!activeSignalContext || typeof activeSignalContext !== "object") activeSignalContext = null;
    let signalStoryTimelines = readStoredJson("strikepulseSignalStoryTimelines", {});
    if (!signalStoryTimelines || typeof signalStoryTimelines !== "object" || Array.isArray(signalStoryTimelines)) signalStoryTimelines = {};
    let tomorrowMissionSignalId = localStorage.getItem("strikepulseTomorrowMissionSignalId") || "";
    let feedbackEntries = readStoredJson("strikepulseFeedback", []);
    if (!Array.isArray(feedbackEntries)) feedbackEntries = [];
    let practiceAccount = readStoredJson("strikepulsePracticeAccount", null) || {
      startingCash: 25000,
      cash: 25000,
      realizedPnl: 0,
      positions: [],
      history: []
    };
    let latestOptionSignal = null;
    let tickCounter = 0;
    let tradeReplayState = {
      itemId: null,
      item: null,
      timeline: [],
      index: 0,
      playing: false,
      timer: null,
      speedMs: Number(localStorage.getItem("strikepulseTradeReplaySpeed")) || 700,
      chartLinked: false,
      liveCandles: null,
      chartContext: null
    };
    let screenshotPreviewUrl = "";
    let startFlowProgress = readStoredJson("strikepulseStartFlow", {});
    let eagleScoutLayers = {
      lightning: true,
      zones: true,
      heatmap: true,
      vwap: true,
      levels: true,
      ema9: true,
      ema21: true,
      sma50: true,
      bollinger: true,
      volume: true,
      strikeIn: true,
      strikeOut: true,
      aPlus: true,
      reject: true,
      graveyard: true,
      replay: true,
      ...readStoredJson("strikepulseEagleLayers", {})
    };
    let chartEngineSettings = {
      chartType: "candlestick",
      ...readStoredJson("strikepulseChartEngine", {})
    };
    let activeEagleScoutMarker = "live";
    const practiceHistoryLimit = 240;
    const readinessTradeTarget = 100;
    const canvas = document.getElementById("chart");
    const ctx = canvas.getContext("2d");
    const professionalChartContainer = document.getElementById("professionalChart");
    const chartEngineLabel = document.getElementById("chartEngineLabel");
    const eagleChartOverlay = document.getElementById("eagleChartOverlay");
    const professionalChartState = {
      status: "fallback",
      library: null,
      chart: null,
      candleSeries: null,
      volumeSeries: null,
      vwapSeries: null,
      priceLines: [],
      resizeObserver: null
    };
    const screenshotTagSchema = [
      { id: "trend", label: "Trend Direction", options: ["Bullish", "Bearish", "Sideways", "Unclear"] },
      { id: "vwap", label: "Price vs VWAP", options: ["Above VWAP", "Below VWAP", "Reclaiming VWAP", "Losing VWAP", "Unclear"] },
      { id: "ema", label: "EMA Alignment", options: ["Bull stacked", "Bear stacked", "Mixed", "Unclear"] },
      { id: "rsi", label: "RSI Condition", options: ["Strong", "Neutral", "Overbought", "Oversold", "Unclear"] },
      { id: "macd", label: "MACD Condition", options: ["Bullish", "Bearish", "Crossing", "Flat", "Unclear"] },
      { id: "volume", label: "Volume Behavior", options: ["Expanding", "Weak", "Climax", "Unclear"] },
      { id: "levels", label: "Support / Resistance", options: ["Holding support", "Rejecting resistance", "Breaking resistance", "Breaking support", "Unclear"] },
      { id: "breakout", label: "Breakout / Breakdown", options: ["Breakout confirmed", "Breakdown confirmed", "Brewing", "Failed", "None", "Unclear"] },
      { id: "reversal", label: "Reversal Risk", options: ["Low", "Medium", "High", "Unclear"] }
    ];
    const startFlowSteps = [
      { id: "ticker", label: "Pick a ticker", detail: "Search or tap a ticker so STRIKEPULSE can load the live signal.", target: "search", next: "Choose a symbol from the ticker strip or search box." },
      { id: "daily", label: "Read Command Center", detail: "Start with best opportunity, biggest risk, proof lesson, and next action.", target: "dailyCommandCenter", next: "Open the Daily Command Center and inspect the top setup." },
      { id: "ticket", label: "Open Signal Ticket", detail: "Use the Quality Gate, rejection logic, Eagle Score, and Lightning readout.", target: "qualityGate", next: "Review the Signal Ticket before making any paper decision." },
      { id: "paper", label: "Demo paper decision", detail: "Use fake demo money, or reject/wait when blockers are present.", target: "paperTradeSignal", next: "Use demo money only if the setup clears your rules." },
      { id: "journal", label: "Journal the decision", detail: "Save why you confirmed, waited, skipped, or rejected the setup.", target: "journalNote", next: "Journal the decision so Proof Engine can learn from it." },
      { id: "replay", label: "Replay the lesson", detail: "Review what happened after a journal or demo outcome exists.", target: "signalReplaySelect", next: "Replay the saved decision, then store the lesson." }
    ];

    function money(value) { return "$" + value.toFixed(2); }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function redactPersonalInfo(value) {
      return String(value)
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
        .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[redacted phone]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted id]")
        .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted card/account]");
    }

    const dataHealth = {
      provider: appConfig.providerMode === "mock" ? "Mock Enriched" : "Live Provider",
      status: "Healthy",
      latency: 0,
      lastSync: "--",
      failures: 0,
      backend: "unknown"
    };

    const authState = {
      status: appConfig.supabase?.enabled ? "checking" : "guest",
      email: "",
      accessToken: "",
      userId: "",
      message: appConfig.supabase?.enabled ? "Checking saved Supabase session..." : "Local fallback active"
    };
    let supabaseClient = null;
    let supabaseAuthLoading = false;
    const supabaseStorageKey = "strikepulseSupabaseAuth";

    function supabaseReady() {
      return Boolean(appConfig.supabase?.enabled && appConfig.supabase?.url && appConfig.supabase?.anonKey);
    }

    function cloudSyncEnabled() {
      return Boolean(appConfig.supabase?.cloudSyncEnabled);
    }

    function hasCloudSession() {
      return Boolean(cloudSyncEnabled() && supabaseReady() && authState.accessToken);
    }

    function browserStorageAvailable() {
      try {
        const testKey = "strikepulseStorageCheck";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
        return true;
      } catch (error) {
        return false;
      }
    }

    async function getSupabaseClient() {
      if (!supabaseReady()) return null;
      if (supabaseClient) return supabaseClient;
      supabaseAuthLoading = true;
      renderAuthState();
      try {
        const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
        const storage = browserStorageAvailable() ? window.localStorage : undefined;
        supabaseClient = createClient(appConfig.supabase.url, appConfig.supabase.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce",
            storageKey: supabaseStorageKey,
            ...(storage ? { storage } : {})
          }
        });
        return supabaseClient;
      } catch (error) {
        authState.status = "guest";
        authState.accessToken = "";
        authState.userId = "";
        authState.message = `Supabase SDK unavailable: ${error.message}. Local fallback remains active.`;
        return null;
      } finally {
        supabaseAuthLoading = false;
        renderAuthState();
      }
    }

    function applySupabaseSession(session, fallbackMessage = "") {
      const user = session?.user;
      authState.status = user ? "signed-in" : "guest";
      authState.email = user?.email || "";
      authState.userId = user?.id || "";
      authState.accessToken = session?.access_token || "";
      authState.message = user
        ? fallbackMessage || "Signed in. Journal and paper trades remain local in Phase 1."
        : fallbackMessage || "Signed out. Local fallback active.";
    }

    async function initializeSupabaseAuth() {
      if (!supabaseReady()) {
        renderAuthState();
        return;
      }
      authState.status = "checking";
      authState.message = "Checking saved Supabase session...";
      renderAuthState();
      const client = await getSupabaseClient();
      if (!client) return;
      try {
        client.auth.onAuthStateChange((_event, session) => {
          applySupabaseSession(session, session ? "Session active." : "Signed out. Local fallback active.");
          renderAuthState();
          renderAppHealth();
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        applySupabaseSession(data.session, data.session ? "Session restored." : "No saved session. Local fallback active.");
      } catch (error) {
        authState.status = "guest";
        authState.accessToken = "";
        authState.userId = "";
        authState.message = `Supabase session check failed: ${error.message}. Local fallback remains active.`;
      }
      renderAuthState();
    }

    function renderAuthState() {
      const configured = supabaseReady();
      const account = document.getElementById("healthAccount");
      const button = document.getElementById("authButton");
      const status = document.getElementById("authStatus");
      const summary = document.getElementById("authModalSummary");
      const accountAuthMode = document.getElementById("accountAuthMode");
      const accountLocalMode = document.getElementById("accountLocalMode");
      const accountCloudMode = document.getElementById("accountCloudMode");
      const label = authState.status === "signed-in"
        ? authState.email || "Signed in"
        : authState.status === "checking" ? "Checking session" : configured ? "Auth ready" : "Guest mode";
      if (account) {
        account.textContent = label;
        account.className = `mt-1 text-sm font-black ${authState.status === "signed-in" ? "text-emerald-300" : configured ? "text-cyan-200" : "text-zinc-300"}`;
      }
      if (button) {
        button.querySelector("span").textContent = authState.status === "signed-in" ? "Account" : authState.status === "checking" ? "Checking" : "Sign In";
      }
      if (status) {
        status.textContent = supabaseAuthLoading ? "Loading Supabase auth..." : configured ? authState.message : "Local fallback active";
        status.className = `mt-1 text-sm font-black ${authState.status === "signed-in" ? "text-emerald-300" : configured ? "text-cyan-200" : "text-amber-200"}`;
      }
      if (summary) {
        summary.textContent = configured
          ? "Supabase Auth is wired for sign up, login, logout, and session persistence. Local journal and paper-trade fallback remains active."
          : "Supabase auth scaffold is ready. Local fallback stays active until credentials are configured.";
      }
      if (accountAuthMode) {
        accountAuthMode.textContent = authState.status === "signed-in" ? "Signed in" : configured ? "Ready" : "Guest";
        accountAuthMode.className = `mt-1 text-sm font-black ${authState.status === "signed-in" ? "text-emerald-100" : configured ? "text-cyan-100" : "text-zinc-300"}`;
      }
      if (accountLocalMode) {
        accountLocalMode.textContent = appConfig.supabase?.localFallback === false ? "Off" : "Active";
      }
      if (accountCloudMode) {
        accountCloudMode.textContent = cloudSyncEnabled() ? "Enabled" : "Disabled";
        accountCloudMode.className = `mt-1 text-sm font-black ${cloudSyncEnabled() ? "text-emerald-100" : "text-amber-100"}`;
      }
    }

    function openAuthModal() {
      renderAuthState();
      document.getElementById("authModal").classList.remove("hidden");
    }

    async function handleAuthShell(action) {
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      if (!supabaseReady()) {
        authState.status = "guest";
        authState.email = email;
        authState.message = "Supabase credentials are not configured yet. Local fallback remains active.";
        renderAuthState();
        showNeutralToast("Add Supabase URL and anon key in config.js to enable auth");
        return;
      }
      const client = await getSupabaseClient();
      if (!client) {
        renderAuthState();
        showNeutralToast("Supabase SDK unavailable; local fallback preserved");
        return;
      }
      if (action !== "sign-out" && (!email || !password)) {
        authState.message = "Email and password are required.";
        renderAuthState();
        showNeutralToast("Enter email and password");
        return;
      }
      authState.status = action === "sign-out" ? "guest" : "pending";
      authState.message = action === "create" ? "Creating account..." : action === "sign-in" ? "Signing in..." : "Signing out...";
      renderAuthState();
      try {
        if (action === "create") {
          const { data, error } = await client.auth.signUp({ email, password });
          if (error) throw error;
          applySupabaseSession(data.session, data.session ? "Account created and signed in. Local journal and paper trades remain local." : "Account created. Check email if confirmation is enabled.");
          showNeutralToast("Supabase account created");
        } else if (action === "sign-in") {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          applySupabaseSession(data.session, "Signed in. Local journal and paper trades remain local.");
          showNeutralToast("Signed in to STRIKEPULSE");
        } else {
          const { error } = await client.auth.signOut();
          if (error) throw error;
          applySupabaseSession(null, "Signed out. Local fallback active.");
          showNeutralToast("Signed out");
        }
      } catch (error) {
        authState.status = authState.accessToken ? "signed-in" : "guest";
        authState.message = `${error.message}. Local fallback remains active.`;
        showNeutralToast("Supabase auth action failed; local fallback preserved");
      }
      renderAuthState();
      renderAppHealth();
    }

    const assetProfiles = {
      leveragedEtf: {
        label: "Leveraged ETF Profile",
        benchmark: "Underlying index ETF, Nasdaq trend, volatility regime",
        confirmations: ["Benchmark trend aligned", "VIX calm or falling", "Fast momentum confirmation", "Tight spread execution"],
        volatility: "Very high beta; expect outsized intraday swings and faster invalidation.",
        idealConditions: "Clean index trend, broad tech participation, calm VIX, and no chop-heavy tape.",
        riskWarnings: ["Leverage decay magnifies failed holds.", "Use smaller size than the benchmark ETF.", "Avoid entries when VIX expands against the move."],
        weights: { trend: 1.15, momentum: 1.2, volatility: 1.2, breadth: 1.05, flow: 1.05 },
        benchmarkSymbols: ["QQQ", "NDX", "VIX"]
      },
      indexEtf: {
        label: "Index ETF Profile",
        benchmark: "Index breadth, VIX, and megacap leadership",
        confirmations: ["Nasdaq/SPY breadth aligned", "VIX supportive", "Megacap leadership confirms", "Range or VWAP structure is clean"],
        volatility: "Moderate; cleaner execution but prone to premium bleed in chop.",
        idealConditions: "Broad participation, stable volatility, and clear range expansion.",
        riskWarnings: ["Avoid midday chop.", "Do not overstay when breadth fades.", "News candles can reverse index options quickly."],
        weights: { trend: 1.1, breadth: 1.2, volatility: 1.1, momentum: 1.0, flow: 1.0 },
        benchmarkSymbols: ["SPY", "QQQ", "VIX"]
      },
      largeCapStock: {
        label: "Large-Cap Stock Profile",
        benchmark: "Sector ETF, SPY/QQQ trend, options liquidity",
        confirmations: ["Sector trend aligned", "Index not fighting the setup", "Volume above baseline", "Options spread remains tight"],
        volatility: "Moderate to high; liquidity is strong but headline risk matters.",
        idealConditions: "Stock trend aligns with sector and broad market context.",
        riskWarnings: ["Earnings/headline risk can gap through stops.", "Megacap reversals can squeeze late entries."],
        weights: { trend: 1.1, momentum: 1.05, volume: 1.1, flow: 1.1, breadth: 1.0 },
        benchmarkSymbols: ["SPY", "QQQ", "Sector ETF"]
      },
      smallCapMomentum: {
        label: "Small-Cap Momentum Profile",
        benchmark: "Relative volume, float/liquidity, Russell/IWM context",
        confirmations: ["Relative volume expansion", "Breakout holds retest", "Spread/liquidity acceptable", "No immediate offering/headline risk"],
        volatility: "Extreme; failed breakouts can reverse violently.",
        idealConditions: "Fresh catalyst, high relative volume, clean breakout retest, and reduced size.",
        riskWarnings: ["Options can be too thin.", "Spreads can become untradeable.", "Use strict stops and smaller size."],
        weights: { momentum: 1.25, volume: 1.25, flow: 0.9, volatility: 1.2, breadth: 0.85 },
        benchmarkSymbols: ["IWM", "Relative Volume", "Float"]
      },
      semiconductorTech: {
        label: "Semiconductor / Tech Profile",
        benchmark: "QQQ trend, SOX/SMH strength, megacap chip leadership",
        confirmations: ["QQQ trend supportive", "Semiconductor peers aligned", "Sector strength confirms", "MACD/RSI momentum supports entry"],
        volatility: "High; strong trend days can move fast, but reversals are sharp.",
        idealConditions: "QQQ green, SOX/SMH aligned, peer strength from NVDA/AMD/AVGO, and stable VIX.",
        riskWarnings: ["Chip names can reverse on rate or export headlines.", "Avoid calls when QQQ is fighting the move."],
        weights: { trend: 1.15, momentum: 1.1, macd: 1.1, breadth: 1.05, flow: 1.1 },
        benchmarkSymbols: ["QQQ", "SMH", "SOX", "VIX"]
      },
      energyOil: {
        label: "Energy / Oil Profile",
        benchmark: "Crude oil, XLE trend, energy sector breadth",
        confirmations: ["Crude trend confirms", "XLE sector strength aligned", "Energy breadth supportive", "Inventory/news risk understood"],
        volatility: "Moderate to high; commodity headlines can dominate technicals.",
        idealConditions: "Crude oil trend and energy equities point in the same direction.",
        riskWarnings: ["Inventory reports and OPEC/news can invalidate signals.", "Avoid entries before major oil headlines."],
        weights: { trend: 1.1, volume: 1.05, volatility: 1.15, breadth: 1.15, news: 1.2 },
        benchmarkSymbols: ["CL", "USO", "XLE", "OIH"]
      },
      commodityEtf: {
        label: "Commodity ETF Profile",
        benchmark: "Underlying commodity trend, dollar/rates context, event risk",
        confirmations: ["Underlying commodity trend aligned", "Inventory/news risk controlled", "ETF trend confirms", "Volatility is not disorderly"],
        volatility: "High around reports; ETF can gap on commodity futures movement.",
        idealConditions: "Commodity trend is clear and no immediate scheduled report conflicts with the setup.",
        riskWarnings: ["Inventory, geopolitical, and futures gaps can override chart signals.", "Stops can slip around reports."],
        weights: { trend: 1.15, volatility: 1.2, news: 1.25, momentum: 1.0, volume: 1.0 },
        benchmarkSymbols: ["Underlying futures", "US Dollar", "Inventory/news"]
      }
    };

    const assetProfileBySymbol = {
      TQQQ: "leveragedEtf",
      SQQQ: "leveragedEtf",
      QQQ: "indexEtf",
      SPY: "indexEtf",
      IWM: "indexEtf",
      NVDA: "semiconductorTech",
      AMD: "semiconductorTech",
      AVGO: "semiconductorTech",
      AAPL: "largeCapStock",
      META: "largeCapStock",
      TSLA: "largeCapStock",
      XLE: "energyOil",
      XOM: "energyOil",
      CVX: "energyOil",
      USO: "commodityEtf",
      GLD: "commodityEtf",
      SLV: "commodityEtf"
    };

    async function apiFetch(path, options = {}) {
      if (!appConfig.backendEnabled || !appConfig.apiBaseUrl) {
        throw new Error("Backend disabled");
      }
      const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
        ...options,
        headers: {
          "content-type": "application/json",
          ...(options.headers || {})
        }
      });
      if (!response.ok) {
        let detail = `API ${response.status}`;
        try {
          const errorBody = await response.json();
          detail = errorBody.detail || errorBody.message || detail;
        } catch (error) {}
        throw new Error(detail);
      }
      return response.json();
    }

    async function refreshBackendHealth() {
      if (!appConfig.backendEnabled) {
        dataHealth.backend = "disabled";
        renderAppHealth();
        return;
      }
      try {
        const health = await apiFetch("/health");
        dataHealth.backend = "connected";
        if (health.providerMode && health.providerMode !== "mock") {
          appConfig.providerMode = health.providerMode;
          dataHealth.provider = health.providerMode === "polygon" ? "Polygon/Massive" : health.providerMode;
        }
      } catch (error) {
        dataHealth.backend = "offline";
      }
      renderAppHealth();
    }

    function shouldUseBackendMarketData() {
      return appConfig.backendEnabled && appConfig.providerMode !== "mock";
    }

    const dataAdapter = {
      name: appConfig.providerMode === "mock" ? "Mock Enriched" : "Live Provider",
      async getQuote(symbol) {
        const started = performance.now();
        if (!shouldUseBackendMarketData()) {
          const data = symbols[symbol];
          updateDataHealth(started, true);
          return {
            symbol,
            price: data.price,
            changePercent: data.move,
            provider: "mock"
          };
        }
        try {
          const quote = await apiFetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`);
          dataHealth.backend = "connected";
          dataHealth.provider = quote.provider || "Live Provider";
          updateDataHealth(started, true);
          return quote;
        } catch (error) {
          dataHealth.backend = appConfig.backendEnabled ? "offline" : "disabled";
          updateDataHealth(started, false);
          throw error;
        }
      },
      async getCandles(symbol, range) {
        const started = performance.now();
        const data = symbols[symbol];
        if (shouldUseBackendMarketData()) {
          try {
            const result = await apiFetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
            if (Array.isArray(result.candles) && result.candles.length) {
              dataHealth.backend = "connected";
              dataHealth.provider = result.provider || "Live Provider";
              updateDataHealth(started, true);
              return result.candles;
            }
          } catch (error) {
            dataHealth.backend = appConfig.backendEnabled ? "offline" : "disabled";
            updateDataHealth(started, false);
          }
        }
        const result = generateCandles(data.price, data.type);
        updateDataHealth(started, true);
        return result;
      },
      async getOptionChain(symbol) {
        const started = performance.now();
        const data = symbols[symbol];
        const premium = getPremiumModel(data);
        const result = {
          symbol,
          bid: Math.max(0.01, premium.basePremium - premium.spread / 2),
          ask: premium.basePremium + premium.spread / 2,
          midpoint: premium.midpoint,
          spread: premium.spread,
          iv: data.options.iv,
          openInterest: data.options.liquidity === "Elite" ? 8000 : data.options.liquidity === "Decent" ? 2500 : data.options.liquidity === "Selective" ? 900 : 180,
          volume: data.options.liquidity === "Elite" ? 5200 : data.options.liquidity === "Decent" ? 1400 : data.options.liquidity === "Selective" ? 450 : 60
        };
        updateDataHealth(started, true);
        return result;
      },
      async getMarketContext() {
        const started = performance.now();
        try {
          const context = await apiFetch("/api/market/context");
          updateDataHealth(started, true);
          dataHealth.backend = "connected";
          return context;
        } catch (error) {
          dataHealth.backend = appConfig.backendEnabled ? "offline" : "disabled";
        }
        updateDataHealth(started, true);
        return marketContext;
      },
      async getEvents(symbol) {
        const started = performance.now();
        const data = symbols[symbol];
        try {
          const result = await apiFetch(`/api/events/calendar?symbol=${encodeURIComponent(symbol)}&sector=${encodeURIComponent(data.sector)}&days=14`);
          updateDataHealth(started, true);
          dataHealth.backend = "connected";
          return result;
        } catch (error) {
          const elevated = data.options.iv >= 60;
          updateDataHealth(started, true);
          return {
            provider: "local-fallback",
            riskScore: elevated ? 62 : 82,
            riskLevel: elevated ? "Moderate" : "Low",
            blockers: [],
            events: [],
            missing: { economicCalendar: "backend-unavailable" },
            note: elevated ? "Check event calendar before holding premium." : "No major prototype event risk flagged."
          };
        }
      },
      async getOptionsFlow(symbol) {
        const started = performance.now();
        const data = symbols[symbol];
        updateDataHealth(started, true);
        return {
          bias: data.options.flow,
          unusualVolume: data.confidence >= 84,
          putCallSkew: data.type === "Bullish" ? "Call-heavy" : "Put-heavy"
        };
      }
    };

    function renderPreferences() {
      userPreferences.theme = normalizeTheme(userPreferences.theme);
      document.getElementById("prefStyle").value = userPreferences.style;
      document.getElementById("prefRisk").value = userPreferences.risk;
      document.getElementById("prefExpiry").value = userPreferences.expiry;
      document.getElementById("prefMoneyness").value = userPreferences.moneyness;
      document.getElementById("prefTheme").value = userPreferences.theme;
      document.getElementById("prefRadar").checked = userPreferences.radar;
      document.getElementById("prefFocus").checked = userPreferences.focus;
      document.getElementById("prefPrivacy").checked = userPreferences.privacy;
      document.getElementById("prefsSummary").textContent = `${userPreferences.style} trader, ${money(Number(userPreferences.risk))} max risk, ${userPreferences.expiry} ${userPreferences.moneyness.toUpperCase()} contracts, ${themeLabels[userPreferences.theme]} theme, radar ${userPreferences.radar ? "on" : "off"}, privacy ${userPreferences.privacy ? "on" : "off"}.`;
    }

    function applyPreferences() {
      userPreferences.theme = normalizeTheme(userPreferences.theme);
      document.body.dataset.brokerTheme = userPreferences.theme;
      document.getElementById("riskBudget").value = userPreferences.risk;
      document.getElementById("expiryChoice").value = userPreferences.expiry;
      document.getElementById("moneynessChoice").value = userPreferences.moneyness;
      setupRadarEnabled = userPreferences.radar;
      focusMode = userPreferences.focus;
      privacyModeEnabled = userPreferences.privacy;
      renderSetupRadar();
      applyFocusMode();
      renderPrivacyPreview();
      setSignal(currentSymbol, false);
    }

    function savePreferences() {
      userPreferences = {
        style: document.getElementById("prefStyle").value,
        risk: document.getElementById("prefRisk").value,
        expiry: document.getElementById("prefExpiry").value,
        moneyness: document.getElementById("prefMoneyness").value,
        theme: normalizeTheme(document.getElementById("prefTheme").value),
        radar: document.getElementById("prefRadar").checked,
        focus: document.getElementById("prefFocus").checked,
        privacy: document.getElementById("prefPrivacy").checked,
        onboarded: true
      };
      localStorage.setItem("strikepulsePreferences", JSON.stringify(userPreferences));
      renderPreferences();
      applyPreferences();
      document.getElementById("prefsModal").classList.add("hidden");
      showNeutralToast("Preferences saved");
    }

    function persistCoachPreferences() {
      localStorage.setItem("strikepulsePreferences", JSON.stringify(userPreferences));
      renderPreferences();
      applyPreferences();
    }

    function selectedCoachValue(name, fallback) {
      return document.querySelector(`.coach-choice.is-selected[data-coach-${name}]`)?.dataset[`coach${name[0].toUpperCase()}${name.slice(1)}`] || fallback;
    }

    function initializeFirstUseCoach() {
      const coach = document.getElementById("firstUseCoach");
      if (!coach) return;
      coach.querySelectorAll(".coach-choice").forEach(button => {
        button.addEventListener("click", () => {
          const group = button.dataset.coachStyle ? "coachStyle" : "coachDepth";
          coach.querySelectorAll(`[data-${group.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}]`).forEach(item => item.classList.remove("is-selected"));
          button.classList.add("is-selected");
        });
      });
      document.getElementById("firstUseStart")?.addEventListener("click", () => {
        userPreferences.style = selectedCoachValue("style", userPreferences.style || "scalp");
        userPreferences.risk = userPreferences.risk || "100";
        userPreferences.onboarded = true;
        localStorage.setItem("strikepulseAnalysisDepth", selectedCoachValue("depth", "beginner"));
        persistCoachPreferences();
        coach.classList.add("hidden");
        focusMissionBriefingFirstScreen({ force: true });
        showNeutralToast("Today's setup is ready");
      });
      if (!userPreferences.onboarded) {
        coach.classList.remove("hidden");
      }
    }

    function updateDataHealth(started, ok) {
      dataHealth.provider = dataAdapter.name;
      dataHealth.latency = Math.max(1, Math.round(performance.now() - started));
      dataHealth.lastSync = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if (ok) {
        dataHealth.status = dataHealth.failures > 0 ? "Recovered" : "Healthy";
        dataHealth.failures = 0;
      } else {
        dataHealth.failures += 1;
        dataHealth.status = dataHealth.failures >= 3 ? "Degraded" : "Retrying";
      }
      renderDataHealth();
    }

    function renderDataHealth() {
      document.getElementById("dataProvider").textContent = dataHealth.provider;
      document.getElementById("dataHealth").textContent = dataHealth.status;
      document.getElementById("dataHealth").className = `mt-1 text-sm font-black ${dataHealth.status === "Healthy" || dataHealth.status === "Recovered" ? "text-emerald-300" : dataHealth.status === "Retrying" ? "text-amber-200" : "text-rose-300"}`;
      document.getElementById("dataLatency").textContent = `${dataHealth.latency}ms`;
      document.getElementById("dataLastSync").textContent = dataHealth.lastSync;
      renderAppHealth();
    }

    function localDataKeys() {
      return [
        "strikepulsePreferences",
        "strikepulseJournal",
        "strikepulseAlerts",
        "strikepulseFocus",
        "strikepulseSetupRadar",
        "strikepulseNotifiedSetups",
        "strikepulseNotifications",
        "strikepulsePrivacyMode",
        "strikepulseShareJournalNotes",
        "strikepulsePracticeAccount",
        "strikepulseStartFlow",
        "strikepulseEagleLayers",
        "strikepulseSignalMemory",
        "strikepulseSignalLedger",
        "strikepulseFeedback",
        "strikepulseMissionState"
      ];
    }

    function getLocalDataSnapshot() {
      return Object.fromEntries(localDataKeys().map(key => [key, readStoredJson(key, localStorage.getItem(key))]));
    }

    function buildUserStateSnapshot() {
      const localData = getLocalDataSnapshot();
      return {
        app: appConfig.appName,
        version: appConfig.version,
        capturedAt: new Date().toISOString(),
        preferences: userPreferences,
        alerts: alertEntries,
        journalEntries,
        paperAccount: practiceAccount,
        signalMemory,
        signalLedger,
        feedbackEntries,
        notifications: notificationEvents,
        localData
      };
    }

    let cloudSyncTimer = null;

    function queueCloudSync(reason = "local-change") {
      if (!hasCloudSession()) return;
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(() => {
        syncLocalState({ silent: true, reason });
      }, 900);
    }

    async function syncLocalState(options = {}) {
      const started = performance.now();
      const cloudSync = document.getElementById("healthCloudSync");
      if (!cloudSyncEnabled()) {
        cloudSync.textContent = "Auth only";
        cloudSync.className = "mt-1 text-sm font-black text-cyan-200";
        authState.message = authState.status === "signed-in"
          ? "Signed in. Cloud journal and paper-trade sync are off for Phase 1."
          : "Phase 1 auth only. Local fallback remains active.";
        renderAuthState();
        if (!options.silent) showNeutralToast("Phase 1 is auth only; journal and paper trades stay local");
        return;
      }
      if (!supabaseReady()) {
        cloudSync.textContent = "Local fallback";
        cloudSync.className = "mt-1 text-sm font-black text-amber-200";
        authState.message = "Add Supabase URL and anon key before cloud sync.";
        renderAuthState();
        if (!options.silent) showNeutralToast("Cloud sync is waiting for Supabase credentials");
        return;
      }
      if (!authState.accessToken) {
        cloudSync.textContent = "Local fallback";
        cloudSync.className = "mt-1 text-sm font-black text-amber-200";
        authState.message = "Sign in with Supabase before cloud sync.";
        renderAuthState();
        if (!options.silent) showNeutralToast("Cloud sync is waiting for Supabase sign-in");
        return;
      }
      cloudSync.textContent = "Syncing";
      cloudSync.className = "mt-1 text-sm font-black text-cyan-200";
      try {
        const result = await apiFetch("/api/user/state", {
          method: "POST",
          headers: {
            authorization: `Bearer ${authState.accessToken}`
          },
          body: JSON.stringify(buildUserStateSnapshot())
        });
        if (!result.ok) {
          throw new Error(result.message || "Supabase sync fell back to local mode");
        }
        dataHealth.backend = "connected";
        cloudSync.textContent = "Synced";
        cloudSync.className = "mt-1 text-sm font-black text-emerald-300";
        const synced = result.synced || {};
        const syncDetail = `${synced.journalEntries || 0} journal / ${synced.paperTrades || 0} paper`;
        authState.message = `Cloud backup synced: ${syncDetail}. Local fallback remains active.`;
        renderAuthState();
        if (!options.silent) showNeutralToast(`Cloud backup synced: ${syncDetail}`);
      } catch (error) {
        dataHealth.backend = appConfig.backendEnabled ? "connected" : "disabled";
        cloudSync.textContent = "Local fallback";
        cloudSync.className = "mt-1 text-sm font-black text-amber-200";
        authState.message = error.message || "Cloud sync unavailable. Local fallback remains active.";
        renderAuthState();
        if (!options.silent) showNeutralToast("Cloud sync unavailable; local fallback preserved");
      } finally {
        dataHealth.latency = Math.max(1, Math.round(performance.now() - started));
        renderAppHealth();
      }
    }

    function renderAppHealth() {
      const storedCount = localDataKeys().filter(key => localStorage.getItem(key) !== null).length;
      const notificationState = !("Notification" in window) ? "Unsupported" : Notification.permission;
      document.getElementById("appVersion").textContent = `v${appConfig.version}`;
      document.getElementById("healthProvider").textContent = dataHealth.provider;
      document.getElementById("healthStatus").textContent = dataHealth.status;
      document.getElementById("healthStatus").className = `mt-1 text-sm font-black ${dataHealth.status === "Healthy" || dataHealth.status === "Recovered" ? "text-emerald-300" : dataHealth.status === "Retrying" ? "text-amber-200" : "text-rose-300"}`;
      document.getElementById("healthNotifications").textContent = notificationState;
      document.getElementById("healthLocalData").textContent = `${storedCount} keys`;
      document.getElementById("healthBackend").textContent = dataHealth.backend;
      document.getElementById("healthBackend").className = `mt-1 text-sm font-black ${dataHealth.backend === "connected" ? "text-emerald-300" : dataHealth.backend === "offline" ? "text-amber-200" : "text-zinc-300"}`;
      if (!["Synced", "Syncing"].includes(document.getElementById("healthCloudSync").textContent)) {
        const cloudLabel = cloudSyncEnabled()
          ? hasCloudSession() ? "Ready" : "Local fallback"
          : supabaseReady() ? "Auth only" : "Local fallback";
        document.getElementById("healthCloudSync").textContent = cloudLabel;
        document.getElementById("healthCloudSync").className = `mt-1 text-sm font-black ${cloudLabel === "Ready" || cloudLabel === "Auth only" ? "text-cyan-200" : "text-amber-200"}`;
      }
      renderAuthState();
      renderLaunchReadiness(storedCount, notificationState);
    }

    function saveStartFlowProgress() {
      localStorage.setItem("strikepulseStartFlow", JSON.stringify(startFlowProgress));
    }

    function markStartFlowStep(stepId) {
      if (!startFlowSteps.some(step => step.id === stepId)) return;
      if (startFlowProgress[stepId]) return;
      startFlowProgress = { ...startFlowProgress, [stepId]: true };
      saveStartFlowProgress();
      renderStartFlow();
    }

    function startFlowJump(targetId) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (targetId === "dailyCommandCenter") markStartFlowStep("daily");
      if (targetId === "qualityGate") markStartFlowStep("ticket");
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
        setTimeout(() => target.focus({ preventScroll: true }), 350);
      }
    }

    function renderStartFlow() {
      const list = document.getElementById("startFlowList");
      const score = document.getElementById("startFlowScore");
      const summary = document.getElementById("startFlowSummary");
      const nextStep = document.getElementById("startFlowNextStep");
      const nextButton = document.getElementById("startFlowNextButton");
      if (!list || !score || !summary) return;
      const completed = startFlowSteps.filter(step => startFlowProgress[step.id]).length;
      const next = startFlowSteps.find(step => !startFlowProgress[step.id]);
      score.textContent = `${completed}/${startFlowSteps.length}`;
      score.className = `rounded-full border bg-zinc-950/70 px-3 py-1 text-xs font-black ${completed === startFlowSteps.length ? "border-emerald-300/30 text-emerald-100" : "border-sky-300/30 text-sky-100"}`;
      summary.textContent = completed === startFlowSteps.length
        ? "First Signal Story complete: STRIKEPULSE produced a decision, captured proof, and created a lesson for tomorrow."
        : `Complete ${startFlowSteps.length - completed} more step${startFlowSteps.length - completed === 1 ? "" : "s"} to finish the first value loop.`;
      if (nextStep && nextButton) {
        nextStep.textContent = next ? `Next: ${next.next}` : "First Signal Story complete. Tomorrow Mission can now use the lesson.";
        nextButton.textContent = next ? `Go: ${next.label}` : "Review Mission";
        nextButton.dataset.startFlowTarget = next?.target || "dailyCommandCenter";
      }
      list.innerHTML = startFlowSteps.map((step, index) => {
        const done = Boolean(startFlowProgress[step.id]);
        return `
          <button data-start-flow-target="${step.target}" class="rounded-lg border ${done ? "border-emerald-300/25 bg-emerald-300/10" : "border-zinc-800 bg-zinc-950/80"} p-3 text-left hover:border-sky-300/45">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="flex items-center gap-2 text-sm font-black ${done ? "text-emerald-100" : "text-zinc-100"}">
                  <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-300 text-zinc-950" : "bg-zinc-800 text-zinc-400"} text-[11px] font-black">${done ? "✓" : index + 1}</span>
                  <span>${step.label}</span>
                </p>
                <p class="mt-1 text-xs leading-relaxed text-zinc-400">${step.detail}</p>
              </div>
              <span class="shrink-0 rounded-full ${done ? "bg-emerald-300/10 text-emerald-200" : "bg-sky-300/10 text-sky-100"} px-2 py-1 text-[11px] font-black">${done ? "Done" : "Go"}</span>
            </div>
          </button>
        `;
      }).join("");
      document.querySelectorAll("[data-start-flow-target]").forEach(button => {
        button.addEventListener("click", () => startFlowJump(button.dataset.startFlowTarget));
      });
    }

    function operatingLoopVerdict({ gate, rejection, lightning, pilot, proof, replays }) {
      if (pilot?.status === "Grounded") return {
        verdict: "Replay First",
        tone: "indigo",
        action: "Pause new demo trades. Replay one saved story, then journal the lesson."
      };
      if (rejection?.verdict === "REJECT" || lightning?.outProbability >= 66) return {
        verdict: "Reject",
        tone: "rose",
        action: rejection?.mainReason || "Risk is too high. Journal the rejection as a completed decision."
      };
      if ((replays?.length || 0) && (!proof?.closed || proof.closed < 5)) return {
        verdict: "Replay First",
        tone: "indigo",
        action: "Replay one saved Signal Story before taking new demo risk."
      };
      if (gate?.verdict === "A+ SETUP" && rejection?.verdict === "APPROVED" && lightning?.inProbability >= 68) return {
        verdict: "Confirm",
        tone: "emerald",
        action: "Confirm the trigger, use demo money only, then journal the decision."
      };
      return {
        verdict: "Wait",
        tone: "amber",
        action: "The setup is not clean yet. Journal the wait decision or replay a similar story."
      };
    }

    function operatingLoopTone(tone) {
      const tones = {
        emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
        rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
        amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
        indigo: "border-indigo-300/30 bg-indigo-300/10 text-indigo-100",
        cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      };
      return tones[tone] || tones.cyan;
    }

    function signalStoryStatusReadout() {
      if (!activeSignalContext?.signalId) {
        return {
          signalId: "No Signal Story",
          status: "Not Started",
          next: "Open Mission Briefing to begin: review one setup, decide, journal, replay.",
          tone: "cyan"
        };
      }
      const story = reconstructSignalStoryTimeline(activeSignalContext.signalId);
      const action = activeSignalContext.suggestedAction || "Wait";
      if (story?.tomorrowMissionLesson || story?.tradeDnaLesson) {
        return {
          signalId: activeSignalContext.signalId,
          status: "Ready for Tomorrow",
          next: "Tomorrow Mission will use this exact lesson.",
          tone: "emerald"
        };
      }
      if (story?.replayGenerated) {
        return {
          signalId: activeSignalContext.signalId,
          status: "Replay Reviewed",
          next: "Open Your Trading Pattern to confirm the lesson.",
          tone: "indigo"
        };
      }
      if (story?.journalSaved) {
        return {
          signalId: activeSignalContext.signalId,
          status: "Journal Saved",
          next: "Replay this exact Signal ID to see what happened next.",
          tone: "cyan"
        };
      }
      if (story?.paperTradeOpened) {
        return {
          signalId: activeSignalContext.signalId,
          status: "Demo Trade Attached",
          next: "Close or journal the demo decision so STRIKEPULSE can learn.",
          tone: "amber"
        };
      }
      if (story?.eagleViewed) {
        const next = action === "Confirm"
          ? "Use demo money or journal the plan."
          : action === "Reject"
            ? "Journal the rejection. Skipping a bad setup is a completed decision."
            : action === "Replay"
              ? "Replay this exact Signal ID before any demo risk."
              : "Journal the wait decision. Waiting is a completed decision.";
        return {
          signalId: activeSignalContext.signalId,
          status: "Setup Reviewed",
          next,
          tone: action === "Confirm" ? "emerald" : action === "Reject" ? "rose" : action === "Replay" ? "indigo" : "amber"
        };
      }
      if (story?.missionViewed) {
        return {
          signalId: activeSignalContext.signalId,
          status: "Mission Briefed",
          next: "Open the setup coach to choose demo trade, wait, reject, or replay first.",
          tone: "cyan"
        };
      }
      return {
        signalId: activeSignalContext.signalId,
        status: "Signal Story Loaded",
        next: "Continue from Mission Briefing or Eagle Scout.",
        tone: "cyan"
      };
    }

    function signalStoryStatusClass(tone) {
      const classes = {
        emerald: "text-emerald-100",
        rose: "text-rose-100",
        amber: "text-amber-100",
        indigo: "text-indigo-100",
        cyan: "text-cyan-100"
      };
      return classes[tone] || classes.cyan;
    }

    function renderSignalStoryStatus() {
      const readout = signalStoryStatusReadout();
      const text = `Signal Story: ${readout.signalId} · ${readout.status}. Next: ${readout.next}`;
      [
        "operatingLoopStoryStatus",
        "eagleScoutStoryStatus",
        "journalStoryStatus",
        "signalReplayStoryStatus",
        "tradeDnaStoryStatus"
      ].forEach(id => {
        const node = document.getElementById(id);
        if (!node) return;
        node.textContent = text;
        node.className = `mt-2 text-xs font-bold leading-relaxed ${signalStoryStatusClass(readout.tone)}`;
      });
      return readout;
    }

    function renderOperatingLoop(payload = {}) {
      const title = document.getElementById("operatingLoopVerdict");
      const action = document.getElementById("operatingLoopAction");
      const trust = document.getElementById("operatingLoopTrust");
      const steps = document.getElementById("operatingLoopSteps");
      if (!title || !action || !trust || !steps) return;
      const data = payload.data || symbols[currentSymbol];
      const gate = payload.gate || getQualityGate(data);
      const rejection = payload.rejection || evaluateTradeRejection(data, gate, currentSymbol);
      const lightning = payload.lightning || evaluateLightningStrike(data, gate, rejection, currentSymbol);
      const pilot = buildPilotStatus();
      const proof = buildProofEngineMetrics();
      const replays = typeof signalReplayItems === "function" ? signalReplayItems() : [];
      const readout = operatingLoopVerdict({ gate, rejection, lightning, pilot, proof, replays });
      const proofText = proof.closed
        ? `${proof.closed} outcomes · ${proofPercent(proof.successRate)} win`
        : "Proof sample building";
      title.textContent = `${readout.verdict}: ${currentSymbol}`;
      title.className = `mt-1 text-xl font-black ${readout.tone === "emerald" ? "text-emerald-100" : readout.tone === "rose" ? "text-rose-100" : readout.tone === "indigo" ? "text-indigo-100" : "text-amber-100"}`;
      action.textContent = readout.action;
      trust.textContent = `${proofText} · ${pilot.status}`;
      trust.className = `w-fit rounded-full border bg-zinc-950/70 px-3 py-1 text-xs font-black ${readout.tone === "emerald" ? "border-emerald-300/30 text-emerald-100" : readout.tone === "rose" ? "border-rose-300/30 text-rose-100" : readout.tone === "indigo" ? "border-indigo-300/30 text-indigo-100" : "border-amber-300/30 text-amber-100"}`;
      const loopSteps = [
        { label: "Mission", value: `${payload.weather?.label || getMarketWeather(currentSymbol).label} weather`, target: "dailyCommandCenter", active: true },
        { label: "Setup Coach", value: `${gate.verdict} · ${lightning.verdict.replace("⚡ ", "")}`, target: "eagleScoutExplainPanel", active: ["Confirm", "Wait"].includes(readout.verdict) },
        { label: "Decision", value: readout.verdict, target: readout.verdict === "Reject" ? "journalNote" : "paperTradeSignal", active: true },
        { label: "Learn", value: readout.verdict === "Replay First" ? "Replay now" : "Journal, then replay", target: readout.verdict === "Replay First" ? "signalReplaySelect" : "journalNote", active: true }
      ];
      steps.innerHTML = loopSteps.map((step, index) => `
        <button data-operating-loop-target="${step.target}" class="rounded-lg border ${step.active ? operatingLoopTone(readout.tone) : "border-zinc-800 bg-zinc-950/70 text-zinc-400"} p-3 text-left hover:border-cyan-300/50" type="button">
          <p class="text-[10px] font-black uppercase opacity-70">${index + 1}. ${escapeHtml(step.label)}</p>
          <p class="mt-1 text-sm font-black">${escapeHtml(step.value)}</p>
        </button>
      `).join("");
      steps.querySelectorAll("[data-operating-loop-target]").forEach(button => {
        button.addEventListener("click", () => startFlowJump(button.dataset.operatingLoopTarget));
      });
      renderSignalStoryStatus();
    }

    function readinessItem(label, status, detail, tone = "ready") {
      return { label, status, detail, tone };
    }

    function renderLaunchReadiness(storedCount = 0, notificationState = "unknown") {
      const backendConnected = dataHealth.backend === "connected";
      const authReady = supabaseReady();
      const sessionReady = authState.status === "signed-in" || authState.status === "checking" || authReady;
      const cloudDisabled = !cloudSyncEnabled();
      const localDataReady = storedCount >= 0;
      const providerReady = dataHealth.provider !== "Mock Enriched" || appConfig.providerMode !== "mock";
      const proofMetrics = buildProofEngineMetrics();
      const firstFlowDone = startFlowSteps.every(step => startFlowProgress[step.id]);
      const feedbackReady = feedbackEntries.length > 0;
      const items = [
        readinessItem("Auth scaffold", authReady ? "Ready" : "Local fallback", authReady ? "Supabase client is configured for sign up, login, logout, and sessions." : "Supabase credentials are not configured; local mode still works.", authReady ? "ready" : "partial"),
        readinessItem("Session persistence", sessionReady ? "Ready" : "Check", sessionReady ? "Refresh-session restore logic is active." : "Session restore needs a configured Supabase client.", sessionReady ? "ready" : "partial"),
        readinessItem("Cloud sync", cloudDisabled ? "Disabled" : "Enabled", cloudDisabled ? "Intentionally off for Phase 1. Journal and paper trades stay local." : "Cloud sync is enabled; verify Phase 2 policies before beta.", cloudDisabled ? "safe" : "partial"),
        readinessItem("Paper trading", "Ready", "Demo-money trading is available with no brokerage execution.", "ready"),
        readinessItem("Journal", "Ready", "Journal notes stay local and redact common personal info patterns.", "ready"),
        readinessItem("Screenshot check", "Ready", "Manual screenshot comparison is local-only and does not upload images.", "ready"),
        readinessItem("Eagle Scout chart", "Ready", "Professional candlesticks are active with canvas fallback.", "ready"),
        readinessItem("Market data", providerReady ? "Connected" : "Mock/Safe", providerReady ? `${dataHealth.provider} mode is active.` : "Mock/enriched mode is safe for demos until live data is verified.", providerReady ? "ready" : "safe"),
        readinessItem("Options trade tape", "Plan blocked", "Provider trade-tape access is limited by subscription plan; signals continue without it.", "partial"),
        readinessItem("Legal disclaimer", "Present", "Educational-only, simulated-data, and no-financial-advice disclosures are visible.", "ready"),
        readinessItem("Brokerage execution", "Disabled", "No live orders, no brokerage connection, and no broker credentials.", "safe"),
        readinessItem("Security posture", "Ready", "No service-role key in frontend; no brokerage credentials stored.", "ready"),
        readinessItem("Notifications", notificationState === "granted" ? "Ready" : "Optional", notificationState === "granted" ? "Browser notifications are enabled." : "Browser notifications are optional; in-app alerts still work.", notificationState === "granted" ? "ready" : "safe"),
        readinessItem("Backend", backendConnected ? "Ready" : "Check", backendConnected ? "STRIKEPULSE API health check is connected." : "Backend is not confirmed connected in this session.", backendConnected ? "ready" : "partial"),
        readinessItem("Local storage", localDataReady ? "Ready" : "Check", `${storedCount} local data keys currently detected.`, localDataReady ? "ready" : "partial"),
        readinessItem("Proof sample", proofMetrics.total ? "Building" : "Needed", proofMetrics.total ? `${proofMetrics.total} signals tracked with ${proofMetrics.closed} linked outcomes.` : "Run signals, close paper trades, journal outcomes, and replay examples before broad beta.", proofMetrics.closed >= 20 ? "ready" : "partial"),
        readinessItem("First value flow", firstFlowDone ? "Complete" : "In progress", firstFlowDone ? "A tester has completed the guided ticker-to-feedback workflow." : "Finish the First Value Flow once to validate the main onboarding path.", firstFlowDone ? "ready" : "partial"),
        readinessItem("Feedback loop", feedbackReady ? "Ready" : "Needed", feedbackReady ? `${feedbackEntries.length} local feedback item${feedbackEntries.length === 1 ? "" : "s"} captured.` : "Capture at least one local beta note so tester friction has a home.", feedbackReady ? "ready" : "partial"),
        readinessItem("Share card", "Ready", "Local signal/rejection cards can be copied or downloaded without account or broker data.", "ready")
      ];

      const readyCount = items.filter(item => item.tone === "ready" || item.tone === "safe").length;
      const attentionCount = items.filter(item => item.tone === "partial").length;
      const blockers = items.filter(item => item.tone === "blocked");
      const score = Math.round((readyCount / items.length) * 100);
      const toneClass = blockers.length
        ? "border-rose-300/30 text-rose-100"
        : score >= 85
          ? "border-emerald-300/30 text-emerald-100"
          : "border-amber-300/30 text-amber-100";
      const pillClasses = {
        ready: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
        safe: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
        partial: "border-amber-300/25 bg-amber-300/10 text-amber-100",
        blocked: "border-rose-300/25 bg-rose-300/10 text-rose-100"
      };
      const iconClasses = {
        ready: "fa-circle-check text-emerald-300",
        safe: "fa-shield-halved text-cyan-300",
        partial: "fa-triangle-exclamation text-amber-300",
        blocked: "fa-circle-xmark text-rose-300"
      };

      const list = document.getElementById("launchReadinessList");
      const badge = document.getElementById("launchReadinessScore");
      const summary = document.getElementById("launchReadinessSummary");
      const rule = document.getElementById("launchReadinessRule");
      const safeCount = document.getElementById("launchReadinessSafeCount");
      const attentionBadge = document.getElementById("launchReadinessAttentionCount");
      const blockerCount = document.getElementById("launchReadinessBlockerCount");
      if (!list || !badge || !summary || !rule) return;

      badge.textContent = `${score}/100`;
      badge.className = `shrink-0 rounded-full border ${toneClass} bg-zinc-950/70 px-2 py-1 text-xs font-black`;
      if (safeCount) safeCount.textContent = `${readyCount}`;
      if (attentionBadge) attentionBadge.textContent = `${attentionCount}`;
      if (blockerCount) blockerCount.textContent = `${blockers.length}`;
      summary.textContent = blockers.length
        ? `${blockers.length} blocker needs attention before beta.`
        : attentionCount
          ? `${readyCount}/${items.length} checks are ready or intentionally safe. ${attentionCount} item${attentionCount === 1 ? "" : "s"} still need beta polish.`
          : "All beta readiness checks are ready or intentionally safe.";
      const nextPartial = items.find(item => item.tone === "partial");
      rule.textContent = !cloudDisabled
        ? "Cloud sync is enabled; confirm database policies and privacy controls before public beta."
        : nextPartial
          ? `${nextPartial.label}: ${nextPartial.detail}`
          : "Beta posture is safe: cloud sync and brokerage execution remain disabled while local workflows are validated.";
      list.innerHTML = items.map(item => `
        <div class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="flex items-center gap-2 text-sm font-black">
                <i class="fa-solid ${iconClasses[item.tone]}"></i>
                <span>${item.label}</span>
              </p>
              <p class="mt-1 text-xs leading-relaxed text-zinc-400">${item.detail}</p>
            </div>
            <span class="shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${pillClasses[item.tone]}">${item.status}</span>
          </div>
        </div>
      `).join("");
    }

    function exportLocalData() {
      const payload = {
        app: appConfig.appName,
        version: appConfig.version,
        exportedAt: new Date().toISOString(),
        providerMode: appConfig.providerMode,
        localData: getLocalDataSnapshot()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `strikepulse-local-data-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showNeutralToast("Local data export prepared");
    }

    function resetLocalData() {
      if (!confirmDestructiveAction("Reset all local STRIKEPULSE prototype data on this device? This clears preferences, alerts, journal, notifications, and paper trading.")) {
        return;
      }
      [...localDataKeys(), ...legacyStorageKeys].forEach(key => localStorage.removeItem(key));
      showNeutralToast("Local data reset. Reloading app.");
      setTimeout(() => window.location.reload(), 700);
    }

    function feedbackCountsBy(key) {
      return feedbackEntries.reduce((acc, item) => {
        const label = item[key] || "Unknown";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
    }

    function topFeedbackPattern(key) {
      return Object.entries(feedbackCountsBy(key)).sort((a, b) => b[1] - a[1])[0] || null;
    }

    function feedbackPill(label, count, tone = "zinc") {
      const tones = {
        rose: "bg-rose-400/10 text-rose-100",
        amber: "bg-amber-400/10 text-amber-100",
        emerald: "bg-emerald-400/10 text-emerald-100",
        blue: "bg-blue-400/10 text-blue-100",
        zinc: "bg-zinc-800 text-zinc-300"
      };
      return `<span class="rounded-full px-2 py-1 text-[11px] font-bold ${tones[tone] || tones.zinc}">${escapeHtml(label)} · ${count}</span>`;
    }

    function localEngagementProfile() {
      const mission = readMissionState();
      const openDays = new Set(mission.openDays || []).size;
      const studiedDays = new Set(mission.studiedDays || []).size;
      const closedTrades = practiceAccount.history.filter(item => item.action === "CLOSE").length;
      const replayCount = typeof signalReplayItems === "function" ? signalReplayItems().length : 0;
      const journalCount = journalEntries.length;
      const feedbackCount = feedbackEntries.length;
      const score = Math.min(100, Math.round(
        openDays * 8 +
        studiedDays * 10 +
        Math.min(closedTrades, 10) * 5 +
        Math.min(journalCount, 10) * 4 +
        Math.min(replayCount, 10) * 3 +
        Math.min(feedbackCount, 10) * 2
      ));
      const tier = score >= 70 ? "Power User" : score >= 40 ? "Active Tester" : score >= 18 ? "New Tester" : "New User";
      return { score, tier, openDays, studiedDays, closedTrades, replayCount, journalCount, feedbackCount };
    }

    function feedbackPriorityWeight(item = {}) {
      const tierWeight = item.engagementTier === "Power User" ? 3 : item.engagementTier === "Active Tester" ? 2 : 1;
      const severityWeight = item.severity === "High" ? 2 : 1;
      return tierWeight * severityWeight;
    }

    function renderPowerUserFeedback() {
      const read = document.getElementById("feedbackPowerUserRead");
      const patterns = document.getElementById("feedbackPowerUserPatterns");
      if (!read || !patterns) return;
      const profile = localEngagementProfile();
      const priority = feedbackEntries
        .filter(item => ["Power User", "Active Tester"].includes(item.engagementTier))
        .sort((a, b) => feedbackPriorityWeight(b) - feedbackPriorityWeight(a));
      const weightedAreas = {};
      priority.forEach(item => {
        weightedAreas[item.area] = (weightedAreas[item.area] || 0) + feedbackPriorityWeight(item);
      });
      const topWeighted = Object.entries(weightedAreas).sort((a, b) => b[1] - a[1]).slice(0, 3);
      read.textContent = priority.length
        ? `${priority.length} priority item${priority.length === 1 ? "" : "s"} from active local usage. Current local tier: ${profile.tier} (${profile.score}/100).`
        : `Current local tier: ${profile.tier} (${profile.score}/100). Feedback becomes priority after repeated mission, journal, replay, or paper-trade use.`;
      patterns.innerHTML = [
        feedbackPill(profile.tier, profile.score, profile.tier === "Power User" ? "emerald" : profile.tier === "Active Tester" ? "blue" : "zinc"),
        ...topWeighted.map(([area, weight]) => feedbackPill(area, weight, "amber"))
      ].join("");
    }

    function renderFeedbackCenter() {
      const list = document.getElementById("feedbackList");
      if (!list) return;
      const topType = topFeedbackPattern("type");
      const topArea = topFeedbackPattern("area");
      const highCount = feedbackEntries.filter(item => item.severity === "High").length;
      document.getElementById("feedbackCount").textContent = `${feedbackEntries.length} items`;
      document.getElementById("feedbackIntelligence").textContent = feedbackEntries.length
        ? `${topArea ? topArea[0] : "Product"} is the most mentioned area. ${highCount ? `${highCount} high-severity item${highCount === 1 ? "" : "s"} need review.` : "No high-severity pattern yet."}`
        : "No feedback patterns yet.";
      const patternPills = [
        topType ? feedbackPill(topType[0], topType[1], "blue") : "",
        topArea ? feedbackPill(topArea[0], topArea[1], "amber") : "",
        highCount ? feedbackPill("High severity", highCount, "rose") : ""
      ].filter(Boolean);
      document.getElementById("feedbackPatterns").innerHTML = patternPills.length
        ? patternPills.join("")
        : `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-400">Waiting for beta feedback</span>`;
      renderPowerUserFeedback();
      list.innerHTML = feedbackEntries.length
        ? feedbackEntries.slice(0, 4).map(item => `
          <article class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs font-black text-zinc-100">${escapeHtml(item.type)} <span class="text-zinc-500">${escapeHtml(item.area)}</span></p>
                <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">${escapeHtml(item.message)}</p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="rounded-full border ${item.severity === "High" ? "border-rose-300/30 text-rose-100" : item.severity === "Low" ? "border-zinc-700 text-zinc-400" : "border-amber-300/30 text-amber-100"} px-2 py-0.5 text-[10px] font-black">${escapeHtml(item.severity)}</span>
                <span class="rounded-full border ${item.engagementTier === "Power User" ? "border-emerald-300/30 text-emerald-100" : item.engagementTier === "Active Tester" ? "border-blue-300/30 text-blue-100" : "border-zinc-700 text-zinc-400"} px-2 py-0.5 text-[10px] font-black">${escapeHtml(item.engagementTier || "Unweighted")}</span>
              </div>
            </div>
          </article>
        `).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-[11px] font-bold text-zinc-500">No local feedback saved yet.</div>`;
    }

    function saveFeedbackEntry() {
      const rawMessage = document.getElementById("feedbackMessage").value.trim();
      if (!rawMessage) {
        showNeutralToast("Add feedback before saving");
        return;
      }
      const redactedMessage = redactPersonalInfo(rawMessage);
      const engagement = localEngagementProfile();
      const entry = {
        id: `FB-${Date.now()}`,
        type: document.getElementById("feedbackType").value,
        area: document.getElementById("feedbackArea").value,
        severity: document.getElementById("feedbackSeverity").value,
        message: redactedMessage,
        symbol: currentSymbol,
        engagementTier: engagement.tier,
        engagementScore: engagement.score,
        createdAt: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };
      feedbackEntries = [entry, ...feedbackEntries].slice(0, 100);
      localStorage.setItem("strikepulseFeedback", JSON.stringify(feedbackEntries));
      document.getElementById("feedbackMessage").value = "";
      renderFeedbackCenter();
      renderAppHealth();
      markStartFlowStep("feedback");
      showNeutralToast(rawMessage !== redactedMessage ? "Feedback saved with personal info redacted" : "Feedback saved locally");
    }

    function feedbackTypeForQuick(label) {
      if (label === "Helpful") return "Praise";
      if (label === "Missing data") return "Missing";
      return "Confusing";
    }

    function feedbackSeverityForQuick(label) {
      if (label === "Too risky" || label === "Missing data") return "High";
      if (label === "Confusing") return "Medium";
      return "Low";
    }

    function saveQuickFeedback(area, label) {
      const engagement = localEngagementProfile();
      const entry = {
        id: `FB-${Date.now()}`,
        type: feedbackTypeForQuick(label),
        area,
        severity: feedbackSeverityForQuick(label),
        message: `Quick feedback: ${label} on ${area}. Context: ${currentSymbol}.`,
        symbol: currentSymbol,
        quick: true,
        engagementTier: engagement.tier,
        engagementScore: engagement.score,
        createdAt: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };
      feedbackEntries = [entry, ...feedbackEntries].slice(0, 100);
      localStorage.setItem("strikepulseFeedback", JSON.stringify(feedbackEntries));
      renderFeedbackCenter();
      renderAppHealth();
      markStartFlowStep("feedback");
      showNeutralToast(`${area} feedback saved: ${label}`);
    }

    function renderQuickFeedbackButtons() {
      const labels = ["Helpful", "Confusing", "Too risky", "Missing data"];
      document.querySelectorAll("[data-quick-feedback-area]").forEach(container => {
        const area = container.dataset.quickFeedbackArea;
        container.innerHTML = labels.map(label => {
          const tone = label === "Helpful" ? "border-emerald-300/25 text-emerald-100 hover:bg-emerald-300/10"
            : label === "Too risky" ? "border-rose-300/25 text-rose-100 hover:bg-rose-300/10"
              : label === "Missing data" ? "border-amber-300/25 text-amber-100 hover:bg-amber-300/10"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800";
          return `<button data-quick-feedback="${escapeHtml(label)}" class="rounded-full border ${tone} px-2 py-1 text-[10px] font-black" type="button">${escapeHtml(label)}</button>`;
        }).join("");
        container.querySelectorAll("[data-quick-feedback]").forEach(button => {
          button.addEventListener("click", () => saveQuickFeedback(area, button.dataset.quickFeedback));
        });
      });
    }

    async function refreshEnrichedData(symbol) {
      try {
        const [chain, events, flow, context] = await Promise.all([
          dataAdapter.getOptionChain(symbol),
          dataAdapter.getEvents(symbol),
          dataAdapter.getOptionsFlow(symbol),
          dataAdapter.getMarketContext()
        ]);
        symbols[symbol].enriched = { chain, events, flow };
        if (context?.spy) {
          marketContext.spy = context.spy;
          marketContext.qqq = context.qqq;
          marketContext.vix = context.vix;
          marketContext.breadth = context.breadth;
          if (context.sectors) marketContext.sectors = context.sectors;
          marketContext.source = context.source || context.provider || "context";
          marketContext.missing = context.missing || {};
          marketContext.updatedAt = context.updatedAt;
        }
      } catch (error) {
        updateDataHealth(performance.now(), false);
        showNeutralToast("Data enrichment temporarily degraded");
      }
    }

    function generateCandles(seed, type) {
      const count = activeRange === "1m" ? 72 : activeRange === "5m" ? 60 : activeRange === "15m" ? 52 : 46;
      const volatility = activeRange === "1m" ? .42 : activeRange === "5m" ? .7 : activeRange === "15m" ? 1.05 : 1.55;
      let price = seed * (type === "Bullish" ? .96 : 1.04);
      return Array.from({ length: count }, (_, index) => {
        const drift = type === "Bullish" ? volatility * .18 : -volatility * .15;
        const wave = Math.sin(index / 2.8) * volatility;
        const open = price;
        const close = Math.max(1, open + drift + wave + (Math.random() - .5) * volatility * 1.6);
        const high = Math.max(open, close) + volatility * .55 + Math.random() * volatility;
        const low = Math.min(open, close) - volatility * .55 - Math.random() * volatility;
        price = close;
        return { open, high, low, close, volume: Math.round(800000 + Math.random() * 2600000) };
      });
    }

    function getStopPrice(data) {
      const distance = data.price * data.stopPct;
      return data.type === "Bullish" ? data.price - distance : data.price + distance;
    }

    function activeChartData() {
      return tradeReplayState.chartLinked && tradeReplayState.chartContext
        ? tradeReplayState.chartContext
        : symbols[currentSymbol];
    }

    function activeChartSymbol() {
      return tradeReplayState.chartLinked && tradeReplayState.item?.symbol
        ? tradeReplayState.item.symbol
        : currentSymbol;
    }

    function visibleCandles() {
      const visibleCount = Math.max(14, Math.round(candles.length / zoomLevel));
      const end = Math.max(visibleCount, candles.length - chartPanOffset);
      return candles.slice(Math.max(0, end - visibleCount), end);
    }

    function setChartZoom(nextZoom) {
      zoomLevel = Math.max(1, Math.min(5, nextZoom));
      setChartPanOffset(chartPanOffset);
      renderChartHud();
      drawChart();
    }

    function setChartType(type) {
      const valid = ["candlestick", "heikin", "hollow", "ohlc", "line"];
      chartEngineSettings.chartType = valid.includes(type) ? type : "candlestick";
      localStorage.setItem("strikepulseChartEngine", JSON.stringify(chartEngineSettings));
      const select = document.getElementById("chartTypeSelect");
      if (select) select.value = chartEngineSettings.chartType;
      setChartEngineLabel(chartEngineSettings.chartType === "candlestick" ? "Professional candles" : `${chartEngineSettings.chartType} canvas`, chartEngineSettings.chartType === "candlestick" ? "emerald" : "cyan");
      drawChart();
    }

    function saveChartLayout() {
      localStorage.setItem("strikepulseChartLayout", JSON.stringify({
        chartType: chartEngineSettings.chartType,
        zoomLevel,
        activeRange,
        layers: eagleScoutLayers
      }));
      showNeutralToast("Chart layout saved locally");
    }

    function loadChartLayout() {
      const saved = readStoredJson("strikepulseChartLayout", null);
      if (!saved) {
        showNeutralToast("No saved chart layout yet");
        return;
      }
      chartEngineSettings.chartType = saved.chartType || chartEngineSettings.chartType;
      zoomLevel = Number(saved.zoomLevel) || zoomLevel;
      activeRange = saved.activeRange || activeRange;
      eagleScoutLayers = { ...eagleScoutLayers, ...(saved.layers || {}) };
      localStorage.setItem("strikepulseChartEngine", JSON.stringify(chartEngineSettings));
      saveEagleScoutLayers();
      const select = document.getElementById("chartTypeSelect");
      if (select) select.value = chartEngineSettings.chartType;
      renderEagleLayerControls();
      showNeutralToast("Chart layout loaded");
      setSignal(currentSymbol, false);
    }

    function getTouchDistance(touches) {
      const [first, second] = touches;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    }

    function setChartPanOffset(nextOffset) {
      const visibleCount = Math.max(14, Math.round(candles.length / zoomLevel));
      const maxOffset = Math.max(0, candles.length - visibleCount);
      chartPanOffset = Math.max(0, Math.min(maxOffset, Math.round(nextOffset)));
      drawChart();
    }

    function resetChartView() {
      zoomLevel = 1;
      chartPanOffset = 0;
      renderChartHud();
      drawChart();
    }

    function chartMetrics() {
      const shown = visibleCandles();
      const last = shown.at(-1);
      const first = shown[0];
      const averageClose = shown.length
        ? shown.reduce((sum, candle) => sum + candle.close, 0) / shown.length
        : 0;
      const range = shown.length
        ? Math.max(...shown.map(candle => candle.high)) - Math.min(...shown.map(candle => candle.low))
        : 0;
      const change = first && last ? ((last.close - first.open) / first.open) * 100 : 0;
      return { shown, last, averageClose, range, change };
    }

    function movingAverage(values, period) {
      return values.map((_, index) => {
        if (index < period - 1) return null;
        const sample = values.slice(index - period + 1, index + 1);
        return sample.reduce((sum, value) => sum + value, 0) / period;
      });
    }

    function exponentialMovingAverage(values, period) {
      const multiplier = 2 / (period + 1);
      let ema = null;
      return values.map((value, index) => {
        if (ema === null) {
          if (index < period - 1) return null;
          ema = values.slice(index - period + 1, index + 1).reduce((sum, item) => sum + item, 0) / period;
          return ema;
        }
        ema = (value - ema) * multiplier + ema;
        return ema;
      });
    }

    function bollingerBands(values, period = 20, deviations = 2) {
      return values.map((_, index) => {
        if (index < period - 1) return null;
        const sample = values.slice(index - period + 1, index + 1);
        const mean = sample.reduce((sum, value) => sum + value, 0) / period;
        const variance = sample.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
        const dev = Math.sqrt(variance) * deviations;
        return { upper: mean + dev, middle: mean, lower: mean - dev };
      });
    }

    function heikinAshiCandles(source) {
      let previous = null;
      return source.map(candle => {
        const close = (candle.open + candle.high + candle.low + candle.close) / 4;
        const open = previous ? (previous.open + previous.close) / 2 : (candle.open + candle.close) / 2;
        const high = Math.max(candle.high, open, close);
        const low = Math.min(candle.low, open, close);
        previous = { open, close };
        return { ...candle, open, high, low, close };
      });
    }

    function chartDisplayCandles(source) {
      return chartEngineSettings.chartType === "heikin" ? heikinAshiCandles(source) : source;
    }

    function indicatorSeriesFor(source) {
      const closes = source.map(candle => candle.close);
      return {
        ema9: exponentialMovingAverage(closes, 9),
        ema21: exponentialMovingAverage(closes, 21),
        sma50: movingAverage(closes, 50),
        bollinger: bollingerBands(closes, 20, 2)
      };
    }

    function chartTimeForIndex(index) {
      const secondsPerBar = activeRange === "1m" ? 60 : activeRange === "5m" ? 300 : activeRange === "15m" ? 900 : 3600;
      const now = Math.floor(Date.now() / 1000);
      return now - ((candles.length - 1 - index) * secondsPerBar);
    }

    function professionalChartData() {
      return candles.map((candle, index) => ({
        time: chartTimeForIndex(index),
        open: Number(candle.open.toFixed(2)),
        high: Number(candle.high.toFixed(2)),
        low: Number(candle.low.toFixed(2)),
        close: Number(candle.close.toFixed(2)),
        volume: candle.volume || 0
      }));
    }

    function vwapLineData(chartData) {
      let cumulativePriceVolume = 0;
      let cumulativeVolume = 0;
      return chartData.map(candle => {
        const typical = (candle.high + candle.low + candle.close) / 3;
        const volume = candle.volume || 1;
        cumulativePriceVolume += typical * volume;
        cumulativeVolume += volume;
        return {
          time: candle.time,
          value: Number((cumulativePriceVolume / cumulativeVolume).toFixed(2))
        };
      });
    }

    function setChartEngineLabel(label, tone = "cyan") {
      if (!chartEngineLabel) return;
      const toneClasses = {
        cyan: "border-cyan-300/20 text-cyan-100",
        amber: "border-amber-300/25 text-amber-100",
        emerald: "border-emerald-300/25 text-emerald-100"
      };
      chartEngineLabel.textContent = label;
      chartEngineLabel.className = `pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg border bg-zinc-950/75 px-3 py-1 text-[10px] font-black uppercase ${toneClasses[tone] || toneClasses.cyan} backdrop-blur`;
    }

    function setFallbackChartVisible(visible) {
      if (!canvas) return;
      canvas.classList.toggle("hidden", !visible);
    }

    function resetProfessionalPriceLines() {
      if (!professionalChartState.candleSeries) return;
      professionalChartState.priceLines.forEach(line => {
        try {
          professionalChartState.candleSeries.removePriceLine(line);
        } catch (error) {}
      });
      professionalChartState.priceLines = [];
    }

    function addProfessionalPriceLine(price, title, color) {
      if (!professionalChartState.candleSeries || !Number.isFinite(price)) return;
      const line = professionalChartState.candleSeries.createPriceLine({
        price,
        color,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title
      });
      professionalChartState.priceLines.push(line);
    }

    async function initializeProfessionalChart() {
      if (!professionalChartContainer || professionalChartState.chart || professionalChartState.status === "loading") return;
      professionalChartState.status = "loading";
      setChartEngineLabel("Loading Pro Chart", "amber");
      try {
        const library = await import("https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.0/dist/lightweight-charts.production.mjs");
        professionalChartState.library = library;
        const chart = library.createChart(professionalChartContainer, {
          autoSize: true,
          layout: {
            background: { type: library.ColorType.Solid, color: "#0B1020" },
            textColor: "#B8C2CC",
            fontFamily: "IBM Plex Mono, Consolas, monospace"
          },
          grid: {
            vertLines: { color: "rgba(0,229,255,.07)" },
            horzLines: { color: "rgba(184,194,204,.08)" }
          },
          crosshair: {
            mode: library.CrosshairMode.Normal,
            vertLine: { color: "rgba(0,229,255,.42)", width: 1, style: 3, labelBackgroundColor: "#1E5EFF" },
            horzLine: { color: "rgba(0,229,255,.42)", width: 1, style: 3, labelBackgroundColor: "#1E5EFF" }
          },
          rightPriceScale: {
            borderColor: "rgba(184,194,204,.18)",
            scaleMargins: { top: .08, bottom: .24 }
          },
          timeScale: {
            borderColor: "rgba(184,194,204,.18)",
            timeVisible: true,
            secondsVisible: activeRange === "1m"
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false
          }
        });
        professionalChartState.chart = chart;
        professionalChartState.candleSeries = chart.addSeries(library.CandlestickSeries, {
          upColor: "#22FF88",
          downColor: "#FF4D4D",
          borderUpColor: "#22FF88",
          borderDownColor: "#FF4D4D",
          wickUpColor: "#B7FFD5",
          wickDownColor: "#FFB3B3",
          priceLineColor: "#00E5FF",
          priceLineWidth: 2,
          lastValueVisible: true
        });
        professionalChartState.volumeSeries = chart.addSeries(library.HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "",
          lastValueVisible: false,
          priceLineVisible: false
        });
        professionalChartState.vwapSeries = chart.addSeries(library.LineSeries, {
          color: "#B8C2CC",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false
        });
        professionalChartState.volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: .78, bottom: 0 }
        });
        professionalChartState.status = "ready";
        setFallbackChartVisible(false);
        setChartEngineLabel("TradingView Lightweight", "emerald");
        if (typeof ResizeObserver !== "undefined") {
          professionalChartState.resizeObserver = new ResizeObserver(() => {
            chart.applyOptions({
              width: professionalChartContainer.clientWidth,
              height: professionalChartContainer.clientHeight
            });
          });
          professionalChartState.resizeObserver.observe(professionalChartContainer);
        }
        renderProfessionalChart();
      } catch (error) {
        professionalChartState.status = "fallback";
        setFallbackChartVisible(true);
        setChartEngineLabel("Canvas fallback", "amber");
        drawChart();
      }
    }

    function renderProfessionalChart() {
      if (professionalChartState.status !== "ready" || !professionalChartState.candleSeries || !candles.length) return false;
      if (chartEngineSettings.chartType !== "candlestick") {
        if (professionalChartContainer) professionalChartContainer.style.display = "none";
        return false;
      }
      if (professionalChartContainer) professionalChartContainer.style.display = "block";
      const chartData = professionalChartData();
      const volumeData = chartData.map(candle => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(34,255,136,.28)" : "rgba(255,77,77,.28)"
      }));
      const data = activeChartData();
      professionalChartState.candleSeries.setData(chartData);
      professionalChartState.volumeSeries.setData(eagleScoutLayers.volume ? volumeData : []);
      professionalChartState.vwapSeries.setData(eagleScoutLayers.vwap ? vwapLineData(chartData) : []);
      resetProfessionalPriceLines();
      if (eagleScoutLayers.levels) {
        addProfessionalPriceLine(data.price, "ENTRY", "#00E5FF");
        addProfessionalPriceLine(data.target, "TARGET", "#22FF88");
        addProfessionalPriceLine(getStopPrice(data), "STOP", "#FF4D4D");
      }
      try {
        const visibleCount = Math.max(14, Math.round(chartData.length / zoomLevel));
        const to = Math.max(visibleCount - 1, chartData.length - 1 - chartPanOffset);
        professionalChartState.chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, to - visibleCount + 1),
          to
        });
      } catch (error) {
        professionalChartState.chart.timeScale().fitContent();
      }
      renderEagleChartOverlay();
      return true;
    }

    function renderChartHud() {
      const { last, averageClose, range, change } = chartMetrics();
      const data = activeChartData();
      const trend = data?.type || "Neutral";
      const trendLabel = document.getElementById("chartTrendLabel");
      const rangeLabel = document.getElementById("chartRangeLabel");
      const modeLabel = document.getElementById("chartModeLabel");
      const lastCandle = document.getElementById("chartLastCandle");
      const vwapBias = document.getElementById("chartVwapBias");
      const zoom = document.getElementById("chartZoomLabel");
      if (trendLabel) {
        const bullish = trend === "Bullish";
        trendLabel.textContent = tradeReplayState.chartLinked ? `${activeChartSymbol()} replay` : `${trend} tape`;
        trendLabel.className = `rounded-lg border px-3 py-2 ${bullish ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100"}`;
      }
      if (rangeLabel) rangeLabel.textContent = `Range ${range ? money(range) : "--"} / ${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
      if (modeLabel) {
        const chartTypeLabel = {
          candlestick: "Candlestick",
          heikin: "Heikin Ashi",
          hollow: "Hollow candles",
          ohlc: "OHLC bars",
          line: "Line"
        }[chartEngineSettings.chartType] || "Candlestick";
        modeLabel.textContent = `${chartTypeLabel} - ${activeRange} decision chart`;
      }
      if (lastCandle) lastCandle.textContent = last ? `${money(last.open)} -> ${money(last.close)}` : "--";
      if (vwapBias) {
        const aboveVwap = last && last.close >= averageClose;
        vwapBias.textContent = last ? (aboveVwap ? "Above VWAP" : "Below VWAP") : "--";
        vwapBias.className = `mt-0.5 text-xs font-black ${aboveVwap ? "text-emerald-300" : "text-rose-300"}`;
      }
      if (zoom) zoom.textContent = `${zoomLevel.toFixed(1)}x`;
    }

    function promoteChartPanel() {
      const chartPanel = document.getElementById("chartPanel");
      const tickerStrip = document.getElementById("tickerStrip");
      if (!chartPanel || !tickerStrip) return;
      tickerStrip.insertAdjacentElement("afterend", chartPanel);
    }

    function saveEagleScoutLayers() {
      localStorage.setItem("strikepulseEagleLayers", JSON.stringify(eagleScoutLayers));
    }

    function renderEagleLayerControls() {
      const chartTypeSelect = document.getElementById("chartTypeSelect");
      if (chartTypeSelect) chartTypeSelect.value = chartEngineSettings.chartType || "candlestick";
      document.querySelectorAll("[data-eagle-layer]").forEach(button => {
        const layer = button.dataset.eagleLayer;
        const active = eagleScoutLayers[layer] !== false;
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.className = `eagle-layer-toggle rounded-lg border px-3 py-2 transition ${active ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/20" : "border-zinc-800 bg-zinc-900/70 text-zinc-500 hover:border-zinc-600 hover:text-zinc-200"}`;
      });
    }

    function toggleEagleLayer(layer) {
      if (!(layer in eagleScoutLayers)) return;
      eagleScoutLayers[layer] = !eagleScoutLayers[layer];
      saveEagleScoutLayers();
      renderEagleLayerControls();
      drawChart();
    }

    function chartConfidenceTone(confidence) {
      if (confidence >= 82) return { fill: "#22FF88", stroke: "#22FF88", label: "High conviction" };
      if (confidence >= 68) return { fill: "#00E5FF", stroke: "#00E5FF", label: "Constructive" };
      if (confidence >= 52) return { fill: "#B8C2CC", stroke: "#B8C2CC", label: "Mixed" };
      return { fill: "#FF4D4D", stroke: "#FF4D4D", label: "Low quality" };
    }

    function svgLinePath(points, xFor, yFor) {
      return points
        .map((value, index) => Number.isFinite(value) ? `${index === 0 || !Number.isFinite(points[index - 1]) ? "M" : "L"} ${xFor(index)} ${yFor(value)}` : "")
        .filter(Boolean)
        .join(" ");
    }

    function svgBandPath(bands, xFor, yFor, key) {
      return bands
        .map((band, index) => band && Number.isFinite(band[key]) ? `${index === 0 || !bands[index - 1] ? "M" : "L"} ${xFor(index)} ${yFor(band[key])}` : "")
        .filter(Boolean)
        .join(" ");
    }

    function chartMarkerBadge(x, y, label, fill, stroke = "#fff7ed", markerType = "signal") {
      return `
        <g data-eagle-scout-marker="${escapeHtml(markerType)}" role="button" tabindex="0" style="pointer-events:auto;cursor:pointer" filter="drop-shadow(0 0 10px ${fill}99)">
          <circle cx="${x}" cy="${y}" r="8" fill="${fill}" stroke="${stroke}" stroke-opacity=".75" stroke-width="1.2"></circle>
          <text x="${x + 13}" y="${y + 4}" fill="${stroke}" font-size="10" font-family="IBM Plex Mono, Consolas, monospace" font-weight="900">${escapeHtml(label)}</text>
        </g>
      `;
    }

    function eagleScoutGrade(score) {
      const normalized = Number(score) || 0;
      if (normalized >= 94) return "A+";
      if (normalized >= 85) return "A";
      if (normalized >= 72) return "B";
      if (normalized >= 58) return "C";
      return "D";
    }

    function eagleScoutPill(label, tone = "zinc") {
      const tones = {
        emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
        amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
        rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
        cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
        zinc: "border-zinc-700 bg-zinc-900 text-zinc-300"
      };
      return `<span class="rounded-full border px-2 py-1 ${tones[tone] || tones.zinc}">${escapeHtml(label)}</span>`;
    }

    function eagleScoutExampleLine(title, detail, tone = "zinc") {
      const toneClass = {
        emerald: "text-emerald-200",
        rose: "text-rose-200",
        cyan: "text-cyan-100",
        amber: "text-amber-100",
        zinc: "text-zinc-200"
      }[tone] || "text-zinc-200";
      return `
        <article class="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
          <p class="font-black ${toneClass}">${escapeHtml(title)}</p>
          <p class="mt-0.5 text-[11px] leading-relaxed text-zinc-500">${escapeHtml(detail)}</p>
        </article>
      `;
    }

    function eagleScoutExamples(symbol) {
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const wins = closed
        .filter(trade => Number(trade.pnl) > 0 && (!symbol || trade.symbol === symbol))
        .slice(0, 3);
      const losses = closed
        .filter(trade => Number(trade.pnl) < 0 && (!symbol || trade.symbol === symbol))
        .slice(0, 3);
      const fallbackWins = wins.length ? wins : closed.filter(trade => Number(trade.pnl) > 0).slice(0, 3);
      const fallbackLosses = losses.length ? losses : closed.filter(trade => Number(trade.pnl) < 0).slice(0, 3);
      const completedJournal = journalEntries
        .filter(entry => !symbol || entry.symbol === symbol)
        .slice(0, 3);
      const replay = signalReplayItems()
        .filter(item => !symbol || item.symbol === symbol)
        .slice(0, 3);
      const graveyard = signalGraveyardItems()
        .filter(item => !symbol || item.symbol === symbol)
        .slice(0, 3);
      return {
        wins: fallbackWins,
        losses: graveyard.length ? graveyard : fallbackLosses,
        replay: replay.length ? replay : signalReplayItems().slice(0, 3),
        journal: completedJournal.length ? completedJournal : journalEntries.slice(0, 3)
      };
    }

    function eagleScoutRiskLevel(data, gate, rejection, lightning) {
      if (rejection.verdict === "REJECT" || gate.verdict === "REJECT" || lightning.outProbability >= 72) return "High";
      if (rejection.verdict === "WAIT" || gate.reasons.length >= 3 || lightning.outProbability >= 58 || data.options?.iv >= 70) return "Elevated";
      if (data.confidence >= 82 && gate.rr >= 2.5 && rejection.verdict === "APPROVED") return "Controlled";
      return "Moderate";
    }

    function eagleScoutSuggestedAction(markerType, gate, rejection, lightning) {
      if (markerType === "reject" || markerType === "strikeOut" || rejection.verdict === "REJECT") return "Reject";
      if (markerType === "graveyard") return "Study";
      if (markerType === "replay") return "Replay";
      if (gate.verdict === "A+ SETUP" && lightning.inProbability >= 82 && rejection.verdict === "APPROVED") return "Confirm";
      if (gate.verdict === "READY" || lightning.inProbability >= 68) return "Wait";
      return "Review";
    }

    function eagleScoutFactorCard(label, score, passed, detail) {
      const tone = passed ? "emerald" : score >= 58 ? "amber" : "rose";
      return `
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-black ${passed ? "text-emerald-100" : score >= 58 ? "text-amber-100" : "text-rose-100"}">${escapeHtml(passed ? "PASS" : "WATCH")} · ${Math.round(score)}/100</p>
            <p class="mt-1 text-xs leading-relaxed text-zinc-400">${escapeHtml(detail)}</p>
          </div>
          ${eagleScoutPill(label, tone)}
        </div>
      `;
    }

    function eagleScoutMemorySummary(symbol, examples) {
      const screenshotLoaded = Boolean(screenshotPreviewUrl);
      const journalCount = examples.journal.length;
      const replayCount = examples.replay.length;
      const paperCount = practiceAccount.history.filter(trade => trade.symbol === symbol).length;
      if (journalCount || replayCount || paperCount || screenshotLoaded) {
        return `${journalCount} journal, ${replayCount} replay, ${paperCount} paper records${screenshotLoaded ? ", screenshot loaded" : ""}`;
      }
      return "No personal records yet";
    }

    function buildEagleScoutExplanation(markerType = "live") {
      const symbol = activeChartSymbol();
      const data = activeChartData();
      const gate = getQualityGate(data);
      const rejection = evaluateTradeRejection(data, gate, symbol);
      const lightning = evaluateLightningStrike(data, gate, rejection, symbol);
      const nineSig = getNineSig(data);
      const weather = getMarketWeather(symbol);
      const stop = getStopPrice(data);
      const premium = getPremiumModel(data);
      const profile = lightning.confirmationProfile || { confirmations: [], blockers: [] };
      const momentumScore = lightning.momentumScore || indicatorValue(data, "momentum", data.confidence);
      const volumeScore = lightning.volumeScore || indicatorValue(data, "volume", data.confidence >= 80 ? 72 : 55);
      const trendScore = lightning.trendScore || data.confidence;
      const confluenceScore = Math.round((gate.score * .45) + ((nineSig.score / 9) * 100 * .35) + (weather.score * .2));
      const passed = [
        data.confidence >= 82 ? `Eagle Score ${data.confidence}/100` : null,
        gate.verdict !== "REJECT" ? `Quality Gate ${gate.verdict}` : null,
        gate.rr >= 2 ? `Reward/risk ${gate.rr.toFixed(2)}:1` : null,
        data.entry.status === "READY" ? `Entry trigger ready: ${data.entry.trigger}` : null,
        ["Elite", "Decent"].includes(data.options?.liquidity) ? `${data.options.liquidity} options liquidity` : null,
        nineSig.score >= 7 ? `${nineSig.score}/9 signal confluence` : null,
        weather.score >= 58 ? `Market Weather ${weather.label}` : null,
        lightning.inProbability >= 68 ? `Strike In probability ${lightning.inProbability}%` : null,
        ...((profile.confirmations || []).filter(item => item.pass).map(item => item.label))
      ].filter(Boolean);
      const failed = [
        ...gate.reasons,
        ...rejection.blockers,
        ...((profile.confirmations || []).filter(item => !item.pass).map(item => item.label)),
        ...((profile.blockers || []).map(item => String(item)))
      ].filter(Boolean);
      const uniquePassed = [...new Set(passed)].slice(0, 10);
      const uniqueFailed = [...new Set(failed)].slice(0, 10);
      const markerLabels = {
        live: "Active Signal",
        strikeIn: "Lightning Strike In",
        strikeOut: "Lightning Strike Out",
        aPlus: "A+ Setup",
        reject: "Reject Marker",
        graveyard: "Signal Graveyard",
        replay: "Replay Marker",
        signal: "Chart Signal"
      };
      const actionHint = markerType === "strikeOut" || markerType === "reject" || rejection.verdict === "REJECT"
        ? "This marker exists to protect decision quality. Do not force the trade until the failed confluences clear."
        : markerType === "graveyard"
          ? "This marker exists to study what failed before risking another similar paper setup."
          : markerType === "replay"
            ? "This marker exists to compare the original read against how the setup evolved candle by candle."
            : "This marker exists because enough trend, momentum, volume, quality, and market context aligned to deserve attention.";
      const riskLevel = eagleScoutRiskLevel(data, gate, rejection, lightning);
      const suggestedAction = eagleScoutSuggestedAction(markerType, gate, rejection, lightning);
      const examples = eagleScoutExamples(symbol);
      const factors = {
        momentum: {
          label: "Momentum",
          score: momentumScore,
          passed: momentumScore >= 68,
          detail: momentumScore >= 68
            ? "RSI, MACD, and signal confidence support directional pressure."
            : "Momentum is not decisive enough yet; wait for stronger follow-through."
        },
        volume: {
          label: "Volume",
          score: volumeScore,
          passed: volumeScore >= 65,
          detail: volumeScore >= 65
            ? "Volume behavior supports the move instead of looking thin."
            : "Volume confirmation is weak, selective, or unclear."
        },
        trend: {
          label: "Trend",
          score: trendScore,
          passed: trendScore >= 68,
          detail: trendScore >= 68
            ? `${detectMarketRegime(symbol)} regime is compatible with this ${data.type.toLowerCase()} setup.`
            : "Trend and regime alignment are not strong enough for blind confidence."
        },
        confluence: {
          label: "Confluence",
          score: confluenceScore,
          passed: confluenceScore >= 68,
          detail: `${nineSig.score}/9 checks, Quality Gate ${gate.verdict}, Market Weather ${weather.label}.`
        }
      };
      return {
        symbol,
        markerType,
        title: `${markerLabels[markerType] || "Signal Marker"}: ${symbol}`,
        subtitle: `${gate.verdict} / ${lightning.verdict}`,
        grade: eagleScoutGrade(data.confidence),
        confidence: data.confidence,
        riskLevel,
        suggestedAction,
        memorySummary: eagleScoutMemorySummary(symbol, examples),
        why: `${suggestedAction}: ${actionHint} ${gate.summary}`,
        lightningSummary: lightning.summary,
        factors,
        passed: uniquePassed,
        failed: uniqueFailed.length ? uniqueFailed : ["No major blocker surfaced by the current local model."],
        riskZone: `Risk from ${money(data.price)} toward stop ${money(stop)}. Premium stop model: ${money(premium.premiumStop)}. Keep position size inside paper-risk rules.`,
        targetZone: `Target zone ${money(data.target)} (${data.type === "Bullish" ? "upside" : "downside"} thesis). Premium target model: ${money(premium.premiumTarget)}.`,
        examples
      };
    }

    function renderEagleScoutExplanation(markerType = "live") {
      const panel = document.getElementById("eagleScoutExplainPanel");
      if (!panel) return;
      const explanation = buildEagleScoutExplanation(markerType);
      const setText = (id, value) => {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
      };
      setText("eagleScoutExplainTitle", explanation.title);
      setText("eagleScoutExplainSubtitle", explanation.subtitle);
      setText("eagleScoutExplainGrade", explanation.grade);
      setText("eagleScoutExplainConfidence", `${explanation.confidence}%`);
      setText("eagleScoutRiskLevel", explanation.riskLevel);
      setText("eagleScoutExplainWhy", explanation.why);
      setText("eagleScoutRiskZone", explanation.riskZone);
      setText("eagleScoutTargetZone", explanation.targetZone);
      setText("eagleScoutActionChip", `Action: ${explanation.suggestedAction}`);
      setText("eagleScoutRiskChip", `Risk: ${explanation.riskLevel}`);
      setText("eagleScoutMemoryChip", `Memory: ${explanation.memorySummary}`);
      updateActiveSignalContext({
        symbol: explanation.symbol || currentSymbol,
        signalId: currentSignalReference(explanation.symbol || currentSymbol),
        source: "eagle-scout-explanation",
        eagleScore: explanation.confidence,
        suggestedAction: explanation.suggestedAction,
        activeBlockers: explanation.failed,
        learning: {
          eagleScoutRisk: explanation.riskLevel,
          eagleScoutWhy: explanation.why,
          markerType: explanation.markerType
        }
      }, "eagleScout");
      renderSignalStoryStatus();

      const riskLevel = document.getElementById("eagleScoutRiskLevel");
      const riskChip = document.getElementById("eagleScoutRiskChip");
      const actionChip = document.getElementById("eagleScoutActionChip");
      const riskTone = explanation.riskLevel === "Controlled" ? "text-emerald-100" : explanation.riskLevel === "High" ? "text-rose-100" : "text-amber-100";
      if (riskLevel) riskLevel.className = `mt-1 text-2xl font-black ${riskTone}`;
      if (riskChip) riskChip.className = `rounded-full border px-3 py-1 text-xs font-black ${explanation.riskLevel === "Controlled" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : explanation.riskLevel === "High" ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`;
      if (actionChip) actionChip.className = `rounded-full border px-3 py-1 text-xs font-black ${["Confirm", "Replay"].includes(explanation.suggestedAction) ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : explanation.suggestedAction === "Reject" ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`;

      const factors = explanation.factors;
      const factorMap = {
        eagleScoutMomentumFactor: factors.momentum,
        eagleScoutVolumeFactor: factors.volume,
        eagleScoutTrendFactor: factors.trend,
        eagleScoutConfluenceFactor: factors.confluence
      };
      Object.entries(factorMap).forEach(([id, factor]) => {
        const node = document.getElementById(id);
        if (node) node.innerHTML = eagleScoutFactorCard(factor.label, factor.score, factor.passed, factor.detail);
      });

      const passedList = document.getElementById("eagleScoutPassedList");
      const failedList = document.getElementById("eagleScoutFailedList");
      if (passedList) passedList.innerHTML = explanation.passed.length
        ? explanation.passed.map(item => eagleScoutPill(item, "emerald")).join("")
        : eagleScoutPill("No passed confluence yet", "zinc");
      if (failedList) failedList.innerHTML = explanation.failed.map(item => eagleScoutPill(item, item.includes("REJECT") || item.includes("below") || item.includes("hostile") ? "rose" : "amber")).join("");

      const wins = document.getElementById("eagleScoutSuccessExamples");
      const failures = document.getElementById("eagleScoutFailureExamples");
      const replay = document.getElementById("eagleScoutReplayExamples");
      const journal = document.getElementById("eagleScoutJournalExamples");
      if (wins) wins.innerHTML = explanation.examples.wins.length
        ? explanation.examples.wins.map(item => eagleScoutExampleLine(`${item.symbol} ${money(Number(item.pnl) || 0)}`, item.plan?.qualityGate || item.contract || "Closed paper win", "emerald")).join("")
        : eagleScoutExampleLine("No local winners yet", "Paper close a winning setup to build success examples.", "zinc");
      if (failures) failures.innerHTML = explanation.examples.losses.length
        ? explanation.examples.losses.map(item => eagleScoutExampleLine(item.symbol || explanation.symbol, item.prevention || item.cause || `${money(Number(item.pnl) || 0)} paper outcome`, "rose")).join("")
        : eagleScoutExampleLine("No local failures yet", "Signal Graveyard and paper losses will teach what to avoid.", "zinc");
      if (replay) replay.innerHTML = explanation.examples.replay.length
        ? [
          eagleScoutExampleLine("Candle-by-candle ready", "Use Replay Mode to step through Eagle Score changes, Lightning appearances, and the final outcome.", "cyan"),
          ...explanation.examples.replay.slice(0, 2).map(item => eagleScoutExampleLine(item.symbol || explanation.symbol, item.replayLabel || item.predictedOutcome || "Replay available", "cyan"))
        ].join("")
          : eagleScoutExampleLine("No replay examples yet", "Use demo money or journal a skipped decision to unlock the first replay lesson.", "zinc");
      if (journal) {
        const screenshotLine = screenshotPreviewUrl
          ? eagleScoutExampleLine("Optional screenshot loaded", "A local chart screenshot can be compared later.", "cyan")
          : eagleScoutExampleLine("Optional screenshot", "You can skip screenshots for the first Signal Story.", "zinc");
        const journalLines = explanation.examples.journal.length
          ? explanation.examples.journal.slice(0, 2).map(item => eagleScoutExampleLine(`${item.symbol || explanation.symbol} ${item.outcome || "Journal"}`, item.note || item.contract || "Local journal note", "amber")).join("")
          : eagleScoutExampleLine("No journal examples yet", "Journal a decision to make this explanation personal.", "zinc");
        journal.innerHTML = screenshotLine + journalLines;
      }
      applyEagleScoutActionButtons(explanation);
      renderProofTrustChips("eagleScoutTrustChips");
      renderPilotStatus();
    }

    async function openSignalExplanation(symbol = currentSymbol, markerType = "live") {
      const nextSymbol = symbols[symbol] ? symbol : currentSymbol;
      await setSignal(nextSymbol, true);
      activeEagleScoutMarker = markerType;
      renderEagleScoutExplanation(markerType);
      document.getElementById("eagleScoutExplainPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      markStartFlowStep("ticket");
    }

    function eagleScoutJumpTo(targetId, startStep = "") {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (startStep) markStartFlowStep(startStep);
    }

    function openEagleScoutReplay() {
      const items = renderSignalReplayOptions();
      const select = document.getElementById("signalReplaySelect");
      const symbol = activeChartSymbol();
      const context = ensureSignalContext(symbol, "eagleScout");
      const match = context?.signalId ? items.find(item => item.signalId === context.signalId) : null;
      if (!match || !select) {
        showNeutralToast(context?.signalId ? `No exact replay yet for ${context.signalId}` : "No active Signal Story replay found");
        return;
      }
      select.value = match.replayId;
      renderSignalReplay({ activateChart: true });
      eagleScoutJumpTo("signalReplaySelect", "replay");
      showNeutralToast(`${context.signalId} replay loaded`);
    }

    function openEagleScoutScreenshotCheck() {
      syncScreenshotContext();
      eagleScoutJumpTo("screenshotSignalCheck", "screenshot");
      showNeutralToast("Screenshot Signal Check is local-only");
    }

    function openEagleScoutPrimaryAction() {
      const explanation = buildEagleScoutExplanation(activeEagleScoutMarker);
      const plan = eagleScoutActionPlan(explanation);
      if (plan.primaryAction === "paper") {
        paperTradeSignalTicket();
        markStartFlowStep("paper");
        return;
      }
      if (plan.primaryAction === "journal") {
        openEagleScoutJournal();
        return;
      }
      if (plan.primaryAction === "replay") {
        openEagleScoutReplay();
        return;
      }
      openEagleScoutScreenshotCheck();
    }

    function fillLaunchDecisionJournal(decision) {
      const note = document.getElementById("journalNote");
      const outcome = document.getElementById("journalOutcome");
      const explanation = buildEagleScoutExplanation(activeEagleScoutMarker);
      const isReject = decision === "Reject";
      const decisionTag = isReject ? "Rejected" : "Wait";
      const failedChecks = Array.isArray(explanation.failed) && explanation.failed.length
        ? explanation.failed.join("; ")
        : "risk outweighed reward";
      const noteText = isReject
        ? `${explanation.title}: Rejected. ${explanation.why} Failed checks: ${failedChecks}.`
        : `${explanation.title}: Wait. ${explanation.why} Recheck only after cleaner confirmation.`;
      ensureSignalContext(explanation?.symbol || currentSymbol, "eagleScout");
      if (outcome) outcome.value = "Skipped";
      if (note) note.value = noteText;
      selectedJournalTags = [...new Set([...(selectedJournalTags || []), "Eagle Scout", decisionTag, "Skipped"])];
      document.querySelectorAll(".journal-tag").forEach(button => {
        const active = selectedJournalTags.includes(button.dataset.tag);
        button.className = active
          ? "journal-tag rounded-full border border-amber-300 bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-100"
          : "journal-tag rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800";
      });
      eagleScoutJumpTo("journalNote", "journal");
      note?.focus();
      showNeutralToast(`${decision} decision ready to journal`);
    }

    function openEagleScoutJournal() {
      const note = document.getElementById("journalNote");
      const outcome = document.getElementById("journalOutcome");
      const explanation = buildEagleScoutExplanation(activeEagleScoutMarker);
      const plan = eagleScoutActionPlan(explanation);
      ensureSignalContext(explanation?.symbol || currentSymbol, "eagleScout");
      if (outcome) outcome.value = plan.journalOutcome;
      if (note && !note.value.trim()) {
        note.value = plan.journalNote;
      }
      selectedJournalTags = [...new Set([...(selectedJournalTags || []), ...plan.journalTags])];
      document.querySelectorAll(".journal-tag").forEach(button => {
        const active = selectedJournalTags.includes(button.dataset.tag);
        button.className = active
          ? "journal-tag rounded-full border border-amber-300 bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-100"
          : "journal-tag rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800";
      });
      eagleScoutJumpTo("journalNote", "journal");
      note?.focus();
      showNeutralToast(plan.journalToast);
    }

    function renderEagleChartOverlay() {
      if (!eagleChartOverlay) return;
      const rawShown = visibleCandles();
      const shown = chartDisplayCandles(rawShown);
      if (!shown.length) {
        eagleChartOverlay.innerHTML = "";
        return;
      }

      const width = eagleChartOverlay.clientWidth || professionalChartContainer?.clientWidth || canvas.clientWidth;
      const height = eagleChartOverlay.clientHeight || professionalChartContainer?.clientHeight || canvas.clientHeight;
      if (!width || !height) return;

      const pad = { top: 46, right: 78, bottom: 76, left: 18 };
      const plotW = Math.max(1, width - pad.left - pad.right);
      const plotH = Math.max(1, height - pad.top - pad.bottom);
      const data = activeChartData();
      const stop = getStopPrice(data);
      const indicatorSource = chartDisplayCandles(candles);
      const sourceStart = Math.max(0, candles.length - chartPanOffset - rawShown.length);
      const indicatorValues = indicatorSeriesFor(indicatorSource);
      const visibleIndicators = Object.fromEntries(Object.entries(indicatorValues).map(([key, values]) => [key, values.slice(sourceStart, sourceStart + rawShown.length)]));
      const averageClose = shown.reduce((sum, candle) => sum + candle.close, 0) / shown.length;
      const extraLevels = [
        ...(eagleScoutLayers.ema9 ? visibleIndicators.ema9.filter(Number.isFinite) : []),
        ...(eagleScoutLayers.ema21 ? visibleIndicators.ema21.filter(Number.isFinite) : []),
        ...(eagleScoutLayers.sma50 ? visibleIndicators.sma50.filter(Number.isFinite) : []),
        ...(eagleScoutLayers.bollinger ? visibleIndicators.bollinger.flatMap(band => band ? [band.upper, band.lower] : []) : [])
      ];
      const levelValues = [data.price, data.target, stop, averageClose, ...extraLevels, ...shown.flatMap(candle => [candle.high, candle.low])];
      const max = Math.max(...levelValues);
      const min = Math.min(...levelValues);
      const spread = Math.max(.01, max - min);
      const yFor = value => pad.top + ((max - value) / spread) * plotH;
      const xFor = index => pad.left + (plotW / Math.max(1, shown.length - 1)) * index;
      const safeText = value => escapeHtml(String(value));
      const priceLabel = value => Number(value).toFixed(2);
      const tone = chartConfidenceTone(data.confidence || 0);
      const bullish = data.type === "Bullish";
      const parts = [];
      const beginnerChart = isBeginnerLaunchChart();

      if (!beginnerChart && eagleScoutLayers.heatmap) {
        const bands = 8;
        for (let index = 0; index < bands; index += 1) {
          const confidenceRamp = ((index + 1) / bands) * ((data.confidence || 0) / 100);
          parts.push(`<rect x="${pad.left + (plotW / bands) * index}" y="${pad.top}" width="${plotW / bands + 1}" height="${plotH}" fill="${tone.fill}" opacity="${(0.025 + confidenceRamp * 0.09).toFixed(3)}"></rect>`);
        }
        parts.push(`<text x="${pad.left + 10}" y="${height - 30}" fill="${tone.stroke}" font-size="11" font-family="IBM Plex Mono, Consolas, monospace" font-weight="800">${safeText(tone.label)} heat ${data.confidence || 0}%</text>`);
      }

      const addPath = (path, color, width = 1.7, opacity = .9, dash = "") => {
        if (!path) return;
        parts.push(`<path d="${path}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""}></path>`);
      };
      addPath(!beginnerChart && eagleScoutLayers.ema9 ? svgLinePath(visibleIndicators.ema9, xFor, yFor) : "", "#00E5FF", 1.8, .92);
      addPath(!beginnerChart && eagleScoutLayers.ema21 ? svgLinePath(visibleIndicators.ema21, xFor, yFor) : "", "#1E5EFF", 1.8, .92);
      addPath(!beginnerChart && eagleScoutLayers.sma50 ? svgLinePath(visibleIndicators.sma50, xFor, yFor) : "", "#B8C2CC", 1.8, .86, "6 4");
      if (!beginnerChart && eagleScoutLayers.bollinger) {
        addPath(svgBandPath(visibleIndicators.bollinger, xFor, yFor, "upper"), "#B8C2CC", 1.2, .62, "4 5");
        addPath(svgBandPath(visibleIndicators.bollinger, xFor, yFor, "lower"), "#B8C2CC", 1.2, .62, "4 5");
      }

      if (eagleScoutLayers.zones || beginnerChart) {
        const support = bullish ? Math.min(data.price, averageClose, ...shown.slice(-12).map(candle => candle.low)) : data.target;
        const resistance = bullish ? data.target : Math.max(data.price, averageClose, ...shown.slice(-12).map(candle => candle.high));
        const zoneHeight = Math.max(16, plotH * .045);
        const supportY = Math.max(pad.top, Math.min(pad.top + plotH - zoneHeight, yFor(support) - zoneHeight / 2));
        const resistanceY = Math.max(pad.top, Math.min(pad.top + plotH - zoneHeight, yFor(resistance) - zoneHeight / 2));
        parts.push(`<rect x="${pad.left}" y="${supportY}" width="${plotW}" height="${zoneHeight}" rx="6" fill="#00E5FF" opacity=".10" stroke="#00E5FF" stroke-opacity=".38" stroke-dasharray="5 5"></rect>`);
        parts.push(`<text x="${pad.left + 10}" y="${supportY + zoneHeight - 5}" fill="#CFFAFE" font-size="10" font-family="IBM Plex Mono, Consolas, monospace" font-weight="800">SETUP ZONE ${priceLabel(support)}</text>`);
        parts.push(`<rect x="${pad.left}" y="${resistanceY}" width="${plotW}" height="${zoneHeight}" rx="6" fill="#FF4D4D" opacity=".10" stroke="#FF4D4D" stroke-opacity=".36" stroke-dasharray="5 5"></rect>`);
        parts.push(`<text x="${pad.left + 10}" y="${resistanceY + zoneHeight - 5}" fill="#FFD6D6" font-size="10" font-family="IBM Plex Mono, Consolas, monospace" font-weight="800">RISK ZONE ${priceLabel(resistance)}</text>`);
      }

      if (!beginnerChart && eagleScoutLayers.lightning) {
        const gate = getQualityGate(data);
        const rejection = evaluateTradeRejection(data, gate, activeChartSymbol());
        const lightning = tradeReplayState.chartLinked
          ? {
            inProbability: tradeReplayState.timeline[tradeReplayState.index]?.marker === "Strike In" ? 82 : Math.max(32, (tradeReplayState.timeline[tradeReplayState.index]?.eagleScore || data.confidence || 60) - 8),
            outProbability: tradeReplayState.timeline[tradeReplayState.index]?.marker === "Strike Out" ? 82 : Math.max(18, 100 - (tradeReplayState.timeline[tradeReplayState.index]?.eagleScore || data.confidence || 60))
          }
          : evaluateLightningStrike(data, gate, rejection, activeChartSymbol());
        const strikeInIndex = Math.max(1, shown.length - 8);
        const strikeIn = shown[strikeInIndex];
        const strikeInX = xFor(strikeInIndex);
        const strikeInY = yFor(strikeIn.close);
        const strikeOutX = xFor(shown.length - 1);
        const strikeOutY = yFor(lightning.outProbability >= lightning.inProbability ? stop : data.target);
        const bolt = (x, y, fill) => `<polygon points="${x},${y - 18} ${x - 8},${y + 1} ${x + 1},${y + 1} ${x - 5},${y + 19} ${x + 12},${y - 5} ${x + 2},${y - 5}" fill="${fill}" stroke="#FFFFFF" stroke-opacity=".65" stroke-width="1"></polygon>`;
        parts.push(`<g data-eagle-scout-marker="strikeIn" role="button" tabindex="0" style="pointer-events:auto;cursor:pointer" filter="drop-shadow(0 0 9px rgba(34,255,136,.42))">${bolt(strikeInX, strikeInY, "#22FF88")}<text x="${strikeInX + 16}" y="${strikeInY + 4}" fill="#22FF88" font-size="11" font-family="IBM Plex Mono, Consolas, monospace" font-weight="900">STRIKE IN ${lightning.inProbability}%</text></g>`);
        parts.push(`<g data-eagle-scout-marker="strikeOut" role="button" tabindex="0" style="pointer-events:auto;cursor:pointer" filter="drop-shadow(0 0 9px rgba(255,77,77,.42))">${bolt(strikeOutX - 58, strikeOutY, "#FF4D4D")}<text x="${Math.max(pad.left + 8, strikeOutX - 162)}" y="${strikeOutY + 4}" fill="#FFB3B3" font-size="11" font-family="IBM Plex Mono, Consolas, monospace" font-weight="900">STRIKE OUT ${lightning.outProbability}%</text></g>`);
      }

      const markerGate = getQualityGate(data);
      const markerRejection = evaluateTradeRejection(data, markerGate, activeChartSymbol());
      const markerIndex = Math.max(1, shown.length - 5);
      if ((beginnerChart || eagleScoutLayers.aPlus) && data.confidence >= 85 && markerGate.verdict !== "FAIL") {
        parts.push(chartMarkerBadge(xFor(markerIndex), yFor(shown[markerIndex].high) - 18, beginnerChart ? "DECISION POINT" : "A+ SETUP", "#22FF88", "#B7FFD5", "aPlus"));
      }
      if ((beginnerChart || eagleScoutLayers.reject) && markerRejection.verdict === "REJECT") {
        parts.push(chartMarkerBadge(xFor(Math.max(1, shown.length - 3)), yFor(shown.at(-1).close) + 28, "REJECT", "#FF4D4D", "#FFD6D6", "reject"));
      }
      if (!beginnerChart && eagleScoutLayers.graveyard && signalGraveyardItems().some(item => item.symbol === activeChartSymbol())) {
        const graveIndex = Math.max(1, shown.length - 9);
        parts.push(chartMarkerBadge(xFor(graveIndex), yFor(shown[graveIndex].low) + 22, "GRAVEYARD", "#FF4D4D", "#B8C2CC", "graveyard"));
      }
      if ((beginnerChart || eagleScoutLayers.replay) && tradeReplayState.chartLinked) {
        const replayIndex = Math.max(0, Math.min(shown.length - 1, tradeReplayState.index));
        parts.push(chartMarkerBadge(xFor(replayIndex), yFor(shown[replayIndex].close), "REPLAY", "#B8C2CC", "#FFFFFF", "replay"));
      }
      if (beginnerChart) {
        const journalIndex = Math.max(1, shown.length - 4);
        const lessonIndex = Math.max(1, shown.length - 2);
        parts.push(chartMarkerBadge(xFor(journalIndex), yFor(shown[journalIndex].low) + 22, "JOURNAL POINT", "#FBBF24", "#FEF3C7", "journal"));
        parts.push(chartMarkerBadge(xFor(lessonIndex), yFor(shown[lessonIndex].close) - 32, "LESSON", "#A5B4FC", "#EEF2FF", "replay"));
      }

      if (eagleScoutLayers.levels || beginnerChart) {
        [
          { label: "ENTRY", value: data.price, color: "#00E5FF" },
          { label: "TARGET", value: data.target, color: "#22FF88" },
          { label: "STOP", value: stop, color: "#FF4D4D" }
        ].forEach(level => {
          const y = yFor(level.value);
          parts.push(`<line x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" stroke="${level.color}" stroke-opacity=".42" stroke-width="1.5" stroke-dasharray="7 6"></line>`);
          parts.push(`<text x="${width - pad.right + 9}" y="${y + 4}" fill="${level.color}" font-size="10" font-family="IBM Plex Mono, Consolas, monospace" font-weight="900">${safeText(level.label)}</text>`);
        });
      }

      eagleChartOverlay.innerHTML = parts.join("");
      renderEagleScoutExplanation(activeEagleScoutMarker);
    }

    function drawLevel(yFor, value, label, color, width, pad) {
      const y = yFor(value);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(2,6,23,.86)";
      const labelWidth = ctx.measureText(label).width + 18;
      ctx.fillRect(width - pad.right + 6, y - 12, labelWidth, 20);
      ctx.fillStyle = color;
      ctx.font = "11px IBM Plex Mono, Consolas, monospace";
      ctx.fillText(label, width - pad.right + 14, y + 4);
    }

    function drawCanvasIndicator(values, xFor, yFor, color, dash = []) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      values.forEach((value, index) => {
        if (!Number.isFinite(value)) return;
        if (!started) {
          ctx.moveTo(xFor(index), yFor(value));
          started = true;
        } else {
          ctx.lineTo(xFor(index), yFor(value));
        }
      });
      if (started) ctx.stroke();
      ctx.restore();
    }

    function isBeginnerLaunchChart() {
      return document.body.dataset.launchMode === "true" && document.body.dataset.advancedMode !== "true";
    }

    function drawChart() {
      renderChartHud();
      if (renderProfessionalChart()) return;
      if (professionalChartContainer) professionalChartContainer.style.display = "none";
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height || !candles.length) return;

      ctx.clearRect(0, 0, width, height);
      const pad = { top: 34, right: 86, bottom: 74, left: 18 };
      const volumeH = Math.max(44, Math.min(78, height * .17));
      const plotW = width - pad.left - pad.right;
      const plotH = height - pad.top - pad.bottom - volumeH;
      const data = activeChartData();
      const rawShown = visibleCandles();
      const shown = chartDisplayCandles(rawShown);
      const averageClose = shown.length ? shown.reduce((sum, candle) => sum + candle.close, 0) / shown.length : 0;
      const indicatorSource = chartDisplayCandles(candles);
      const sourceStart = Math.max(0, candles.length - chartPanOffset - rawShown.length);
      const indicatorValues = indicatorSeriesFor(indicatorSource);
      const visibleIndicators = Object.fromEntries(Object.entries(indicatorValues).map(([key, values]) => [key, values.slice(sourceStart, sourceStart + rawShown.length)]));
      const stop = getStopPrice(data);
      const beginnerChart = isBeginnerLaunchChart();
      const indicatorLevels = [
        ...(!beginnerChart && eagleScoutLayers.ema9 ? visibleIndicators.ema9.filter(Number.isFinite) : []),
        ...(!beginnerChart && eagleScoutLayers.ema21 ? visibleIndicators.ema21.filter(Number.isFinite) : []),
        ...(!beginnerChart && eagleScoutLayers.sma50 ? visibleIndicators.sma50.filter(Number.isFinite) : []),
        ...(!beginnerChart && eagleScoutLayers.bollinger ? visibleIndicators.bollinger.flatMap(band => band ? [band.upper, band.lower] : []) : [])
      ];
      const levels = [data.price, data.target, stop, averageClose, ...indicatorLevels];
      const max = Math.max(...shown.map(c => c.high), ...levels);
      const min = Math.min(...shown.map(c => c.low), ...levels);
      const spread = Math.max(.01, max - min);
      const yFor = value => pad.top + ((max - value) / spread) * plotH;
      const gap = plotW / shown.length;
      const xFor = index => pad.left + gap * index + gap / 2;
      const bodyW = Math.max(6, Math.min(18, gap * .58));
      const volumeTop = pad.top + plotH + 16;
      const maxVolume = Math.max(...shown.map(c => c.volume || 1));

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(30,94,255,.18)");
      gradient.addColorStop(.42, "rgba(11,16,32,.90)");
      gradient.addColorStop(1, "rgba(11,16,32,.98)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(0,229,255,.14)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = pad.left + (plotW / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, volumeTop + volumeH);
        ctx.stroke();
      }

      ctx.lineWidth = 1;
      ctx.font = "12px IBM Plex Mono, Consolas, monospace";
      for (let i = 0; i <= 6; i++) {
        const y = pad.top + (plotH / 6) * i;
        const label = max - (spread / 6) * i;
        ctx.strokeStyle = i === 0 || i === 6 ? "rgba(0,229,255,.14)" : "rgba(184,194,204,.07)";
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(184,194,204,.76)";
        ctx.fillText(label.toFixed(2), width - pad.right + 10, y + 4);
      }

      ctx.shadowBlur = 14;
      if (chartEngineSettings.chartType === "line") {
        drawCanvasIndicator(shown.map(candle => candle.close), xFor, yFor, "#00E5FF", []);
      }
      shown.forEach((candle, index) => {
        const x = pad.left + gap * index + gap / 2;
        const rising = candle.close >= candle.open;
        const color = rising ? "#22FF88" : "#FF4D4D";
        const openY = yFor(candle.open);
        const closeY = yFor(candle.close);
        const volumeHeight = ((candle.volume || 1) / maxVolume) * volumeH;

        ctx.shadowBlur = 0;
        if (!beginnerChart && eagleScoutLayers.volume) {
          ctx.fillStyle = rising ? "rgba(34,255,136,.14)" : "rgba(255,77,77,.14)";
          ctx.fillRect(x - bodyW / 2, volumeTop + volumeH - volumeHeight, bodyW, volumeHeight);
        }

        if (chartEngineSettings.chartType === "line") return;
        ctx.shadowColor = rising ? "rgba(34,255,136,.34)" : "rgba(255,77,77,.34)";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = color;
        ctx.fillStyle = chartEngineSettings.chartType === "hollow" && rising ? "rgba(11,16,32,.90)" : color;
        ctx.lineWidth = Math.max(1.5, Math.min(2.5, gap * .18));
        ctx.beginPath();
        ctx.moveTo(x, yFor(candle.high));
        ctx.lineTo(x, yFor(candle.low));
        ctx.stroke();
        if (chartEngineSettings.chartType === "ohlc") {
          ctx.beginPath();
          ctx.moveTo(x - bodyW / 2, openY);
          ctx.lineTo(x, openY);
          ctx.moveTo(x, closeY);
          ctx.lineTo(x + bodyW / 2, closeY);
          ctx.stroke();
        } else {
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(3, Math.abs(openY - closeY));
          ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
          if (chartEngineSettings.chartType === "hollow" && rising) {
            ctx.strokeRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
          }
        }
      });
      ctx.shadowBlur = 0;

      drawCanvasIndicator(!beginnerChart && eagleScoutLayers.ema9 ? visibleIndicators.ema9 : [], xFor, yFor, "#00E5FF");
      drawCanvasIndicator(!beginnerChart && eagleScoutLayers.ema21 ? visibleIndicators.ema21 : [], xFor, yFor, "#1E5EFF");
      drawCanvasIndicator(!beginnerChart && eagleScoutLayers.sma50 ? visibleIndicators.sma50 : [], xFor, yFor, "#B8C2CC", [6, 4]);
      if (!beginnerChart && eagleScoutLayers.bollinger) {
        drawCanvasIndicator(visibleIndicators.bollinger.map(band => band?.upper ?? null), xFor, yFor, "rgba(184,194,204,.78)", [4, 5]);
        drawCanvasIndicator(visibleIndicators.bollinger.map(band => band?.lower ?? null), xFor, yFor, "rgba(184,194,204,.78)", [4, 5]);
      }

      if (!beginnerChart && eagleScoutLayers.vwap) drawLevel(yFor, averageClose, "VWAP", "rgba(184,194,204,.92)", width, pad);
      if (eagleScoutLayers.levels || beginnerChart) {
        drawLevel(yFor, data.price, "ENTRY", "rgba(0,229,255,.92)", width, pad);
        drawLevel(yFor, data.target, "TARGET", "rgba(34,255,136,.92)", width, pad);
        drawLevel(yFor, stop, "STOP", "rgba(255,77,77,.92)", width, pad);
      }

      if (!beginnerChart && eagleScoutLayers.lightning) {
        const markerIndex = Math.max(1, shown.length - 7);
        const markerX = pad.left + gap * markerIndex + gap / 2;
        const markerY = yFor(shown[markerIndex].close);
        ctx.shadowColor = "rgba(0,229,255,.42)";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "rgba(0,229,255,.92)";
        ctx.beginPath();
        ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,229,255,.92)";
        ctx.font = "11px IBM Plex Mono, Consolas, monospace";
        ctx.fillText("signal", markerX + 10, markerY + 4);
      }

      const lastY = yFor(shown[shown.length - 1].close);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(0,229,255,.65)";
      ctx.beginPath();
      ctx.moveTo(pad.left, lastY);
      ctx.lineTo(width - pad.right, lastY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(0,229,255,.92)";
      ctx.fillRect(width - pad.right + 6, lastY - 12, 72, 22);
      ctx.fillStyle = "#0B1020";
      ctx.font = "12px IBM Plex Mono, Consolas, monospace";
      ctx.fillText(shown.at(-1).close.toFixed(2), width - pad.right + 13, lastY + 4);

      ctx.fillStyle = "rgba(184,194,204,.72)";
      ctx.font = "10px IBM Plex Mono, Consolas, monospace";
      ctx.fillText(`${shown.length} candles visible`, pad.left, height - 18);
      ctx.fillText("Volume", pad.left, volumeTop - 5);
      renderEagleChartOverlay();
    }

    function resizeCanvas() {
      if (professionalChartState.status === "ready" && professionalChartState.chart && professionalChartContainer) {
        professionalChartState.chart.applyOptions({
          width: professionalChartContainer.clientWidth,
          height: professionalChartContainer.clientHeight
        });
        renderProfessionalChart();
        renderEagleChartOverlay();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawChart();
    }

    function showToast(symbol, type) {
      const bullish = type === "Bullish";
      const toast = document.createElement("div");
      toast.className = `toast fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-lg border bg-zinc-950 px-4 py-3 text-sm font-bold shadow-2xl ${bullish ? "border-emerald-400 text-emerald-300" : "border-rose-400 text-rose-300"}`;
      toast.innerHTML = `<i class="fa-solid ${bullish ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}"></i><span>${symbol} ${type} Signal - early detection active</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3600);
    }

    function showNeutralToast(message) {
      const toast = document.createElement("div");
      toast.className = "toast fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-cyan-400 bg-zinc-950 px-4 py-3 text-sm font-bold text-cyan-300 shadow-2xl";
      toast.innerHTML = `<i class="fa-solid fa-bookmark"></i><span>${message}</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    function confirmDestructiveAction(message) {
      if (typeof window.confirm !== "function") {
        showNeutralToast("Confirmation is unavailable in this browser context");
        return false;
      }
      return window.confirm(message);
    }

    function sendSetupNotification(title, body) {
      notificationEvents = [{
        title,
        body,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      }, ...notificationEvents].slice(0, 20);
      localStorage.setItem("strikepulseNotifications", JSON.stringify(notificationEvents));
      renderNotificationCenter();
      showNeutralToast(`${title} - ${body}`);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }

    function renderBreakdown(data) {
      document.getElementById("signalSummary").textContent = data.thesis;
      document.getElementById("signalScore").textContent = `Score ${data.confidence}/100`;
      document.getElementById("disciplineNote").textContent = data.note;
      document.getElementById("breakdownList").innerHTML = data.indicators.map(item => {
        const bullish = data.type === "Bullish";
        const barColor = bullish ? "bg-emerald-400" : "bg-rose-400";
        return `
          <article class="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div class="mb-2 flex items-center justify-between gap-3">
              <p class="text-sm font-black">${item.label}</p>
              <p class="text-xs font-black text-zinc-300">${item.value}/100</p>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div class="${barColor} h-full rounded-full" style="width: ${item.value}%"></div>
            </div>
            <p class="mt-2 text-xs leading-relaxed text-zinc-400">${item.detail}</p>
          </article>
        `;
      }).join("");
    }

    function renderStopPlan(data) {
      const entry = data.price;
      const stopDistance = entry * data.stopPct;
      const stop = data.type === "Bullish" ? entry - stopDistance : entry + stopDistance;
      const reward = Math.abs(data.target - entry);
      const riskReward = reward / stopDistance;
      const budget = Number(document.getElementById("riskBudget").value);
      const shares = Math.max(1, Math.floor(budget / stopDistance));
      const stopDirection = data.type === "Bullish" ? "below" : "above";
      const closeDirection = data.type === "Bullish" ? "below" : "above";

      document.getElementById("entryZone").textContent = money(entry);
      document.getElementById("stopLoss").textContent = money(stop);
      document.getElementById("riskPerShare").textContent = money(stopDistance);
      document.getElementById("maxShares").textContent = shares.toLocaleString();
      document.getElementById("riskReward").textContent = `R/R ${riskReward.toFixed(2)}:1`;
      document.getElementById("stopSummary").textContent = `${data.stopType} stop placed ${stopDirection} entry, using about ${(data.stopPct * 100).toFixed(1)}% room.`;
      document.getElementById("invalidationRule").textContent = `Exit if price closes ${closeDirection} ${money(stop)} or if the signal thesis fails before target. Do not widen the stop after entry.`;
      syncRiskManagerDefaults(data, entry, stop);
      renderRiskManager();
    }

    function syncRiskManagerDefaults(data, entry, stop) {
      const accountInput = document.getElementById("riskManagerAccount");
      const riskPctInput = document.getElementById("riskManagerRiskPct");
      const entryInput = document.getElementById("riskManagerEntry");
      const stopInput = document.getElementById("riskManagerStop");
      const targetInput = document.getElementById("riskManagerTarget");
      const riskInputs = [accountInput, riskPctInput, entryInput, stopInput, targetInput];
      if (!accountInput || riskInputs.includes(document.activeElement)) {
        return;
      }
      const preferredRisk = Number(document.getElementById("riskBudget").value) || 100;
      const accountSize = Number(accountInput.value) || 25000;
      riskPctInput.value = Math.max(0.1, Math.min(10, (preferredRisk / accountSize) * 100)).toFixed(1);
      entryInput.value = entry.toFixed(2);
      stopInput.value = stop.toFixed(2);
      targetInput.value = data.target.toFixed(2);
    }

    function riskManagerValues() {
      return {
        accountSize: Math.max(0, Number(document.getElementById("riskManagerAccount").value) || 0),
        riskPct: Math.max(0, Number(document.getElementById("riskManagerRiskPct").value) || 0),
        entry: Math.max(0, Number(document.getElementById("riskManagerEntry").value) || 0),
        stop: Math.max(0, Number(document.getElementById("riskManagerStop").value) || 0),
        target: Math.max(0, Number(document.getElementById("riskManagerTarget").value) || 0)
      };
    }

    function renderRiskManager() {
      const { accountSize, riskPct, entry, stop, target } = riskManagerValues();
      const dollarRisk = accountSize * (riskPct / 100);
      const riskPerShare = Math.abs(entry - stop);
      const rewardPerShare = Math.abs(target - entry);
      const rr = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
      const maxShares = riskPerShare > 0 ? Math.floor(dollarRisk / riskPerShare) : 0;
      const suggestedContracts = Math.floor(maxShares / contractMultiplier());
      const valid = accountSize > 0 && riskPct > 0 && entry > 0 && stop > 0 && target > 0 && riskPerShare > 0;
      const rejected = !valid || rr < 2;
      const verdict = !valid ? "INVALID" : rejected ? "REJECT" : "APPROVED";
      const verdictClass = !valid
        ? "border-zinc-600 text-zinc-300"
        : rejected
          ? "border-rose-300/35 text-rose-100"
          : "border-emerald-300/35 text-emerald-100";

      document.getElementById("riskManagerVerdict").textContent = verdict;
      document.getElementById("riskManagerVerdict").className = `w-fit rounded-full border ${verdictClass} bg-zinc-950/70 px-3 py-1 text-xs font-black`;
      document.getElementById("riskManagerMaxSize").textContent = `${Math.max(0, maxShares).toLocaleString()} shares`;
      document.getElementById("riskManagerDollarRisk").textContent = money(dollarRisk);
      document.getElementById("riskManagerRr").textContent = valid ? `${rr.toFixed(2)}:1` : "--";
      document.getElementById("riskManagerRr").className = `mt-1 text-xl font-black ${valid && rr >= 2 ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("riskManagerContracts").textContent = Math.max(0, suggestedContracts).toLocaleString();
      document.getElementById("riskManagerSummary").textContent = !valid
        ? "Enter account size, risk percent, entry, stop, and target to calculate sizing."
        : rejected
          ? `Trade rejected: ${rr.toFixed(2)}:1 risk/reward is below the 2:1 minimum.`
          : `Risking ${money(dollarRisk)} allows ${maxShares.toLocaleString()} shares, or about ${suggestedContracts.toLocaleString()} options contracts at 100-share control.`;
      return { valid, rejected, rr, dollarRisk, maxShares, suggestedContracts };
    }

    function riskManagerAllowsTrade() {
      const result = renderRiskManager();
      if (!result.valid) {
        showNeutralToast("Risk Manager needs valid entry, stop, target, account size, and risk percent");
        return false;
      }
      if (result.rejected) {
        showNeutralToast(`Trade rejected: ${result.rr.toFixed(2)}:1 is below 2:1`);
        return false;
      }
      return true;
    }

    function renderTradeManagement(data) {
      const expiry = document.getElementById("expiryChoice").value;
      const moneyness = document.getElementById("moneynessChoice").value;
      const isFast = expiry === "0dte";
      const isNextWeek = expiry === "next-week";
      const thin = data.options.liquidity === "Thin" || data.options.liquidity === "Selective";
      const highIv = data.options.iv >= 60;
      const firstTrim = isFast ? 18 : highIv ? 22 : 28;
      const premiumStop = isFast ? 25 : thin ? 28 : 35;
      const runnerTarget = isNextWeek ? 60 : isFast ? 35 : 45;
      const timeStop = isFast ? "5 min no follow-through" : isNextWeek ? "30 min no follow-through" : "10-15 min no follow-through";
      const style = isFast ? "FAST SCALP" : isNextWeek ? "TACTICAL SWING" : "SCALP";

      document.getElementById("managementStyle").textContent = style;
      document.getElementById("firstTrim").textContent = `+${firstTrim}%`;
      document.getElementById("premiumStop").textContent = `-${premiumStop}%`;
      document.getElementById("breakevenRule").textContent = isFast ? "Move fast after +15%" : "After first trim";
      document.getElementById("timeStop").textContent = timeStop;
      document.getElementById("managementSummary").textContent = isFast
        ? "0DTE requires fast decisions: trim quickly, cut quickly, and never let theta choose for you."
        : isNextWeek
          ? "Next-week contracts allow more patience, but failed confirmations still need to be cut."
          : "Weekly options need a clean move soon after entry or premium decay starts working against you.";

      const scaleRules = [
        `Trim 30-50% of position when premium reaches +${firstTrim}%.`,
        `Move remaining contracts to breakeven after the first trim.`,
        `Let a small runner work toward +${runnerTarget}% only if stock candles keep confirming.`
      ];
      if (moneyness === "otm") scaleRules.unshift("Take profits faster because OTM contracts lose bid support quickly.");
      if (thin) scaleRules.unshift("Use smaller size and prioritize exits at the bid/ask midpoint.");

      const exitRules = [
        `Cut if premium loses ${premiumStop}% from entry.`,
        `Exit if stock violates the Stop Plan level.`,
        `Exit if spread widens beyond the selector limit.`,
        `Exit if the entry trigger fails after ${timeStop}.`
      ];
      if (highIv) exitRules.push("Avoid holding through volatility crush if momentum stalls.");
      if (isFast) exitRules.push("No holding and hoping: close before late-session theta acceleration.");

      document.getElementById("scaleOutPath").innerHTML = scaleRules.map(rule => `
        <div class="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
          <i class="fa-solid fa-arrow-up-right-dots mt-0.5 text-emerald-300"></i>
          <span>${rule}</span>
        </div>
      `).join("");

      document.getElementById("hardExitRules").innerHTML = exitRules.map(rule => `
        <div class="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
          <i class="fa-solid fa-circle-xmark mt-0.5 text-rose-300"></i>
          <span>${rule}</span>
        </div>
      `).join("");
    }

    function getPremiumModel(data) {
      const expiry = document.getElementById("expiryChoice").value;
      const moneyness = document.getElementById("moneynessChoice").value;
      const side = data.type === "Bullish" ? "Call" : "Put";
      const deltaMap = { itm: 0.62, atm: 0.52, otm: 0.38 };
      const expiryMultiplier = { "0dte": 0.45, weekly: 1, "next-week": 1.55 }[expiry];
      const moneyMultiplier = { itm: 1.35, atm: 1, otm: 0.62 }[moneyness];
      const ivMultiplier = 1 + (data.options.iv / 100);
      const basePremium = Math.max(0.35, data.price * 0.012 * expiryMultiplier * moneyMultiplier * ivMultiplier);
      const spread = Number(data.options.spread.replace("$", "")) || 0.1;
      const midpoint = basePremium + (Math.random() - 0.5) * spread * 0.35;
      const theta = basePremium * ({ "0dte": 0.34, weekly: 0.09, "next-week": 0.045 }[expiry]);
      const premiumStopPct = expiry === "0dte" ? 0.25 : data.options.liquidity === "Elite" ? 0.35 : 0.28;
      const premiumTargetPct = expiry === "0dte" ? 0.28 : moneyness === "otm" ? 0.55 : 0.4;
      const premiumStop = basePremium * (1 - premiumStopPct);
      const premiumTarget = basePremium * (1 + premiumTargetPct);
      const breakeven = side === "Call" ? data.price + basePremium : data.price - basePremium;
      return { side, basePremium, midpoint, theta, premiumStop, premiumTarget, breakeven, spread, premiumStopPct, premiumTargetPct, delta: deltaMap[moneyness] };
    }

    function renderPremiumTracker(data) {
      const model = getPremiumModel(data);
      const spreadTooWide = model.spread > (data.options.liquidity === "Elite" ? 0.12 : 0.22);
      const status = spreadTooWide ? "Wide Spread" : model.theta / model.basePremium > 0.25 ? "Theta Hot" : "Tracking";
      const statusClass = status === "Tracking" ? "text-sky-100 border-sky-300/30" : status === "Theta Hot" ? "text-amber-100 border-amber-300/30" : "text-rose-100 border-rose-300/30";
      const pathPct = Math.round(((model.basePremium - model.premiumStop) / (model.premiumTarget - model.premiumStop)) * 100);

      document.getElementById("premiumStatus").textContent = status;
      document.getElementById("premiumStatus").className = `rounded-full border ${statusClass} bg-zinc-950/70 px-2 py-1 text-xs font-black`;
      document.getElementById("optionPremium").textContent = money(model.basePremium);
      document.getElementById("premiumMidpoint").textContent = money(model.midpoint);
      document.getElementById("premiumStopPrice").textContent = money(model.premiumStop);
      document.getElementById("premiumTargetPrice").textContent = money(model.premiumTarget);
      document.getElementById("premiumTheta").textContent = `-${money(model.theta).replace("$", "$")}`;
      document.getElementById("premiumBreakeven").textContent = money(model.breakeven);
      document.getElementById("premiumSpread").textContent = money(model.spread);
      document.getElementById("premiumPathBar").style.width = `${Math.max(8, Math.min(92, pathPct))}%`;
      document.getElementById("premiumPathLabel").textContent = `${Math.round(model.premiumStopPct * 100)}% stop / ${Math.round(model.premiumTargetPct * 100)}% target`;
      document.getElementById("premiumNote").textContent = spreadTooWide
        ? "Spread is too wide for clean execution. Use limit orders or skip."
        : model.theta / model.basePremium > 0.25
          ? "Theta is aggressive. This contract needs immediate follow-through."
          : "Premium structure is tradable if entry timing and spread remain controlled.";
    }

    function contractMultiplier() {
      return 100;
    }

    function currentPracticePremium(symbol = currentSymbol) {
      return getPremiumModel(symbols[symbol]).midpoint;
    }

    function positionMarketValue(position) {
      if (position.optionTicker) {
        return (position.lastPremium || position.entryPremium) * position.qty * contractMultiplier();
      }
      return currentPracticePremium(position.symbol) * position.qty * contractMultiplier();
    }

    function positionOpenPnl(position) {
      if (position.optionTicker) {
        return ((position.lastPremium || position.entryPremium) - position.entryPremium) * position.qty * contractMultiplier();
      }
      return (currentPracticePremium(position.symbol) - position.entryPremium) * position.qty * contractMultiplier();
    }

    function savePracticeAccount() {
      localStorage.setItem("strikepulsePracticeAccount", JSON.stringify(practiceAccount));
    }

    function trimPracticeHistory() {
      practiceAccount.history = practiceAccount.history.slice(0, practiceHistoryLimit);
    }

    function detectMarketRegime(symbol = currentSymbol) {
      const data = symbols[symbol] || symbols[currentSymbol];
      const sectorState = marketContext.sectors?.[data.sector] || "Mixed";
      const spy = marketContext.spy || {};
      const qqq = marketContext.qqq || {};
      const vix = marketContext.vix || {};
      const breadth = marketContext.breadth || {};
      const bullishTrend = spy.trend === "Bullish" && qqq.trend === "Bullish" && spy.score >= 65 && qqq.score >= 65;
      const bearishTrend = spy.trend === "Bearish" && qqq.trend === "Bearish" && spy.score <= 45 && qqq.score <= 45;
      const highVol = vix.state === "Elevated" || vix.score < 55;
      const lowVol = vix.state === "Calm" && vix.score >= 75;
      const breadthPositive = breadth.state === "Positive" && breadth.score >= 60;
      const breadthNegative = breadth.state === "Negative" || breadth.score < 45;

      if (highVol) return "High Volatility";
      if (bullishTrend && breadthPositive && sectorState !== "Fighting") return "Trending Bull";
      if (bearishTrend && breadthNegative) return "Trending Bear";
      if (lowVol && !bullishTrend && !bearishTrend) return "Low Volatility";
      return "Range Bound";
    }

    function regimeWeightSummary(regime) {
      const summaries = {
        "Trending Bull": "Weights favor trend, momentum, MACD, and breadth confirmation.",
        "Trending Bear": "Weights favor downside trend, momentum, volatility control, and breadth.",
        "Range Bound": "Weights favor RSI, volatility control, and selective confirmation over chase entries.",
        "High Volatility": "Weights favor volatility, news, flow, and volume while reducing oscillator trust.",
        "Low Volatility": "Weights favor clean structure and volatility quality while discounting weak volume."
      };
      return summaries[regime] || "Weights use the balanced STRIKEPULSE model.";
    }

    function regimeTone(regime) {
      const tones = {
        "Trending Bull": { section: "border-emerald-400/25 bg-emerald-400/10", icon: "text-emerald-300", text: "text-emerald-100", border: "border-emerald-300/30" },
        "Trending Bear": { section: "border-rose-300/25 bg-rose-300/10", icon: "text-rose-300", text: "text-rose-100", border: "border-rose-300/30" },
        "Range Bound": { section: "border-blue-400/25 bg-blue-400/10", icon: "text-blue-300", text: "text-blue-100", border: "border-blue-300/30" },
        "High Volatility": { section: "border-amber-300/25 bg-amber-300/10", icon: "text-amber-300", text: "text-amber-100", border: "border-amber-300/30" },
        "Low Volatility": { section: "border-cyan-400/25 bg-cyan-400/10", icon: "text-cyan-300", text: "text-cyan-100", border: "border-cyan-300/30" }
      };
      return tones[regime] || tones["Range Bound"];
    }

    function premiumTierLabel(featureKey) {
      const tier = appConfig.premiumControls?.[featureKey] || "included";
      const labels = {
        pro: "PRO READY",
        eliteAi: "ELITE AI",
        desk: "DESK",
        included: "INCLUDED"
      };
      return labels[tier] || String(tier).toUpperCase();
    }

    function getMarketWeather(symbol = currentSymbol) {
      const data = symbols[symbol] || symbols[currentSymbol];
      const regime = detectMarketRegime(symbol);
      const sectorState = marketContext.sectors?.[data.sector] || "Mixed";
      const spyScore = Number(marketContext.spy?.score) || 50;
      const qqqScore = Number(marketContext.qqq?.score) || 50;
      const vixScore = Number(marketContext.vix?.score) || 50;
      const breadthScore = Number(marketContext.breadth?.score) || 50;
      const trendScore = Math.round((spyScore + qqqScore) / 2);
      const sectorScore = sectorState === "Aligned" ? 78 : sectorState === "Fighting" ? 34 : 56;
      const regimeAdjustment = regime === "Trending Bull" ? 8
        : regime === "Trending Bear" ? -8
          : regime === "High Volatility" ? -16
            : regime === "Low Volatility" ? 4
              : -2;
      const rawScore = Math.round((trendScore * .3) + (breadthScore * .25) + (vixScore * .25) + (sectorScore * .2) + regimeAdjustment);
      const score = Math.max(0, Math.min(100, rawScore));
      const label = score >= 78 ? "Sunny" : score >= 60 ? "Mixed" : score >= 42 ? "Storm" : "Danger";
      const icon = label === "Sunny" ? "☀" : label === "Mixed" ? "🌤" : label === "Storm" ? "⛈" : "🌪";
      const riskNote = label === "Sunny"
        ? "Conditions favor clean continuation if the individual setup confirms."
        : label === "Mixed"
          ? "Selective entries only; wait for confirmation instead of chasing."
          : label === "Storm"
            ? "Risk is elevated; reduce size and demand stronger confirmation."
            : "Danger conditions; rejection rules should dominate trade selection.";
      return {
        label,
        icon,
        score,
        regime,
        sectorState,
        trendScore,
        breadthScore,
        volatilityScore: vixScore,
        summary: `${icon} ${label}: ${riskNote} Trend ${trendScore}/100, breadth ${breadthScore}/100, volatility ${vixScore}/100, ${data.sector} context ${sectorState}.`
      };
    }

    function marketWeatherTone(label) {
      const tones = {
        Sunny: { section: "border-emerald-300/25 bg-emerald-400/10", text: "text-emerald-100", badge: "border-emerald-300/30 text-emerald-100" },
        Mixed: { section: "border-sky-300/25 bg-sky-400/10", text: "text-sky-100", badge: "border-sky-300/30 text-sky-100" },
        Storm: { section: "border-amber-300/25 bg-amber-300/10", text: "text-amber-100", badge: "border-amber-300/30 text-amber-100" },
        Danger: { section: "border-rose-300/25 bg-rose-400/10", text: "text-rose-100", badge: "border-rose-300/30 text-rose-100" }
      };
      return tones[label] || tones.Mixed;
    }

    function indicatorValue(data, keyword, fallback = 55) {
      const match = (data.indicators || []).find(item => item.label.toLowerCase().includes(keyword));
      return Number(match?.value) || fallback;
    }

    function lightningProofAdjustment(symbol) {
      const metrics = typeof buildProofEngineMetrics === "function" ? buildProofEngineMetrics() : null;
      if (!metrics || metrics.closed < 8) return { in: 0, out: 0, note: "Proof sample still building" };
      const strikeInRate = metrics.strikeIn.rate;
      const strikeOutRate = metrics.strikeOut.rate;
      return {
        in: strikeInRate === null ? 0 : strikeInRate >= .6 ? 4 : -6,
        out: strikeOutRate === null ? 0 : strikeOutRate >= .6 ? 5 : -3,
        note: `${metrics.closed} linked outcomes informing Lightning`
      };
    }

    function lightningConfirmationProfile(data, gate, rejection, weather, nineSig, trendAligned) {
      const rr = Number(gate.rr) || 0;
      const confirmations = [
        { label: "Entry ready", pass: data.entry.status === "READY" },
        { label: "Quality gate clear", pass: ["A+ SETUP", "READY"].includes(gate.verdict) },
        { label: "Rejection engine approved", pass: rejection.verdict === "APPROVED" },
        { label: "6/9+ confluence", pass: nineSig.score >= 6 },
        { label: "2:1 reward/risk", pass: rr >= 2 },
        { label: "Usable liquidity", pass: ["Elite", "Decent", "Live"].includes(data.options?.liquidity) },
        { label: "Weather supportive", pass: ["Sunny", "Mixed"].includes(weather.label) },
        { label: "Trend aligned", pass: trendAligned }
      ];
      const blockers = confirmations.filter(item => !item.pass).map(item => item.label);
      return {
        confirmations,
        passed: confirmations.filter(item => item.pass).length,
        blockers,
        confirmationRate: confirmations.filter(item => item.pass).length / confirmations.length
      };
    }

    function evaluateLightningStrike(data, gate = getQualityGate(data), rejection = evaluateTradeRejection(data, gate), symbol = currentSymbol) {
      const weather = getMarketWeather(symbol);
      const regime = detectMarketRegime(symbol);
      const nineSig = getNineSig(data);
      const momentumScore = Math.round((data.confidence + indicatorValue(data, "momentum", data.confidence) + indicatorValue(data, "rsi", data.confidence)) / 3);
      const trendAligned = ["Trending Bull", "Low Volatility"].includes(regime) && data.type === "Bullish"
        || ["Trending Bear"].includes(regime) && data.type === "Bearish"
        || regime === "Range Bound" && gate.verdict !== "REJECT";
      const trendScore = trendAligned ? 82 : regime === "High Volatility" ? 42 : 58;
      const volumeScore = indicatorValue(data, "volume", data.confidence >= 80 ? 72 : 55);
      const riskScore = rejection.verdict === "APPROVED" ? 86 : rejection.verdict === "WAIT" ? 58 : 28;
      const qualityScore = Math.max(0, Math.min(100, Math.round((gate.score * .45) + (rejection.score * .35) + (weather.score * .2))));
      const profile = lightningConfirmationProfile(data, gate, rejection, weather, nineSig, trendAligned);
      const proof = lightningProofAdjustment(symbol);
      const rrPenalty = (Number(gate.rr) || 0) < 2 ? 8 : 0;
      const liquidityPenalty = ["Thin", "Selective"].includes(data.options?.liquidity) ? 8 : 0;
      const weatherPenalty = weather.label === "Danger" ? 16 : weather.label === "Storm" ? 10 : 0;
      const inBase = (momentumScore * .23) + (trendScore * .2) + (volumeScore * .16) + (qualityScore * .25) + (nineSig.score / 9 * 16);
      const inProbability = Math.max(0, Math.min(100, Math.round(inBase + (profile.confirmationRate * 8) + proof.in - rrPenalty - liquidityPenalty - weatherPenalty)));
      const weakeningPenalty = data.entry.status === "WAIT" ? 14 : data.options.iv >= 70 ? 12 : 0;
      const hardRiskBoost = rejection.verdict === "REJECT" ? 18
        : rejection.verdict === "WAIT" ? 8
          : profile.blockers.length >= 3 ? 6 : 0;
      const outProbability = Math.max(0, Math.min(100, Math.round((100 - riskScore) * .3 + (100 - qualityScore) * .25 + (weather.label === "Danger" ? 24 : weather.label === "Storm" ? 16 : 3) + weakeningPenalty + rrPenalty + liquidityPenalty + hardRiskBoost + proof.out)));
      const eliteStrikeIn = inProbability >= 82 && profile.passed >= 7 && rejection.verdict === "APPROVED" && data.entry.status === "READY";
      const brewingStrike = inProbability >= 68 && profile.passed >= 5 && rejection.verdict !== "REJECT";
      const protectiveStrikeOut = rejection.verdict === "REJECT" || outProbability >= 66 || (profile.blockers.length >= 3 && outProbability >= 58);
      const verdict = protectiveStrikeOut
        ? "⚡ Strike Out Armed"
        : eliteStrikeIn
          ? "⚡ Strike In Armed"
          : brewingStrike
            ? "⚡ Strike Brewing"
            : "No Lightning";
      const premiumLocked = premiumTierLabel("lightningStrikeAlerts");
      const blockerText = profile.blockers.length ? ` Blockers: ${profile.blockers.slice(0, 3).join(", ")}.` : " All core confirmations are aligned.";
      const summary = `${verdict}. In ${inProbability}/100, Out ${outProbability}/100. ${profile.passed}/8 confirmations, ${proof.note}.${blockerText}`;
      return {
        verdict,
        inProbability,
        outProbability,
        premiumLocked,
        momentumScore,
        trendScore,
        volumeScore,
        qualityScore,
        weather,
        confirmationProfile: profile,
        proofAdjustment: proof,
        summary,
        factors: [
          `Momentum ${momentumScore}/100`,
          `Trend ${trendScore}/100`,
          `Volume ${volumeScore}/100`,
          `Quality ${qualityScore}/100`,
          `Weather ${weather.label}`,
          `${profile.passed}/8 confirmations`,
          proof.note
        ]
      };
    }

    function currentMarketSnapshot(symbol = currentSymbol) {
      const data = symbols[symbol] || symbols[currentSymbol];
      return {
        regime: detectMarketRegime(symbol),
        spy: marketContext.spy?.trend || "Neutral",
        qqq: marketContext.qqq?.trend || "Neutral",
        vix: marketContext.vix?.state || "Unknown",
        breadth: marketContext.breadth?.state || "Mixed",
        sector: marketContext.sectors?.[data.sector] || "Mixed"
      };
    }

    function currentIndicatorSnapshot(data) {
      return (data.indicators || []).map(item => ({
        label: item.label,
        value: item.value,
        detail: item.detail
      }));
    }

    function predictionFromSignal(score, verdict, direction = "Bullish") {
      const normalizedScore = Number(score) || 0;
      const strong = ["A+ SETUP", "READY", "STRONG BUY", "BUY"].includes(verdict) || normalizedScore >= 70;
      if (strong) {
        return direction === "Bearish" ? "Expected downside follow-through" : "Expected upside follow-through";
      }
      if (normalizedScore >= 55 || verdict === "WAIT" || verdict === "CONFIRM") {
        return "Expected mixed result unless confirmation improved";
      }
      return "Expected avoid or failed follow-through";
    }

    function createPracticePlanSnapshot() {
      const data = symbols[currentSymbol];
      const gate = getQualityGate(data);
      const nineSig = getNineSig(data);
      const premium = getPremiumModel(data);
      const score = data.confidence;
      return {
        signalScore: score,
        direction: data.type,
        predictedOutcome: predictionFromSignal(score, gate.verdict, data.type),
        qualityGate: gate.verdict,
        blockers: gate.reasons.slice(0, 3),
        nineSig: nineSig.score,
        marketConditions: currentMarketSnapshot(currentSymbol),
        indicators: currentIndicatorSnapshot(data),
        entryStatus: data.entry.status,
        entryTrigger: data.entry.trigger,
        stop: getStopPrice(data),
        target: data.target,
        premiumStop: premium.premiumStop,
        premiumTarget: premium.premiumTarget,
        liquidity: data.options.liquidity,
        rr: gate.rr
      };
    }

    function gradePracticeTrade(position, pnl) {
      const plan = position.plan || {};
      let score = 100;
      const issues = [];
      if (!["A+ SETUP", "READY"].includes(plan.qualityGate)) {
        score -= 25;
        issues.push(`Quality Gate was ${plan.qualityGate || "unknown"}`);
      }
      if (plan.entryStatus === "WAIT") {
        score -= 20;
        issues.push("Entry timing said wait");
      }
      if (plan.entryStatus === "CONFIRM") {
        score -= 10;
        issues.push("Entry needed confirmation");
      }
      if ((plan.nineSig || 0) < 6) {
        score -= 15;
        issues.push("9-Sig was weak");
      }
      if (!["Elite", "Decent"].includes(plan.liquidity)) {
        score -= 15;
        issues.push("Contract liquidity was not ideal");
      }
      if ((plan.rr || 0) < 1.5) {
        score -= 15;
        issues.push("Reward/risk was weak");
      }
      const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
      return { score: Math.max(0, score), grade, issues };
    }

    function renderPracticeAnalytics() {
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const wins = closed.filter(trade => trade.pnl > 0).length;
      const winRate = closed.length ? Math.round((wins / closed.length) * 100) : null;
      const avgPnl = closed.length ? closed.reduce((sum, trade) => sum + trade.pnl, 0) / closed.length : 0;
      const gradeMap = { A: 4, B: 3, C: 2, D: 1 };
      const reverseGrade = { 4: "A", 3: "B", 2: "C", 1: "D" };
      const graded = closed.filter(trade => trade.grade);
      const avgGradeScore = graded.length ? Math.round(graded.reduce((sum, trade) => sum + gradeMap[trade.grade], 0) / graded.length) : null;
      const risky = closed.filter(trade => trade.grade === "C" || trade.grade === "D").length;
      document.getElementById("practiceWinRate").textContent = winRate === null ? "--" : `${winRate}%`;
      document.getElementById("practiceAvgPnl").textContent = money(avgPnl);
      document.getElementById("practiceAvgPnl").className = `mt-1 font-black ${avgPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("practiceAvgGrade").textContent = avgGradeScore ? reverseGrade[avgGradeScore] : "--";
      document.getElementById("practiceRiskyEntries").textContent = risky;
      renderAgentReadiness(closed);
    }

    function drawdownFromTrades(closedTrades) {
      let equity = Number(practiceAccount.startingCash) || 25000;
      let peak = equity;
      let maxDrawdown = 0;
      closedTrades.slice().reverse().forEach(trade => {
        equity += Number(trade.pnl) || 0;
        peak = Math.max(peak, equity);
        maxDrawdown = Math.max(maxDrawdown, peak - equity);
      });
      return {
        dollars: maxDrawdown,
        percent: peak > 0 ? (maxDrawdown / peak) * 100 : 0
      };
    }

    function agentReadinessMetrics(closedTrades = practiceAccount.history.filter(trade => trade.action === "CLOSE")) {
      const wins = closedTrades.filter(trade => trade.pnl > 0);
      const losses = closedTrades.filter(trade => trade.pnl < 0);
      const totalPnl = closedTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
      const winRate = closedTrades.length ? wins.length / closedTrades.length : 0;
      const avgWin = wins.length ? wins.reduce((sum, trade) => sum + trade.pnl, 0) / wins.length : 0;
      const avgLoss = losses.length ? Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0) / losses.length) : 0;
      const expectancy = closedTrades.length ? (winRate * avgWin) - ((1 - winRate) * avgLoss) : 0;
      const drawdown = drawdownFromTrades(closedTrades);
      const progressScore = Math.min(25, (closedTrades.length / readinessTradeTarget) * 25);
      const expectancyScore = expectancy > 0 ? Math.min(20, 8 + Math.min(12, expectancy / 10)) : 0;
      const profitScore = totalPnl > 0 ? 20 : 0;
      const drawdownScore = closedTrades.length ? Math.max(0, 15 - Math.min(15, drawdown.percent / 2)) : 0;
      const processScore = closedTrades.length
        ? Math.min(20, closedTrades.filter(trade => ["A", "B"].includes(trade.grade)).length / closedTrades.length * 20)
        : 0;
      const readinessScore = Math.round(progressScore + expectancyScore + profitScore + drawdownScore + processScore);
      const profitable = totalPnl > 0 && expectancy > 0;
      const sampleReady = closedTrades.length >= readinessTradeTarget;
      const automationReady = sampleReady && profitable;
      return {
        closedCount: closedTrades.length,
        totalPnl,
        winRate,
        avgWin,
        avgLoss,
        expectancy,
        drawdown,
        readinessScore,
        profitable,
        sampleReady,
        automationReady
      };
    }

    function readinessPill(label, pass) {
      return `<span class="rounded-full ${pass ? "bg-emerald-400/10 text-emerald-200" : "bg-zinc-800 text-zinc-500"} px-2 py-1 text-[11px] font-bold">${label}</span>`;
    }

    function renderAgentReadiness(closedTrades) {
      const metrics = agentReadinessMetrics(closedTrades);
      const status = metrics.automationReady ? "AUTOMATION READY" : "PAPER ONLY";
      const scoreTone = metrics.readinessScore >= 80 ? "text-emerald-300" : metrics.readinessScore >= 55 ? "text-amber-200" : "text-rose-300";
      document.getElementById("agentReadinessStatus").textContent = status;
      document.getElementById("agentReadinessStatus").className = `shrink-0 rounded-full border ${metrics.automationReady ? "border-emerald-300/30 text-emerald-100" : "border-cyan-300/30 text-cyan-100"} bg-zinc-950/70 px-2 py-1 text-[11px] font-black`;
      document.getElementById("agentReadinessScore").textContent = `${metrics.readinessScore}/100`;
      document.getElementById("agentReadinessScore").className = `mt-1 font-black ${scoreTone}`;
      document.getElementById("agentReadinessProgress").textContent = `${Math.min(metrics.closedCount, readinessTradeTarget)}/${readinessTradeTarget}`;
      document.getElementById("agentReadinessExpectancy").textContent = money(metrics.expectancy);
      document.getElementById("agentReadinessExpectancy").className = `mt-1 font-black ${metrics.expectancy > 0 ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("agentReadinessDrawdown").textContent = `${money(metrics.drawdown.dollars)} / ${metrics.drawdown.percent.toFixed(1)}%`;
      document.getElementById("agentReadinessDrawdown").className = `mt-1 font-black ${metrics.drawdown.percent <= 10 ? "text-emerald-300" : metrics.drawdown.percent <= 20 ? "text-amber-200" : "text-rose-300"}`;
      document.getElementById("agentReadinessProfitability").textContent = metrics.profitable ? `${money(metrics.totalPnl)} proven` : "Not proven";
      document.getElementById("agentReadinessProfitability").className = `mt-1 font-black ${metrics.profitable ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("agentReadinessAutomation").textContent = metrics.automationReady ? "Unlocked" : "Locked";
      document.getElementById("agentReadinessAutomation").className = `mt-1 font-black ${metrics.automationReady ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("agentReadinessBar").style.width = `${Math.max(0, Math.min(100, metrics.readinessScore))}%`;
      document.getElementById("agentReadinessBar").className = `h-full rounded-full ${metrics.automationReady ? "bg-emerald-300" : metrics.readinessScore >= 55 ? "bg-amber-300" : "bg-cyan-300"}`;
      document.getElementById("agentReadinessSummary").textContent = metrics.automationReady
        ? "100 paper trades are complete and profitability is proven. Automation can be considered next."
        : `Paper-only mode remains active. Need ${Math.max(0, readinessTradeTarget - metrics.closedCount)} more closed paper trades and positive expectancy/profitability before automation.`;
      document.getElementById("agentReadinessChecklist").innerHTML = [
        readinessPill("Paper only", true),
        readinessPill("100 trades", metrics.sampleReady),
        readinessPill("Positive expectancy", metrics.expectancy > 0),
        readinessPill("Profitable", metrics.profitable),
        readinessPill("Automation allowed", metrics.automationReady)
      ].join("");
    }

    function renderPracticeAccount() {
      const openPnl = practiceAccount.positions.reduce((sum, position) => sum + positionOpenPnl(position), 0);
      const marketValue = practiceAccount.positions.reduce((sum, position) => sum + positionMarketValue(position), 0);
      const equity = practiceAccount.cash + marketValue;
      document.getElementById("practiceStartingCash").value = String(practiceAccount.startingCash || 25000);
      document.getElementById("practiceCash").textContent = money(practiceAccount.cash);
      document.getElementById("practiceEquity").textContent = money(equity);
      document.getElementById("practiceOpenPnl").textContent = money(openPnl);
      document.getElementById("practiceOpenPnl").className = `mt-1 text-xl font-black ${openPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("practiceRealizedPnl").textContent = money(practiceAccount.realizedPnl);
      document.getElementById("practiceRealizedPnl").className = `mt-1 text-xl font-black ${practiceAccount.realizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`;
      renderPracticeAnalytics();

      document.getElementById("practicePositions").innerHTML = practiceAccount.positions.length
        ? practiceAccount.positions.map(position => {
          const pnl = positionOpenPnl(position);
          return `
            <article class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm font-black">${position.contract}</p>
                <p class="mt-1 text-xs text-zinc-400">${position.qty} @ ${money(position.entryPremium)} · now ${money(position.optionTicker ? (position.lastPremium || position.entryPremium) : currentPracticePremium(position.symbol))}</p>
                <p class="mt-1 text-[11px] text-zinc-500">${position.plan?.qualityGate || "--"} · ${position.plan?.nineSig || 0}/9 Sig · ${position.plan?.liquidity || "Unknown"} liquidity</p>
                </div>
                <span class="shrink-0 text-sm font-black ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}">${money(pnl)}</span>
              </div>
            </article>
          `;
        }).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-500">No open simulated positions.</div>`;

      document.getElementById("practiceHistory").innerHTML = practiceAccount.history.length
        ? practiceAccount.history.slice(0, 4).map(trade => `
          <article class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-black">${trade.contract}</p>
                <p class="mt-1 text-xs text-zinc-400">${trade.action} ${trade.qty} · ${trade.time}${trade.grade ? ` · Grade ${trade.grade}` : ""}</p>
                ${trade.issues?.length ? `<p class="mt-1 text-[11px] text-zinc-500">${trade.issues.join("; ")}</p>` : ""}
              </div>
              <span class="shrink-0 text-sm font-black ${trade.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}">${money(trade.pnl)}</span>
            </div>
          </article>
        `).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-500">No practice trades yet.</div>`;
      renderEliteDashboard();
    }

    function buyPracticeContract() {
      if (!riskManagerAllowsTrade()) {
        return;
      }
      const qty = Math.max(1, Number(document.getElementById("practiceQty").value) || 1);
      const premium = currentPracticePremium();
      const cost = premium * qty * contractMultiplier();
      if (cost > practiceAccount.cash) {
        showNeutralToast("Practice account has insufficient simulated cash");
        return;
      }
      const signalId = currentSignalReference(currentSymbol);
      const position = {
        id: Date.now(),
        signalId,
        symbol: currentSymbol,
        contract: currentContractLabel(),
        qty,
        entryPremium: premium,
        plan: createPracticePlanSnapshot(),
        openedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };
      practiceAccount.cash -= cost;
      practiceAccount.positions.unshift(position);
      practiceAccount.history.unshift({ ...position, action: "BUY", pnl: 0, time: position.openedAt });
      linkSignalLedger(signalId, "paper", position.id, {
        userVerdict: "Paper trade opened",
        outcome: { status: "Open", source: "local-paper" }
      });
      linkActiveSignalContext("paper", position.id, {
        stage: "paperTrade",
        userVerdict: "Paper trade opened",
        outcome: { status: "Open", source: "local-paper" }
      });
      trimPracticeHistory();
      savePracticeAccount();
      queueCloudSync("paper-buy");
      renderPracticeAccount();
      renderJournal();
      showNeutralToast(`${currentSymbol} paper trade opened`);
    }

    function optionSignalSnapshot() {
      if (!latestOptionSignal?.analysis) return null;
      const feeds = latestOptionSignal.feeds || {};
      const meta = feeds.contract?.contract || {};
      const latestCandle = feeds.candles?.candles?.at(-1) || {};
      const premium = Number.isFinite(latestCandle.close) ? latestCandle.close : null;
      const profileResult = evaluateAssetProfile(meta.underlying_ticker || currentSymbol, latestOptionSignal.analysis, { newsKnown: false });
      const symbol = meta.underlying_ticker || currentSymbol;
      const score = latestOptionSignal.analysis.confidence ?? latestOptionSignal.analysis.score;
      const rejection = tradeRejectionForSignal(latestOptionSignal.analysis, profileResult, symbol);
      const eventRisk = eventRiskForSymbol(symbol);
      const memorySnapshot = rememberSignalSnapshot(symbol, "live-options");
      return {
        symbol,
        signalId: memorySnapshot?.signalId || null,
        signalMemoryId: memorySnapshot?.id || null,
        optionTicker: latestOptionSignal.contract,
        contract: document.getElementById("optionIntelMeta").textContent || latestOptionSignal.contract,
        contractType: meta.contract_type || "",
        strike: meta.strike_price,
        expiration: meta.expiration_date,
        premium,
        verdict: rejection.rejected ? "REJECT" : latestOptionSignal.analysis.verdict,
        score,
        grade: latestOptionSignal.analysis.grade,
        nineSig: latestOptionSignal.analysis.nineSig,
        marketRegime: latestOptionSignal.analysis.marketRegime,
        baseConfidence: latestOptionSignal.analysis.baseConfidence,
        regimeAdjustment: latestOptionSignal.analysis.regimeAdjustment,
        scoreBreakdown: latestOptionSignal.analysis.scoreBreakdown || [],
        marketConditions: currentMarketSnapshot(symbol),
        blockers: latestOptionSignal.analysis.blockers || [],
        rejection,
        eventRisk,
        assetProfile: profileResult.profile.label,
        adjustedConfidence: profileResult.adjustedConfidence,
        profileBlockers: profileResult.blockers,
        predictedOutcome: predictionFromSignal(score, rejection.rejected ? "REJECT" : latestOptionSignal.analysis.verdict, latestOptionSignal.analysis.direction || symbols[symbol]?.type || "Bullish"),
        cached: latestOptionSignal.cached
      };
    }

    function paperTradeSignalTicket() {
      if (!riskManagerAllowsTrade()) {
        return;
      }
      const snapshot = optionSignalSnapshot();
      if (!snapshot || !Number.isFinite(snapshot.premium) || snapshot.premium <= 0) {
        showNeutralToast("Load a live signal with option candles before paper trading");
        return;
      }
      if (snapshot.rejection?.rejected) {
        showNeutralToast(`Trade rejected: ${snapshot.rejection.primaryReason || "hard stop detected"}`);
        return;
      }
      const qty = Math.max(1, Number(document.getElementById("practiceQty").value) || 1);
      const cost = snapshot.premium * qty * contractMultiplier();
      if (cost > practiceAccount.cash) {
        showNeutralToast("Practice account has insufficient simulated cash");
        return;
      }
      const openedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const position = {
        id: Date.now(),
        signalId: snapshot.signalId,
        symbol: snapshot.symbol,
        optionTicker: snapshot.optionTicker,
        contract: snapshot.contract,
        qty,
        entryPremium: snapshot.premium,
        lastPremium: snapshot.premium,
        plan: {
          signalScore: snapshot.score,
          direction: snapshot.contractType === "put" ? "Bearish" : "Bullish",
          predictedOutcome: snapshot.predictedOutcome,
          marketRegime: snapshot.marketRegime,
          baseConfidence: snapshot.baseConfidence,
          regimeAdjustment: snapshot.regimeAdjustment,
          qualityGate: snapshot.verdict,
          blockers: [...(snapshot.rejection?.reasons || []), ...snapshot.blockers, ...snapshot.profileBlockers].slice(0, 3),
          nineSig: snapshot.nineSig,
          marketConditions: snapshot.marketConditions,
          eventRisk: snapshot.eventRisk,
          indicators: snapshot.scoreBreakdown.map(factor => ({
            label: factor.factor,
            value: factor.rawScore,
            detail: factor.detail
          })),
          entryStatus: ["WAIT", "AVOID", "REJECT"].includes(snapshot.verdict) ? "WAIT" : "READY",
          entryTrigger: "Live options signal ticket",
          stop: null,
          target: null,
          premiumStop: null,
          premiumTarget: null,
          liquidity: "Live",
          rr: null
        },
        openedAt
      };
      practiceAccount.cash -= cost;
      practiceAccount.positions.unshift(position);
      practiceAccount.history.unshift({ ...position, action: "BUY", pnl: 0, time: openedAt });
      linkSignalLedger(snapshot.signalId, "paper", position.id, {
        userVerdict: "Paper trade opened",
        outcome: { status: "Open", source: "local-paper" }
      });
      updateActiveSignalContext({
        signalId: snapshot.signalId,
        symbol: snapshot.symbol,
        source: "paper-trade",
        eagleScore: snapshot.score,
        suggestedAction: snapshot.verdict,
        marketRegime: snapshot.marketRegime,
        learning: {
          optionTicker: snapshot.optionTicker,
          contract: snapshot.contract,
          predictedOutcome: snapshot.predictedOutcome
        }
      }, "paperTrade");
      linkActiveSignalContext("paper", position.id, {
        userVerdict: "Paper trade opened",
        outcome: { status: "Open", source: "local-paper" }
      });
      trimPracticeHistory();
      savePracticeAccount();
      queueCloudSync("paper-signal-buy");
      renderPracticeAccount();
      renderJournal();
      showNeutralToast(`${snapshot.optionTicker} paper trade opened`);
    }

    function prefillJournalFromClosedPaperTrade(closeTrade) {
      if (!closeTrade) return;
      const note = document.getElementById("journalNote");
      const outcome = document.getElementById("journalOutcome");
      const result = closeTrade.pnl > 0 ? "Win" : closeTrade.pnl < 0 ? "Loss" : "Breakeven";
      const plan = closeTrade.plan || {};
      const issues = closeTrade.issues?.length ? closeTrade.issues.join("; ") : "No major process issue detected.";
      const lesson = closeTrade.pnl > 0
        ? "What should be repeated next time?"
        : closeTrade.pnl < 0
          ? "What warning sign should block the next similar setup?"
          : "What would have made the setup clearer before entry?";
      if (outcome) outcome.value = result;
      if (note && !note.value.trim()) {
        note.value = [
          `${closeTrade.symbol} paper trade closed: ${result}.`,
          `P/L ${money(closeTrade.pnl)} (${Number(closeTrade.percentMove || 0).toFixed(2)}%).`,
          `Process grade ${closeTrade.grade || "--"} / ${closeTrade.processScore || 0}.`,
          `Original read: ${plan.qualityGate || "Signal"} · ${plan.nineSig || 0}/9 Sig.`,
          `Lesson prompt: ${lesson}`,
          `Issues: ${issues}`
        ].join(" ");
      }
      const autoTags = ["Paper Close", result];
      if (closeTrade.pnl < 0) autoTags.push("Review Replay");
      if (closeTrade.processScore < 75) autoTags.push("Process Review");
      selectedJournalTags = [...new Set([...(selectedJournalTags || []), ...autoTags])];
      document.querySelectorAll(".journal-tag").forEach(button => {
        const active = selectedJournalTags.includes(button.dataset.tag);
        button.className = active
          ? "journal-tag rounded-full border border-cyan-400 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200"
          : "journal-tag rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800";
      });
      markStartFlowStep("journal");
      const replaySelect = document.getElementById("signalReplaySelect");
      const replayItems = typeof signalReplayItems === "function" ? signalReplayItems() : [];
      const replayMatch = replayItems.find(item => item.type === "paper" && item.symbol === closeTrade.symbol);
      if (replaySelect && replayMatch) replaySelect.value = replayMatch.replayId;
    }

    function closePracticePositions() {
      const closing = practiceAccount.positions.filter(position => position.symbol === currentSymbol);
      if (!closing.length) {
        showNeutralToast(`No open ${currentSymbol} paper position`);
        return;
      }
      const closedTrades = [];
      closing.forEach(position => {
        const exitPremium = position.optionTicker ? (position.lastPremium || position.entryPremium) : currentPracticePremium(position.symbol);
        const value = exitPremium * position.qty * contractMultiplier();
        const pnl = (exitPremium - position.entryPremium) * position.qty * contractMultiplier();
        const grade = gradePracticeTrade(position, pnl);
        const closeId = Date.now() + Math.random();
        const percentMove = position.entryPremium ? ((exitPremium - position.entryPremium) / position.entryPremium) * 100 : 0;
        practiceAccount.cash += value;
        practiceAccount.realizedPnl += pnl;
        const closeTrade = {
          id: closeId,
          signalId: position.signalId || position.plan?.signalId || null,
          symbol: position.symbol,
          contract: position.contract,
          qty: position.qty,
          action: "CLOSE",
          pnl,
          percentMove,
          grade: grade.grade,
          processScore: grade.score,
          issues: grade.issues,
          plan: position.plan,
          date: todayKey(),
          time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        };
        practiceAccount.history.unshift(closeTrade);
        linkSignalLedger(closeTrade.signalId, "paper", closeId, {
          outcome: {
            status: "Closed",
            paperTradeOutcome: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven",
            winLoss: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven",
            percentMove: Number(percentMove.toFixed(2)),
            maxFavorableExcursion: Number(Math.max(0, percentMove).toFixed(2)),
            maxAdverseExcursion: Number(Math.min(0, percentMove).toFixed(2)),
            source: "local-paper"
          }
        });
        if (activeSignalContext?.signalId === closeTrade.signalId) {
          linkActiveSignalContext("paper", closeId, {
            outcome: {
              status: "Closed",
              paperTradeOutcome: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven",
              winLoss: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven",
              percentMove: Number(percentMove.toFixed(2)),
              maxFavorableExcursion: Number(Math.max(0, percentMove).toFixed(2)),
              maxAdverseExcursion: Number(Math.min(0, percentMove).toFixed(2)),
              source: "local-paper"
            },
            learning: {
              closeGrade: grade.grade,
              processScore: grade.score,
              issues: grade.issues
            }
          });
        }
        closedTrades.push(closeTrade);
      });
      practiceAccount.positions = practiceAccount.positions.filter(position => position.symbol !== currentSymbol);
      trimPracticeHistory();
      savePracticeAccount();
      queueCloudSync("paper-close");
      renderPracticeAccount();
      renderJournal();
      renderSignalReplayOptions();
      prefillJournalFromClosedPaperTrade(closedTrades[0]);
      renderEagleScoutCoach(practiceAccount.history.find(trade => trade.action === "CLOSE" && trade.symbol === currentSymbol));
      document.getElementById("journalNote")?.scrollIntoView({ behavior: "smooth", block: "center" });
      showNeutralToast(`${currentSymbol} paper position closed. Journal the lesson next.`);
    }

    function resetPracticeAccount() {
      if (!confirmDestructiveAction("Reset the paper trading account? This clears open simulated positions and paper trade history.")) {
        return;
      }
      const startingCash = Number(document.getElementById("practiceStartingCash").value) || 25000;
      practiceAccount = {
        startingCash,
        cash: startingCash,
        realizedPnl: 0,
        positions: [],
        history: []
      };
      savePracticeAccount();
      queueCloudSync("paper-reset");
      renderPracticeAccount();
      renderJournal();
      showNeutralToast(`Paper account reset to ${money(startingCash)}`);
    }

    function renderOptionsEdge(data) {
      const flowClass = data.options.flow === "Calls" ? "text-emerald-300" : "text-rose-300";
      document.getElementById("optionsGrade").textContent = data.options.grade;
      document.getElementById("optionsLiquidity").textContent = data.options.liquidity;
      document.getElementById("optionsSpread").textContent = data.options.spread;
      document.getElementById("optionsIv").textContent = data.options.iv;
      document.getElementById("optionsFlow").textContent = data.options.flow;
      document.getElementById("optionsFlow").className = `mt-1 text-lg font-black ${flowClass}`;
      document.getElementById("optionsSetup").textContent = data.options.setup;
    }

    function renderContractSelector(data) {
      const expiry = document.getElementById("expiryChoice").value;
      const moneyness = document.getElementById("moneynessChoice").value;
      const side = data.type === "Bullish" ? "Call" : "Put";
      const expiryLabel = { "0dte": "0DTE", weekly: "Weekly", "next-week": "Next Week" }[expiry];
      const moneyLabel = { itm: "Slight ITM", atm: "ATM", otm: "Slight OTM" }[moneyness];
      const deltaMap = { itm: 0.62, atm: 0.52, otm: 0.38 };
      const oiMap = { Elite: "5k", Decent: "2k", Selective: "750", Thin: "Avoid" };
      const spreadLimit = data.options.liquidity === "Elite" ? "$0.10" : data.options.liquidity === "Decent" ? "$0.18" : data.options.liquidity === "Selective" ? "$0.25" : "Skip";
      const thin = data.options.liquidity === "Thin";
      const riskyExpiry = expiry === "0dte";
      const lottery = moneyness === "otm";
      const verdict = thin ? "Skip" : riskyExpiry || lottery ? "Aggressive" : "Best Fit";
      const verdictClass = thin ? "text-rose-100 border-rose-300/30" : riskyExpiry || lottery ? "text-amber-100 border-amber-300/30" : "text-violet-100 border-violet-300/30";

      document.getElementById("contractVerdict").textContent = verdict;
      document.getElementById("contractVerdict").className = `rounded-full border ${verdictClass} bg-zinc-950/70 px-2 py-1 text-xs font-black`;
      document.getElementById("recommendedContract").textContent = `${currentSymbol} ${expiryLabel} ${moneyLabel} ${side}`;
      document.getElementById("contractDelta").textContent = deltaMap[moneyness].toFixed(2);
      document.getElementById("contractOi").textContent = oiMap[data.options.liquidity] || "1k";
      document.getElementById("contractMaxSpread").textContent = spreadLimit;

      const reason = thin
        ? "Options liquidity is too thin for elite execution. The signal may be valid, but the contract market is not attractive."
        : `${moneyLabel} ${side.toLowerCase()} gives a practical delta profile while respecting the current ${data.options.liquidity.toLowerCase()} liquidity and ${data.options.spread} spread.`;
      document.getElementById("contractReason").textContent = reason;

      const warning = expiry === "0dte"
        ? "0DTE has extreme theta and gamma risk. Use only for fast scalps with a hard stop and no averaging down."
        : expiry === "weekly"
          ? "Weekly contracts decay quickly. Be right on direction and timing; do not hold a failed scalp."
          : "Next-week expiry gives more time for the thesis to work, usually at higher premium cost.";
      document.getElementById("thetaWarning").textContent = lottery
        ? warning + " Slight OTM contracts need faster movement; avoid them when momentum is unclear."
        : warning;
    }

    function cleanOptionIntelContract() {
      const input = document.getElementById("optionIntelContract");
      const contract = input.value.trim().toUpperCase();
      input.value = contract;
      if (!/^O:[A-Z][A-Z0-9.\-]{0,14}\d{6}[CP]\d{8}$/.test(contract)) {
        throw new Error("Use Polygon format like O:NVDA260601C00152500");
      }
      return contract;
    }

    function latestIndicatorValue(result, key = "value") {
      const latest = result?.values?.[0];
      const value = latest?.[key];
      return Number.isFinite(value) ? value.toFixed(2) : "--";
    }

    function latestIndicatorNumber(result, key = "value") {
      const value = result?.values?.[0]?.[key];
      return Number.isFinite(value) ? value : null;
    }

    function assetProfileKeyFor(symbol, data = symbols[symbol]) {
      if (data?.assetProfile && assetProfiles[data.assetProfile]) return data.assetProfile;
      if (assetProfileBySymbol[symbol]) return assetProfileBySymbol[symbol];
      if (data?.sector === "Semiconductors") return "semiconductorTech";
      if (data?.sector === "Index ETF") return "indexEtf";
      if (data?.sector === "Megacap Tech" || data?.sector === "EVs") return "largeCapStock";
      if (data?.risk === "Elevated" || data?.options?.liquidity === "Thin") return "smallCapMomentum";
      return "largeCapStock";
    }

    function activeAssetProfile(symbol) {
      const data = symbols[symbol] || {};
      const key = assetProfileKeyFor(symbol, data);
      return { key, ...assetProfiles[key] };
    }

    function factorScore(analysis, factorName) {
      const item = analysis?.scoreBreakdown?.find(factor => factor.factor.toLowerCase() === factorName.toLowerCase());
      return Number.isFinite(item?.rawScore) ? item.rawScore : 55;
    }

    const profileFactorNames = {
      trend: "Trend",
      momentum: "Momentum",
      rsi: "RSI",
      macd: "MACD",
      volume: "Volume",
      volatility: "Volatility",
      breadth: "Market breadth",
      news: "News sentiment",
      flow: "Options flow"
    };

    function profileWeightSummary(profile) {
      return Object.entries(profile.weights || {})
        .sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1))
        .slice(0, 4)
        .map(([factor, multiplier]) => `${factor.toUpperCase()} ${multiplier > 1 ? "+" : ""}${Math.round((multiplier - 1) * 100)}%`)
        .join(" / ");
    }

    function profileWeightConfidenceAdjustment(profile, analysis) {
      return Object.entries(profile.weights || {}).reduce((sum, [factor, multiplier]) => {
        const score = factorScore(analysis, profileFactorNames[factor] || factor);
        const quality = (score - 55) / 45;
        return sum + quality * (multiplier - 1) * 10;
      }, 0);
    }

    function benchmarkConfirmationFor(profile, symbol, data) {
      if (profile.key === "leveragedEtf") {
        return `QQQ ${marketContext.qqq?.score ?? "--"}/100, Nasdaq proxy ${marketContext.qqq?.trend || "Neutral"}, VIX ${marketContext.vix?.score ?? "--"}/100`;
      }
      if (profile.key === "indexEtf") {
        return `Nasdaq breadth ${marketContext.breadth?.score ?? "--"}/100, QQQ ${marketContext.qqq?.trend || "Neutral"}, megacap tech ${marketContext.sectors?.["Megacap Tech"] || "Mixed"}`;
      }
      if (profile.key === "semiconductorTech") {
        return `Semiconductor strength ${marketContext.sectors?.Semiconductors || "Mixed"}, QQQ ${marketContext.qqq?.score ?? "--"}/100, VIX ${marketContext.vix?.score ?? "--"}/100`;
      }
      if (profile.key === "energyOil") {
        return `Crude/oil proxy, XLE trend context, energy sector ${marketContext.sectors?.Energy || "Mixed"}`;
      }
      if (profile.key === "commodityEtf") {
        return `${symbol} commodity trend context, event/news risk, volatility ${marketContext.vix?.state || "Unknown"}`;
      }
      if (profile.key === "smallCapMomentum") {
        return `IWM/risk appetite proxy, relative volume, spread/liquidity confirmation`;
      }
      return `${data.sector || "Sector"} vs SPY ${marketContext.spy?.score ?? "--"}/100 and QQQ ${marketContext.qqq?.score ?? "--"}/100`;
    }

    function evaluateAssetProfile(symbol, analysis, context = {}) {
      const data = symbols[symbol] || {};
      const profile = activeAssetProfile(symbol);
      const baseConfidence = analysis?.confidence ?? analysis?.score ?? data.confidence ?? 0;
      const sectorState = marketContext.sectors[data.sector] || "Mixed";
      const qqqSupport = marketContext.qqq?.score >= 70;
      const spySupport = marketContext.spy?.score >= 70;
      const vixSupport = marketContext.vix?.score >= 60;
      const breadthSupport = marketContext.breadth?.score >= 60;
      const blockers = [];
      let adjustment = 0;
      const weightAdjustment = profileWeightConfidenceAdjustment(profile, analysis);
      adjustment += weightAdjustment;

      if ((profile.key === "leveragedEtf" || profile.key === "indexEtf" || profile.key === "semiconductorTech") && !qqqSupport) {
        blockers.push("QQQ/Nasdaq context is not supportive.");
        adjustment -= profile.key === "leveragedEtf" ? 10 : 6;
      }
      if ((profile.key === "indexEtf" || profile.key === "largeCapStock") && !spySupport) {
        blockers.push("SPY context is not supportive.");
        adjustment -= 4;
      }
      if ((profile.key === "semiconductorTech" || profile.key === "largeCapStock") && sectorState === "Fighting") {
        blockers.push(`${data.sector || "Sector"} is fighting the setup.`);
        adjustment -= 8;
      } else if (sectorState === "Aligned") {
        adjustment += 4;
      }
      if (!breadthSupport) {
        blockers.push("Market breadth is below confirmation threshold.");
        adjustment -= profile.key === "indexEtf" ? 8 : 4;
      }
      if (!vixSupport) {
        blockers.push("Volatility regime is not supportive.");
        adjustment -= profile.key === "leveragedEtf" || profile.key === "commodityEtf" ? 8 : 4;
      }
      if (profile.key === "smallCapMomentum" && data.options?.liquidity === "Thin") {
        blockers.push("Small-cap options liquidity is thin.");
        adjustment -= 10;
      }
      if ((profile.key === "energyOil" || profile.key === "commodityEtf") && context.newsKnown === false) {
        blockers.push("Commodity/news catalyst risk is not confirmed.");
        adjustment -= 5;
      }

      const trend = factorScore(analysis, "Trend");
      const momentum = factorScore(analysis, "Momentum");
      const volume = factorScore(analysis, "Volume");
      const volatility = factorScore(analysis, "Volatility");
      if (trend >= 75) adjustment += 2;
      if (momentum >= 80) adjustment += 2;
      if (volume < 55) {
        blockers.push("Volume confirmation is weak for this profile.");
        adjustment -= profile.key === "smallCapMomentum" ? 8 : 3;
      }
      if (volatility < 55) {
        blockers.push("Volatility profile is hostile.");
        adjustment -= 4;
      }

      return {
        profile,
        benchmarkConfirmation: benchmarkConfirmationFor(profile, symbol, data),
        marketConfirmation: `${data.sector || "Market"}: ${sectorState}; QQQ ${marketContext.qqq?.score ?? "--"}/100; VIX ${marketContext.vix?.score ?? "--"}/100`,
        blockers,
        adjustedConfidence: Math.round(Math.max(0, Math.min(100, baseConfidence + adjustment))),
        adjustment: Math.round(adjustment),
        weightAdjustment: Math.round(weightAdjustment),
        weightSummary: profileWeightSummary(profile)
      };
    }

    function renderAssetProfileTicket(profileResult) {
      if (!profileResult) return;
      const adjustedTone = profileResult.adjustedConfidence >= 75 ? "text-emerald-300" : profileResult.adjustedConfidence >= 60 ? "text-amber-200" : "text-rose-300";
      document.getElementById("assetProfileName").textContent = profileResult.profile.label;
      document.getElementById("assetProfileBenchmark").textContent = profileResult.benchmarkConfirmation;
      document.getElementById("assetProfileMarket").textContent = profileResult.marketConfirmation;
      document.getElementById("assetProfileAdjusted").textContent = `${profileResult.adjustedConfidence}/100`;
      document.getElementById("assetProfileAdjusted").className = `shrink-0 text-sm font-black ${adjustedTone}`;
      document.getElementById("assetProfileWeights").textContent = profileResult.weightSummary
        ? `${profileResult.weightSummary} (${profileResult.weightAdjustment >= 0 ? "+" : ""}${profileResult.weightAdjustment} confidence)`
        : "Balanced weighting";
      document.getElementById("assetProfileBlockers").textContent = profileResult.blockers.length
        ? profileResult.blockers.join(" / ")
        : `Profile aligned. Ideal conditions: ${profileResult.profile.idealConditions}`;
    }

    function tradeRejectionForSignal(analysis, profileResult, symbol) {
      const data = symbols[symbol] || {};
      const gate = data.price ? getQualityGate(data) : null;
      const reasons = [
        ...(analysis?.rejection?.reasons || [])
      ];

      if (gate?.rr < 2) {
        reasons.push(`Reward/risk is ${gate.rr.toFixed(2)}:1, below the 2:1 minimum.`);
      }
      if (profileResult?.adjustedConfidence < 55 && profileResult.blockers.length) {
        reasons.push("Asset profile adjustment drops confidence below tradeable threshold.");
      }
      if ((profileResult?.blockers.length || 0) >= 3) {
        reasons.push("Multiple asset-profile blockers are stacked against this setup.");
      }
      if (analysis?.marketRegime === "High Volatility" && profileResult?.blockers.some(blocker => blocker.toLowerCase().includes("volatility"))) {
        reasons.push("High-volatility regime is not supportive for this profile.");
      }
      const eventRisk = eventRiskForSymbol(symbol);
      if (eventRisk.riskScore <= 30 || eventRisk.blockers?.length) {
        reasons.push(...(eventRisk.blockers?.length ? eventRisk.blockers : ["High-impact event risk is inside the trade window."]));
      }

      const uniqueReasons = [...new Set(reasons)];
      return {
        rejected: analysis?.verdict === "REJECT" || uniqueReasons.length > 0,
        primaryReason: uniqueReasons[0] || "",
        reasons: uniqueReasons
      };
    }

    function setSignalTicketTradeState(rejection) {
      const paperButton = document.getElementById("paperTradeSignal");
      if (!paperButton) return;
      paperButton.disabled = Boolean(rejection?.rejected);
      paperButton.textContent = rejection?.rejected ? "Rejected" : "Demo Paper Trade";
      paperButton.className = rejection?.rejected
        ? "cursor-not-allowed rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100 opacity-80"
        : "rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950 hover:bg-emerald-300";
    }

    function renderOptionIntelStatus(text, tone = "blue") {
      const status = document.getElementById("optionIntelStatus");
      const toneClass = {
        blue: "border-blue-300/30 text-blue-100",
        emerald: "border-emerald-300/30 text-emerald-100",
        amber: "border-amber-300/30 text-amber-100",
        rose: "border-rose-300/30 text-rose-100"
      }[tone] || "border-blue-300/30 text-blue-100";
      status.textContent = text;
      status.className = `rounded-full border ${toneClass} bg-zinc-950/70 px-2 py-1 text-xs font-black`;
    }

    function regimeTicketTone(regime) {
      const tones = {
        "Trending Bull": { border: "border-emerald-300/30", bg: "bg-emerald-300/10", text: "text-emerald-100", muted: "text-emerald-100/70" },
        "Trending Bear": { border: "border-rose-300/30", bg: "bg-rose-300/10", text: "text-rose-100", muted: "text-rose-100/70" },
        "Range Bound": { border: "border-blue-300/30", bg: "bg-blue-300/10", text: "text-blue-100", muted: "text-blue-100/70" },
        "High Volatility": { border: "border-amber-300/30", bg: "bg-amber-300/10", text: "text-amber-100", muted: "text-amber-100/70" },
        "Low Volatility": { border: "border-cyan-300/30", bg: "bg-cyan-300/10", text: "text-cyan-100", muted: "text-cyan-100/70" }
      };
      return tones[regime] || tones["Range Bound"];
    }

    function topRegimeWeights(weights = {}) {
      return Object.entries(weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([factor, weight]) => `${factor} ${weight}%`)
        .join(" / ");
    }

    function eventRiskForSymbol(symbol = currentSymbol) {
      const events = symbols[symbol]?.enriched?.events;
      return events || {
        riskScore: 82,
        riskLevel: "Low",
        blockers: [],
        events: [],
        provider: "not-loaded"
      };
    }

    function renderEventRiskTicket(eventRisk) {
      const risk = eventRisk || eventRiskForSymbol();
      const level = risk.riskLevel || "Unknown";
      const score = Number.isFinite(risk.riskScore) ? risk.riskScore : 55;
      const tone = level === "High" || score <= 45
        ? { border: "border-rose-300/30", bg: "bg-rose-300/10", text: "text-rose-100", muted: "text-rose-100/70" }
        : level === "Moderate" || score <= 70
          ? { border: "border-amber-300/30", bg: "bg-amber-300/10", text: "text-amber-100", muted: "text-amber-100/70" }
          : { border: "border-emerald-300/30", bg: "bg-emerald-300/10", text: "text-emerald-100", muted: "text-emerald-100/70" };
      const nextEvent = (risk.events || [])[0];
      const detail = risk.blockers?.length
        ? risk.blockers.join(" / ")
        : nextEvent
          ? `${nextEvent.title} in ${nextEvent.hoursUntil}h. Source: ${risk.source || risk.provider || "calendar"}.`
          : `No high-impact event blockers loaded. Source: ${risk.source || risk.provider || "calendar"}.`;
      document.getElementById("optionEventRiskPanel").className = `mt-3 rounded-lg border ${tone.border} ${tone.bg} p-2`;
      document.getElementById("optionEventRiskLevel").textContent = level;
      document.getElementById("optionEventRiskLevel").className = `mt-1 text-sm font-black ${tone.text}`;
      document.getElementById("optionEventRiskScore").textContent = `${score}/100`;
      document.getElementById("optionEventRiskScore").className = `shrink-0 text-sm font-black ${tone.text}`;
      document.getElementById("optionEventRiskDetail").textContent = detail;
      document.getElementById("optionEventRiskDetail").className = `mt-2 text-[11px] leading-relaxed ${tone.muted}`;
    }

    function setOptionDecisionSummary({ action = "AWAIT SIGNAL", why = "Run contract intelligence to generate a decision explanation.", risk = "Risk readout appears with rejection, event, and quality gate context.", tone = "cyan", confidence = 0 } = {}) {
      const panel = document.getElementById("optionDecisionPanel");
      const actionEl = document.getElementById("optionDecisionAction");
      const whyEl = document.getElementById("optionDecisionWhy");
      const riskEl = document.getElementById("optionDecisionRisk");
      const ring = document.getElementById("optionDecisionConfidenceRing");
      if (!panel || !actionEl || !whyEl || !riskEl) return;
      const tones = {
        emerald: { panel: "border-emerald-300/25 bg-emerald-300/10", text: "text-emerald-100" },
        amber: { panel: "border-amber-300/25 bg-amber-300/10", text: "text-amber-100" },
        rose: { panel: "border-rose-300/25 bg-rose-300/10", text: "text-rose-100" },
        cyan: { panel: "border-cyan-300/25 bg-cyan-300/10", text: "text-cyan-100" }
      };
      const selected = tones[tone] || tones.cyan;
      panel.className = `mt-3 rounded-lg border ${selected.panel} p-3`;
      actionEl.textContent = action;
      actionEl.className = `mt-1 text-xl font-black ${selected.text}`;
      whyEl.textContent = why;
      riskEl.textContent = risk;
      if (ring) {
        const normalized = Math.max(0, Math.min(100, Math.round(confidence || 0)));
        ring.style.setProperty("--sp-confidence", `${normalized}%`);
        const inner = ring.querySelector("div");
        if (inner) inner.textContent = normalized ? `${normalized}` : "--";
      }
    }

    function buildSignalEnginePayload(results, context = {}) {
      const symbol = context.symbol || results.meta?.contract?.underlying_ticker || currentSymbol;
      const data = symbols[symbol] || symbols[currentSymbol];
      const gate = getQualityGate(data);
      const premium = getPremiumModel(data);
      const eventRisk = eventRiskForSymbol(symbol);
      const candles = results.candles?.candles || [];
      const latestCandle = candles[candles.length - 1] || {};
      const contract = results.meta?.contract || {};
      const expiration = contract.expiration_date ? new Date(`${contract.expiration_date}T00:00:00Z`) : null;
      const daysToExpiration = expiration
        ? Math.max(0, Math.ceil((expiration.getTime() - Date.now()) / 86400000))
        : null;
      const marketRegime = detectMarketRegime(symbol);
      return {
        market: {
          signalConfidence: data.confidence,
          direction: data.type,
          entryConfirmed: data.entry.status === "READY",
          rewardRisk: gate.rr,
          marketAligned: (marketContext.sectors[data.sector] || "Mixed") === "Aligned",
          breadthAligned: marketContext.breadth.state === "Positive",
          vixSupportive: marketContext.vix.score >= 60,
          marketRegime,
          eventRiskScore: eventRisk.riskScore,
          eventBlockers: eventRisk.blockers || []
        },
        indicators: {
          price: latestCandle.close || data.price,
          sma: latestIndicatorNumber(results.sma),
          ema: latestIndicatorNumber(results.ema),
          macd: latestIndicatorNumber(results.macd, "value"),
          macdSignal: latestIndicatorNumber(results.macd, "signal"),
          macdHistogram: latestIndicatorNumber(results.macd, "histogram"),
          rsi: latestIndicatorNumber(results.rsi)
        },
        contract: {
          spread: premium.spread,
          midpoint: premium.midpoint,
          volume: latestCandle.volume || null,
          openInterest: contract.open_interest || contract.openInterest || null,
          impliedVolatility: data.options.iv,
          daysToExpiration,
          optionsFlowScore: results.trades
            ? 55
            : isPlanBlocked(context.failures, context.planBlocked, "trades")
              ? 55
              : null
        }
      };
    }

    function isPlanBlocked(failures, planBlocked, key) {
      return Boolean(planBlocked?.[key]) || String(failures?.[key] || "").toLowerCase().includes("plan-blocked");
    }

    function renderSignalEngineAnalysis(analysis, context = {}) {
      if (!analysis) {
        document.getElementById("optionIntelVerdict").textContent = "Unavailable";
        document.getElementById("optionIntelHealth").textContent = "Unavailable";
        document.getElementById("optionSignalDirection").textContent = "Awaiting contract scan";
        document.getElementById("optionSignalGrade").textContent = "--";
        document.getElementById("optionSignalGrade").className = "grid h-14 w-14 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-xl font-black text-zinc-200";
        document.getElementById("optionSignalScore").textContent = "--";
        document.getElementById("optionSignalNineSig").textContent = "--";
        document.getElementById("optionSignalPrice").textContent = "--";
        setOptionDecisionSummary();
        document.getElementById("optionSignalRegime").textContent = "--";
        document.getElementById("optionSignalRegimeImpact").textContent = "--";
        document.getElementById("optionSignalRegimeWeights").textContent = "Regime-adjusted weights load with the signal.";
        renderEventRiskTicket({ riskLevel: "--", riskScore: 55, blockers: [], events: [], provider: "not-loaded" });
        renderLightningTicket({
          verdict: "Awaiting Signal",
          inProbability: 0,
          outProbability: 0,
          premiumLocked: premiumTierLabel("lightningStrikeAlerts"),
          summary: "Lightning Strike probabilities load after contract intelligence runs."
        });
        document.getElementById("optionSignalPulseBar").style.width = "0%";
        document.getElementById("optionSignalPulseBar").className = "h-full w-0 rounded-full bg-blue-300 transition-all";
        document.getElementById("optionSignalBlockers").textContent = "No live blockers loaded yet.";
        document.getElementById("optionSignalBreakdown").innerHTML = "";
        setSignalTicketTradeState({ rejected: false });
        return;
      }
      const latestCandle = context.results?.candles?.candles?.at(-1) || {};
      const meta = context.results?.meta?.contract || {};
      const ticketSymbol = meta.underlying_ticker || currentSymbol;
      const ticketData = symbols[ticketSymbol] || symbols[currentSymbol];
      const profileResult = evaluateAssetProfile(ticketSymbol, analysis, { newsKnown: false });
      const eventRisk = eventRiskForSymbol(ticketSymbol);
      const rejection = tradeRejectionForSignal(analysis, profileResult, ticketSymbol);
      const localGate = getQualityGate(ticketData);
      const localRejection = evaluateTradeRejection(ticketData, localGate, ticketSymbol);
      const lightning = evaluateLightningStrike(ticketData, localGate, localRejection, ticketSymbol);
      const displayVerdict = rejection.rejected ? "REJECT" : analysis.verdict;
      const verdictTone = displayVerdict === "STRONG BUY" || displayVerdict === "BUY" || displayVerdict === "A+ SETUP" || displayVerdict === "READY"
        ? "text-emerald-300"
        : displayVerdict === "AVOID" || displayVerdict === "SKIP" || displayVerdict === "REJECT"
          ? "text-rose-300"
          : "text-amber-200";
      const ticketTone = displayVerdict === "STRONG BUY" || displayVerdict === "BUY" || displayVerdict === "A+ SETUP" || displayVerdict === "READY"
        ? {
            border: "border-emerald-300/40",
            grade: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
            bar: "bg-emerald-300",
            health: "text-emerald-300"
          }
        : displayVerdict === "AVOID" || displayVerdict === "SKIP" || displayVerdict === "REJECT"
          ? {
              border: "border-rose-300/40",
              grade: "border-rose-300/35 bg-rose-300/10 text-rose-100",
              bar: "bg-rose-300",
              health: "text-rose-300"
            }
          : {
              border: "border-amber-300/40",
              grade: "border-amber-300/35 bg-amber-300/10 text-amber-100",
              bar: "bg-amber-300",
              health: "text-amber-200"
            };
      const direction = meta.contract_type
        ? `${String(meta.contract_type).toUpperCase()} ${meta.underlying_ticker || ""} ${meta.expiration_date || ""}`.trim()
        : "Live options signal";
      const blockerList = rejection.rejected
        ? rejection.reasons
        : analysis.blockers || [];
      const blockers = blockerList.length
        ? blockerList.join(" / ")
        : "No blockers from the signal engine.";
      const confidence = analysis.confidence ?? analysis.score ?? 0;
      const regime = analysis.marketRegime || detectMarketRegime(ticketSymbol);
      const regimeImpact = Number(analysis.regimeAdjustment) || 0;
      const regimeTone = regimeTicketTone(regime);
      const regimeImpactText = `${regimeImpact >= 0 ? "+" : ""}${regimeImpact} pts`;
      const regimeWeights = topRegimeWeights(analysis.regimeWeights);
      const primaryReason = rejection.rejected
        ? rejection.mainReason
        : analysis.blockers?.length
          ? analysis.blockers[0]
          : confidence >= 78
            ? `${analysis.nineSig}/9 signals aligned with ${regime} context.`
            : `${analysis.nineSig}/9 signals aligned, but confirmation is still mixed.`;
      const eventBlocker = eventRisk.blockers?.[0];
      const riskReason = rejection.rejected
        ? rejection.reasons[0] || rejection.mainReason
        : eventBlocker || localRejection.mainReason || `${localGate.verdict} gate with ${localGate.rr.toFixed(2)}:1 reward/risk.`;
      const decisionAction = rejection.rejected
        ? "REJECT"
        : confidence >= 82 && lightning.inProbability >= 82 && localGate.verdict !== "FAIL"
          ? "CONFIRM PAPER ONLY"
          : confidence >= 68 || lightning.inProbability >= 68
            ? "WAIT FOR TRIGGER"
            : "STUDY / AVOID CHASE";
      const decisionTone = decisionAction === "CONFIRM PAPER ONLY"
        ? "emerald"
        : decisionAction === "REJECT" ? "rose" : "amber";
      document.getElementById("optionIntelVerdict").textContent = `${displayVerdict} ${confidence}/100 ${analysis.grade}`;
      document.getElementById("optionIntelVerdict").className = `mt-1 text-xs font-black ${verdictTone}`;
      document.getElementById("optionSignalTicket").className = `mt-3 rounded-lg border ${ticketTone.border} bg-zinc-950/90 p-3`;
      document.getElementById("optionSignalDirection").textContent = direction;
      document.getElementById("optionSignalGrade").textContent = analysis.grade || "--";
      document.getElementById("optionSignalGrade").className = `grid h-14 w-14 place-items-center rounded-lg border ${ticketTone.grade} text-xl font-black`;
      document.getElementById("optionSignalScore").textContent = `${confidence}/100`;
      document.getElementById("optionSignalNineSig").textContent = `${analysis.nineSig}/9`;
      document.getElementById("optionSignalPrice").textContent = Number.isFinite(latestCandle.close) ? `$${latestCandle.close.toFixed(2)}` : "--";
      document.getElementById("optionSignalPulseBar").style.width = `${Math.max(0, Math.min(100, confidence))}%`;
      document.getElementById("optionSignalPulseBar").className = `h-full rounded-full ${ticketTone.bar} transition-all`;
      setOptionDecisionSummary({
        action: decisionAction,
        why: primaryReason,
        risk: riskReason,
        tone: decisionTone,
        confidence
      });
      document.getElementById("optionSignalRegimePanel").className = `mt-3 rounded-lg border ${regimeTone.border} ${regimeTone.bg} p-2`;
      document.getElementById("optionSignalRegime").textContent = regime;
      document.getElementById("optionSignalRegime").className = `mt-1 text-sm font-black ${regimeTone.text}`;
      document.getElementById("optionSignalRegimeImpact").textContent = regimeImpactText;
      document.getElementById("optionSignalRegimeImpact").className = `shrink-0 text-sm font-black ${regimeImpact > 0 ? "text-emerald-300" : regimeImpact < 0 ? "text-rose-300" : "text-zinc-200"}`;
      document.getElementById("optionSignalRegimeWeights").textContent = regimeWeights
        ? `Confidence ${analysis.baseConfidence ?? confidence}/100 -> ${confidence}/100. Emphasis: ${regimeWeights}.`
        : `Confidence adjusted for ${regime}.`;
      document.getElementById("optionSignalRegimeWeights").className = `mt-2 text-[11px] leading-relaxed ${regimeTone.muted}`;
      document.getElementById("optionIntelHealth").textContent = rejection.rejected
        ? `Trade Rejection Engine / ${rejection.reasons.length} hard stops${context.cached ? " / cached" : ""}`
        : `${analysis.nineSig}/9 Sig / ${analysis.blockers?.length || 0} blockers${context.cached ? " / cached" : ""}`;
      document.getElementById("optionIntelHealth").className = `mt-2 text-xs font-black ${rejection.rejected ? "text-rose-300" : analysis.blockers?.length ? "text-amber-200" : ticketTone.health}`;
      document.getElementById("optionSignalBlockers").textContent = blockers;
      renderAssetProfileTicket(profileResult);
      renderEventRiskTicket(eventRisk);
      renderLightningTicket(lightning);
      setSignalTicketTradeState(rejection);
      document.getElementById("optionSignalBreakdown").innerHTML = (analysis.scoreBreakdown || []).map(item => {
        const tone = item.rawScore >= 85 ? "text-emerald-200" : item.rawScore >= 70 ? "text-cyan-200" : item.rawScore >= 55 ? "text-amber-200" : "text-rose-200";
        return `
          <div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black text-zinc-300">${escapeHtml(item.factor)}</span>
              <span class="font-black ${tone}">${item.rawScore}/100</span>
            </div>
            <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span>${item.weight}% weight / +${item.weightedScore}</span>
              <span>${escapeHtml(item.status || "")}</span>
            </div>
            <p class="mt-1 text-[11px] leading-relaxed text-zinc-400">${escapeHtml(item.detail || "")}</p>
          </div>
        `;
      }).join("");
    }

    async function refreshOptionIntelligence() {
      let contract;
      try {
        contract = cleanOptionIntelContract();
      } catch (error) {
        renderOptionIntelStatus("Invalid", "rose");
        document.getElementById("optionIntelDetails").textContent = error.message;
        return;
      }

      renderOptionIntelStatus("Loading", "blue");
      document.getElementById("optionIntelDetails").textContent = "Checking live contract metadata, candles, indicators, trade tape, and signal grade...";
      const query = encodeURIComponent(contract);
      let liveSignal;
      try {
        liveSignal = await apiFetch(`/api/signal/live-options?contract=${query}`);
      } catch (error) {
        renderOptionIntelStatus("Blocked", "rose");
        document.getElementById("optionIntelDetails").textContent = `Live options signal unavailable: ${error.message}`;
        renderSignalEngineAnalysis(null);
        return;
      }
      const feeds = liveSignal.feeds || {};
      const results = {
        meta: feeds.contract,
        candles: feeds.candles,
        sma: feeds.sma,
        ema: feeds.ema,
        macd: feeds.macd,
        rsi: feeds.rsi,
        trades: feeds.trades
      };
      const failures = liveSignal.failures || {};
      const planBlocked = liveSignal.planBlocked || {};
      const underlyingSymbol = results.meta?.contract?.underlying_ticker || currentSymbol;
      if (!symbols[underlyingSymbol]?.enriched?.events && symbols[underlyingSymbol]) {
        try {
          const events = await dataAdapter.getEvents(underlyingSymbol);
          symbols[underlyingSymbol].enriched = { ...(symbols[underlyingSymbol].enriched || {}), events };
        } catch (error) {}
      }
      try {
        const regimeAdjusted = await apiFetch("/api/signal/analyze", {
          method: "POST",
          body: JSON.stringify(buildSignalEnginePayload(results, { failures, planBlocked, symbol: underlyingSymbol }))
        });
        liveSignal.analysis = regimeAdjusted.analysis || regimeAdjusted;
      } catch (error) {
        failures.engine = `Regime-adjusted scoring unavailable: ${error.message}`;
      }
      latestOptionSignal = liveSignal;
      const latestLivePremium = results.candles?.candles?.at(-1)?.close;
      if (Number.isFinite(latestLivePremium)) {
        practiceAccount.positions.forEach(position => {
          if (position.optionTicker === liveSignal.contract) {
            position.lastPremium = latestLivePremium;
          }
        });
        savePracticeAccount();
        renderPracticeAccount();
      }

      const meta = results.meta?.contract;
      document.getElementById("optionIntelMeta").textContent = meta
        ? `${meta.underlying_ticker || "--"} ${meta.contract_type || "--"} ${meta.strike_price || "--"} ${meta.expiration_date || ""}`
        : "Unavailable";
      document.getElementById("optionIntelCandles").textContent = results.candles?.candles?.length
        ? `${results.candles.candles.length} bars`
        : "Unavailable";
      document.getElementById("optionIntelIndicators").textContent = [
        `SMA ${latestIndicatorValue(results.sma)}`,
        `EMA ${latestIndicatorValue(results.ema)}`,
        `RSI ${latestIndicatorValue(results.rsi)}`,
        `MACD ${latestIndicatorValue(results.macd, "value")}`
      ].join(" / ");
      document.getElementById("optionIntelTrades").textContent = results.trades
        ? `${results.trades.trades.length} prints`
        : isPlanBlocked(failures, planBlocked, "trades") ? "Plan blocked" : "Unavailable";

      const engineAnalysis = liveSignal.analysis;
      renderSignalEngineAnalysis(engineAnalysis, { results, cached: liveSignal.cached });

      const available = Object.values(results).filter(Boolean).length;
      renderOptionIntelStatus(available >= 5 ? "Live" : "Partial", available >= 5 ? "emerald" : "amber");
      const blocked = Object.entries(failures).map(([key, message]) => {
        if (isPlanBlocked(failures, planBlocked, key)) {
          return `${key.toUpperCase()}: provider plan blocked; signal continues without this feed`;
        }
        return `${key.toUpperCase()}: ${message}`;
      }).join(" | ");
      const engineSummary = engineAnalysis
        ? ` Engine: ${engineAnalysis.verdict} (${engineAnalysis.confidence ?? engineAnalysis.score}/100 confidence, ${engineAnalysis.nineSig}/9 Sig).`
        : "";
      const engineBlockers = engineAnalysis?.blockers?.length
        ? ` Blockers: ${engineAnalysis.blockers.join(" ")}`
        : "";
      document.getElementById("optionIntelDetails").textContent = blocked
        ? `Loaded ${available}/7 feeds${liveSignal.cached ? " from cache" : ""}.${engineSummary}${engineBlockers} ${blocked}`
        : `Loaded ${available}/7 feeds from Polygon/Massive${liveSignal.cached ? " cache" : ""}.${engineSummary}${engineBlockers} Contract intelligence is available.`;
    }

    async function searchReferenceTickers() {
      const symbol = currentSymbol || "NVDA";
      renderOptionIntelStatus("Searching", "blue");
      try {
        const result = await apiFetch(`/api/reference/tickers?market=stocks&search=${encodeURIComponent(symbol)}&limit=5`);
        const tickers = result.tickers.map(item => `${item.ticker}: ${item.name || item.market || "supported"}`).join(" | ");
        document.getElementById("optionIntelDetails").textContent = tickers || "No supported tickers returned.";
        renderOptionIntelStatus("Ticker Ref", "emerald");
      } catch (error) {
        document.getElementById("optionIntelDetails").textContent = `Ticker reference unavailable: ${error.message}`;
        renderOptionIntelStatus("Blocked", "amber");
      }
    }

    function getQualityGate(data) {
      const expiry = document.getElementById("expiryChoice").value;
      const moneyness = document.getElementById("moneynessChoice").value;
      const sectorState = marketContext.sectors[data.sector] || "Mixed";
      const stopDistance = data.price * data.stopPct;
      const reward = Math.abs(data.target - data.price);
      const rr = reward / stopDistance;
      const reasons = [];
      let score = 0;

      if (data.confidence >= 85) score += 25;
      else if (data.confidence >= 75) score += 18;
      else reasons.push("Signal confidence is not elite.");

      if (data.entry.status === "READY") score += 25;
      else if (data.entry.status === "CONFIRM") {
        score += 14;
        reasons.push("Entry still needs confirmation.");
      } else {
        score += 8;
        reasons.push("Entry timing says wait.");
      }

      if (data.options.liquidity === "Elite") score += 22;
      else if (data.options.liquidity === "Decent") score += 15;
      else if (data.options.liquidity === "Selective") {
        score += 9;
        reasons.push("Options chain is selective; use stricter limits.");
      } else {
        reasons.push("Options chain is too thin.");
      }

      if (rr >= 2) score += 18;
      else reasons.push("Reward/risk is below the 2:1 minimum.");

      if (sectorState === "Aligned") score += 10;
      else if (sectorState === "Mixed") {
        score += 4;
        reasons.push("Market context is mixed for this ticker.");
      } else {
        score -= 10;
        reasons.push("Ticker is fighting the broader tape.");
      }

      if (marketContext.vix.score < 55) reasons.push("Volatility regime is hostile for clean entries.");

      const nineSig = getNineSig(data);
      if (nineSig.score >= 7) score += 8;
      else if (nineSig.score <= 4) {
        score -= 8;
        reasons.push("9-Sig confluence is weak.");
      }

      if (expiry === "0dte") reasons.push("0DTE adds extreme theta and gamma risk.");
      if (moneyness === "otm") reasons.push("Slight OTM needs faster movement to pay.");
      if (data.options.iv >= 70) reasons.push("IV is elevated; premium may punish late entries.");

      const hardReject = data.options.liquidity === "Thin" || rr < 2 || sectorState === "Fighting";
      let verdict = "WAIT";
      let tone = "amber";
      let icon = "fa-triangle-exclamation";
      let summary = "Setup has promise, but one or more gates still need confirmation.";

      if (hardReject) {
        verdict = "REJECT";
        tone = "rose";
        icon = "fa-circle-xmark";
        summary = "Trade rejected by discipline rules. Do not trade until the hard stop clears.";
      } else if (score >= 82 && data.entry.status === "READY" && expiry !== "0dte" && moneyness !== "otm") {
        verdict = "A+ SETUP";
        tone = "emerald";
        icon = "fa-circle-check";
        summary = "Signal, entry timing, contract quality, and reward/risk are aligned.";
      } else if (score >= 68 && data.entry.status !== "WAIT") {
        verdict = "READY";
        tone = "cyan";
        icon = "fa-circle-play";
        summary = "Trade is workable if the trigger confirms and contract spread stays controlled.";
      }

      return { verdict, tone, icon, summary, score, rr, reasons };
    }

    function getTraderDisciplineSnapshot() {
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const wins = closed.filter(trade => Number(trade.pnl) > 0).length;
      const winRate = closed.length ? wins / closed.length : null;
      const journalCoverage = closed.length ? Math.min(1, journalEntries.length / closed.length) : (journalEntries.length ? 1 : .55);
      const recentLosses = closed.slice(-8).filter(trade => Number(trade.pnl) < 0).length;
      let score = 64;
      if (winRate !== null) score += Math.round((winRate - .5) * 34);
      score += Math.round((journalCoverage - .55) * 24);
      score -= Math.max(0, recentLosses - 3) * 7;
      score = Math.max(20, Math.min(96, score));
      const label = score >= 78 ? "Disciplined" : score >= 58 ? "Developing" : "Needs discipline";
      const reason = journalCoverage < .5
        ? "Journal coverage is light; document the plan before sizing up."
        : recentLosses >= 5
          ? "Recent paper trade losses suggest reduced size and stricter confirmation."
          : "Discipline history is acceptable for paper-trade decision support.";
      return { score, label, reason, closedCount: closed.length, journalCoverage };
    }

    function clampPilotScore(value) {
      return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    }

    function pilotRecentClosedTrades(limit = 8) {
      return practiceAccount.history
        .filter(trade => trade.action === "CLOSE")
        .slice(-limit);
    }

    function pilotConsecutiveLosses(closedTrades) {
      let count = 0;
      for (let index = closedTrades.length - 1; index >= 0; index -= 1) {
        if (Number(closedTrades[index].pnl) < 0) count += 1;
        else break;
      }
      return count;
    }

    function pilotTagCount(tags, matcher) {
      return tags.filter(tag => matcher.test(String(tag))).length;
    }

    function buildPilotStatus() {
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const recentClosed = pilotRecentClosedTrades(10);
      const todaysBuys = practiceAccount.history.filter(trade => trade.action === "BUY" && isTodayTrade(trade));
      const todaysCloses = practiceAccount.history.filter(trade => trade.action === "CLOSE" && isTodayTrade(trade));
      const journaledOutcomes = journalEntries.filter(entry => ["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome));
      const todaysJournals = journalEntries.filter(entry => !entry.date || entry.date === todayKey());
      const allTags = journalEntries.flatMap(entry => entry.tags || []);
      const ruleBreakTags = pilotTagCount(allTags, /Chased|Oversized|Ignored Stop|No Confirmation|Bad Contract|Held Too Long/i);
      const ignoredStopTags = pilotTagCount(allTags, /Ignored Stop/i);
      const oversizedTags = pilotTagCount(allTags, /Oversized/i);
      const chasedTags = pilotTagCount(allTags, /Chased/i);
      const noConfirmationTags = pilotTagCount(allTags, /No Confirmation/i);
      const skippedOrWaited = journalEntries.filter(entry => /Skipped|Wait|Reject/i.test(`${entry.outcome || ""} ${(entry.tags || []).join(" ")}`)).length;
      const emotionHits = journalEntries.filter(entry => /revenge|frustrat|fomo|angry|tilt|bored|impatient|forced|scared|panic|emotional/i.test(entry.note || "")).length;
      const consecutiveLosses = pilotConsecutiveLosses(closed);
      const weakGrades = recentClosed.filter(trade => /C|D|F/i.test(String(trade.grade || trade.plan?.grade || ""))).length;
      const journalCoverage = closed.length ? Math.min(1, journaledOutcomes.length / closed.length) : (journalEntries.length ? 1 : .55);
      const unjournaledToday = Math.max(0, todaysCloses.length - todaysJournals.length);
      const replayStudyCredit = Math.min(10, (typeof signalReplayItems === "function" ? signalReplayItems().length : 0) * 2);

      const discipline = clampPilotScore(72 + (journalCoverage - .55) * 28 - unjournaledToday * 12 - ruleBreakTags * 3 - Math.max(0, consecutiveLosses - 1) * 7 + replayStudyCredit);
      const patience = clampPilotScore(74 - Math.max(0, todaysBuys.length - 2) * 12 - chasedTags * 5 - noConfirmationTags * 4 + Math.min(12, skippedOrWaited * 4));
      const ruleAdherence = clampPilotScore(78 - ignoredStopTags * 14 - oversizedTags * 10 - chasedTags * 8 - noConfirmationTags * 8 - weakGrades * 4 + journalCoverage * 8);
      const overtradingRisk = clampPilotScore(18 + Math.max(0, todaysBuys.length - 2) * 16 + Math.max(0, consecutiveLosses - 1) * 12 + unjournaledToday * 10 + chasedTags * 4 - Math.min(12, skippedOrWaited * 3));
      const emotionalRisk = clampPilotScore(12 + emotionHits * 12 + Math.max(0, consecutiveLosses - 1) * 10 + chasedTags * 4 - replayStudyCredit);
      const readinessScore = clampPilotScore((discipline * .3) + (patience * .24) + (ruleAdherence * .26) + ((100 - overtradingRisk) * .1) + ((100 - emotionalRisk) * .1));

      const status = readinessScore >= 85 ? "Mission Ready" : readinessScore >= 70 ? "Selective" : readinessScore >= 55 ? "Caution" : "Grounded";
      const blockers = [];
      if (unjournaledToday) blockers.push(`${unjournaledToday} paper outcome needs a journal note`);
      if (todaysBuys.length > 2) blockers.push("Possible overtrading: slow down before adding risk");
      if (consecutiveLosses >= 2) blockers.push("Loss streak detected: review before the next entry");
      if (ruleBreakTags >= 3) blockers.push("Rule-break tags are repeating");
      if (emotionHits) blockers.push("Emotional language appeared in recent notes");
      if (!blockers.length) blockers.push("No major trader-risk blocker detected");

      const recommendations = [];
      if (status === "Grounded") recommendations.push("Grounded: journal and replay before any new paper risk.");
      else if (status === "Caution") recommendations.push("Caution: only A-quality paper setups with a written invalidation.");
      else if (status === "Selective") recommendations.push("Selective: require Lightning confirmation and normal paper size.");
      else recommendations.push("Mission Ready: paper execution is allowed only after stop, target, and journal plan are clear.");
      if (unjournaledToday) recommendations.push("Log the last paper outcome before another decision.");
      if (todaysBuys.length > 2) recommendations.push("Throttle new entries unless the setup is exceptional.");
      if (consecutiveLosses >= 2) recommendations.push("Replay the last losing setup before accepting another signal.");

      const strengths = [];
      if (discipline >= 78) strengths.push("Discipline stable");
      if (patience >= 78) strengths.push("Patience stable");
      if (ruleAdherence >= 78) strengths.push("Rules intact");
      if (overtradingRisk <= 30) strengths.push("Overtrading low");
      if (emotionalRisk <= 30) strengths.push("Emotion low");
      if (!strengths.length) strengths.push("Training mode active");

      return {
        status,
        readinessScore,
        discipline,
        patience,
        ruleAdherence,
        overtradingRisk,
        emotionalRisk,
        journalCoverage,
        todaysBuys: todaysBuys.length,
        todaysCloses: todaysCloses.length,
        unjournaledToday,
        consecutiveLosses,
        blockers: blockers.slice(0, 4),
        recommendations: recommendations.slice(0, 4),
        strengths: strengths.slice(0, 3)
      };
    }

    function pilotStatusTone(status) {
      if (status === "Mission Ready") return "emerald";
      if (status === "Selective") return "cyan";
      if (status === "Caution") return "amber";
      return "rose";
    }

    function pilotStatusPill(label, value, tone = "cyan") {
      const toneClass = tone === "emerald"
        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
        : tone === "rose"
          ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
          : tone === "amber"
            ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
            : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
      const text = label ? `${label} ${value}` : String(value);
      return `<span class="rounded-full border px-2 py-1 text-[11px] font-black ${toneClass}">${escapeHtml(text)}</span>`;
    }

    function pilotWhyPills(pilot) {
      const whyItems = pilot.blockers[0] === "No major trader-risk blocker detected" ? pilot.strengths : pilot.blockers;
      return whyItems.slice(0, 3).map(item => pilotStatusPill("", item, pilot.blockers[0] === "No major trader-risk blocker detected" ? "emerald" : pilotStatusTone(pilot.status))).join("");
    }

    function renderPilotStatus() {
      const pilot = buildPilotStatus();
      const tone = pilotStatusTone(pilot.status);
      const toneText = tone === "emerald" ? "text-emerald-100" : tone === "rose" ? "text-rose-100" : tone === "amber" ? "text-amber-100" : "text-cyan-100";
      const setText = (id, value) => {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
      };
      setText("missionPilotStatus", `${pilot.status} · ${pilot.readinessScore}/100`);
      setText("missionPilotRule", pilot.recommendations[0]);
      setText("missionPilotDiscipline", `${pilot.discipline}/100`);
      setText("missionPilotPatience", `${pilot.patience}/100`);
      setText("missionPilotOvertrading", `${pilot.overtradingRisk}/100`);
      const missionStatus = document.getElementById("missionPilotStatus");
      if (missionStatus) missionStatus.className = `mt-1 text-xl font-black ${toneText}`;
      const missionWhy = document.getElementById("missionPilotWhy");
      if (missionWhy) missionWhy.innerHTML = pilotWhyPills(pilot);

      setText("eagleScoutPilotStatus", `${pilot.status} · Readiness ${pilot.readinessScore}/100`);
      setText("eagleScoutPilotRecommendation", pilot.recommendations[0]);
      const eagleStatus = document.getElementById("eagleScoutPilotStatus");
      if (eagleStatus) eagleStatus.className = `mt-1 text-lg font-black ${toneText}`;
      const eagleWhy = document.getElementById("eagleScoutPilotWhy");
      if (eagleWhy) eagleWhy.innerHTML = pilotWhyPills(pilot);
      const factors = document.getElementById("eagleScoutPilotFactors");
      if (factors) {
        factors.innerHTML = [
          pilotStatusPill("Discipline", `${pilot.discipline}/100`, pilot.discipline >= 75 ? "emerald" : pilot.discipline >= 55 ? "amber" : "rose"),
          pilotStatusPill("Patience", `${pilot.patience}/100`, pilot.patience >= 75 ? "emerald" : pilot.patience >= 55 ? "amber" : "rose"),
          pilotStatusPill("Rules", `${pilot.ruleAdherence}/100`, pilot.ruleAdherence >= 75 ? "emerald" : pilot.ruleAdherence >= 55 ? "amber" : "rose"),
          pilotStatusPill("Emotion", `${pilot.emotionalRisk}/100 risk`, pilot.emotionalRisk <= 35 ? "emerald" : pilot.emotionalRisk <= 60 ? "amber" : "rose")
        ].join("");
      }
      setText("journalPilotReminder", pilot.unjournaledToday
        ? `${pilot.unjournaledToday} paper outcome still needs a journal note. Capture entry reason, invalidation, emotion, and lesson before the next decision.`
        : `${pilot.status}: ${pilot.recommendations[0]}`
      );
      if (activeSignalContext?.signalId) {
        updateActiveSignalContext({
          signalId: activeSignalContext.signalId,
          symbol: activeSignalContext.symbol || currentSymbol,
          source: "pilot-status",
          learning: {
            pilotStatus: pilot.status,
            pilotReadinessScore: pilot.readinessScore,
            pilotDiscipline: pilot.discipline,
            pilotPatience: pilot.patience,
            pilotRuleAdherence: pilot.ruleAdherence,
            pilotBlockers: pilot.blockers,
            pilotRecommendation: pilot.recommendations[0]
          }
        }, "pilotStatus");
      }
      return pilot;
    }

    function spreadValue(data) {
      return Number(String(data.options.spread || "").replace(/[^0-9.]/g, "")) || 0;
    }

    function evaluateTradeRejection(data, gate = getQualityGate(data), symbol = currentSymbol) {
      const expiry = document.getElementById("expiryChoice").value;
      const moneyness = document.getElementById("moneynessChoice").value;
      const sectorState = marketContext.sectors[data.sector] || "Mixed";
      const regime = detectMarketRegime(symbol);
      const nineSig = getNineSig(data);
      const discipline = getTraderDisciplineSnapshot();
      const spread = spreadValue(data);
      const spreadLimit = data.options.liquidity === "Elite" ? .12 : data.options.liquidity === "Decent" ? .18 : data.options.liquidity === "Selective" ? .25 : .08;
      const blockers = [];
      const improvements = [];
      let score = 100;

      const addBlocker = (reason, improvement, penalty, hard = false) => {
        blockers.push({ reason, hard });
        improvements.push(improvement);
        score -= penalty;
      };

      if (gate.rr < 2) addBlocker("Reward/risk is below the required 2:1 floor.", "Move entry closer to support/resistance or widen target only if the chart supports it.", 34, true);
      if (data.options.liquidity === "Thin") addBlocker("Options liquidity is too thin for clean fills.", "Use shares, choose a more liquid ticker, or wait for volume/open interest to improve.", 30, true);
      if (spread > spreadLimit) addBlocker(`Bid/ask spread is too wide at ${data.options.spread}.`, `Wait for spread under $${spreadLimit.toFixed(2)} or use strict limit orders.`, 16, data.options.liquidity === "Thin");
      if (sectorState === "Fighting") addBlocker("Ticker is fighting the broader market/sector tape.", "Wait for sector confirmation or choose a cleaner relative-strength setup.", 24, true);
      if (data.entry.status === "WAIT") addBlocker("Entry trigger has not confirmed yet.", "Wait for the planned trigger instead of front-running the move.", 18, false);
      if (data.confidence < 68) addBlocker("Signal confidence is below tradeable quality.", "Wait for trend, momentum, and volume to align.", 16, false);
      if (marketContext.vix.score < 55 || regime === "High Volatility") addBlocker("Volatility regime is hostile for clean entries.", "Reduce size or wait for VIX/volatility pressure to calm.", 14, false);
      if (nineSig.score <= 4) addBlocker("9-Sig confluence is weak.", "Wait for more confluence across signal, entry, contract, tape, breadth, and VIX.", 18, false);
      if (data.options.iv >= 70) addBlocker("IV is elevated; premium can punish late entries.", "Avoid chasing premium or wait for IV/event risk to cool.", 14, false);
      if (expiry === "0dte") addBlocker("0DTE contract selection adds extreme gamma/theta risk.", "Use a longer expiry while testing discipline.", 12, false);
      if (moneyness === "otm") addBlocker("OTM selection needs a faster move to pay.", "Prefer ATM/ITM until the setup has exceptional momentum.", 8, false);
      if (discipline.score < 50) addBlocker("Trader discipline score is too low for aggressive entries.", discipline.reason, 12, false);

      score = Math.max(0, Math.min(100, Math.round(score)));
      const hardRejected = blockers.some(item => item.hard);
      const verdict = hardRejected || score < 58 ? "REJECT" : score < 78 ? "WAIT" : "APPROVED";
      const tone = verdict === "APPROVED" ? "emerald" : verdict === "WAIT" ? "amber" : "rose";
      const mainReason = blockers[0]?.reason || "No rejection rules triggered. Trade still requires normal risk management.";
      const confidenceImpact = Math.round(score - (data.confidence || 0));
      const uniqueImprovements = [...new Set(improvements)].slice(0, 5);
      const visibleBlockers = blockers.map(item => item.reason).slice(0, 6);

      return {
        verdict,
        tone,
        score,
        hardRejected,
        mainReason,
        blockers: visibleBlockers,
        improvements: uniqueImprovements,
        confidenceImpact,
        discipline,
        suggestedAction: verdict === "APPROVED"
          ? "Confirm trigger, size correctly, then paper trade."
          : verdict === "WAIT"
            ? "Wait for the blocker list to clear."
            : "Reject this trade until hard blockers clear."
      };
    }

    function getMarketOdds(data) {
      const sectorState = marketContext.sectors[data.sector] || "Mixed";
      let bull = 50;
      bull += marketContext.spy.trend === "Bullish" ? 11 : marketContext.spy.trend === "Bearish" ? -11 : 0;
      bull += marketContext.qqq.trend === "Bullish" ? 13 : marketContext.qqq.trend === "Bearish" ? -13 : 0;
      bull += marketContext.vix.state === "Calm" ? 8 : marketContext.vix.state === "Elevated" ? -10 : 0;
      bull += marketContext.breadth.state === "Positive" ? 9 : marketContext.breadth.state === "Negative" ? -9 : 0;
      bull += sectorState === "Aligned" ? 6 : sectorState === "Fighting" ? -8 : 0;
      bull += data.type === "Bullish" ? 4 : -4;
      bull = Math.max(8, Math.min(92, Math.round(bull)));
      return { bull, bear: 100 - bull, label: bull >= 62 ? "Bullish Bias" : bull <= 38 ? "Bearish Bias" : "Mixed" };
    }

    function renderMarketWeather(symbol = currentSymbol) {
      const weather = getMarketWeather(symbol);
      const tone = marketWeatherTone(weather.label);
      const panel = document.getElementById("marketWeatherPanel");
      if (!panel) return weather;
      panel.className = `mt-3 rounded-lg border ${tone.section} p-4`;
      document.getElementById("marketWeatherLabel").textContent = `${weather.icon} ${weather.label}`;
      document.getElementById("marketWeatherLabel").className = `mt-1 text-2xl font-black ${tone.text}`;
      document.getElementById("marketWeatherSummary").textContent = weather.summary;
      document.getElementById("marketWeatherScore").textContent = `${weather.score}/100`;
      document.getElementById("marketWeatherScore").className = `mt-1 text-sm font-black ${tone.text}`;
      document.getElementById("marketWeatherTrend").textContent = `${weather.trendScore}/100`;
      document.getElementById("marketWeatherVol").textContent = `${weather.volatilityScore}/100`;
      document.getElementById("marketWeatherBreadth").textContent = `${weather.breadthScore}/100`;
      return weather;
    }

    function renderLightningTicket(lightning) {
      const result = lightning || evaluateLightningStrike(symbols[currentSymbol], getQualityGate(symbols[currentSymbol]), evaluateTradeRejection(symbols[currentSymbol]), currentSymbol);
      if (canReuseActiveSignalContext(currentSymbol)) {
        updateActiveSignalContext({
          signalId: activeSignalContext.signalId,
          symbol: currentSymbol,
          source: "lightning-strike",
          lightning: result,
          learning: {
            lightningStatus: result.verdict,
            lightningSummary: result.summary
          }
        }, "lightningStrike");
      }
      const armedIn = result.verdict.includes("Strike In");
      const armedOut = result.verdict.includes("Strike Out");
      const brewing = result.verdict.includes("Brewing");
      const tone = armedIn
        ? { border: "border-emerald-300/30", bg: "bg-emerald-300/10", text: "text-emerald-100", muted: "text-emerald-100/70" }
        : armedOut
          ? { border: "border-rose-300/30", bg: "bg-rose-300/10", text: "text-rose-100", muted: "text-rose-100/70" }
          : brewing
            ? { border: "border-cyan-300/30", bg: "bg-cyan-300/10", text: "text-cyan-100", muted: "text-cyan-100/70" }
            : { border: "border-amber-300/30", bg: "bg-amber-300/10", text: "text-amber-100", muted: "text-amber-100/70" };
      document.getElementById("optionLightningPanel").className = `mt-3 rounded-lg border ${tone.border} ${tone.bg} p-3`;
      document.getElementById("optionLightningVerdict").textContent = result.verdict;
      document.getElementById("optionLightningVerdict").className = `mt-1 text-sm font-black ${tone.text}`;
      document.getElementById("optionLightningTier").textContent = result.premiumLocked;
      document.getElementById("optionLightningIn").textContent = `${result.inProbability}%`;
      document.getElementById("optionLightningIn").className = `mt-1 text-sm font-black ${result.inProbability >= 82 ? "text-emerald-200" : result.inProbability >= 68 ? "text-amber-100" : "text-zinc-200"}`;
      document.getElementById("optionLightningOut").textContent = `${result.outProbability}%`;
      document.getElementById("optionLightningOut").className = `mt-1 text-sm font-black ${result.outProbability >= 66 ? "text-rose-200" : result.outProbability >= 58 ? "text-amber-100" : "text-zinc-200"}`;
      document.getElementById("optionLightningSummary").textContent = result.summary;
      document.getElementById("optionLightningSummary").className = `mt-2 text-[11px] leading-relaxed ${tone.muted}`;
      renderProofTrustChips("lightningTrustChips");
      const factorTarget = document.getElementById("optionLightningFactors");
      const blockerTarget = document.getElementById("optionLightningBlockers");
      const profile = result.confirmationProfile || { confirmations: [], blockers: [] };
      if (factorTarget) {
        factorTarget.innerHTML = profile.confirmations.slice(0, 8).map(item => `
          <span class="rounded-full border px-2 py-1 text-[10px] font-black ${item.pass ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-zinc-700 bg-zinc-950/70 text-zinc-400"}">
            ${item.pass ? "✓" : "·"} ${escapeHtml(item.label)}
          </span>
        `).join("");
      }
      if (blockerTarget) {
        blockerTarget.innerHTML = profile.blockers.length
          ? profile.blockers.slice(0, 4).map(item => `<span class="rounded-full border border-rose-300/25 bg-rose-300/10 px-2 py-1 text-[10px] font-black text-rose-100">Blocker: ${escapeHtml(item)}</span>`).join("")
          : `<span class="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-100">All core confirmations aligned</span>`;
      }
    }

    function getNineSig(data) {
      const sectorState = marketContext.sectors[data.sector] || "Mixed";
      const stopDistance = data.price * data.stopPct;
      const rr = Math.abs(data.target - data.price) / stopDistance;
      const checks = [
        { label: "Signal", pass: data.confidence >= 80 },
        { label: "Entry", pass: data.entry.status === "READY" },
        { label: "Contract", pass: data.options.liquidity === "Elite" || data.options.liquidity === "Decent" },
        { label: "Spread", pass: !["Thin", "Selective"].includes(data.options.liquidity) },
        { label: "R/R", pass: rr >= 1.8 },
        { label: "IV", pass: data.options.iv < 65 },
        { label: "Tape", pass: sectorState === "Aligned" },
        { label: "Breadth", pass: marketContext.breadth.score >= 60 },
        { label: "VIX", pass: marketContext.vix.score >= 60 }
      ];
      return { score: checks.filter(check => check.pass).length, checks };
    }

    function renderMarketContext(data) {
      const sectorState = marketContext.sectors[data.sector] || "Mixed";
      const tapeScore = Math.round((marketContext.spy.score + marketContext.qqq.score + marketContext.vix.score + marketContext.breadth.score) / 4);
      const regime = detectMarketRegime(currentSymbol);
      const tone = regimeTone(regime);

      const panel = document.getElementById("marketContextPanel");
      panel.className = `rounded-lg border ${tone.section} p-4`;
      document.getElementById("marketContextIcon").className = `fa-solid fa-globe ${tone.icon}`;
      document.getElementById("marketRegime").textContent = regime;
      document.getElementById("marketRegime").className = `w-fit rounded-full border ${tone.border} bg-zinc-950/70 px-3 py-1 text-xs font-black ${tone.text}`;
      document.getElementById("spyTrend").textContent = marketContext.spy.trend;
      document.getElementById("qqqTrend").textContent = marketContext.qqq.trend;
      document.getElementById("vixState").textContent = marketContext.vix.value
        ? `${marketContext.vix.state} ${marketContext.vix.value}`
        : marketContext.vix.state;
      document.getElementById("breadthState").textContent = marketContext.breadth.state;
      document.getElementById("sectorAlignment").textContent = sectorState;
      const contextSource = marketContext.source ? ` Source: ${marketContext.source}.` : "";
      const breadthSource = marketContext.breadth?.source === "polygon-grouped-daily"
        ? " Breadth is provider-derived from grouped daily market bars."
        : marketContext.breadth?.source === "sector-etf-proxy"
          ? " Breadth is proxy-based until provider advance/decline is available."
          : "";
      document.getElementById("marketContextSummary").textContent = `${data.sector} regime is ${regime} with tape score ${tapeScore}/100. ${regimeWeightSummary(regime)}${contextSource}${breadthSource}`;

      const odds = getMarketOdds(data);
      document.getElementById("bullOdds").textContent = `${odds.bull}%`;
      document.getElementById("bearOdds").textContent = `${odds.bear}%`;
      document.getElementById("bullOddsBar").style.width = `${odds.bull}%`;
      document.getElementById("bearOddsBar").style.width = `${odds.bear}%`;
      document.getElementById("marketOddsLabel").textContent = odds.label;
      document.getElementById("marketOddsLabel").className = `rounded-full px-2 py-1 text-xs font-black ${odds.bull >= 62 ? "bg-emerald-400/10 text-emerald-200" : odds.bull <= 38 ? "bg-rose-400/10 text-rose-200" : "bg-zinc-800 text-zinc-300"}`;

      const nineSig = getNineSig(data);
      document.getElementById("nineSigScore").textContent = `${nineSig.score}/9`;
      document.getElementById("nineSigScore").className = `rounded-full px-2 py-1 text-xs font-black ${nineSig.score >= 7 ? "bg-emerald-400/10 text-emerald-200" : nineSig.score <= 4 ? "bg-rose-400/10 text-rose-200" : "bg-amber-300/10 text-amber-100"}`;
      document.getElementById("nineSigList").innerHTML = nineSig.checks.map(check => `
        <span class="rounded-md px-2 py-1 ${check.pass ? "bg-emerald-400/10 text-emerald-200" : "bg-zinc-800 text-zinc-500"}">${check.label}</span>
      `).join("");
    }

    function renderQualityGate(data) {
      const gate = getQualityGate(data);
      const rejection = evaluateTradeRejection(data, gate, currentSymbol);
      const toneMap = {
        emerald: { section: "border-emerald-400/25 bg-emerald-400/10", text: "text-emerald-100", icon: "text-emerald-300", border: "border-emerald-300/30" },
        cyan: { section: "border-cyan-400/25 bg-cyan-400/10", text: "text-cyan-100", icon: "text-cyan-300", border: "border-cyan-300/30" },
        amber: { section: "border-amber-300/25 bg-amber-300/10", text: "text-amber-100", icon: "text-amber-300", border: "border-amber-300/30" },
        rose: { section: "border-rose-300/25 bg-rose-300/10", text: "text-rose-100", icon: "text-rose-300", border: "border-rose-300/30" }
      };
      const tone = toneMap[gate.tone];
      const section = document.getElementById("qualityGate");
      section.className = `mt-4 rounded-lg border ${tone.section} p-4`;
      document.getElementById("qualityIcon").className = `fa-solid ${gate.icon} ${tone.icon}`;
      document.getElementById("qualityVerdict").textContent = gate.verdict;
      document.getElementById("qualityVerdict").className = `w-fit rounded-full border ${tone.border} bg-zinc-950/70 px-3 py-1 text-xs font-black ${tone.text}`;
      document.getElementById("qualitySummary").textContent = gate.summary;
      renderProofTrustChips("qualityTrustChips");
      document.getElementById("gateSignal").textContent = data.confidence;
      document.getElementById("gateEntry").textContent = data.entry.status;
      document.getElementById("gateContract").textContent = data.options.liquidity;
      document.getElementById("gateReward").textContent = `${gate.rr.toFixed(2)}:1`;
      document.getElementById("gateMarket").textContent = marketContext.sectors[data.sector] || "Mixed";
      document.getElementById("qualityReasons").innerHTML = gate.reasons.length
        ? gate.reasons.map(reason => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300">${reason}</span>`).join("")
        : `<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">No blockers detected</span>`;

      const rejectionTone = toneMap[rejection.tone];
      const rejectionPanel = document.getElementById("tradeRejectionEngine");
      rejectionPanel.className = `mt-3 rounded-lg border ${rejectionTone.section} p-3`;
      document.getElementById("rejectionVerdict").textContent = rejection.verdict;
      document.getElementById("rejectionVerdict").className = `w-fit rounded-full border ${rejectionTone.border} bg-zinc-950/70 px-3 py-1 text-xs font-black ${rejectionTone.text}`;
      document.getElementById("rejectionScore").textContent = `${rejection.score}/100`;
      document.getElementById("rejectionMainReason").textContent = rejection.mainReason;
      const impactLabel = rejection.confidenceImpact >= 0 ? `Impact +${rejection.confidenceImpact}` : `Impact ${rejection.confidenceImpact}`;
      document.getElementById("rejectionConfidenceImpact").textContent = impactLabel;
      document.getElementById("rejectionConfidenceImpact").className = `w-fit rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs font-black ${rejection.confidenceImpact >= 0 ? "text-emerald-200" : "text-rose-200"}`;
      document.getElementById("rejectionBlockers").innerHTML = rejection.blockers.length
        ? rejection.blockers.map(reason => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300">${escapeHtml(reason)}</span>`).join("")
        : `<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">No rejection blockers</span>`;
      document.getElementById("rejectionImprove").innerHTML = rejection.improvements.length
        ? rejection.improvements.map(reason => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300">${escapeHtml(reason)}</span>`).join("")
        : `<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">Confirm trigger and size correctly</span>`;
    }

    function renderScreenshotControls() {
      const ticker = document.getElementById("screenshotTicker");
      const tagGrid = document.getElementById("screenshotTagGrid");
      if (!ticker || !tagGrid) return;
      ticker.innerHTML = Object.keys(symbols).map(symbol => `<option value="${symbol}">${symbol}</option>`).join("");
      ticker.value = currentSymbol;
      const presets = document.getElementById("screenshotPresetButtons");
      if (presets) {
        presets.innerHTML = [
          ["aligned", "Aligned"],
          ["breakout", "Breakout"],
          ["caution", "Caution"],
          ["reversal", "Reversal Risk"],
          ["unclear", "Reset"]
        ].map(([id, label]) => `
          <button data-screenshot-preset="${id}" class="rounded-lg border border-indigo-300/30 bg-indigo-300/10 px-2 py-2 text-[11px] font-black text-indigo-100 hover:bg-indigo-300/20" type="button">${label}</button>
        `).join("");
      }
      tagGrid.innerHTML = screenshotTagSchema.map(item => `
        <label class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
          <span class="text-xs font-bold uppercase text-zinc-500">${item.label}</span>
          <select data-screenshot-tag="${item.id}" class="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold outline-none focus:border-indigo-300">
            ${item.options.map(option => `<option value="${option}">${option}</option>`).join("")}
          </select>
        </label>
      `).join("");
      document.querySelectorAll("[data-screenshot-preset]").forEach(button => {
        button.addEventListener("click", () => applyScreenshotPreset(button.dataset.screenshotPreset));
      });
      document.querySelectorAll("[data-screenshot-tag]").forEach(select => {
        select.addEventListener("change", updateScreenshotTagProgress);
      });
      updateScreenshotTagProgress();
    }

    function syncScreenshotContext() {
      const ticker = document.getElementById("screenshotTicker");
      const timeframe = document.getElementById("screenshotTimeframe");
      if (ticker) ticker.value = currentSymbol;
      if (timeframe) timeframe.value = activeRange;
    }

    function screenshotTags() {
      return Object.fromEntries([...document.querySelectorAll("[data-screenshot-tag]")].map(select => [
        select.dataset.screenshotTag,
        select.value
      ]));
    }

    function setScreenshotTags(values = {}) {
      document.querySelectorAll("[data-screenshot-tag]").forEach(select => {
        select.value = values[select.dataset.screenshotTag] || "Unclear";
      });
      updateScreenshotTagProgress();
    }

    function screenshotPresetValues(preset, bullish) {
      const aligned = {
        trend: bullish ? "Bullish" : "Bearish",
        vwap: bullish ? "Above VWAP" : "Below VWAP",
        ema: bullish ? "Bull stacked" : "Bear stacked",
        rsi: "Neutral",
        macd: bullish ? "Bullish" : "Bearish",
        volume: "Expanding",
        levels: bullish ? "Holding support" : "Rejecting resistance",
        breakout: "Brewing",
        reversal: "Low"
      };
      const presets = {
        aligned,
        breakout: {
          ...aligned,
          levels: bullish ? "Breaking resistance" : "Breaking support",
          breakout: bullish ? "Breakout confirmed" : "Breakdown confirmed",
          rsi: "Strong"
        },
        caution: {
          trend: "Sideways",
          vwap: bullish ? "Reclaiming VWAP" : "Losing VWAP",
          ema: "Mixed",
          rsi: "Neutral",
          macd: "Flat",
          volume: "Weak",
          levels: bullish ? "Rejecting resistance" : "Holding support",
          breakout: "None",
          reversal: "Medium"
        },
        reversal: {
          trend: bullish ? "Bearish" : "Bullish",
          vwap: bullish ? "Below VWAP" : "Above VWAP",
          ema: bullish ? "Bear stacked" : "Bull stacked",
          rsi: bullish ? "Oversold" : "Overbought",
          macd: bullish ? "Bearish" : "Bullish",
          volume: "Climax",
          levels: bullish ? "Breaking support" : "Breaking resistance",
          breakout: "Failed",
          reversal: "High"
        },
        unclear: {}
      };
      return presets[preset] || presets.unclear;
    }

    function applyScreenshotPreset(preset) {
      const ticker = document.getElementById("screenshotTicker")?.value || currentSymbol;
      const data = symbols[ticker] || symbols[currentSymbol];
      setScreenshotTags(screenshotPresetValues(preset, data.type === "Bullish"));
      if (preset !== "unclear") runScreenshotSignalCheck();
      else clearScreenshotResultOnly();
      showNeutralToast(preset === "unclear" ? "Screenshot tags reset" : "Screenshot preset applied locally");
    }

    function updateScreenshotTagProgress() {
      const tags = screenshotTags();
      const total = screenshotTagSchema.length;
      const tagged = Object.values(tags).filter(value => value && value !== "Unclear").length;
      const visibleRisk = ["High", "Failed", "Weak", "Climax"].filter(value => Object.values(tags).includes(value)).length;
      const label = document.getElementById("screenshotTagProgress");
      const quality = document.getElementById("screenshotPatternQuality");
      if (label) label.textContent = `${tagged}/${total} visible factor${tagged === 1 ? "" : "s"} tagged.`;
      if (quality) {
        const text = tagged >= 8 ? "High clarity" : tagged >= 5 ? "Usable read" : tagged >= 3 ? "Thin read" : "Needs tags";
        const tone = tagged >= 8 ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          : tagged >= 5 ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
            : tagged >= 3 ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
              : "border-zinc-700 bg-zinc-900 text-zinc-400";
        quality.textContent = visibleRisk >= 2 ? `${text} / risk visible` : text;
        quality.className = `w-fit rounded-full border ${tone} px-2 py-1 text-[11px] font-black`;
      }
    }

    function factorResult(label, value, matchValues = [], conflictValues = [], partialValues = []) {
      if (!value || value === "Unclear") return { label, status: "missing", detail: `${label} is unclear in the screenshot.` };
      if (matchValues.includes(value)) return { label, status: "match", detail: `${label}: ${value}` };
      if (partialValues.includes(value)) return { label, status: "partial", detail: `${label}: ${value}` };
      if (conflictValues.includes(value)) return { label, status: "conflict", detail: `${label}: ${value}` };
      return { label, status: "missing", detail: `${label}: ${value}` };
    }

    function buildChartIntelligenceSignalContext(symbol, data, gate) {
      const activeContext = ensureSignalContext(symbol, "chartIntelligence");
      const rejection = evaluateTradeRejection(data, gate, symbol);
      const lightning = evaluateLightningStrike(data, gate, rejection, symbol);
      return {
        signalId: activeContext?.signalId || latestSignalIdForSymbol(symbol),
        symbol,
        timeframe: document.getElementById("screenshotTimeframe")?.value || activeRange,
        direction: data.type,
        gate,
        rejection,
        lightning,
        market: currentMarketSnapshot(symbol),
        signalScore: data.confidence
      };
    }

    function detectChartIntelligencePattern(tags, bullish) {
      const trendAligned = bullish ? tags.trend === "Bullish" : tags.trend === "Bearish";
      const emaAligned = bullish ? tags.ema === "Bull stacked" : tags.ema === "Bear stacked";
      const vwapAligned = bullish ? ["Above VWAP", "Reclaiming VWAP"].includes(tags.vwap) : ["Below VWAP", "Losing VWAP"].includes(tags.vwap);
      const breakout = bullish ? tags.breakout === "Breakout confirmed" : tags.breakout === "Breakdown confirmed";
      const brewing = tags.breakout === "Brewing";
      const failed = tags.breakout === "Failed" || tags.reversal === "High";
      const compression = tags.trend === "Sideways" && tags.ema === "Mixed" && tags.volume !== "Expanding";
      if (failed) return "Failed breakout / reversal risk";
      if (breakout && trendAligned && vwapAligned) return bullish ? "Bullish breakout confirmation" : "Bearish breakdown confirmation";
      if (brewing && trendAligned && emaAligned) return "Trend continuation brewing";
      if (trendAligned && emaAligned && vwapAligned) return "Clean trend continuation";
      if (compression) return "Range compression / wait zone";
      if (tags.volume === "Climax" && tags.reversal === "Medium") return "Exhaustion watch";
      return "Mixed chart structure";
    }

    function chartIntelRiskLevel(analysis, context) {
      if (context.rejection.verdict === "REJECT" || analysis.conflicts.length >= 3 || context.lightning.outProbability >= 66) return "High";
      if (analysis.conflicts.length || analysis.missing.length >= 4 || context.rejection.verdict === "WAIT") return "Elevated";
      if (analysis.score >= 78 && context.lightning.outProbability < 45) return "Controlled";
      return "Moderate";
    }

    function chartIntelSuggestedVerdict(analysis, context, riskLevel) {
      if (riskLevel === "High" || context.rejection.verdict === "REJECT" || analysis.conflicts.length >= 3) return "Reject";
      if (analysis.visibleCount < 5 || analysis.missing.length >= 4) return "Replay First";
      if (analysis.score >= 80 && context.gate.verdict === "A+ SETUP" && context.lightning.inProbability >= 68) return "Confirm";
      return "Wait";
    }

    function chartIntelExampleLine(title, detail, tone = "cyan") {
      const color = tone === "rose" ? "text-rose-100/85" : "text-cyan-100/85";
      return `<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2"><p class="font-black ${color}">${escapeHtml(title)}</p><p class="mt-1 text-zinc-400">${escapeHtml(detail)}</p></div>`;
    }

    function chartIntelExamples(symbol, pattern) {
      const replayItems = typeof signalReplayItems === "function" ? signalReplayItems() : [];
      const winners = replayItems
        .filter(item => item.symbol === symbol && (Number(item.pnl) > 0 || item.outcome === "Win"))
        .slice(0, 2);
      const failures = [
        ...signalGraveyardItems().filter(item => item.symbol === symbol),
        ...replayItems.filter(item => item.symbol === symbol && (Number(item.pnl) < 0 || item.outcome === "Loss"))
      ].slice(0, 2);
      return {
        winners: winners.length ? winners.map(item => ({
          title: `${item.symbol} ${item.outcome || "Win"}`,
          detail: item.replayLabel || item.contract || `Similar ${pattern.toLowerCase()} example`
        })) : [{ title: "No local winner yet", detail: "Paper trade and journal a winning version of this pattern to build Eagle Scout memory." }],
        failures: failures.length ? failures.map(item => ({
          title: `${item.symbol} ${item.cause ? "Graveyard" : item.outcome || "Loss"}`,
          detail: item.prevention || item.replayLabel || item.contract || "Study the failed setup before trusting a similar chart."
        })) : [{ title: "No local failure yet", detail: "Signal Graveyard will add failed examples as local signal memory grows." }]
      };
    }

    function compareScreenshotTags(tags, data, gate) {
      const bullish = data.type === "Bullish";
      const results = [
        factorResult("Trend direction", tags.trend, bullish ? ["Bullish"] : ["Bearish"], bullish ? ["Bearish"] : ["Bullish"], ["Sideways"]),
        factorResult("Price vs VWAP", tags.vwap, bullish ? ["Above VWAP", "Reclaiming VWAP"] : ["Below VWAP", "Losing VWAP"], bullish ? ["Below VWAP", "Losing VWAP"] : ["Above VWAP", "Reclaiming VWAP"]),
        factorResult("EMA alignment", tags.ema, bullish ? ["Bull stacked"] : ["Bear stacked"], bullish ? ["Bear stacked"] : ["Bull stacked"], ["Mixed"]),
        factorResult("RSI condition", tags.rsi, bullish ? ["Strong", "Neutral"] : ["Neutral", "Oversold"], bullish ? ["Oversold"] : ["Overbought"], bullish ? ["Overbought"] : ["Strong"]),
        factorResult("MACD condition", tags.macd, bullish ? ["Bullish", "Crossing"] : ["Bearish", "Crossing"], bullish ? ["Bearish"] : ["Bullish"], ["Flat"]),
        factorResult("Volume behavior", tags.volume, ["Expanding"], ["Weak"], ["Climax"]),
        factorResult("Support/resistance", tags.levels, bullish ? ["Holding support", "Breaking resistance"] : ["Rejecting resistance", "Breaking support"], bullish ? ["Rejecting resistance", "Breaking support"] : ["Holding support", "Breaking resistance"]),
        factorResult("Breakout/breakdown signs", tags.breakout, bullish ? ["Breakout confirmed", "Brewing"] : ["Breakdown confirmed", "Brewing"], bullish ? ["Breakdown confirmed", "Failed"] : ["Breakout confirmed", "Failed"], ["None"]),
        factorResult("Reversal risk", tags.reversal, ["Low"], ["High"], ["Medium"])
      ];
      const weights = { match: 10, partial: 5, missing: 0, conflict: -10 };
      const raw = results.reduce((sum, result) => sum + weights[result.status], 0);
      let score = Math.round(((raw + 90) / 180) * 100);
      if (gate.verdict === "REJECT" || gate.verdict === "WAIT") score = Math.min(score, gate.verdict === "REJECT" ? 62 : 78);
      score = Math.max(0, Math.min(100, score));
      const conflicts = results.filter(result => result.status === "conflict");
      const missing = results.filter(result => result.status === "missing");
      const matches = results.filter(result => result.status === "match" || result.status === "partial");
      const visibleCount = results.length - missing.length;
      const clarityPenalty = visibleCount < 5 ? 10 : visibleCount < 7 ? 4 : 0;
      score = Math.max(0, Math.min(100, score - clarityPenalty));
      const result = score >= 80 ? "STRONG MATCH" : score >= 60 ? "PARTIAL MATCH" : score >= 40 ? "WEAK MATCH" : "CONFLICT";
      const symbol = data.symbol || currentSymbol;
      const signalContext = buildChartIntelligenceSignalContext(symbol, data, gate);
      const detectedPattern = detectChartIntelligencePattern(tags, bullish);
      const riskLevel = chartIntelRiskLevel({ score, conflicts, missing, visibleCount }, signalContext);
      const suggestedAction = chartIntelSuggestedVerdict({ score, conflicts, missing, visibleCount }, signalContext, riskLevel);
      const strikeProbability = Math.max(0, Math.min(100, Math.round((signalContext.lightning.inProbability * .55) + (score * .35) + ((matches.length / results.length) * 10) - (conflicts.length * 4))));
      const examples = chartIntelExamples(symbol, detectedPattern);
      const explanation = `Eagle Scout sees ${detectedPattern.toLowerCase()} on ${symbol} ${signalContext.timeframe}. Confidence is ${score}/100 with Strike probability ${strikeProbability}/100 and ${riskLevel.toLowerCase()} risk. ${matches.length} reasons passed, ${conflicts.length} failed, and ${missing.length} are unclear. Verdict: ${suggestedAction}.`;
      return { score, result, suggestedAction, explanation, matches, conflicts, missing, visibleCount, detectedPattern, riskLevel, strikeProbability, signalContext, examples };
    }

    function renderScreenshotPills(containerId, items, emptyLabel, tone) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const tones = {
        match: "bg-emerald-400/10 text-emerald-200",
        conflict: "bg-rose-400/10 text-rose-200",
        missing: "bg-zinc-800 text-zinc-400"
      };
      container.innerHTML = items.length
        ? items.map(item => `<span class="rounded-full px-2 py-1 text-[11px] font-bold ${tones[tone]}">${item.detail}</span>`).join("")
        : `<span class="rounded-full px-2 py-1 text-[11px] font-bold ${tones[tone]}">${emptyLabel}</span>`;
    }

    function runScreenshotSignalCheck() {
      updateScreenshotTagProgress();
      const ticker = document.getElementById("screenshotTicker")?.value || currentSymbol;
      const data = symbols[ticker] || symbols[currentSymbol];
      const gate = getQualityGate(data);
      const analysis = compareScreenshotTags(screenshotTags(), { ...data, symbol: ticker }, gate);
      const badgeTone = analysis.result === "STRONG MATCH"
        ? "border-emerald-300/30 text-emerald-100"
        : analysis.result === "PARTIAL MATCH"
          ? "border-cyan-300/30 text-cyan-100"
          : analysis.result === "WEAK MATCH"
            ? "border-amber-300/30 text-amber-100"
            : "border-rose-300/30 text-rose-100";
      document.getElementById("screenshotCorrelationBadge").textContent = analysis.result;
      document.getElementById("screenshotCorrelationBadge").className = `w-fit rounded-full border ${badgeTone} bg-zinc-950/70 px-3 py-1 text-xs font-black`;
      document.getElementById("screenshotScore").textContent = `${analysis.score}/100`;
      document.getElementById("screenshotScore").className = `mt-1 text-3xl font-black ${analysis.score >= 80 ? "text-emerald-300" : analysis.score >= 60 ? "text-cyan-200" : analysis.score >= 40 ? "text-amber-200" : "text-rose-300"}`;
      document.getElementById("screenshotSuggestedAction").textContent = analysis.suggestedAction;
      document.getElementById("screenshotExplanation").textContent = analysis.explanation;
      document.getElementById("chartIntelPattern").textContent = analysis.detectedPattern;
      document.getElementById("chartIntelRisk").textContent = `Risk: ${analysis.riskLevel}`;
      document.getElementById("chartIntelRisk").className = `mt-1 text-xs font-black ${analysis.riskLevel === "Controlled" ? "text-emerald-200" : analysis.riskLevel === "High" ? "text-rose-200" : "text-amber-100"}`;
      document.getElementById("chartIntelStrike").textContent = `${analysis.strikeProbability}/100`;
      document.getElementById("chartIntelStrike").className = `mt-1 text-2xl font-black ${analysis.strikeProbability >= 78 ? "text-emerald-200" : analysis.strikeProbability >= 60 ? "text-cyan-100" : analysis.strikeProbability >= 42 ? "text-amber-100" : "text-rose-200"}`;
      document.getElementById("chartIntelSignalContext").textContent = `${analysis.signalContext.signalId} · ${analysis.signalContext.gate.verdict}`;
      renderProofTrustChips("chartIntelTrustChips");
      renderScreenshotPills("screenshotMatches", analysis.matches, "No matching factors yet", "match");
      renderScreenshotPills("screenshotConflicts", analysis.conflicts, "No conflicts tagged", "conflict");
      renderScreenshotPills("screenshotMissing", analysis.missing, "No unclear factors", "missing");
      document.getElementById("chartIntelWinners").innerHTML = analysis.examples.winners.map(item => chartIntelExampleLine(item.title, item.detail, "cyan")).join("");
      document.getElementById("chartIntelFailures").innerHTML = analysis.examples.failures.map(item => chartIntelExampleLine(item.title, item.detail, "rose")).join("");
      updateActiveSignalContext({
        signalId: analysis.signalContext.signalId,
        symbol: analysis.signalContext.symbol,
        source: "chart-intelligence",
        suggestedAction: analysis.suggestedAction,
        eagleScore: analysis.score,
        qualityGate: analysis.signalContext.gate,
        tradeRejection: analysis.signalContext.rejection,
        lightning: analysis.signalContext.lightning,
        learning: {
          chartIntelPattern: analysis.detectedPattern,
          chartIntelRisk: analysis.riskLevel,
          chartIntelStrikeProbability: analysis.strikeProbability,
          chartIntelResult: analysis.result,
          chartIntelVisibleFactors: analysis.visibleCount,
          chartIntelConflicts: analysis.conflicts.map(item => item.label)
        }
      }, "chartIntelligence");
      activeEagleScoutMarker = analysis.suggestedAction === "Reject" ? "reject" : analysis.suggestedAction === "Replay First" ? "replay" : "live";
      renderEagleScoutExplanation(activeEagleScoutMarker);
      showNeutralToast(`Screenshot check: ${analysis.result}`);
    }

    function clearScreenshotResultOnly() {
      document.getElementById("screenshotCorrelationBadge").textContent = "LOCAL ONLY";
      document.getElementById("screenshotCorrelationBadge").className = "w-fit rounded-full border border-indigo-300/30 bg-zinc-950/70 px-3 py-1 text-xs font-black text-indigo-100";
      document.getElementById("screenshotScore").textContent = "--";
      document.getElementById("screenshotScore").className = "mt-1 text-3xl font-black text-indigo-200";
      document.getElementById("screenshotSuggestedAction").textContent = "Needs screenshot tags";
      document.getElementById("screenshotExplanation").textContent = "Upload or paste a screenshot, tag the visible setup, then ask Eagle Scout what it sees.";
      document.getElementById("chartIntelPattern").textContent = "--";
      document.getElementById("chartIntelRisk").textContent = "Risk: --";
      document.getElementById("chartIntelRisk").className = "mt-1 text-xs font-black text-zinc-400";
      document.getElementById("chartIntelStrike").textContent = "--";
      document.getElementById("chartIntelStrike").className = "mt-1 text-2xl font-black text-cyan-100";
      document.getElementById("chartIntelSignalContext").textContent = "SignalContext pending";
      renderProofTrustChips("chartIntelTrustChips");
      renderScreenshotPills("screenshotMatches", [], "No matching factors yet", "match");
      renderScreenshotPills("screenshotConflicts", [], "No conflicts tagged", "conflict");
      renderScreenshotPills("screenshotMissing", [], "No unclear factors", "missing");
      document.getElementById("chartIntelWinners").innerHTML = chartIntelExampleLine("No screenshot read yet", "Run Chart Intelligence to compare against local winning examples.", "cyan");
      document.getElementById("chartIntelFailures").innerHTML = chartIntelExampleLine("No screenshot read yet", "Run Chart Intelligence to compare against failed and rejected examples.", "rose");
    }

    function setScreenshotPreview(file) {
      if (!file || !["image/png", "image/jpeg"].includes(file.type)) {
        showNeutralToast("Upload a PNG or JPG chart screenshot");
        return;
      }
      if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
      screenshotPreviewUrl = URL.createObjectURL(file);
      const preview = document.getElementById("screenshotPreview");
      preview.src = screenshotPreviewUrl;
      preview.classList.remove("hidden");
      showNeutralToast("Screenshot preview loaded locally");
    }

    function clearScreenshotSignalCheck() {
      if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
      screenshotPreviewUrl = "";
      const input = document.getElementById("screenshotUpload");
      const preview = document.getElementById("screenshotPreview");
      if (input) input.value = "";
      if (preview) {
        preview.removeAttribute("src");
        preview.classList.add("hidden");
      }
      setScreenshotTags({});
      clearScreenshotResultOnly();
    }

    function rankSetups() {
      return Object.entries(symbols).map(([symbol, data]) => {
        const gate = getQualityGate(data);
        const rejection = evaluateTradeRejection(data, gate, symbol);
        const contractPenalty = data.options.liquidity === "Thin" ? 35 : data.options.liquidity === "Selective" ? 14 : 0;
        const entryPenalty = data.entry.status === "WAIT" ? 16 : data.entry.status === "CONFIRM" ? 8 : 0;
        const ivPenalty = data.options.iv >= 70 ? 10 : 0;
        const rejectionPenalty = rejection.verdict === "REJECT" ? 32 : rejection.verdict === "WAIT" ? 12 : 0;
        const qualityScore = Math.max(0, Math.round(gate.score - contractPenalty - entryPenalty - ivPenalty - rejectionPenalty));
        const avoidScore = Math.round((100 - qualityScore) + contractPenalty + entryPenalty + ivPenalty);
        const opportunityScore = Math.max(0, Math.min(100, Math.round((qualityScore * .7) + (rejection.score * .3))));
        return { symbol, data, gate, rejection, qualityScore, avoidScore, opportunityScore };
      });
    }

    function setupReason(item) {
      if (item.rejection?.verdict === "REJECT") return item.rejection.mainReason;
      if (item.data.options.liquidity === "Thin") return "Options chain is too thin for clean execution.";
      if (item.data.entry.status === "WAIT") return "Entry timing has not confirmed yet.";
      if (item.gate.rr < 1.5) return "Reward/risk needs improvement.";
      if (item.data.options.iv >= 70) return "IV is elevated; premium is expensive.";
      return item.data.options.setup;
    }

    function opportunityWhy(item) {
      const strengths = [
        `${item.gate.verdict} quality gate`,
        `${getNineSig(item.data).score}/9 confluence`,
        `${item.data.options.liquidity} liquidity`,
        `${item.gate.rr.toFixed(2)}:1 reward/risk`
      ];
      return `${item.symbol} leads because it combines ${strengths.join(", ")}. ${item.data.options.setup}`;
    }

    function bestOpportunityAction(item) {
      if (!item) return "Wait for setup data";
      if (item.rejection.verdict === "APPROVED") return "Confirm trigger, paper trade, then journal the decision.";
      if (item.rejection.verdict === "WAIT") return "Wait for blockers to clear before entry.";
      return "Reject for now; choose patience over a bad fill.";
    }

    function signalSuggestedAction(gate, rejection, lightning) {
      if (rejection?.verdict === "REJECT" || gate?.verdict === "REJECT") return "Reject";
      if (lightning?.verdict?.includes("Strike In") && rejection?.verdict === "APPROVED") return "Confirm";
      if (lightning?.verdict?.includes("Strike Out")) return "Wait";
      if (gate?.verdict === "A+ SETUP" || gate?.verdict === "READY") return "Confirm";
      return "Wait";
    }

    function eagleScoutActionPlan(explanation) {
      const action = explanation?.suggestedAction || "Wait";
      const hasReplay = Boolean(explanation?.examples?.replay?.length);
      const plan = {
        primaryLabel: "Review Context",
        primaryIcon: "fa-magnifying-glass-chart",
        primaryTone: "cyan",
        primaryAction: "screenshot",
        replayLabel: hasReplay ? "Review Replay" : "Replay Later",
        journalLabel: "Journal Signal",
        journalOutcome: "Planned",
        journalToast: "Journal prefilled from Eagle Scout",
        journalNote: `${explanation?.title || currentSymbol}: ${action}. ${explanation?.why || "Review the setup before taking paper risk."}`,
        journalTags: ["Eagle Scout", action],
        paperDisabled: true
      };

      if (action === "Confirm") {
        return {
          ...plan,
          primaryLabel: "Demo Trade",
          primaryIcon: "fa-paper-plane",
          primaryTone: "emerald",
          primaryAction: "paper",
          journalLabel: "Journal Plan",
          journalOutcome: "Planned",
          journalToast: "Plan journal prefilled from the setup coach",
          journalNote: `${explanation.title}: Confirm candidate. ${explanation.why} Risk zone: ${explanation.riskZone} Target zone: ${explanation.targetZone}`,
          journalTags: ["Eagle Scout", "Confirm", "Paper Plan"],
          paperDisabled: false
        };
      }

      if (action === "Reject") {
        return {
          ...plan,
          primaryLabel: "Journal Skip",
          primaryIcon: "fa-ban",
          primaryTone: "rose",
          primaryAction: "journal",
          replayLabel: hasReplay ? "Study Failure" : "Replay Later",
          journalLabel: "Journal Skip",
          journalOutcome: "Skipped",
          journalToast: "Skip journal prefilled from the setup coach",
          journalNote: `${explanation.title}: Rejected. ${explanation.why} Failed checks: ${explanation.failed.join("; ")}.`,
          journalTags: ["Eagle Scout", "Rejected", "Skipped"]
        };
      }

      if (action === "Replay") {
        return {
          ...plan,
          primaryLabel: "Replay First",
          primaryIcon: "fa-clock-rotate-left",
          primaryTone: "indigo",
          primaryAction: "replay",
          journalLabel: "Journal Lesson",
          journalOutcome: "Planned",
          journalToast: "Replay lesson journal prefilled",
          journalNote: `${explanation.title}: Replay first before paper risk. ${explanation.why}`,
          journalTags: ["Eagle Scout", "Replay First"]
        };
      }

      return {
        ...plan,
        primaryLabel: "Journal Wait",
        primaryIcon: "fa-book-open",
        primaryTone: "amber",
        primaryAction: "journal",
        journalLabel: "Journal Watch",
        journalOutcome: "Skipped",
        journalToast: "Wait journal prefilled from the setup coach",
        journalNote: `${explanation.title}: Wait. ${explanation.why} Recheck after cleaner confirmation.`,
        journalTags: ["Eagle Scout", "Wait", "Skipped", "Watchlist"]
      };
    }

    function applyEagleScoutActionButtons(explanation) {
      const plan = eagleScoutActionPlan(explanation);
      const primary = document.getElementById("eagleScoutOpenPaper");
      const replay = document.getElementById("eagleScoutOpenReplay");
      const journal = document.getElementById("eagleScoutOpenJournal");
      const launchSummary = document.getElementById("launchDecisionSummary");
      const launchCoreVerdict = document.getElementById("launchCoreVerdict");
      const launchCoreRule = document.getElementById("launchCoreRule");
      const tones = {
        emerald: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20",
        rose: "border-rose-300/35 bg-rose-300/10 text-rose-100 hover:bg-rose-300/20",
        indigo: "border-indigo-300/35 bg-indigo-300/10 text-indigo-100 hover:bg-indigo-300/20",
        cyan: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20",
        amber: "border-amber-300/35 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
      };
      if (primary) {
        primary.dataset.action = plan.primaryAction;
        primary.innerHTML = `<i class="fa-solid ${plan.primaryIcon} mr-1"></i> ${plan.primaryLabel}`;
        primary.className = `rounded-lg border px-3 py-2 text-xs font-black ${tones[plan.primaryTone] || tones.cyan}`;
        primary.disabled = false;
        primary.title = plan.primaryAction === "paper"
          ? "Paper trading uses demo money only and still requires the live signal ticket to be loaded."
          : "Continue the STRIKEPULSE learning loop from this signal.";
      }
      if (replay) {
        replay.innerHTML = `<i class="fa-solid fa-clock-rotate-left mr-1"></i> ${plan.replayLabel}`;
        replay.className = `rounded-lg border border-indigo-300/35 bg-indigo-300/10 px-3 py-2 text-xs font-black text-indigo-100 hover:bg-indigo-300/20 ${hasReplayClass(explanation)}`;
      }
      if (journal) {
        journal.innerHTML = `<i class="fa-solid fa-book-open mr-1"></i> ${plan.journalLabel}`;
        journal.dataset.outcome = plan.journalOutcome;
      }
      if (launchSummary) {
        launchSummary.textContent = `${explanation?.symbol || currentSymbol}: ${explanation?.suggestedAction || "Wait"} read. Choose demo trade, wait, or reject to finish this story.`;
      }
      if (launchCoreVerdict) {
        launchCoreVerdict.textContent = `${explanation?.symbol || currentSymbol}: ${explanation?.suggestedAction || "Wait"}`;
      }
      if (launchCoreRule) {
        launchCoreRule.textContent = plan.primaryAction === "paper"
          ? "Clear setup. Demo trade, then journal."
          : "Not clear. Wait or reject, then journal.";
      }
    }

    function hasReplayClass(explanation) {
      return explanation?.examples?.replay?.length ? "" : "opacity-90";
    }

    function signalDateKey(timestamp = new Date()) {
      return new Date(timestamp).toISOString().slice(0, 10).replaceAll("-", "");
    }

    function generateSignalId(symbol = currentSymbol, timestamp = new Date()) {
      const day = signalDateKey(timestamp);
      const prefix = `SP-${symbol}-${day}-`;
      const existing = signalLedger
        .map(item => item.signalId)
        .filter(id => String(id || "").startsWith(prefix))
        .map(id => Number(String(id).split("-").at(-1)) || 0);
      const next = Math.max(0, ...existing) + 1;
      return `${prefix}${String(next).padStart(4, "0")}`;
    }

    function signalContextDateKey(context = {}) {
      return signalDateKey(context.createdAt || context.timestamp || new Date());
    }

    function signalSetupSignature(snapshot = {}) {
      const gate = snapshot.qualityGate?.verdict || snapshot.gate?.verdict || snapshot.systemVerdict || "--";
      const rejection = snapshot.tradeRejection?.verdict || snapshot.rejection?.verdict || "--";
      const lightning = snapshot.lightning?.verdict || snapshot.lightningStatus || "--";
      const timeframe = snapshot.timeframe || activeRange || "--";
      return `${timeframe}|${gate}|${rejection}|${lightning}`;
    }

    function sameSignalDay(left = {}, right = {}) {
      return signalContextDateKey(left) === signalContextDateKey(right);
    }

    function sameSetupSignature(left = {}, right = {}) {
      const leftSignature = left.setupSignature || signalSetupSignature(left);
      const rightSignature = right.setupSignature || signalSetupSignature(right);
      return leftSignature === rightSignature;
    }

    function canReuseActiveSignalContext(symbol = currentSymbol, snapshot = null) {
      if (!activeSignalContext?.signalId || activeSignalContext.symbol !== symbol) return false;
      if (!sameSignalDay(activeSignalContext, snapshot || { timestamp: new Date() })) return false;
      if (!snapshot) return true;
      return sameSetupSignature(activeSignalContext, snapshot);
    }

    function latestReusableSignalSnapshot(symbol = currentSymbol, snapshot = null) {
      return signalMemory.find(item => {
        if (item.symbol !== symbol) return false;
        if (!sameSignalDay(item, snapshot || { timestamp: new Date() })) return false;
        return snapshot ? sameSetupSignature(item, snapshot) : true;
      });
    }

    function latestReusableSignalRecord(symbol = currentSymbol, snapshot = null) {
      return signalLedger.find(item => {
        if (item.symbol !== symbol) return false;
        if (!sameSignalDay(item, snapshot || { timestamp: new Date() })) return false;
        return snapshot ? sameSetupSignature(item, snapshot) : true;
      });
    }

    function saveSignalLedger() {
      localStorage.setItem("strikepulseSignalLedger", JSON.stringify(signalLedger.slice(0, 500)));
    }

    function saveTomorrowMissionSignalId(signalId) {
      tomorrowMissionSignalId = signalId || "";
      if (tomorrowMissionSignalId) {
        localStorage.setItem("strikepulseTomorrowMissionSignalId", tomorrowMissionSignalId);
      } else {
        localStorage.removeItem("strikepulseTomorrowMissionSignalId");
      }
    }

    function confidenceBandFor(score) {
      const value = Number(score) || 0;
      if (value >= 80) return "80-100";
      if (value >= 60) return "60-79";
      return "Below 60";
    }

    function setupTypeForSignal(snapshot = {}) {
      const verdict = snapshot.qualityGate?.verdict || snapshot.tradeRejection?.verdict || snapshot.suggestedAction || "Signal";
      if (snapshot.tradeRejection?.verdict === "REJECT") return "Rejected Setup";
      if (String(snapshot.lightning?.verdict || "").includes("Strike In")) return "Lightning Strike In";
      if (String(snapshot.lightning?.verdict || "").includes("Strike Out")) return "Lightning Strike Out";
      return verdict;
    }

    function signalLedgerRecordFromSnapshot(snapshot) {
      const signalId = snapshot.signalId || generateSignalId(snapshot.symbol, snapshot.timestamp);
      const price = Number(snapshot.price) || Number(symbols[snapshot.symbol]?.price) || 0;
      return {
        signalId,
        sourceMemoryId: snapshot.id,
        createdAt: snapshot.timestamp || new Date().toISOString(),
        date: (snapshot.timestamp || new Date().toISOString()).slice(0, 10),
        symbol: snapshot.symbol,
        eagleScore: Number(snapshot.eagleScore ?? snapshot.confidence) || 0,
        confidenceBand: confidenceBandFor(snapshot.eagleScore ?? snapshot.confidence),
        lightningStatus: snapshot.lightning?.verdict || "Watching",
        lightningInProbability: snapshot.lightning?.strikeInProbability ?? null,
        lightningOutProbability: snapshot.lightning?.strikeOutProbability ?? null,
        systemVerdict: snapshot.qualityGate?.verdict || snapshot.tradeRejection?.verdict || "WAIT",
        setupSignature: snapshot.setupSignature || signalSetupSignature(snapshot),
        userVerdict: snapshot.suggestedAction || "Wait",
        marketWeather: snapshot.marketWeather?.label || "--",
        marketRegime: snapshot.marketRegime || "--",
        setupType: setupTypeForSignal(snapshot),
        entryPriceSnapshot: price,
        targetSnapshot: symbols[snapshot.symbol]?.target ?? null,
        stopSnapshot: symbols[snapshot.symbol] ? getStopPrice(symbols[snapshot.symbol]) : null,
        linkedJournalIds: [],
        linkedPaperTradeIds: [],
        linkedReplayIds: [],
        graveyard: {
          buried: false,
          failureReasons: []
        },
        outcome: {
          status: "Open",
          paperTradeOutcome: null,
          winLoss: null,
          percentMove: null,
          maxFavorableExcursion: null,
          maxAdverseExcursion: null,
          source: "local-educational"
        }
      };
    }

    function upsertSignalLedger(snapshot) {
      if (!snapshot) return null;
      if (!snapshot.signalId) snapshot.signalId = generateSignalId(snapshot.symbol, snapshot.timestamp);
      const record = signalLedgerRecordFromSnapshot(snapshot);
      const existingIndex = signalLedger.findIndex(item => item.signalId === record.signalId);
      if (existingIndex >= 0) {
        signalLedger[existingIndex] = {
          ...signalLedger[existingIndex],
          ...record,
          linkedJournalIds: signalLedger[existingIndex].linkedJournalIds || [],
          linkedPaperTradeIds: signalLedger[existingIndex].linkedPaperTradeIds || [],
          linkedReplayIds: signalLedger[existingIndex].linkedReplayIds || [],
          graveyard: signalLedger[existingIndex].graveyard || record.graveyard,
          outcome: signalLedger[existingIndex].outcome || record.outcome
        };
      } else {
        signalLedger = [record, ...signalLedger].slice(0, 500);
      }
      saveSignalLedger();
      updateSignalStoryTimeline(record.signalId, {
        createdAt: record.createdAt,
        graveyardStatus: record.graveyard?.buried ? "Buried" : "Clear"
      });
      return record.signalId;
    }

    function currentSignalReference(symbol = currentSymbol) {
      if (canReuseActiveSignalContext(symbol)) return activeSignalContext.signalId;
      const latest = latestReusableSignalSnapshot(symbol);
      if (latest?.signalId) return latest.signalId;
      const record = latestReusableSignalRecord(symbol);
      if (record?.signalId) return record.signalId;
      const snapshot = rememberSignalSnapshot(symbol, "proof-link");
      return snapshot?.signalId || null;
    }

    function linkSignalLedger(signalId, type, id, patch = {}) {
      if (!signalId) return;
      const index = signalLedger.findIndex(item => item.signalId === signalId);
      if (index < 0) return;
      const key = type === "journal" ? "linkedJournalIds" : type === "paper" ? "linkedPaperTradeIds" : "linkedReplayIds";
      const current = signalLedger[index];
      const links = new Set(current[key] || []);
      if (id) links.add(id);
      signalLedger[index] = {
        ...current,
        [key]: [...links],
        ...patch,
        outcome: {
          ...(current.outcome || {}),
          ...(patch.outcome || {})
        },
        graveyard: {
          ...(current.graveyard || {}),
          ...(patch.graveyard || {})
        }
      };
      saveSignalLedger();
      updateSignalStoryTimeline(signalId, {
        paperTradeOpened: key === "linkedPaperTradeIds" ? new Date().toISOString() : undefined,
        journalSaved: key === "linkedJournalIds" ? new Date().toISOString() : undefined,
        replayGenerated: key === "linkedReplayIds" ? id : undefined,
        graveyardStatus: signalLedger[index].graveyard?.buried ? "Buried" : "Clear"
      });
      if (activeSignalContext?.signalId === signalId) {
        linkActiveSignalContext(type, id, patch);
      }
    }

    function latestSignalIdForSymbol(symbol = currentSymbol) {
      const latest = latestReusableSignalSnapshot(symbol);
      const today = signalDateKey(new Date());
      const ledgerMatch = signalLedger.find(item => item.symbol === symbol && signalDateKey(item.createdAt || item.date || new Date()) === today);
      return latest?.signalId || ledgerMatch?.signalId || "LOCAL-PREVIEW";
    }

    function saveActiveSignalContext() {
      if (!activeSignalContext) {
        localStorage.removeItem("strikepulseActiveSignalContext");
        return;
      }
      localStorage.setItem("strikepulseActiveSignalContext", JSON.stringify(activeSignalContext));
    }

    function saveSignalStoryTimelines() {
      localStorage.setItem("strikepulseSignalStoryTimelines", JSON.stringify(signalStoryTimelines));
    }

    function baseSignalStoryTimeline(signalId, createdAt = null) {
      return {
        signalId,
        createdAt,
        missionViewed: null,
        eagleViewed: null,
        paperTradeOpened: null,
        journalSaved: null,
        replayGenerated: null,
        graveyardStatus: "Clear",
        tradeDnaLesson: null,
        tomorrowMissionLesson: null
      };
    }

    function reconstructSignalStoryTimeline(signalId) {
      if (!signalId) return null;
      const existing = signalStoryTimelines[signalId] || {};
      const ledger = signalLedger.find(item => item.signalId === signalId) || {};
      const memory = signalMemory.find(item => item.signalId === signalId) || {};
      const paperBuys = practiceAccount.history.filter(item => item.signalId === signalId && item.action === "BUY");
      const paperCloses = practiceAccount.history.filter(item => item.signalId === signalId && item.action === "CLOSE");
      const journals = journalEntries.filter(entry => entry.signalId === signalId);
      const learning = activeSignalContext?.signalId === signalId ? (activeSignalContext.learning || {}) : {};
      const firstPaper = paperBuys[paperBuys.length - 1] || paperBuys[0] || paperCloses[paperCloses.length - 1] || paperCloses[0];
      const firstJournal = journals[journals.length - 1] || journals[0];
      const replayId = existing.replayGenerated || ledger.linkedReplayIds?.[0] || learning.replayId || null;
      const buried = ledger.graveyard?.buried || memory.tradeRejection?.verdict === "REJECT" || memory.qualityGate?.verdict === "REJECT";
      return {
        ...baseSignalStoryTimeline(signalId, ledger.createdAt || memory.timestamp || existing.createdAt || new Date().toISOString()),
        ...existing,
        signalId,
        createdAt: existing.createdAt || ledger.createdAt || memory.timestamp || new Date().toISOString(),
        paperTradeOpened: existing.paperTradeOpened || firstPaper?.openedAt || firstPaper?.time || null,
        journalSaved: existing.journalSaved || firstJournal?.time || null,
        replayGenerated: replayId,
        graveyardStatus: buried ? "Buried" : existing.graveyardStatus || "Clear",
        tradeDnaLesson: existing.tradeDnaLesson || learning.tradeDnaRecommendation || null,
        tomorrowMissionLesson: existing.tomorrowMissionLesson || learning.pilotRecommendation || null
      };
    }

    function updateSignalStoryTimeline(signalId, patch = {}) {
      if (!signalId) return null;
      const reconstructed = reconstructSignalStoryTimeline(signalId);
      const safePatch = { ...patch };
      Object.keys(safePatch).forEach(key => {
        if (safePatch[key] === undefined) delete safePatch[key];
      });
      ["createdAt", "missionViewed", "eagleViewed", "paperTradeOpened", "journalSaved", "replayGenerated"].forEach(key => {
        if (reconstructed?.[key] && safePatch[key]) delete safePatch[key];
      });
      const timeline = {
        ...reconstructed,
        ...safePatch,
        signalId
      };
      signalStoryTimelines[signalId] = timeline;
      saveSignalStoryTimelines();
      if (signalStoryHasLesson(timeline) && (safePatch.tradeDnaLesson || safePatch.tomorrowMissionLesson)) {
        saveTomorrowMissionSignalId(signalId);
      }
      return timeline;
    }

    function signalStoryTimeValue(value) {
      const time = Date.parse(value || "");
      return Number.isFinite(time) ? time : 0;
    }

    function signalStoryCompletionScore(story = {}) {
      return [
        story.signalId,
        story.missionViewed,
        story.eagleViewed,
        story.paperTradeOpened,
        story.journalSaved,
        story.replayGenerated,
        story.tradeDnaLesson,
        story.tomorrowMissionLesson
      ].filter(Boolean).length;
    }

    function signalStoryLatestTime(story = {}) {
      return Math.max(
        signalStoryTimeValue(story.createdAt),
        signalStoryTimeValue(story.missionViewed),
        signalStoryTimeValue(story.eagleViewed),
        signalStoryTimeValue(story.paperTradeOpened),
        signalStoryTimeValue(story.journalSaved),
        signalStoryTimeValue(story.replayGenerated)
      );
    }

    function signalStoryHasLesson(story = {}) {
      return Boolean(story?.signalId && (story.tomorrowMissionLesson || story.tradeDnaLesson));
    }

    function latestCompletedSignalStory() {
      const ids = new Set([
        ...Object.keys(signalStoryTimelines || {}),
        ...signalLedger.map(item => item.signalId).filter(Boolean),
        ...signalMemory.map(item => item.signalId).filter(Boolean),
        ...practiceAccount.history.map(item => item.signalId).filter(Boolean),
        ...journalEntries.map(entry => entry.signalId).filter(Boolean)
      ]);
      return [...ids]
        .map(id => reconstructSignalStoryTimeline(id))
        .filter(story => story?.signalId && story.eagleViewed && (story.journalSaved || story.replayGenerated) && (story.tradeDnaLesson || story.tomorrowMissionLesson))
        .sort((a, b) => signalStoryLatestTime(b) - signalStoryLatestTime(a) || signalStoryCompletionScore(b) - signalStoryCompletionScore(a))[0] || null;
    }

    function completedSignalStoryForMission() {
      const storedStory = tomorrowMissionSignalId ? reconstructSignalStoryTimeline(tomorrowMissionSignalId) : null;
      if (signalStoryHasLesson(storedStory)) return storedStory;
      const activeStory = activeSignalContext?.signalId ? reconstructSignalStoryTimeline(activeSignalContext.signalId) : null;
      if (signalStoryHasLesson(activeStory)) return activeStory;
      return null;
    }

    function signalStoryMissionReadout(story) {
      if (!story) return null;
      const lesson = story.tomorrowMissionLesson || story.tradeDnaLesson;
      if (!lesson) return null;
      return {
        headline: `${story.signalId} lesson`,
        replay: story.replayGenerated
          ? `${story.signalId}: replay reviewed. ${lesson}`
          : `${story.signalId}: journal lesson ready. ${lesson}`,
        focus: "Apply the last completed Signal Story",
        detail: lesson,
        dnaRule: `From ${story.signalId}: ${lesson}`
      };
    }

    function signalStoryPatchForStage(context = {}, stage = "context") {
      const now = new Date().toISOString();
      const learning = context.learning || {};
      if (stage === "mission") {
        return { missionViewed: now };
      }
      if (stage === "eagleScout") return { eagleViewed: now };
      if (stage === "lightningStrike") return {};
      if (stage === "paper" || stage === "paperTrade") return { paperTradeOpened: now };
      if (stage === "journal") return { journalSaved: now };
      if (stage === "replay") return { replayGenerated: learning.replayId || now };
      if (stage === "tradeDna") return { tradeDnaLesson: learning.tradeDnaRecommendation || null };
      if (stage === "pilotStatus") return { tomorrowMissionLesson: learning.pilotRecommendation || null };
      return {};
    }

    function signalContextFromSnapshot(snapshot = {}, stage = "memory") {
      const symbol = snapshot.symbol || currentSymbol;
      const data = symbols[symbol] || symbols[currentSymbol];
      const reusableMemory = latestReusableSignalSnapshot(symbol, snapshot);
      const reusableRecord = latestReusableSignalRecord(symbol, snapshot);
      const signalId = snapshot.signalId
        || (canReuseActiveSignalContext(symbol, snapshot) ? activeSignalContext.signalId : null)
        || reusableMemory?.signalId
        || reusableRecord?.signalId
        || generateSignalId(symbol, snapshot.timestamp || new Date());
      const ledger = signalLedger.find(item => item.signalId === signalId) || {};
      return {
        signalId,
        symbol,
        source: snapshot.source || stage,
        stage,
        timeframe: snapshot.timeframe || activeRange,
        setupSignature: snapshot.setupSignature || signalSetupSignature(snapshot),
        createdAt: snapshot.timestamp || ledger.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        price: Number(snapshot.price ?? data?.price) || 0,
        eagleScore: Number(snapshot.eagleScore ?? snapshot.confidence ?? data?.confidence) || 0,
        suggestedAction: snapshot.suggestedAction || ledger.userVerdict || "Wait",
        qualityGate: snapshot.qualityGate || { verdict: ledger.systemVerdict || "WAIT", score: 0 },
        tradeRejection: snapshot.tradeRejection || { verdict: ledger.systemVerdict || "WAIT", score: 0, mainReason: "No rejection read attached yet", blockers: [] },
        lightning: snapshot.lightning || { verdict: ledger.lightningStatus || "Watching", strikeInProbability: ledger.lightningInProbability, strikeOutProbability: ledger.lightningOutProbability, factors: [] },
        marketWeather: snapshot.marketWeather || { label: ledger.marketWeather || "--", score: null },
        marketRegime: snapshot.marketRegime || ledger.marketRegime || "--",
        activeBlockers: snapshot.activeBlockers || [],
        links: {
          journalIds: ledger.linkedJournalIds || [],
          paperTradeIds: ledger.linkedPaperTradeIds || [],
          replayIds: ledger.linkedReplayIds || []
        },
        outcome: ledger.outcome || snapshot.outcome || { status: "Open", source: "local-educational" },
        learning: activeSignalContext?.signalId === signalId ? (activeSignalContext.learning || {}) : {}
      };
    }

    function updateActiveSignalContext(snapshotOrPatch = {}, stage = "context") {
      const patchSignalId = snapshotOrPatch.signalId;
      const patchSymbol = snapshotOrPatch.symbol || activeSignalContext?.symbol || currentSymbol;
      const sameActiveSignal = patchSignalId && activeSignalContext?.signalId === patchSignalId;
      const hasSetupFields = Boolean(snapshotOrPatch.qualityGate || snapshotOrPatch.tradeRejection || snapshotOrPatch.lightning || snapshotOrPatch.setupSignature);
      const canReuseActive = !patchSignalId && (
        hasSetupFields
          ? canReuseActiveSignalContext(patchSymbol, snapshotOrPatch)
          : activeSignalContext?.symbol === patchSymbol && activeSignalContext?.signalId
      );
      const base = sameActiveSignal || canReuseActive
        ? activeSignalContext
        : snapshotOrPatch.signalId || snapshotOrPatch.symbol || snapshotOrPatch.qualityGate
          ? signalContextFromSnapshot(snapshotOrPatch, stage)
          : activeSignalContext;
      if (!base) return null;
      activeSignalContext = {
        ...(activeSignalContext?.signalId === base.signalId ? activeSignalContext : {}),
        ...base,
        ...snapshotOrPatch,
        stage,
        setupSignature: snapshotOrPatch.setupSignature || base.setupSignature || signalSetupSignature({ ...base, ...snapshotOrPatch }),
        updatedAt: new Date().toISOString(),
        links: {
          ...(base.links || {}),
          ...(snapshotOrPatch.links || {})
        },
        learning: {
          ...(base.learning || {}),
          ...(snapshotOrPatch.learning || {})
        }
      };
      saveActiveSignalContext();
      updateSignalStoryTimeline(activeSignalContext.signalId, signalStoryPatchForStage(activeSignalContext, stage));
      return activeSignalContext;
    }

    function ensureSignalContext(symbol = currentSymbol, stage = "context") {
      if (canReuseActiveSignalContext(symbol)) {
        activeSignalContext.stage = stage;
        activeSignalContext.updatedAt = new Date().toISOString();
        saveActiveSignalContext();
        return activeSignalContext;
      }
      const latest = latestReusableSignalSnapshot(symbol);
      if (latest?.signalId) return updateActiveSignalContext(latest, stage);
      const snapshot = rememberSignalSnapshot(symbol, stage);
      return snapshot ? updateActiveSignalContext(snapshot, stage) : null;
    }

    function linkActiveSignalContext(type, id, patch = {}) {
      if (!activeSignalContext?.signalId) return null;
      const key = type === "journal" ? "journalIds" : type === "paper" ? "paperTradeIds" : "replayIds";
      const links = new Set(activeSignalContext.links?.[key] || []);
      if (id) links.add(id);
      return updateActiveSignalContext({
        signalId: activeSignalContext.signalId,
        symbol: activeSignalContext.symbol,
        links: {
          ...(activeSignalContext.links || {}),
          [key]: [...links]
        },
        ...patch
      }, type);
    }

    function demoContractFor(symbol) {
      const price = Math.round(symbols[symbol]?.price || 100);
      return `${symbol} DEMO ${price}C`;
    }

    function demoPaperTrade(symbol, outcome, pnl, percentMove, daysAgo, tags = []) {
      const signalId = currentSignalReference(symbol);
      const data = symbols[symbol] || symbols[currentSymbol];
      const opened = new Date(Date.now() - (daysAgo * 86400000));
      const closed = new Date(opened.getTime() + 45 * 60000);
      const entryPremium = Math.max(.8, Number((data.price * .012).toFixed(2)));
      const exitPremium = Math.max(.15, Number((entryPremium * (1 + percentMove / 100)).toFixed(2)));
      return {
        buy: {
          id: `DEMO-BUY-${symbol}-${daysAgo}`,
          demo: true,
          signalId,
          symbol,
          contract: demoContractFor(symbol),
          qty: 1,
          action: "BUY",
          entryPremium,
          lastPremium: entryPremium,
          pnl: 0,
          percentMove: 0,
          date: opened.toISOString().slice(0, 10),
          time: opened.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          openedAt: opened.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          plan: {
            signalScore: data.confidence,
            direction: data.type,
            predictedOutcome: predictionFromSignal(data.confidence, getQualityGate(data).verdict, data.type),
            marketRegime: detectMarketRegime(symbol),
            qualityGate: getQualityGate(data).verdict,
            blockers: tags.slice(0, 3),
            nineSig: getNineSig(data).score,
            marketConditions: currentMarketSnapshot(symbol),
            indicators: currentIndicatorSnapshot(data),
            entryStatus: "READY",
            entryTrigger: data.entry.trigger,
            rr: Number(getQualityGate(data).rr.toFixed(2))
          }
        },
        close: {
          id: `DEMO-CLOSE-${symbol}-${daysAgo}`,
          demo: true,
          signalId,
          symbol,
          contract: demoContractFor(symbol),
          qty: 1,
          action: "CLOSE",
          entryPremium,
          exitPremium,
          lastPremium: exitPremium,
          pnl,
          percentMove,
          date: closed.toISOString().slice(0, 10),
          time: closed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          grade: pnl > 0 ? "A" : outcome === "Breakeven" ? "B" : "C",
          processScore: pnl > 0 ? 84 : 58,
          issues: pnl > 0 ? [] : tags,
          plan: {
            signalScore: data.confidence,
            direction: data.type,
            predictedOutcome: predictionFromSignal(data.confidence, getQualityGate(data).verdict, data.type),
            marketRegime: detectMarketRegime(symbol),
            qualityGate: getQualityGate(data).verdict,
            blockers: tags.slice(0, 3),
            nineSig: getNineSig(data).score,
            marketConditions: currentMarketSnapshot(symbol),
            indicators: currentIndicatorSnapshot(data),
            entryStatus: "READY",
            entryTrigger: data.entry.trigger,
            rr: Number(getQualityGate(data).rr.toFixed(2))
          }
        },
        journal: {
          journalId: `DEMO-J-${symbol}-${daysAgo}`,
          demo: true,
          signalId,
          symbol,
          signal: data.type,
          contract: demoContractFor(symbol),
          entryTrigger: data.entry.trigger,
          stop: money(getStopPrice(data)),
          target: money(data.target),
          outcome,
          tags,
          replay: {
            signalScore: data.confidence,
            verdict: getQualityGate(data).verdict,
            predictedOutcome: predictionFromSignal(data.confidence, getQualityGate(data).verdict, data.type),
            marketConditions: currentMarketSnapshot(symbol),
            indicators: currentIndicatorSnapshot(data)
          },
          note: outcome === "Win"
            ? "DEMO: Waited for confirmation, respected the stop, and took the planned target zone."
            : "DEMO: Entered before full confirmation. Replay shows where Strike Out risk started building.",
          date: closed.toISOString().slice(0, 10),
          time: closed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        }
      };
    }

    function loadDemoMode() {
      const samples = [
        demoPaperTrade("NVDA", "Win", 420, 18.4, 1, ["Trend continuation", "A+ Setup"]),
        demoPaperTrade("QQQ", "Win", 260, 9.7, 2, ["Waited", "Clean trigger"]),
        demoPaperTrade("TSLA", "Loss", -180, -7.2, 3, ["Chased", "No Confirmation"]),
        demoPaperTrade("AMD", "Breakeven", 0, 0, 4, ["Skipped", "Replay lesson"])
      ];
      const previousDemoPnl = Number(localStorage.getItem("strikepulseDemoPnl")) || 0;
      const demoPnl = samples.reduce((sum, item) => sum + (Number(item.close.pnl) || 0), 0);
      practiceAccount.history = [
        ...samples.flatMap(item => [item.close, item.buy]),
        ...practiceAccount.history.filter(item => !String(item.id || "").startsWith("DEMO-") && !item.demo)
      ].slice(0, practiceHistoryLimit);
      practiceAccount.positions = practiceAccount.positions.filter(item => !item.demo);
      practiceAccount.startingCash = Number(practiceAccount.startingCash) || 25000;
      practiceAccount.realizedPnl = (Number(practiceAccount.realizedPnl) || 0) - previousDemoPnl + demoPnl;
      practiceAccount.cash = (Number(practiceAccount.cash) || practiceAccount.startingCash) - previousDemoPnl + demoPnl;

      journalEntries = [
        ...samples.map(item => item.journal),
        ...journalEntries.filter(item => !String(item.journalId || "").startsWith("DEMO-J-") && !item.demo)
      ].slice(0, 12);

      ["NVDA", "QQQ", "TSLA", "AMD"].forEach(symbol => rememberSignalSnapshot(symbol, "demo-mode"));
      samples.forEach(item => {
        linkSignalLedger(item.close.signalId, "paper", item.close.id, {
          linkedPaperTradeIds: [item.close.id],
          linkedJournalIds: [item.journal.journalId],
          userVerdict: item.journal.outcome === "Loss" ? "Replay First" : "Paper trade reviewed",
          outcome: {
            status: "Closed",
            paperTradeOutcome: item.close.pnl,
            winLoss: item.close.pnl > 0 ? "Win" : item.close.pnl < 0 ? "Loss" : "Breakeven",
            percentMove: item.close.percentMove,
            maxFavorableExcursion: Math.max(0, item.close.percentMove + 3),
            maxAdverseExcursion: Math.min(0, item.close.percentMove - 4),
            source: "local-demo"
          },
          graveyard: {
            buried: item.close.pnl < 0,
            failureReasons: item.close.pnl < 0 ? item.close.issues : []
          }
        });
      });

      startFlowProgress = {
        ...startFlowProgress,
        ticker: true,
        daily: true,
        ticket: true,
        replay: true
      };
      localStorage.setItem("strikepulseDemoMode", "loaded");
      localStorage.setItem("strikepulseDemoPnl", String(demoPnl));
      savePracticeAccount();
      localStorage.setItem("strikepulseJournal", JSON.stringify(journalEntries));
      saveStartFlowProgress();
      renderPracticeAccount();
      renderJournal();
      renderStartFlow();
      renderEagleScoutCommandCenter();
      showNeutralToast("Demo samples loaded locally");
      openSignalExplanation("NVDA", "live");
    }

    function shareCardTone(verdict) {
      if (verdict === "APPROVED" || verdict === "CONFIRM") return {
        badge: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
        score: "text-emerald-200",
        status: "Signal card ready: confirmation candidate."
      };
      if (verdict === "REJECT") return {
        badge: "border-rose-300/30 bg-rose-300/10 text-rose-100",
        score: "text-rose-200",
        status: "Rejection card ready: blocker-first decision."
      };
      return {
        badge: "border-amber-300/30 bg-amber-300/10 text-amber-100",
        score: "text-amber-100",
        status: "Wait card ready: confirmation still needed."
      };
    }

    function buildShareSignalPayload(symbol = currentSymbol) {
      const data = symbols[symbol] || symbols[currentSymbol];
      const gate = getQualityGate(data);
      const rejection = evaluateTradeRejection(data, gate, symbol);
      const lightning = evaluateLightningStrike(data, gate, rejection, symbol);
      const weather = getMarketWeather(symbol);
      const suggestedAction = signalSuggestedAction(gate, rejection, lightning);
      const verdict = rejection.verdict === "REJECT" ? "REJECT" : rejection.verdict === "APPROVED" && suggestedAction === "Confirm" ? "CONFIRM" : rejection.verdict;
      const topBlocker = rejection.blockers[0] || gate.reasons[0] || (rejection.verdict === "APPROVED" ? "No major blockers detected. Risk management still required." : "Wait for cleaner confirmation.");
      const why = rejection.verdict === "REJECT"
        ? rejection.mainReason
        : `${gate.verdict} with ${data.confidence}/100 Eagle Score, ${currentContractLabelFor(symbol)}, and ${weather.label} market weather.`;
      return {
        brand: "STRIKEPULSE",
        title: "Signal Check",
        symbol,
        direction: data.type,
        price: money(data.price),
        timeframe: activeRange,
        verdict,
        action: suggestedAction,
        eagleScore: data.confidence,
        qualityGate: gate.verdict,
        qualityScore: gate.score,
        rewardRisk: `${gate.rr.toFixed(2)}:1`,
        rejectionScore: rejection.score,
        rejectionReason: rejection.mainReason,
        why,
        topBlocker,
        lightning: lightning.verdict,
        lightningIn: lightning.inProbability,
        lightningOut: lightning.outProbability,
        weather: `${weather.label} ${weather.score}/100`,
        regime: weather.regime,
        signalId: latestSignalIdForSymbol(symbol),
        generatedAt: new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        disclaimer: "Educational signal research only. Paper trading workflow. Not financial advice. No brokerage execution."
      };
    }

    function shareSignalText(payload = buildShareSignalPayload()) {
      return [
        `${payload.brand} ${payload.title}`,
        `${payload.symbol} ${payload.direction} | ${payload.verdict} | Action: ${payload.action}`,
        `Eagle Score: ${payload.eagleScore}/100 | Quality: ${payload.qualityGate} | R/R: ${payload.rewardRisk}`,
        `Lightning: ${payload.lightning} | In ${payload.lightningIn}% / Out ${payload.lightningOut}%`,
        `Market Weather: ${payload.weather} | Regime: ${payload.regime}`,
        `Why: ${payload.rejectionReason}`,
        `Top blocker: ${payload.topBlocker}`,
        `Signal ID: ${payload.signalId}`,
        payload.disclaimer
      ].join("\n");
    }

    async function copyShareSignalCard() {
      const text = shareSignalText();
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
        }
        document.getElementById("shareSignalStatus").textContent = "Copied local signal card text.";
        showNeutralToast("Signal card copied");
      } catch (error) {
        document.getElementById("shareSignalStatus").textContent = "Copy blocked by browser permissions. Text preview is still visible.";
        showNeutralToast("Copy blocked by browser");
      }
    }

    function drawShareSignalCanvas(payload) {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      const verdict = payload.verdict;
      const accent = verdict === "REJECT" ? "#FF4D4D" : verdict === "CONFIRM" || verdict === "APPROVED" ? "#22FF88" : "#B8C2CC";
      const muted = "#B8C2CC";
      ctx.fillStyle = "#0B1020";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, 0, 1200, 720);
      gradient.addColorStop(0, "rgba(30,94,255,.20)");
      gradient.addColorStop(.55, "rgba(11,16,32,.88)");
      gradient.addColorStop(1, "rgba(0,229,255,.10)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(36, 36, 1128, 648);

      ctx.fillStyle = "#e5e7eb";
      ctx.font = "900 34px Arial";
      ctx.fillText("STRIKEPULSE", 72, 100);
      ctx.fillStyle = muted;
      ctx.font = "700 18px Arial";
      ctx.fillText("Educational Signal Check | Paper Trading Workflow", 72, 132);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "900 84px Arial";
      ctx.fillText(payload.symbol, 72, 238);
      ctx.fillStyle = muted;
      ctx.font = "800 24px Arial";
      ctx.fillText(`${payload.direction} | ${payload.timeframe} | ${payload.price}`, 76, 276);

      ctx.fillStyle = accent;
      ctx.font = "900 54px Arial";
      ctx.fillText(payload.verdict, 760, 130);
      ctx.font = "900 24px Arial";
      ctx.fillText(`Action: ${payload.action}`, 764, 170);

      const stat = (x, y, label, value, color = "#e5e7eb") => {
        ctx.fillStyle = "rgba(15,23,42,.82)";
        ctx.fillRect(x, y, 230, 106);
        ctx.strokeStyle = "rgba(255,255,255,.12)";
        ctx.strokeRect(x, y, 230, 106);
        ctx.fillStyle = muted;
        ctx.font = "800 17px Arial";
        ctx.fillText(label, x + 20, y + 34);
        ctx.fillStyle = color;
        ctx.font = "900 28px Arial";
        ctx.fillText(value, x + 20, y + 72);
      };
      stat(72, 330, "Eagle Score", `${payload.eagleScore}/100`, accent);
      stat(324, 330, "Lightning", payload.lightning.replace("⚡ ", "").slice(0, 18), "#fde68a");
      stat(576, 330, "Weather", payload.weather, "#bae6fd");
      stat(828, 330, "R/R", payload.rewardRisk, "#e5e7eb");

      ctx.fillStyle = muted;
      ctx.font = "800 20px Arial";
      ctx.fillText("Why", 72, 505);
      ctx.fillText("Top Blocker", 72, 590);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 24px Arial";
      wrapCanvasText(ctx, payload.rejectionReason, 72, 536, 1020, 30, 2);
      ctx.fillStyle = "#e5e7eb";
      wrapCanvasText(ctx, payload.topBlocker, 72, 622, 1020, 28, 2);

      ctx.fillStyle = "#64748b";
      ctx.font = "700 17px Arial";
      ctx.fillText(`Signal ID: ${payload.signalId} | Generated ${payload.generatedAt}`, 72, 670);
      ctx.fillText("Educational only. Not financial advice. No brokerage execution.", 690, 670);
      return canvas;
    }

    function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
      const words = String(text || "").split(/\s+/);
      let line = "";
      let lines = 0;
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          ctx.fillText(lines === maxLines - 1 ? `${line}...` : line, x, y);
          lines += 1;
          if (lines >= maxLines) return;
          line = word;
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      if (line && lines < maxLines) ctx.fillText(line, x, y);
    }

    function downloadShareSignalCard() {
      const payload = buildShareSignalPayload();
      const canvas = drawShareSignalCanvas(payload);
      const link = document.createElement("a");
      link.download = `STRIKEPULSE-${payload.symbol}-${payload.verdict}-signal-card.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      document.getElementById("shareSignalStatus").textContent = "PNG generated locally from the current signal card.";
      showNeutralToast("Signal card PNG downloaded");
    }

    function renderShareSignalCard(symbol = currentSymbol) {
      const panel = document.getElementById("shareSignalPanel");
      if (!panel) return;
      const payload = buildShareSignalPayload(symbol);
      const tone = shareCardTone(payload.verdict);
      document.getElementById("shareCardSymbol").textContent = `${payload.symbol} ${payload.direction}`;
      document.getElementById("shareCardVerdict").textContent = payload.verdict;
      document.getElementById("shareCardVerdict").className = `rounded-lg border px-3 py-2 text-xs font-black ${tone.badge}`;
      document.getElementById("shareCardHeadline").textContent = `${payload.action}: ${payload.rejectionReason}`;
      document.getElementById("shareCardEagleScore").textContent = `${payload.eagleScore}/100`;
      document.getElementById("shareCardEagleScore").className = `mt-1 text-lg font-black ${tone.score}`;
      document.getElementById("shareCardLightning").textContent = payload.lightning;
      document.getElementById("shareCardWeather").textContent = payload.weather;
      document.getElementById("shareCardSignalId").textContent = payload.signalId;
      document.getElementById("shareCardWhy").textContent = payload.why || payload.rejectionReason;
      document.getElementById("shareCardBlocker").textContent = payload.topBlocker;
      document.getElementById("shareCardDisclaimer").textContent = payload.disclaimer;
      document.getElementById("shareSignalStatus").textContent = tone.status;
    }

    function buildSignalSnapshot(symbol = currentSymbol, source = "scan") {
      const data = symbols[symbol] || symbols[currentSymbol];
      if (!data) return null;
      const gate = getQualityGate(data);
      const rejection = evaluateTradeRejection(data, gate, symbol);
      const lightning = evaluateLightningStrike(data, gate, rejection, symbol);
      const weather = getMarketWeather(symbol);
      const sectorRotation = buildSectorRotation(rankSetups());
      const sectorRead = sectorRotation.sectors.find(item => item.sector === data.sector);
      const timestamp = new Date().toISOString();
      const timeLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const signalDraft = {
        symbol,
        timestamp,
        timeframe: activeRange,
        qualityGate: { verdict: gate.verdict },
        tradeRejection: { verdict: rejection.verdict },
        lightning: { verdict: lightning.verdict }
      };
      const reusableSnapshot = latestReusableSignalSnapshot(symbol, signalDraft);
      const reusableRecord = latestReusableSignalRecord(symbol, signalDraft);
      return {
        id: `${Date.now()}-${symbol}-${source}`,
        signalId: canReuseActiveSignalContext(symbol, signalDraft)
          ? activeSignalContext.signalId
          : reusableSnapshot?.signalId || reusableRecord?.signalId || generateSignalId(symbol),
        source,
        symbol,
        timestamp,
        timeLabel,
        price: Number(data.price.toFixed(2)),
        timeframe: activeRange,
        setupSignature: signalSetupSignature(signalDraft),
        marketWeather: {
          label: weather.label,
          score: weather.score,
          summary: weather.summary
        },
        marketRegime: weather.regime,
        sectorRotation: {
          sector: data.sector,
          bias: sectorRead?.bias || "Mixed",
          confidence: sectorRead?.confidence ?? null,
          context: sectorRead?.context || marketContext.sectors?.[data.sector] || "Mixed"
        },
        qualityGate: {
          verdict: gate.verdict,
          score: gate.score,
          rewardRisk: Number(gate.rr.toFixed(2)),
          reasons: gate.reasons
        },
        tradeRejection: {
          verdict: rejection.verdict,
          score: rejection.score,
          mainReason: rejection.mainReason,
          blockers: rejection.blockers,
          improvements: rejection.improvements
        },
        eagleScore: data.confidence,
        confidence: data.confidence,
        lightning: {
          verdict: lightning.verdict,
          strikeInProbability: lightning.inProbability,
          strikeOutProbability: lightning.outProbability,
          premiumTier: lightning.premiumLocked,
          factors: lightning.factors
        },
        activeBlockers: [...new Set([...(gate.reasons || []), ...(rejection.blockers || [])])].slice(0, 8),
        suggestedAction: signalSuggestedAction(gate, rejection, lightning),
        outcome: null
      };
    }

    function saveSignalMemory() {
      localStorage.setItem("strikepulseSignalMemory", JSON.stringify(signalMemory.slice(0, 250)));
    }

    function rememberSignalSnapshot(symbol = currentSymbol, source = "scan") {
      const snapshot = buildSignalSnapshot(symbol, source);
      if (!snapshot) return null;
      const reusable = latestReusableSignalSnapshot(symbol, snapshot);
      if (reusable?.signalId) {
        const merged = {
          ...reusable,
          ...snapshot,
          id: reusable.id || snapshot.id,
          signalId: reusable.signalId,
          timestamp: reusable.timestamp || snapshot.timestamp
        };
        signalMemory = [merged, ...signalMemory.filter(item => item.id !== reusable.id)].slice(0, 250);
        upsertSignalLedger(merged);
        saveSignalMemory();
        updateActiveSignalContext(merged, source);
        return merged;
      }
      const last = signalMemory[0];
      const duplicate = last &&
        last.symbol === snapshot.symbol &&
        last.source === snapshot.source &&
        last.timeframe === snapshot.timeframe &&
        last.qualityGate?.verdict === snapshot.qualityGate.verdict &&
        last.tradeRejection?.verdict === snapshot.tradeRejection.verdict &&
        last.lightning?.verdict === snapshot.lightning.verdict;
      if (duplicate && Date.now() - Date.parse(last.timestamp) < 45000) {
        if (!last.signalId) {
          last.signalId = upsertSignalLedger(last);
          saveSignalMemory();
        }
        updateActiveSignalContext(last, source);
        return last;
      }
      upsertSignalLedger(snapshot);
      signalMemory = [snapshot, ...signalMemory].slice(0, 250);
      saveSignalMemory();
      updateActiveSignalContext(snapshot, source);
      renderSignalGraveyard();
      renderTradeDna();
      renderProofEngine();
      return snapshot;
    }

    function todayKey() {
      return new Date().toISOString().slice(0, 10);
    }

    function isTodayTrade(trade) {
      return !trade.date || trade.date === todayKey();
    }

    function heatmapTone(score) {
      if (score >= 82) return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
      if (score >= 68) return "border-cyan-300/30 bg-cyan-400/12 text-cyan-100";
      if (score >= 54) return "border-amber-300/30 bg-amber-300/12 text-amber-100";
      return "border-rose-300/30 bg-rose-400/12 text-rose-100";
    }

    function sectorBiasTone(bias) {
      if (bias === "Bullish") return "border-emerald-300/30 text-emerald-100";
      if (bias === "Bearish") return "border-rose-300/30 text-rose-100";
      return "border-amber-300/30 text-amber-100";
    }

    function buildSectorRotation(ranked = rankSetups()) {
      const groups = new Map();
      ranked.forEach(item => {
        const sector = item.data.sector || "Unclassified";
        if (!groups.has(sector)) groups.set(sector, []);
        groups.get(sector).push(item);
      });

      const sectors = [...groups.entries()].map(([sector, items]) => {
        const sortedBest = [...items].sort((a, b) => b.opportunityScore - a.opportunityScore);
        const sortedRisk = [...items].sort((a, b) => b.avoidScore - a.avoidScore);
        const score = Math.round(items.reduce((sum, item) => sum + item.opportunityScore, 0) / items.length);
        const approved = items.filter(item => item.rejection.verdict === "APPROVED").length;
        const rejected = items.filter(item => item.rejection.verdict === "REJECT").length;
        const bullish = items.filter(item => item.data.type === "Bullish").length;
        const bearish = items.filter(item => item.data.type === "Bearish").length;
        const context = marketContext.sectors?.[sector] || "Mixed";
        const contextAdjustment = context === "Aligned" ? 8 : context === "Fighting" ? -12 : 0;
        const confidence = Math.max(0, Math.min(100, Math.round(score + contextAdjustment + approved * 4 - rejected * 5)));
        const bias = confidence >= 72 && bullish >= bearish ? "Bullish" : confidence <= 48 || rejected > approved ? "Bearish" : "Mixed";
        return {
          sector,
          items,
          score,
          confidence,
          approved,
          rejected,
          bullish,
          bearish,
          context,
          bias,
          best: sortedBest[0],
          worst: sortedRisk[0]
        };
      }).sort((a, b) => b.confidence - a.confidence);

      const leaders = sectors.slice(0, 4);
      const laggards = [...sectors].sort((a, b) => a.confidence - b.confidence).slice(0, 4);
      const leaderText = leaders[0] ? `${leaders[0].sector} is leading` : "No leader detected";
      const laggardText = laggards[0] ? `${laggards[0].sector} is lagging` : "no clear laggard";
      const approvedCount = sectors.reduce((sum, sector) => sum + sector.approved, 0);
      const rejectedCount = sectors.reduce((sum, sector) => sum + sector.rejected, 0);
      const overallBias = approvedCount > rejectedCount + 2 ? "Bullish" : rejectedCount > approvedCount ? "Bearish" : "Mixed";
      const summary = `${leaderText}, while ${laggardText}. Money is rotating toward ${leaders.slice(0, 2).map(item => item.sector).join(" and ") || "higher-quality setups"}; avoid chasing sectors with rejection-engine blockers.`;

      return { sectors, leaders, laggards, overallBias, summary };
    }

    function sectorCardHtml(sector, mode = "leader") {
      const item = mode === "leader" ? sector.best : sector.worst;
      const tone = sectorBiasTone(sector.bias);
      const symbol = item?.symbol || "--";
      const score = mode === "leader" ? item?.opportunityScore : item?.avoidScore;
      const subtitle = mode === "leader"
        ? `Best: ${symbol} · ${item?.rejection.verdict || "--"} · ${item?.gate.verdict || "--"}`
        : `Risk: ${symbol} · ${item ? setupReason(item) : "No risk candidate"}`;
      return `
        <button data-sector-symbol="${symbol}" class="w-full rounded-lg border ${tone} bg-zinc-900/80 p-3 text-left hover:border-white/40">
          <span class="flex items-center justify-between gap-3">
            <span class="min-w-0">
              <span class="block truncate text-sm font-black">${escapeHtml(sector.sector)}</span>
              <span class="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-zinc-400">${escapeHtml(subtitle)}</span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-black">${sector.confidence}</span>
              <span class="block text-[10px] font-bold text-zinc-500">${escapeHtml(sector.bias)}</span>
            </span>
          </span>
          <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-zinc-950/70">
            <span class="block h-full rounded-full bg-current" style="width: ${Math.max(5, Math.min(100, Number(score) || sector.confidence))}%"></span>
          </span>
        </button>
      `;
    }

    function renderSectorRotation(ranked = rankSetups()) {
      const rotation = buildSectorRotation(ranked);
      const biasTone = sectorBiasTone(rotation.overallBias);
      document.getElementById("sectorRotationSummary").textContent = rotation.summary;
      document.getElementById("sectorRotationBias").textContent = `${rotation.overallBias} ROTATION`;
      document.getElementById("sectorRotationBias").className = `w-fit rounded-full border ${biasTone} bg-zinc-950/70 px-3 py-1 text-xs font-black`;
      document.getElementById("sectorLeaders").innerHTML = rotation.leaders.length
        ? rotation.leaders.map(sector => sectorCardHtml(sector, "leader")).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-500">No leading sectors yet.</div>`;
      document.getElementById("sectorLaggards").innerHTML = rotation.laggards.length
        ? rotation.laggards.map(sector => sectorCardHtml(sector, "laggard")).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-500">No lagging sectors yet.</div>`;
      document.getElementById("sectorBoard").innerHTML = rotation.sectors.map(sector => {
        const tone = sectorBiasTone(sector.bias);
        return `
          <article class="rounded-lg border ${tone} bg-zinc-900/80 p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-black">${escapeHtml(sector.sector)}</p>
                <p class="mt-1 text-[11px] font-bold text-zinc-400">${sector.context} context · ${sector.approved} approved · ${sector.rejected} rejected</p>
              </div>
              <span class="shrink-0 rounded-full border ${tone} bg-zinc-950/70 px-2 py-1 text-xs font-black">${sector.confidence}</span>
            </div>
            <div class="mt-3 grid gap-2">
              <button data-sector-symbol="${sector.best?.symbol || currentSymbol}" class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-left hover:border-emerald-300/50">
                <p class="text-[10px] font-bold uppercase text-zinc-500">Best</p>
                <p class="mt-0.5 text-xs font-black text-emerald-200">${escapeHtml(sector.best?.symbol || "--")} · ${sector.best?.opportunityScore ?? "--"}/100</p>
              </button>
              <button data-sector-symbol="${sector.worst?.symbol || currentSymbol}" class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-left hover:border-rose-300/50">
                <p class="text-[10px] font-bold uppercase text-zinc-500">Highest Risk</p>
                <p class="mt-0.5 text-xs font-black text-rose-200">${escapeHtml(sector.worst?.symbol || "--")} · ${sector.worst?.rejection.verdict || "--"}</p>
              </button>
            </div>
          </article>
        `;
      }).join("");
      document.querySelectorAll("[data-sector-symbol]").forEach(button => {
        button.addEventListener("click", () => {
          if (symbols[button.dataset.sectorSymbol]) openSignalExplanation(button.dataset.sectorSymbol, button.textContent.includes("Worst") ? "reject" : "live");
        });
      });
    }

    function dailyCommandProofLesson() {
      const metrics = buildProofEngineMetrics();
      const buckets = replayOutcomeBuckets();
      const richestBucket = [...buckets].sort((a, b) => b.items.length - a.items.length)[0];
      if (!metrics.total) {
        return {
          text: "Build the sample",
          meta: "No signals tracked yet",
          lesson: "Replay and journal the next setup."
        };
      }
      if (metrics.closed < 20) {
        return {
          text: `${metrics.closed}/${metrics.total} outcomes linked`,
          meta: "Sample still building",
          lesson: richestBucket?.items.length ? `Study ${richestBucket.label.toLowerCase()}.` : "Close paper trades to create proof."
        };
      }
      const bestBand = [...metrics.eagleBands]
        .filter(band => band.closed)
        .sort((a, b) => (b.wins / b.closed) - (a.wins / a.closed))[0];
      return {
        text: bestBand ? `${bestBand.band} band leads` : "Proof active",
        meta: `${metrics.closed} linked outcomes`,
        lesson: metrics.failures[0] ? `Watch ${metrics.failures[0][0].toLowerCase()}.` : "Repeat clean confirmations."
      };
    }

    function dailyCommandRisk(top, weather) {
      if (!top) return "No ranked setup yet.";
      if (["Storm", "Danger"].includes(weather.label)) return `${weather.label} market conditions can override good-looking setups.`;
      if (top.rejection.verdict === "REJECT") return top.rejection.mainReason || "Trade Rejection Engine blocks the top setup.";
      if (top.rejection.verdict === "WAIT") return setupReason(top);
      return setupReason(top) || "Protect against chasing after the first move.";
    }

    function dailyCommandAction(top, weather, proof) {
      if (!top) return "Scan the watchlist first.";
      if (["Storm", "Danger"].includes(weather.label) && top.rejection.verdict !== "APPROVED") return "Reject weak setups and wait for cleaner weather.";
      if (top.rejection.verdict === "APPROVED") return "Open the ticket, confirm trigger, paper trade only, then journal the outcome.";
      if (top.rejection.verdict === "WAIT") return "Wait for blockers to clear before any paper entry.";
      if (proof.meta.includes("building") || proof.text.includes("/")) return "Use the next setup to build proof, not size.";
      return "Reject this setup and replay the closest matching failure.";
    }

    function eagleCommandGrade(score) {
      if (score >= 92) return "A+";
      if (score >= 85) return "A";
      if (score >= 75) return "B";
      if (score >= 60) return "C";
      if (score >= 45) return "D";
      return "F";
    }

    function eagleCommandTone(action, score) {
      if (action === "Reject" || score < 45) return {
        shield: "rounded-lg border border-rose-300/25 bg-rose-300/10 p-4 text-center",
        core: "eagle-shield-core mx-auto mt-3 grid h-40 w-36 place-items-center border border-rose-200/40 shadow-2xl shadow-rose-950/40",
        meter: "eagle-meter-fill h-full rounded-full bg-rose-300 transition-all duration-700",
        text: "text-rose-100"
      };
      if (action === "Confirm" || score >= 85) return {
        shield: "rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 text-center",
        core: "eagle-shield-core mx-auto mt-3 grid h-40 w-36 place-items-center border border-emerald-200/40 shadow-2xl shadow-emerald-950/40",
        meter: "eagle-meter-fill h-full rounded-full bg-emerald-300 transition-all duration-700",
        text: "text-emerald-100"
      };
      return {
        shield: "rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-center",
        core: "eagle-shield-core mx-auto mt-3 grid h-40 w-36 place-items-center border border-amber-200/40 shadow-2xl shadow-amber-950/40",
        meter: "eagle-meter-fill h-full rounded-full bg-amber-300 transition-all duration-700",
        text: "text-amber-100"
      };
    }

    function eagleCommandAiCopy(mode, payload) {
      const blockers = payload.rejection.blockers.length ? payload.rejection.blockers.slice(0, 2).join(" ") : "No hard blocker is active, but normal risk management still applies.";
      const copy = {
        setup: `${payload.symbol} is a ${payload.data.type.toLowerCase()} setup with Eagle Score ${payload.score}/100, Quality Gate ${payload.gate.verdict}, and ${payload.weather.label} market weather.`,
        risk: `Primary risk: ${payload.rejection.mainReason} Strike Out is ${payload.lightning.outProbability}% and reward/risk is ${payload.gate.rr.toFixed(2)}:1.`,
        entry: payload.data.entry.status === "READY"
          ? `Entry is marked READY. Confirm the planned trigger: ${payload.data.entry.trigger}. Paper mode only.`
          : `Entry is not ready. Wait for ${payload.data.entry.trigger} instead of chasing before confirmation.`,
        exit: `Use the current plan: stop near ${money(getStopPrice(payload.data))}, target near ${money(payload.data.target)}, and reassess if Lightning Strike Out rises.`,
        rejection: `${payload.rejection.verdict}: ${blockers}`
      };
      return copy[mode] || copy.setup;
    }

    function renderEagleCommandMiniChart(data, lightning, lightningEnabled) {
      const chart = document.getElementById("eagleCommandMiniChart");
      const markers = document.getElementById("eagleCommandLightningMarkers");
      if (!chart || !markers) return;
      const bars = candles.slice(-34);
      const low = Math.min(...bars.map(item => item.low));
      const high = Math.max(...bars.map(item => item.high));
      const range = Math.max(.01, high - low);
      chart.innerHTML = bars.map((bar, index) => {
        const height = Math.max(12, Math.min(100, ((bar.high - bar.low) / range) * 100));
        const body = Math.max(10, Math.min(100, (Math.abs(bar.close - bar.open) / range) * 100 + 14));
        const up = bar.close >= bar.open;
        const opacity = index > bars.length - 7 ? "opacity-100" : "opacity-70";
        return `<div class="flex h-full flex-1 items-end"><div class="eagle-mini-bar w-full rounded-t ${up ? "bg-emerald-300" : "bg-rose-300"} ${opacity}" style="height:${Math.max(height, body)}%"></div></div>`;
      }).join("");
      markers.innerHTML = lightningEnabled
        ? `
          <button data-command-marker="strikeIn" class="eagle-lightning-marker pointer-events-auto absolute left-[62%] top-[14%] rounded-full border border-emerald-200 bg-zinc-950/85 px-3 py-1 text-[10px] font-black text-emerald-100 shadow-lg shadow-emerald-950/50" type="button">⚡ STRIKE IN ${lightning.inProbability}%</button>
          <button data-command-marker="strikeOut" class="eagle-lightning-marker pointer-events-auto absolute left-[8%] top-[64%] rounded-full border border-rose-200 bg-zinc-950/85 px-3 py-1 text-[10px] font-black text-rose-100 shadow-lg shadow-rose-950/50" type="button">⚡ STRIKE OUT ${lightning.outProbability}%</button>
        `
        : `<div class="absolute right-3 top-3 rounded-full border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-[10px] font-black text-zinc-400">Lightning off</div>`;
      markers.querySelectorAll("[data-command-marker]").forEach(button => {
        button.addEventListener("click", () => openSignalExplanation(currentSymbol, button.dataset.commandMarker));
      });
    }

    function missionTodayKey() {
      return new Date().toISOString().slice(0, 10);
    }

    function consecutiveDayCount(days = []) {
      const unique = [...new Set(days)].sort().reverse();
      if (!unique.length) return 0;
      let count = 0;
      const cursor = new Date();
      for (const day of unique) {
        const expected = cursor.toISOString().slice(0, 10);
        if (day !== expected) break;
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return count;
    }

    function readMissionState() {
      const state = readStoredJson("strikepulseMissionState", { openDays: [], studiedDays: [] });
      return {
        openDays: Array.isArray(state.openDays) ? state.openDays : [],
        studiedDays: Array.isArray(state.studiedDays) ? state.studiedDays : []
      };
    }

    function saveMissionState(state) {
      localStorage.setItem("strikepulseMissionState", JSON.stringify({
        openDays: [...new Set(state.openDays || [])].slice(-90),
        studiedDays: [...new Set(state.studiedDays || [])].slice(-90)
      }));
    }

    function touchMissionOpenDay() {
      const today = missionTodayKey();
      const state = readMissionState();
      if (!state.openDays.includes(today)) {
        state.openDays.push(today);
        saveMissionState(state);
      }
      return state;
    }

    function markMissionStudied() {
      const today = missionTodayKey();
      const state = readMissionState();
      if (!state.studiedDays.includes(today)) {
        state.studiedDays.push(today);
        saveMissionState(state);
      }
      renderEagleScoutCommandCenter();
      showNeutralToast("Daily mission marked studied");
    }

    function missionStatusFor(weather, action, dangerCount, replayCount) {
      if (["Storm", "Danger"].includes(weather.label)) return {
        status: "Defense First",
        mode: "Stand Down",
        objective: "Protect capital. Study danger signals and only paper trade if blockers clear.",
        tone: "border-rose-300/30 bg-rose-300/10 text-rose-100"
      };
      if (action === "Confirm" && dangerCount < 2) return {
        status: "Hunt One Setup",
        mode: "Mission Ready",
        objective: "Focus on one clean setup. Confirm trigger, paper trade only, then journal the decision.",
        tone: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      };
      if (replayCount) return {
        status: "Replay Then Trade",
        mode: "Study First",
        objective: "Replay the highest-value lesson before taking new paper risk.",
        tone: "border-indigo-300/30 bg-indigo-300/10 text-indigo-100"
      };
      return {
        status: "Go Slow",
        mode: "Selective",
        objective: "Wait for stronger confirmation. No trade is a valid mission outcome.",
        tone: "border-amber-300/30 bg-amber-300/10 text-amber-100"
      };
    }

    function missionDailyFocus(status, confidence, proof, graveyardCount, dna) {
      if (status.status === "Defense First") return {
        goal: "Protect capital and study one danger signal",
        detail: "Bad weather means the best mission is discipline, not forcing entries."
      };
      if (dna?.bestSetup?.expectancy > 0 && dna.sampleSize >= 6 && confidence >= 58) return {
        goal: "Trade only your Eagle DNA edge",
        detail: `Favor ${dna.bestSetup.key.split(" · ").slice(0, 3).join(" · ")} and reject anything outside the playbook.`
      };
      if (!proof.closed) return {
        goal: "Build the proof sample",
        detail: "Paper trade only, journal the decision, then replay the result."
      };
      if (graveyardCount) return {
        goal: "Eliminate the top Graveyard mistake",
        detail: "Study the warning before taking fresh paper risk."
      };
      if (confidence >= 78) return {
        goal: "Hunt one clean confirmed setup",
        detail: "One high-quality paper trade beats five noisy attempts."
      };
      return {
        goal: "Wait for confirmation",
        detail: "No trade is valid when the mission board is mixed."
      };
    }

    function missionEagleDnaReadout(dna) {
      if (!dna || dna.sampleSize < 6) {
        return {
          headline: "Build the Eagle DNA sample",
          rule: "Close paper trades, journal outcomes, and replay signals so STRIKEPULSE can identify your real edge."
        };
      }
      const best = dna.bestSetup?.key || "No clear best setup yet";
      const bestShort = best.split(" · ").slice(0, 4).join(" · ");
      const avoid = dna.worstSetup?.pnl < 0 ? dna.worstSetup.key.split(" · ").slice(0, 3).join(" · ") : null;
      const winText = dna.bestSetup ? `${Math.round(dna.bestSetup.winRate * 100)}% win` : "win rate building";
      const moveText = dna.bestSetup ? tradeDnaPercent(dna.bestSetup.avgMove ?? dna.avgWinningMove) : "--";
      return {
        headline: `${bestShort} · ${winText} · ${moveText}`,
        rule: avoid
          ? `Avoid ${avoid}${dna.topMistake ? ` when ${dna.topMistake.label.toLowerCase()} appears` : ""}.`
        : dna.recommendation
      };
    }

    function missionPrimaryActionReadout(status, payload, confidence) {
      if (status.status === "Defense First" || payload.rejection.verdict === "REJECT") {
        return {
          action: "Stand down / study",
          rule: payload.rejection.mainReason || "Market weather is unfavorable. Protect demo capital and review the warning."
        };
      }
      if (payload.action === "Confirm" && confidence >= 78 && payload.lightning.inProbability >= 68) {
        return {
          action: "One paper setup only",
          rule: "Confirm the trigger, size the demo risk, then journal the decision."
        };
      }
      if (payload.lightning.inProbability >= 68) {
        return {
          action: "Wait for Lightning trigger",
          rule: "Momentum is building. Do not chase before entry confirmation and risk/reward clear."
        };
      }
      return {
        action: "Watchlist and wait",
        rule: "The board is not clean enough yet. No trade is a valid outcome."
      };
    }

    function missionTopRiskReadout(payload, graveyardLesson, dangerSignals) {
      if (payload.rejection.verdict === "REJECT") {
        return {
          risk: payload.rejection.mainReason || "Trade Rejection Engine active",
          rule: payload.rejection.blockers?.[0] || "Respect the rejection before considering any paper entry."
        };
      }
      if (graveyardLesson) {
        return {
          risk: `${graveyardLesson.symbol}: ${graveyardLesson.cause || "Failure pattern"}`,
          rule: graveyardLesson.prevention || "Study the failed setup before taking fresh paper risk."
        };
      }
      if (dangerSignals.length) {
        const topDanger = dangerSignals[0];
        return {
          risk: `${topDanger.symbol}: Strike Out ${topDanger.lightning.outProbability}%`,
          rule: topDanger.rejection.mainReason || "Avoid the setup until risk cools."
        };
      }
      return {
        risk: `${payload.weather.label} weather`,
        rule: `Volatility ${payload.weather.volatilityScore}/100 and breadth ${payload.weather.breadthScore}/100 set today's risk backdrop.`
      };
    }

    function missionProofPulseReadout(proof) {
      if (!proof.closed) {
        return {
          pulse: "0 outcomes logged",
          rule: "Start the proof sample with paper trades, journal links, and replay reviews."
        };
      }
      const successRate = Math.round((proof.successRate || 0) * 100);
      if (proof.closed < 20) {
        return {
          pulse: `${proof.closed}/20 proof sample`,
          rule: `${successRate}% early success rate. Treat this as directional, not proven yet.`
        };
      }
      return {
        pulse: `${successRate}% signal success`,
        rule: `${proof.closed} closed outcomes. Use the Proof Engine before trusting stronger automation ideas.`
      };
    }

    function renderCockpitPriority({ status, payload, confidence, primaryAction, topRisk, proofPulse }) {
      const actionEl = document.getElementById("cockpitNowAction");
      const reasonEl = document.getElementById("cockpitNowReason");
      const riskEl = document.getElementById("cockpitNowRisk");
      const confidenceEl = document.getElementById("cockpitNowConfidence");
      const proofEl = document.getElementById("cockpitNowProof");
      if (!actionEl || !reasonEl || !riskEl || !confidenceEl || !proofEl) return;
      const confidenceLabel = confidence >= 78 ? "High" : confidence >= 58 ? "Selective" : "Low";
      actionEl.textContent = primaryAction.action;
      reasonEl.textContent = `${status.objective} ${primaryAction.rule}`;
      riskEl.textContent = topRisk.risk;
      confidenceEl.textContent = `${confidence}/100 · ${confidenceLabel}`;
      proofEl.textContent = proofPulse.pulse;
      const strip = document.getElementById("cockpitPriorityStrip");
      if (strip) {
        const tone = payload.rejection.verdict === "REJECT" || status.status === "Defense First"
          ? "border-rose-300/30"
          : confidence >= 78 ? "border-emerald-300/30" : "border-cyan-300/25";
        strip.className = `sp-premium-card mb-5 rounded-lg border ${tone} p-4`;
      }
    }

    function missionLightningOpportunities(ranked) {
      return ranked
        .map(item => {
          const lightning = evaluateLightningStrike(item.data, item.gate, item.rejection, item.symbol);
          return { ...item, lightning };
        })
        .filter(item => item.rejection.verdict !== "REJECT" && item.lightning.inProbability >= 62)
        .sort((a, b) => b.lightning.inProbability - a.lightning.inProbability)
        .slice(0, 3);
    }

    function missionDangerSignals(ranked) {
      return ranked
        .map(item => {
          const lightning = evaluateLightningStrike(item.data, item.gate, item.rejection, item.symbol);
          return { ...item, lightning };
        })
        .filter(item => item.rejection.verdict === "REJECT" || item.lightning.outProbability >= 66)
        .sort((a, b) => (b.lightning.outProbability + (b.rejection.verdict === "REJECT" ? 25 : 0)) - (a.lightning.outProbability + (a.rejection.verdict === "REJECT" ? 25 : 0)))
        .slice(0, 3);
    }

    function renderMissionList(targetId, items, emptyText, itemTemplate) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.innerHTML = items.length
        ? items.map(itemTemplate).join("")
        : `<p class="text-xs leading-relaxed opacity-80">${emptyText}</p>`;
    }

    function renderDailyMission(payload) {
      updateActiveSignalContext({
        symbol: payload.symbol || currentSymbol,
        signalId: currentSignalReference(payload.symbol || currentSymbol),
        source: "mission-briefing",
        eagleScore: payload.score,
        suggestedAction: payload.action,
        qualityGate: payload.gate,
        tradeRejection: payload.rejection,
        lightning: payload.lightning,
        marketWeather: payload.weather,
        marketRegime: payload.weather?.regime
      }, "mission");
      const ranked = rankSetups().sort((a, b) => b.opportunityScore - a.opportunityScore);
      const lightningOps = missionLightningOpportunities(ranked);
      const dangerSignals = missionDangerSignals(ranked);
      const replays = typeof signalReplayItems === "function" ? signalReplayItems() : [];
      const graveyard = signalGraveyardItems();
      const proof = buildProofEngineMetrics();
      const dna = buildTradeDna();
      const missionState = touchMissionOpenDay();
      const openStreak = consecutiveDayCount(missionState.openDays);
      const studiedStreak = consecutiveDayCount(missionState.studiedDays);
      const status = missionStatusFor(payload.weather, payload.action, dangerSignals.length, replays.length);
      const confidence = Math.max(0, Math.min(100, Math.round((payload.score * .45) + (payload.weather.score * .2) + (payload.rejection.score * .2) + (proof.closed ? Math.min(100, proof.successRate * 100) * .15 : 9))));
      const grade = eagleCommandGrade(payload.score);
      const graveyardLesson = graveyard[0];
      const topReplay = replays[0];
      const focus = missionDailyFocus(status, confidence, proof, graveyard.length, dna);
      const dnaReadout = missionEagleDnaReadout(dna);
      const completedStory = completedSignalStoryForMission();
      const storyReadout = signalStoryMissionReadout(completedStory);
      const primaryAction = missionPrimaryActionReadout(status, payload, confidence);
      const topRisk = missionTopRiskReadout(payload, graveyardLesson, dangerSignals);
      const proofPulse = missionProofPulseReadout(proof);
      const studiedToday = missionState.studiedDays.includes(missionTodayKey());
      const pilot = renderPilotStatus();
      renderCockpitPriority({ status, payload, confidence, primaryAction, topRisk, proofPulse });
      renderOperatingLoop(payload);

      document.getElementById("missionStatus").textContent = status.status;
      document.getElementById("missionObjective").textContent = status.objective;
      document.getElementById("missionMode").textContent = status.mode;
      document.getElementById("missionMode").className = `rounded-full border px-3 py-1 text-xs font-black ${status.tone}`;
      document.getElementById("missionPrimaryAction").textContent = primaryAction.action;
      document.getElementById("missionPrimaryRule").textContent = primaryAction.rule;
      document.getElementById("missionTopRisk").textContent = topRisk.risk;
      document.getElementById("missionTopRiskRule").textContent = topRisk.rule;
      document.getElementById("missionProofPulse").textContent = proofPulse.pulse;
      document.getElementById("missionProofRule").textContent = proofPulse.rule;
      document.getElementById("missionWeather").textContent = `${payload.weather.icon} ${payload.weather.label} / ${payload.weather.score}`;
      document.getElementById("missionWeatherMeta").textContent = `Trend ${payload.weather.trendScore}/100, breadth ${payload.weather.breadthScore}/100, volatility ${payload.weather.volatilityScore}/100.`;
      document.getElementById("missionEagleBriefing").textContent = `${grade} · ${payload.score}/100 · ${payload.action}`;
      document.getElementById("missionEagleMeta").textContent = `${payload.gate.verdict} gate, ${payload.rejection.verdict} rejection read, ${payload.lightning.verdict}.`;
      document.getElementById("missionTradeStreak").textContent = `${openStreak} day${openStreak === 1 ? "" : "s"}`;
      document.getElementById("missionStreakMeta").textContent = `Studied streak ${studiedStreak} day${studiedStreak === 1 ? "" : "s"}. Journal entries: ${journalEntries.length}.`;
      document.getElementById("missionOpenReplays").textContent = replays.length ? `${replays.length} replay${replays.length === 1 ? "" : "s"} available` : "No open replays yet";
      document.getElementById("missionReplayFocus").textContent = storyReadout?.replay || (topReplay ? `${topReplay.symbol}: ${topReplay.replayLabel || topReplay.type || "Replay setup"}` : "Create replays by closing paper trades, journaling outcomes, or reviewing signal memory.");
      document.getElementById("missionGraveyardLesson").textContent = graveyardLesson ? `${graveyardLesson.symbol}: ${graveyardLesson.cause || "Warning active"}` : "No Graveyard lesson yet";
      document.getElementById("missionGraveyardRule").textContent = graveyardLesson ? graveyardLesson.prevention : "Avoid forcing trades until a real warning pattern appears.";
      document.getElementById("missionDailyFocus").textContent = storyReadout?.focus || focus.goal;
      document.getElementById("missionDailyFocusMeta").textContent = storyReadout?.detail || focus.detail;
      document.getElementById("missionEagleDna").textContent = storyReadout?.headline || dnaReadout.headline;
      document.getElementById("missionEagleDnaRule").textContent = storyReadout?.dnaRule || dnaReadout.rule;
      document.getElementById("missionConfidence").textContent = `${confidence}/100 · ${confidence >= 78 ? "Mission Ready" : confidence >= 58 ? "Selective" : "Study Mode"}`;
      document.getElementById("missionConfidenceRule").textContent = confidence >= 78
        ? `Confidence is high, but paper mode and Pilot Status still apply: ${pilot.status}.`
        : confidence >= 58
          ? `Confidence is mixed. Demand clean trigger and respect blockers. Pilot Status: ${pilot.status}.`
          : `Confidence is low. Study replays and danger signals before taking paper risk. Pilot Status: ${pilot.status}.`;
      const studiedButton = document.getElementById("markMissionStudied");
      studiedButton.innerHTML = studiedToday ? `<i class="fa-solid fa-check mr-1"></i> Studied Today` : `<i class="fa-solid fa-check mr-1"></i> Mark Studied`;
      studiedButton.className = studiedToday
        ? "rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100"
        : "rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-300/10";

      renderMissionList("missionLightningList", lightningOps, "No Lightning setups. Good traders wait.", item => `
        <button data-symbol="${item.symbol}" class="block w-full rounded border border-emerald-300/20 bg-zinc-950/50 px-2 py-1 text-left hover:border-emerald-200/70">
          ⚡ ${escapeHtml(item.symbol)} · ${item.lightning.inProbability}% · ${escapeHtml(item.rejection.verdict)}
        </button>
      `);
      renderMissionList("missionDangerList", dangerSignals, "No major danger signals on the board.", item => `
        <button data-symbol="${item.symbol}" class="block w-full rounded border border-rose-300/20 bg-zinc-950/50 px-2 py-1 text-left hover:border-rose-200/70">
          ⛔ ${escapeHtml(item.symbol)} · Out ${item.lightning.outProbability}% · ${escapeHtml(item.rejection.mainReason)}
        </button>
      `);
      document.querySelectorAll("#missionLightningList [data-symbol], #missionDangerList [data-symbol]").forEach(button => {
        button.addEventListener("click", () => openSignalExplanation(button.dataset.symbol, button.closest("#missionDangerList") ? "strikeOut" : "strikeIn"));
      });
    }

    function renderEagleScoutCommandCenter() {
      const panel = document.getElementById("eagleCommandCenter");
      if (!panel) return;
      const data = symbols[currentSymbol];
      const gate = getQualityGate(data);
      const rejection = evaluateTradeRejection(data, gate, currentSymbol);
      const lightning = evaluateLightningStrike(data, gate, rejection, currentSymbol);
      const weather = getMarketWeather(currentSymbol);
      const action = signalSuggestedAction(gate, rejection, lightning);
      const score = Math.max(0, Math.min(100, Math.round((data.confidence * .48) + (gate.score * .26) + (rejection.score * .16) + (weather.score * .1))));
      const grade = eagleCommandGrade(score);
      const tone = eagleCommandTone(action, score);
      const proof = buildProofEngineMetrics();
      const graveyard = signalGraveyardItems();
      const lightningToggle = document.getElementById("eagleCommandLightningToggle");
      const lightningEnabled = lightningToggle ? lightningToggle.checked : true;
      const replayLoaded = tradeReplayState.timeline.length > 0;
      const aiMode = panel.dataset.aiMode || "setup";
      const payload = { symbol: currentSymbol, data, gate, rejection, lightning, weather, action, score };

      updateActiveSignalContext({
        symbol: currentSymbol,
        signalId: currentSignalReference(currentSymbol),
        source: "eagle-scout",
        eagleScore: score,
        suggestedAction: action,
        qualityGate: gate,
        tradeRejection: rejection,
        lightning,
        marketWeather: weather,
        marketRegime: weather.regime,
        activeBlockers: [...new Set([...(gate.reasons || []), ...(rejection.blockers || [])])].slice(0, 8)
      }, "eagleScout");
      renderDailyMission(payload);
      document.getElementById("eagleCommandTitle").textContent = `${currentSymbol} Eagle Scout Command`;
      document.getElementById("eagleCommandSummary").textContent = `${weather.label} market weather, ${gate.verdict} quality gate, ${rejection.verdict} rejection engine, ${lightning.verdict}.`;
      document.getElementById("eagleScoreShield").className = tone.shield;
      document.getElementById("eagleShieldCore").className = tone.core;
      document.getElementById("eagleCommandGrade").textContent = grade;
      document.getElementById("eagleCommandGrade").className = `text-5xl font-black ${tone.text}`;
      document.getElementById("eagleCommandScore").textContent = `${score}/100`;
      document.getElementById("eagleCommandVerdict").textContent = action.toUpperCase();
      document.getElementById("eagleCommandVerdict").className = `mt-3 text-xl font-black ${tone.text}`;
      document.getElementById("eagleCommandMeter").style.width = `${score}%`;
      document.getElementById("eagleCommandMeter").className = tone.meter;
      document.getElementById("eagleCommandAction").textContent = action === "Confirm"
        ? "Confirm only if entry trigger holds, then use demo money and journal."
        : action === "Reject"
          ? `${rejection.mainReason} Journaling the rejection completes the story.`
          : "Wait for blockers to clear, or journal the wait as a completed decision.";

      document.getElementById("eagleCommandStrikeIn").textContent = `${lightning.inProbability}%`;
      document.getElementById("eagleCommandStrikeOut").textContent = `${lightning.outProbability}%`;
      document.getElementById("eagleCommandLightningSummary").textContent = lightningEnabled ? lightning.summary : "Lightning markers are hidden from the Command Center chart.";
      document.getElementById("eagleCommandReplayState").textContent = replayLoaded ? `Replay ${tradeReplayState.index + 1}/${tradeReplayState.timeline.length}` : "Replay Ready";
      document.getElementById("eagleCommandReplayLesson").textContent = replayLoaded
        ? `${tradeReplayState.item?.symbol || currentSymbol}: ${tradeReplayState.timeline[tradeReplayState.index]?.marker || "Watching"} at Eagle ${tradeReplayState.timeline[tradeReplayState.index]?.eagleScore || score}/100.`
        : "Select a replay example in Signal Replay to link candle-by-candle proof.";
      document.getElementById("eagleCommandScreenshot").textContent = "Local-first";
      document.getElementById("eagleCommandScreenshotMeta").textContent = `${signalMemory.length} signal memories available for screenshot comparison.`;
      document.getElementById("eagleCommandGraveyard").textContent = `${graveyard.length} warning${graveyard.length === 1 ? "" : "s"}`;
      document.getElementById("eagleCommandGraveyardMeta").textContent = graveyard[0]
        ? (graveyard[0].cause || graveyard[0].warningSigns?.[0] || "Review the archived warning before trading.")
        : "No failed/rejected signal warning active yet.";
      document.getElementById("eagleCommandProof").textContent = proof.closed ? `${Math.round((proof.wins / proof.closed) * 100)}% win rate` : "Building sample";
      document.getElementById("eagleCommandProofMeta").textContent = `${proof.total} tracked signals, ${proof.closed} linked outcomes, ${proof.rejectionSaves} rejection saves.`;
      document.getElementById("eagleCommandAiTitle").textContent = `Explain ${aiMode}`;
      document.getElementById("eagleCommandAiBody").textContent = eagleCommandAiCopy(aiMode, payload);
      document.querySelectorAll(".eagle-command-ai").forEach(button => {
        const active = button.dataset.commandAi === aiMode;
        button.className = active
          ? `eagle-command-ai ${button.dataset.commandAi === "rejection" ? "col-span-2 " : ""}rounded-lg border border-cyan-300/30 px-2 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-300/10`
          : `eagle-command-ai ${button.dataset.commandAi === "rejection" ? "col-span-2 " : ""}rounded-lg border border-zinc-700 px-2 py-2 text-xs font-black text-zinc-300 hover:bg-zinc-800`;
      });

      renderEagleCommandMiniChart(data, lightning, lightningEnabled);
    }

    function renderDailyCommandCenter(ranked, top, weather) {
      const panel = document.getElementById("dailyCommandCenter");
      if (!panel) return;
      const proof = dailyCommandProofLesson();
      const best = top || ranked[0];
      const action = dailyCommandAction(best, weather, proof);
      const headline = best
        ? `${best.symbol}: ${best.rejection.verdict} at ${best.opportunityScore}/100`
        : "Scanning the desk";
      const summary = best
        ? `${weather.label} market weather. ${best.symbol} leads the board, but the desk should respect the biggest risk before taking a paper trade.`
        : "Best opportunity, biggest risk, proof lesson, and next action will update as signals build.";
      const readinessTone = buildProofEngineMetrics().closed >= 20
        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
        : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";

      document.getElementById("dailyCommandHeadline").textContent = headline;
      document.getElementById("dailyCommandSummary").textContent = summary;
      document.getElementById("dailyCommandReadiness").textContent = buildProofEngineMetrics().closed >= 20 ? "PROOF ACTIVE" : "LOCAL PROOF";
      document.getElementById("dailyCommandReadiness").className = `w-fit rounded-full border px-3 py-1 text-xs font-black ${readinessTone}`;
      document.getElementById("dailyCommandOpportunity").textContent = best ? `${best.symbol} ${best.data.type}` : "--";
      document.getElementById("dailyCommandOpportunityMeta").textContent = best ? `${best.rejection.verdict} / ${best.opportunityScore}/100` : "Waiting for scan";
      document.getElementById("dailyCommandRisk").textContent = dailyCommandRisk(best, weather);
      document.getElementById("dailyCommandWeather").textContent = `${weather.icon} ${weather.label} / ${weather.score}/100`;
      document.getElementById("dailyCommandProof").textContent = proof.text;
      document.getElementById("dailyCommandProofMeta").textContent = proof.meta;
      document.getElementById("dailyCommandAction").textContent = action;
      document.getElementById("dailyCommandLesson").textContent = proof.lesson;
      document.getElementById("dailyCommandOpportunityCard").dataset.commandSymbol = best?.symbol || currentSymbol;
      document.getElementById("dailyCommandOpportunityCard").onclick = () => {
        markStartFlowStep("daily");
        markStartFlowStep("ticker");
        openSignalExplanation(document.getElementById("dailyCommandOpportunityCard").dataset.commandSymbol, "strikeIn");
      };
    }

    function renderEliteDashboard() {
      const ranked = rankSetups().sort((a, b) => b.opportunityScore - a.opportunityScore);
      const top = ranked[0];
      const currentData = symbols[currentSymbol];
      const marketOdds = getMarketOdds(currentData);
      const weather = renderMarketWeather(currentSymbol);
      const regime = detectMarketRegime(currentSymbol);
      const openPnl = practiceAccount.positions.reduce((sum, position) => sum + positionOpenPnl(position), 0);
      const openExposure = practiceAccount.positions.reduce((sum, position) => sum + positionMarketValue(position), 0);
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const todayClosed = closed.filter(isTodayTrade);
      const todayRealized = todayClosed.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
      const dailyPnl = todayRealized + openPnl;
      const wins = closed.filter(trade => trade.pnl > 0).length;
      const winRate = closed.length ? Math.round((wins / closed.length) * 100) : null;
      const biasTone = marketOdds.bull >= 62 ? "text-emerald-300" : marketOdds.bull <= 38 ? "text-rose-300" : "text-amber-200";
      const pnlTone = dailyPnl >= 0 ? "text-emerald-300" : "text-rose-300";

      renderDailyCommandCenter(ranked, top, weather);
      document.getElementById("eliteTopSignal").textContent = top ? `${top.symbol} ${top.data.type}` : "--";
      document.getElementById("eliteTopSignal").className = `mt-1 text-xl font-black ${top?.data.type === "Bearish" ? "text-rose-300" : "text-emerald-300"}`;
      document.getElementById("eliteTopScore").textContent = top ? `${top.rejection.verdict} / ${top.opportunityScore}` : "Score --";
      document.getElementById("eliteTopSignalCard").dataset.eliteSymbol = top?.symbol || currentSymbol;
      document.getElementById("eliteTopSignalCard").onclick = () => openSignalExplanation(document.getElementById("eliteTopSignalCard").dataset.eliteSymbol, "live");
      const bestTone = top?.rejection.verdict === "APPROVED" ? "border-emerald-300/30 text-emerald-100" : top?.rejection.verdict === "WAIT" ? "border-amber-300/30 text-amber-100" : "border-rose-300/30 text-rose-100";
      document.getElementById("bestOpportunitySymbol").textContent = top ? `${top.symbol} ${top.data.type}` : "--";
      document.getElementById("bestOpportunityWhy").textContent = top ? opportunityWhy(top) : "Waiting for ranked setup data.";
      document.getElementById("bestOpportunityVerdict").textContent = top ? top.rejection.verdict : "SCANNING";
      document.getElementById("bestOpportunityVerdict").className = `w-fit rounded-full border ${bestTone || "border-amber-300/30 text-amber-100"} bg-zinc-950/70 px-3 py-1 text-xs font-black`;
      document.getElementById("bestOpportunityScore").textContent = top ? `${top.opportunityScore}/100` : "--/100";
      document.getElementById("bestOpportunityRisk").textContent = top ? setupReason(top) : "--";
      document.getElementById("bestOpportunityAction").textContent = bestOpportunityAction(top);
      document.getElementById("bestOpportunityOpen").dataset.bestSymbol = top?.symbol || currentSymbol;
      document.getElementById("bestOpportunityOpen").onclick = () => openSignalExplanation(document.getElementById("bestOpportunityOpen").dataset.bestSymbol, "strikeIn");
      document.getElementById("eliteMarketBias").textContent = marketOdds.label;
      document.getElementById("eliteMarketBias").className = `mt-1 text-xl font-black ${biasTone}`;
      document.getElementById("eliteMarketRegime").textContent = `${regime} / ${marketOdds.bull}% bull`;
      document.getElementById("eliteOpenTrades").textContent = practiceAccount.positions.length;
      document.getElementById("eliteOpenExposure").textContent = `${money(openExposure)} exposure`;
      document.getElementById("eliteDailyPnl").textContent = money(dailyPnl);
      document.getElementById("eliteDailyPnl").className = `mt-1 text-xl font-black ${pnlTone}`;
      document.getElementById("eliteDailyRealized").textContent = `${money(todayRealized)} realized / ${money(openPnl)} open`;
      document.getElementById("eliteWinRate").textContent = winRate === null ? "--" : `${winRate}%`;
      document.getElementById("eliteWinRate").className = `mt-1 text-xl font-black ${winRate === null ? "text-zinc-300" : winRate >= 55 ? "text-emerald-300" : winRate >= 45 ? "text-amber-200" : "text-rose-300"}`;
      document.getElementById("eliteWinRateSample").textContent = `${closed.length} closed`;
      document.getElementById("eliteAlertCount").textContent = alertEntries.length;
      document.getElementById("eliteAlertFocus").textContent = alertEntries[0]?.symbol ? `${alertEntries[0].symbol} ${alertEntries[0].type}` : "No active alerts";
      document.getElementById("eliteDashboardSummary").textContent = top
        ? `${top.symbol} leads the board at ${top.opportunityScore}/100 with a ${top.rejection.verdict} rejection-engine read while market weather is ${weather.label}.`
        : "Desk view waiting for signal data.";

      document.getElementById("eliteConfidenceHeatmap").innerHTML = ranked.map(item => `
        <button data-heatmap-symbol="${item.symbol}" class="rounded-lg border ${heatmapTone(item.opportunityScore)} p-2 text-left hover:border-white/40">
          <span class="flex items-center justify-between gap-2">
            <span class="text-sm font-black">${item.symbol}</span>
            <span class="text-xs font-black">${item.opportunityScore}</span>
          </span>
          <span class="mt-1 block text-[11px] font-bold text-zinc-300">${item.rejection.verdict} · ${item.gate.verdict}</span>
          <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-950/70">
            <span class="block h-full rounded-full bg-current" style="width: ${Math.max(5, Math.min(100, item.opportunityScore))}%"></span>
          </span>
        </button>
      `).join("");

      document.getElementById("eliteWatchlistAlerts").innerHTML = alertEntries.length
        ? alertEntries.slice(0, 4).map(alert => `
          <article class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-xs font-black text-zinc-100">${escapeHtml(alert.symbol)} <span class="text-zinc-500">${escapeHtml(alert.type)}</span></p>
                <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">${escapeHtml(alert.label)}</p>
              </div>
              <span class="shrink-0 text-[11px] text-zinc-500">${escapeHtml(alert.created)}</span>
            </div>
          </article>
        `).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-sm text-zinc-500">No watchlist alerts saved.</div>`;

      document.querySelectorAll("[data-heatmap-symbol]").forEach(button => {
        button.addEventListener("click", () => openSignalExplanation(button.dataset.heatmapSymbol, "live"));
      });
      renderSectorRotation(ranked);
    }

    function renderSetupRankings() {
      const ranked = rankSetups();
      const top = [...ranked].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 5);
      const avoid = [...ranked].sort((a, b) => b.avoidScore - a.avoidScore).slice(0, 5);

      document.getElementById("topSetups").innerHTML = top.map((item, index) => `
        <button data-rank-symbol="${item.symbol}" class="flex w-full items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-left hover:border-emerald-300/50">
          <span class="min-w-0">
            <span class="block text-sm font-black">${index + 1}. ${item.symbol} <span class="text-xs ${item.data.type === "Bullish" ? "text-emerald-300" : "text-rose-300"}">${item.data.type}</span></span>
            <span class="mt-1 block text-xs leading-relaxed text-zinc-400">${currentContractLabelFor(item.symbol)} · ${item.rejection.verdict} · ${item.gate.verdict}</span>
          </span>
          <span class="shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-200">${item.opportunityScore}</span>
        </button>
      `).join("");

      document.getElementById("avoidSetups").innerHTML = avoid.map((item, index) => `
        <button data-rank-symbol="${item.symbol}" class="flex w-full items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-left hover:border-rose-300/50">
          <span class="min-w-0">
            <span class="block text-sm font-black">${index + 1}. ${item.symbol} <span class="text-xs ${item.data.type === "Bullish" ? "text-emerald-300" : "text-rose-300"}">${item.data.type}</span></span>
            <span class="mt-1 block text-xs leading-relaxed text-zinc-400">${setupReason(item)}</span>
          </span>
          <span class="shrink-0 rounded-full bg-rose-400/10 px-2 py-1 text-xs font-black text-rose-200">${item.avoidScore}</span>
        </button>
      `).join("");

      document.querySelectorAll("[data-rank-symbol]").forEach(button => {
        button.addEventListener("click", () => openSignalExplanation(button.dataset.rankSymbol, button.closest("#avoidSetups") ? "reject" : "strikeIn"));
      });
      renderEliteDashboard();
    }

    function renderSetupTape() {
      const ranked = rankSetups().sort((a, b) => b.qualityScore - a.qualityScore);
      const items = [...ranked, ...ranked].map(item => {
        const bullish = item.data.move >= 0;
        const tone = item.gate.verdict === "REJECT" || item.gate.verdict === "SKIP"
          ? "border-rose-400/30 text-rose-200"
          : item.gate.verdict === "A+ SETUP"
            ? "border-emerald-400/35 text-emerald-200"
            : "border-zinc-700 text-zinc-200";
        return `
          <button data-tape-symbol="${item.symbol}" class="shrink-0 rounded-full border ${tone} bg-zinc-900/90 px-3 py-1.5 text-xs font-black hover:bg-zinc-800">
            ${item.symbol}
            <span class="${bullish ? "text-emerald-300" : "text-rose-300"}">${item.data.move > 0 ? "+" : ""}${item.data.move.toFixed(1)}%</span>
            <span class="text-zinc-500">·</span>
            <span>${item.gate.verdict}</span>
            <span class="text-zinc-500">·</span>
            <span>${getNineSig(item.data).score}/9</span>
          </button>
        `;
      }).join("");
      document.getElementById("setupTape").innerHTML = items;
      document.querySelectorAll("[data-tape-symbol]").forEach(button => {
        button.addEventListener("click", () => openSignalExplanation(button.dataset.tapeSymbol, "live"));
      });
    }

    function renderEntryTiming(data) {
      const toneMap = {
        emerald: {
          section: "border-emerald-400/25 bg-emerald-400/10",
          icon: "text-emerald-300",
          badge: "border-emerald-300/30 text-emerald-100",
          check: "text-emerald-300"
        },
        amber: {
          section: "border-amber-300/25 bg-amber-300/10",
          icon: "text-amber-300",
          badge: "border-amber-300/30 text-amber-100",
          check: "text-amber-300"
        },
        rose: {
          section: "border-rose-300/25 bg-rose-300/10",
          icon: "text-rose-300",
          badge: "border-rose-300/30 text-rose-100",
          check: "text-rose-300"
        }
      };
      const tone = toneMap[data.entry.tone] || toneMap.amber;
      const section = document.getElementById("entryStatus").closest("section");
      section.className = `mt-4 rounded-lg border ${tone.section} p-4`;
      section.querySelector(".fa-crosshairs").className = `fa-solid fa-crosshairs ${tone.icon}`;

      document.getElementById("entryStatus").textContent = data.entry.status;
      document.getElementById("entryStatus").className = `w-fit rounded-full border ${tone.badge} bg-zinc-950/70 px-3 py-1 text-xs font-black`;
      document.getElementById("entryTimingSummary").textContent = data.entry.summary;
      document.getElementById("entryTrigger").textContent = data.entry.trigger;
      document.getElementById("noTradeZone").textContent = data.entry.noTrade;
      document.getElementById("chaseLimit").textContent = data.entry.chase;
      document.getElementById("entryChecklist").innerHTML = data.entry.checklist.map(item => `
        <div class="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
          <i class="fa-solid fa-check mt-0.5 ${tone.check}"></i>
          <span>${item}</span>
        </div>
      `).join("");
    }

    function currentContractLabel() {
      return currentContractLabelFor(currentSymbol);
    }

    function currentContractLabelFor(symbol) {
      const expiry = document.getElementById("expiryChoice").value;
      const moneyness = document.getElementById("moneynessChoice").value;
      const expiryLabel = { "0dte": "0DTE", weekly: "Weekly", "next-week": "Next Week" }[expiry];
      const moneyLabel = { itm: "Slight ITM", atm: "ATM", otm: "Slight OTM" }[moneyness];
      const side = symbols[symbol].type === "Bullish" ? "Call" : "Put";
      return `${symbol} ${expiryLabel} ${moneyLabel} ${side}`;
    }

    function average(values) {
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }

    function standardDeviation(values) {
      if (values.length < 2) return 0;
      const mean = average(values);
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
      return Math.sqrt(variance);
    }

    function summarizeSetups(trades) {
      const groups = trades.reduce((acc, trade) => {
        const key = trade.contract || trade.symbol || "Unknown";
        if (!acc[key]) acc[key] = { key, pnl: 0, count: 0 };
        acc[key].pnl += Number(trade.pnl) || 0;
        acc[key].count += 1;
        return acc;
      }, {});
      return Object.values(groups).sort((a, b) => b.pnl - a.pnl);
    }

    function recurringMistakes(closedTrades, entries) {
      const counts = {};
      const add = label => {
        if (!label) return;
        counts[label] = (counts[label] || 0) + 1;
      };
      closedTrades.forEach(trade => {
        (trade.issues || []).forEach(add);
        if (trade.grade === "C" || trade.grade === "D") add(`Low process grade ${trade.grade}`);
      });
      entries.forEach(entry => {
        (entry.tags || []).forEach(add);
        const note = `${entry.note || ""} ${entry.outcome || ""}`.toLowerCase();
        if (note.includes("chase") || note.includes("chased")) add("Chased entries");
        if (note.includes("oversize") || note.includes("too big")) add("Oversized risk");
        if (note.includes("ignored stop") || note.includes("moved stop")) add("Ignored stop");
        if (note.includes("held too long") || note.includes("overheld")) add("Held too long");
        if (note.includes("bad contract") || note.includes("wide spread")) add("Bad contract selection");
        if (note.includes("no confirmation") || note.includes("early entry")) add("Entered without confirmation");
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count }));
    }

    function renderJournalAnalytics() {
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const wins = closed.filter(trade => trade.pnl > 0);
      const losses = closed.filter(trade => trade.pnl < 0);
      const pnlValues = closed.map(trade => Number(trade.pnl) || 0);
      const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
      const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
      const mean = average(pnlValues);
      const deviation = standardDeviation(pnlValues);
      const sharpe = deviation > 0 ? (mean / deviation) * Math.sqrt(pnlValues.length) : 0;
      const setups = summarizeSetups(closed);
      const mistakes = recurringMistakes(closed, journalEntries);

      document.getElementById("journalSampleSize").textContent = `${closed.length} closed`;
      document.getElementById("journalWinRate").textContent = closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "--";
      document.getElementById("journalAvgGain").textContent = money(average(wins.map(trade => trade.pnl)));
      document.getElementById("journalAvgLoss").textContent = losses.length ? money(average(losses.map(trade => trade.pnl))) : "$0.00";
      document.getElementById("journalProfitFactor").textContent = profitFactor === Infinity ? "∞" : closed.length ? profitFactor.toFixed(2) : "--";
      document.getElementById("journalSharpe").textContent = closed.length >= 2 ? sharpe.toFixed(2) : "--";
      document.getElementById("journalBestSetup").textContent = setups.length ? `${setups[0].key} ${money(setups[0].pnl)} / ${setups[0].count}x` : "--";
      document.getElementById("journalWorstSetup").textContent = setups.length ? `${setups[setups.length - 1].key} ${money(setups[setups.length - 1].pnl)} / ${setups[setups.length - 1].count}x` : "--";
      document.getElementById("journalMistakes").innerHTML = mistakes.length
        ? mistakes.map(item => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-300">${escapeHtml(item.label)} · ${item.count}</span>`).join("")
        : `<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-emerald-200">No recurring mistakes detected yet</span>`;
    }

    function proofOutcomeForRecord(record) {
      const linkedPaper = practiceAccount.history.find(trade => trade.action === "CLOSE" && trade.signalId === record.signalId);
      if (linkedPaper) {
        return {
          status: "Closed",
          winLoss: linkedPaper.pnl > 0 ? "Win" : linkedPaper.pnl < 0 ? "Loss" : "Breakeven",
          percentMove: linkedPaper.percentMove ?? null,
          maxFavorableExcursion: linkedPaper.percentMove ? Math.max(0, linkedPaper.percentMove) : null,
          maxAdverseExcursion: linkedPaper.percentMove ? Math.min(0, linkedPaper.percentMove) : null,
          source: "local-paper"
        };
      }
      const linkedJournal = journalEntries.find(entry => entry.signalId === record.signalId && ["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome));
      if (linkedJournal) {
        return {
          status: linkedJournal.outcome === "Skipped" ? "Skipped" : "Closed",
          winLoss: linkedJournal.outcome,
          percentMove: null,
          maxFavorableExcursion: null,
          maxAdverseExcursion: null,
          source: "local-journal"
        };
      }
      return record.outcome || { status: "Open", winLoss: null, source: "local-educational" };
    }

    function proofRecords() {
      const records = [...signalLedger];
      const known = new Set(records.map(item => item.signalId));
      signalMemory.forEach(snapshot => {
        if (!snapshot.signalId || known.has(snapshot.signalId)) return;
        records.push(signalLedgerRecordFromSnapshot(snapshot));
        known.add(snapshot.signalId);
      });
      return records.map(record => ({
        ...record,
        outcome: proofOutcomeForRecord(record)
      }));
    }

    function proofWin(outcome = {}) {
      return outcome.winLoss === "Win" || outcome.paperTradeOutcome === "Win";
    }

    function proofClosed(outcome = {}) {
      return ["Closed", "Skipped"].includes(outcome.status) || ["Win", "Loss", "Breakeven", "Skipped"].includes(outcome.winLoss);
    }

    function proofBandStats(records, band) {
      const items = records.filter(record => record.confidenceBand === band);
      const closed = items.filter(record => proofClosed(record.outcome));
      const wins = closed.filter(record => proofWin(record.outcome));
      const avgMove = average(closed.map(record => Number(record.outcome?.percentMove)).filter(Number.isFinite));
      return { band, count: items.length, closed: closed.length, wins: wins.length, avgMove };
    }

    function proofFailureLabel(text = "") {
      return graveyardWarningLabel(text);
    }

    function buildProofEngineMetrics() {
      const records = proofRecords();
      const closed = records.filter(record => proofClosed(record.outcome));
      const wins = closed.filter(record => proofWin(record.outcome));
      const rejected = records.filter(record => record.systemVerdict === "REJECT" || record.setupType === "Rejected Setup" || record.graveyard?.buried);
      const rejectionSaves = records.filter(record =>
        (record.systemVerdict === "REJECT" || record.setupType === "Rejected Setup") &&
        (record.outcome?.status === "Skipped" || record.graveyard?.buried || record.outcome?.winLoss === "Loss")
      ).length;
      const strikeIn = records.filter(record => String(record.lightningStatus || "").includes("Strike In"));
      const strikeInClosed = strikeIn.filter(record => proofClosed(record.outcome));
      const strikeInWins = strikeInClosed.filter(record => proofWin(record.outcome));
      const strikeOut = records.filter(record => String(record.lightningStatus || "").includes("Strike Out") || Number(record.lightningOutProbability) >= 66);
      const strikeOutWarnings = strikeOut.filter(record => record.graveyard?.buried || record.outcome?.winLoss === "Loss" || record.outcome?.status === "Skipped");
      const failureCounts = {};
      records.forEach(record => {
        (record.graveyard?.failureReasons || []).forEach(reason => {
          const label = proofFailureLabel(reason);
          failureCounts[label] = (failureCounts[label] || 0) + 1;
        });
      });
      recurringMistakes(practiceAccount.history.filter(trade => trade.action === "CLOSE"), journalEntries).forEach(item => {
        const label = proofFailureLabel(item.label);
        failureCounts[label] = (failureCounts[label] || 0) + item.count;
      });
      return {
        records,
        total: records.length,
        closed: closed.length,
        wins: wins.length,
        successRate: closed.length ? wins.length / closed.length : null,
        rejected: rejected.length,
        rejectionSaves,
        eagleBands: ["80-100", "60-79", "Below 60"].map(band => proofBandStats(records, band)),
        strikeIn: {
          count: strikeIn.length,
          closed: strikeInClosed.length,
          wins: strikeInWins.length,
          rate: strikeInClosed.length ? strikeInWins.length / strikeInClosed.length : null
        },
        strikeOut: {
          count: strikeOut.length,
          warnings: strikeOutWarnings.length,
          rate: strikeOut.length ? strikeOutWarnings.length / strikeOut.length : null
        },
        failures: Object.entries(failureCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      };
    }

    function proofPercent(rate) {
      return rate === null || rate === undefined || !Number.isFinite(rate) ? "Building" : `${Math.round(rate * 100)}%`;
    }

    function trustChip(label, value, tone = "cyan") {
      const tones = {
        emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
        cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
        amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
        rose: "border-rose-300/25 bg-rose-300/10 text-rose-100",
        zinc: "border-zinc-700 bg-zinc-950/70 text-zinc-300"
      };
      return `<span class="rounded-full border px-2 py-1 text-[10px] font-black ${tones[tone] || tones.cyan}">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
    }

    function proofTrustChipHtml(metrics = buildProofEngineMetrics()) {
      const sampleTone = metrics.closed >= 20 ? "emerald" : metrics.closed >= 8 ? "cyan" : "amber";
      const winTone = metrics.successRate === null ? "amber" : metrics.successRate >= .58 ? "emerald" : metrics.successRate >= .45 ? "cyan" : "rose";
      const strikeInTone = metrics.strikeIn.rate === null ? "amber" : metrics.strikeIn.rate >= .58 ? "emerald" : metrics.strikeIn.rate >= .45 ? "cyan" : "rose";
      const strikeOutTone = metrics.strikeOut.rate === null ? "amber" : metrics.strikeOut.rate >= .58 ? "emerald" : metrics.strikeOut.rate >= .4 ? "cyan" : "rose";
      return [
        trustChip("Sample", `${metrics.closed}/20`, sampleTone),
        trustChip("Win Rate", proofPercent(metrics.successRate), winTone),
        trustChip("Strike In", metrics.strikeIn.closed ? `${Math.round((metrics.strikeIn.rate || 0) * 100)}% / ${metrics.strikeIn.closed}` : "Building", strikeInTone),
        trustChip("Strike Out Saves", metrics.strikeOut.count ? `${metrics.strikeOut.warnings}/${metrics.strikeOut.count}` : "Building", strikeOutTone),
        trustChip("Proof", "Local educational", "zinc")
      ].join("");
    }

    function renderProofTrustChips(targetId, metrics = buildProofEngineMetrics()) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.innerHTML = proofTrustChipHtml(metrics);
    }

    function proofTrustStatus(metrics) {
      const linkedProgress = Math.min(100, Math.round((metrics.closed / 20) * 100));
      if (metrics.closed >= 50) return {
        label: "Strong local sample",
        grade: "High Trust",
        progress: 100,
        tone: "emerald",
        rule: "This is a useful educational sample. Keep validating before changing real-world risk behavior."
      };
      if (metrics.closed >= 20) return {
        label: "Usable proof sample",
        grade: "Usable",
        progress: linkedProgress,
        tone: "emerald",
        rule: "Enough linked outcomes exist to study patterns, but results are still local paper/journal evidence only."
      };
      if (metrics.closed >= 8) return {
        label: "Early proof forming",
        grade: "Early Read",
        progress: linkedProgress,
        tone: "cyan",
        rule: "Use these stats as clues, not conclusions. Push toward 20 linked outcomes."
      };
      return {
        label: "Building proof",
        grade: "Learning",
        progress: linkedProgress,
        tone: "amber",
        rule: "Close paper trades, attach journal outcomes, and replay signals before trusting accuracy percentages."
      };
    }

    function proofBestBandRead(metrics) {
      const qualified = metrics.eagleBands
        .filter(band => band.closed > 0)
        .map(band => ({
          ...band,
          rate: band.closed ? band.wins / band.closed : null
        }))
        .sort((a, b) => (b.rate - a.rate) || (b.avgMove - a.avgMove) || (b.closed - a.closed));
      const best = qualified[0];
      if (!best) return "Needs linked outcomes";
      const move = Number.isFinite(best.avgMove) && best.avgMove ? ` · ${best.avgMove > 0 ? "+" : ""}${best.avgMove.toFixed(1)}% avg` : "";
      return `${best.band} · ${Math.round(best.rate * 100)}% on ${best.closed} outcome${best.closed === 1 ? "" : "s"}${move}`;
    }

    function proofStrikeRead(label, rate, closed, count, goodText, weakText) {
      if (!count) return `${label}: no examples yet`;
      if (!closed) return `${label}: ${count} tracked, waiting for outcomes`;
      const percent = Math.round(rate * 100);
      return `${label}: ${percent}% · ${percent >= 60 ? goodText : weakText}`;
    }

    function proofRateText(rate, closed) {
      if (!closed) return "Building";
      return closed < 20 ? `${Math.round(rate * 100)}% sample` : `${Math.round(rate * 100)}%`;
    }

    function proofMetricRow(label, primary, secondary = "") {
      return `
        <div class="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1.5">
          <span class="text-[11px] font-bold text-zinc-400">${escapeHtml(label)}</span>
          <span class="text-[11px] font-black text-zinc-100">${escapeHtml(primary)}${secondary ? ` <span class="font-bold text-zinc-500">${escapeHtml(secondary)}</span>` : ""}</span>
        </div>
      `;
    }

    function renderProofEngine() {
      const panel = document.getElementById("proofEnginePanel");
      if (!panel) return;
      const metrics = buildProofEngineMetrics();
      const sampleReady = metrics.closed >= 20;
      const trust = proofTrustStatus(metrics);
      document.getElementById("proofEngineSample").textContent = sampleReady ? "Usable sample" : "Building sample";
      document.getElementById("proofEngineSample").className = `shrink-0 rounded-full border ${sampleReady ? "border-emerald-300/30 text-emerald-100" : "border-amber-300/30 text-amber-100"} bg-zinc-950/70 px-2 py-1 text-[11px] font-black`;
      document.getElementById("proofEngineSummary").textContent = metrics.total
        ? `${metrics.total} local signals tracked, ${metrics.closed} linked outcomes, ${metrics.rejected} rejection/graveyard warnings.`
        : "Educational statistics from local signals, paper trades, journal outcomes, replay, and Signal Graveyard.";
      document.getElementById("proofReadiness").textContent = `${trust.label} · ${metrics.closed}/20 outcomes`;
      document.getElementById("proofTrustGrade").textContent = trust.grade;
      document.getElementById("proofTrustGrade").className = `w-fit rounded-full border ${trust.tone === "emerald" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : trust.tone === "cyan" ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"} px-3 py-1 text-[11px] font-black`;
      document.getElementById("proofReadinessMeter").style.width = `${trust.progress}%`;
      document.getElementById("proofReadinessMeter").className = `h-full rounded-full transition-all duration-700 ${trust.tone === "emerald" ? "bg-emerald-300" : trust.tone === "cyan" ? "bg-cyan-300" : "bg-amber-300"}`;
      document.getElementById("proofTrustRule").textContent = trust.rule;
      document.getElementById("proofSignalsTracked").textContent = metrics.total;
      document.getElementById("proofLinkedOutcomes").textContent = metrics.closed;
      document.getElementById("proofSuccessRate").textContent = metrics.successRate === null ? "--" : proofRateText(metrics.successRate, metrics.closed);
      document.getElementById("proofRejectionSaves").textContent = metrics.rejectionSaves;
      document.getElementById("proofBestBand").textContent = proofBestBandRead(metrics);
      document.getElementById("proofStrikeInRead").textContent = proofStrikeRead("Strike In", metrics.strikeIn.rate || 0, metrics.strikeIn.closed, metrics.strikeIn.count, "confirming well", "needs threshold review");
      document.getElementById("proofStrikeOutRead").textContent = proofStrikeRead("Strike Out", metrics.strikeOut.rate || 0, metrics.strikeOut.warnings, metrics.strikeOut.count, "protecting users", "needs more failure proof");
      document.getElementById("proofEagleBands").innerHTML = metrics.eagleBands.map(band => {
        const rate = band.closed ? `${Math.round((band.wins / band.closed) * 100)}%` : "Building";
        const move = Number.isFinite(band.avgMove) && band.avgMove ? ` / ${band.avgMove > 0 ? "+" : ""}${band.avgMove.toFixed(1)}%` : "";
        return proofMetricRow(band.band, `${rate}${move}`, `${band.closed}/${band.count}`);
      }).join("");
      document.getElementById("proofLightningStats").innerHTML = [
        proofMetricRow("Strike In", metrics.strikeIn.rate === null ? "Building" : proofRateText(metrics.strikeIn.rate, metrics.strikeIn.closed), `${metrics.strikeIn.closed}/${metrics.strikeIn.count}`),
        proofMetricRow("Strike Out", metrics.strikeOut.rate === null ? "Building" : `${Math.round(metrics.strikeOut.rate * 100)}% warning`, `${metrics.strikeOut.warnings}/${metrics.strikeOut.count}`)
      ].join("");
      document.getElementById("proofFailureReasons").innerHTML = metrics.failures.length
        ? metrics.failures.map(([label, count]) => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-300">${escapeHtml(label)} · ${count}</span>`).join("")
        : `<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-emerald-200">No recurring failure reason yet</span>`;
      document.getElementById("proofEngineGuardrail").textContent = sampleReady
        ? "Educational statistics only. These outcomes come from local paper trades, journal labels, replay references, and Signal Graveyard, not broker-verified real account data."
        : "Building sample. Treat these as educational local stats only until at least 20 linked outcomes exist. No broker data, no real account tracking, no guarantees.";
    }

    function replayItemForSignal(record) {
      const replayItems = signalReplayItems();
      const existing = replayItems.find(item => item.signalId === record.signalId);
      if (existing) return existing;
      const memory = signalMemory.find(item => item.signalId === record.signalId || item.id === record.sourceMemoryId);
      if (memory) {
        return {
          ...memory,
          type: "memory",
          replayId: `memory-${record.signalId}`,
          replayLabel: `${record.symbol} memory · ${record.userVerdict || record.systemVerdict} · ${record.date}`
        };
      }
      return {
        ...record,
        type: "memory",
        replayId: `proof-${record.signalId}`,
        replayLabel: `${record.symbol} proof · ${record.userVerdict || record.systemVerdict} · ${record.date}`,
        confidence: record.eagleScore,
        eagleScore: record.eagleScore,
        suggestedAction: record.userVerdict,
        qualityGate: { verdict: record.systemVerdict },
        lightning: {
          verdict: record.lightningStatus,
          strikeInProbability: record.lightningInProbability,
          strikeOutProbability: record.lightningOutProbability,
          factors: [record.lightningStatus, record.marketWeather, record.marketRegime].filter(Boolean)
        },
        outcome: record.outcome?.winLoss || record.outcome?.status || "PENDING"
      };
    }

    function replayOutcomeBuckets() {
      const records = proofRecords();
      const bucketDefs = [
        {
          id: "winning",
          label: "Winning Signals",
          tone: "emerald",
          match: record => proofWin(record.outcome),
          reason: record => `${record.outcome?.winLoss || "Win"} outcome from ${record.outcome?.source || "local proof"}.`
        },
        {
          id: "failed",
          label: "Failed Signals",
          tone: "rose",
          match: record => record.outcome?.winLoss === "Loss",
          reason: record => `${record.outcome?.winLoss || "Loss"} outcome. Review blockers and entry timing.`
        },
        {
          id: "rejected",
          label: "Rejected / Avoided",
          tone: "amber",
          match: record => record.systemVerdict === "REJECT" || record.setupType === "Rejected Setup" || record.outcome?.status === "Skipped",
          reason: record => record.graveyard?.buried ? "Rejected setup later entered the Graveyard." : "Signal was skipped or rejected for protection."
        },
        {
          id: "strike-in",
          label: "Strike In Examples",
          tone: "cyan",
          match: record => String(record.lightningStatus || "").includes("Strike In"),
          reason: record => `Strike In with Eagle ${record.eagleScore}/100.`
        },
        {
          id: "strike-out",
          label: "Strike Out Saves",
          tone: "rose",
          match: record => String(record.lightningStatus || "").includes("Strike Out") || Number(record.lightningOutProbability) >= 66,
          reason: record => `Strike Out risk ${record.lightningOutProbability ?? "--"}%.`
        },
        {
          id: "graveyard",
          label: "Graveyard Warnings",
          tone: "rose",
          match: record => record.graveyard?.buried,
          reason: record => (record.graveyard?.failureReasons || []).slice(0, 2).join(" / ") || "Archived as failed-risk setup."
        }
      ];
      return bucketDefs.map(bucket => ({
        ...bucket,
        items: records
          .filter(bucket.match)
          .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
          .slice(0, 3)
          .map(record => ({
            record,
            replayItem: replayItemForSignal(record),
            reason: bucket.reason(record)
          }))
      }));
    }

    function replayOutcomeTone(tone) {
      const tones = {
        emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
        cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
        amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
        rose: "border-rose-300/25 bg-rose-300/10 text-rose-100"
      };
      return tones[tone] || tones.cyan;
    }

    function renderReplayOutcomeLibrary() {
      const panel = document.getElementById("replayOutcomeLibraryPanel");
      if (!panel) return;
      const buckets = replayOutcomeBuckets();
      const exampleCount = buckets.reduce((sum, bucket) => sum + bucket.items.length, 0);
      const richest = [...buckets].sort((a, b) => b.items.length - a.items.length)[0];
      document.getElementById("replayOutcomeCount").textContent = `${exampleCount} examples`;
      document.getElementById("replayOutcomeSummary").textContent = exampleCount
        ? `${richest.label} has the most local examples right now. Replay the cards to study what happened candle by candle.`
        : "Local learning examples will appear as signals get outcomes, paper trades close, and Graveyard warnings build.";
      document.getElementById("replayOutcomeBuckets").innerHTML = buckets.map(bucket => `
        <section class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-[11px] font-black uppercase text-zinc-400">${escapeHtml(bucket.label)}</p>
            <span class="rounded-full border px-2 py-0.5 text-[10px] font-black ${replayOutcomeTone(bucket.tone)}">${bucket.items.length}</span>
          </div>
          <div class="space-y-2">
            ${bucket.items.length ? bucket.items.map(({ record, replayItem, reason }) => `
              <article class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-xs font-black text-zinc-100">${escapeHtml(record.symbol)} <span class="text-[10px] text-zinc-500">${escapeHtml(record.signalId)}</span></p>
                    <p class="mt-1 text-[11px] leading-relaxed text-zinc-400">Eagle ${record.eagleScore}/100 · ${escapeHtml(record.lightningStatus || "Watching")} · ${escapeHtml(record.outcome?.winLoss || record.outcome?.status || "Open")}</p>
                  </div>
                  <button data-outcome-replay="${escapeHtml(replayItem.replayId)}" data-outcome-signal="${escapeHtml(record.signalId)}" class="shrink-0 rounded-lg border border-sky-300/35 px-2 py-1 text-[10px] font-black text-sky-100 hover:bg-sky-300/10" type="button">Replay</button>
                </div>
                <p class="mt-1 text-[11px] leading-relaxed text-zinc-500">${escapeHtml(reason)}</p>
              </article>
            `).join("") : `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-[11px] font-bold text-zinc-500">No examples yet.</div>`}
          </div>
        </section>
      `).join("");
      document.getElementById("replayOutcomeLesson").textContent = exampleCount
        ? "Use these examples as educational pattern review. They are local paper/journal/replay records, not broker-verified performance."
        : "Build the sample by replaying signals, closing paper trades, journaling outcomes, and reviewing rejected setups.";
      document.querySelectorAll("[data-outcome-replay]").forEach(button => {
        button.addEventListener("click", () => openReplayOutcomeExample(button.dataset.outcomeSignal, button.dataset.outcomeReplay));
      });
    }

    function openReplayOutcomeExample(signalId, replayId) {
      const records = proofRecords();
      const record = records.find(item => item.signalId === signalId);
      if (!record) return;
      const item = replayItemForSignal(record);
      const select = document.getElementById("signalReplaySelect");
      const optionExists = select && [...select.options].some(option => option.value === replayId);
      if (optionExists) {
        select.value = replayId;
        renderSignalReplay({ activateChart: true });
      } else {
        const score = replaySignalScore(item);
        const predicted = replayPrediction(item, score);
        const actual = replayActualOutcome(item);
        const compare = replayComparison(predicted, actual);
        loadTradeReplay(item, score, true);
        markStartFlowStep("replay");
        document.getElementById("signalReplayStatus").textContent = "Library";
        document.getElementById("signalReplayScore").textContent = score === null ? "--" : `${score}/100`;
        document.getElementById("signalReplayPredicted").textContent = predicted.prediction;
        document.getElementById("signalReplayActual").textContent = `${actual.label} · ${actual.detail}`;
        document.getElementById("signalReplayMarket").textContent = replayMarketText(item.plan?.marketConditions || item.marketConditions || currentMarketSnapshot(item.symbol));
        document.getElementById("signalReplayIndicators").innerHTML = item.lightning?.factors?.length
          ? item.lightning.factors.slice(0, 6).map(factor => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-300">${escapeHtml(factor)}</span>`).join("")
          : `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-400">Proof Engine replay example</span>`;
        document.getElementById("signalReplayCompare").textContent = compare;
      }
      showNeutralToast(`${record.symbol} replay example loaded`);
    }

    function tradeDnaScoreBand(score) {
      if (!Number.isFinite(score) || score <= 0) return "Eagle unscored";
      if (score >= 85) return "Eagle 85+";
      if (score >= 70) return "Eagle 70-84";
      if (score >= 55) return "Eagle 55-69";
      return "Eagle under 55";
    }

    function tradeDnaRsiBand(value) {
      if (!Number.isFinite(value)) return "RSI untracked";
      if (value < 35) return "RSI washed out";
      if (value <= 55) return "RSI 35-55";
      if (value <= 70) return "RSI momentum";
      return "RSI extended";
    }

    function tradeDnaSetupStyle(trade, data, score) {
      const gate = trade.plan?.qualityGate || trade.plan?.entryStatus || "Paper setup";
      const regime = trade.plan?.marketConditions?.regime || detectMarketRegime(trade.symbol);
      const entryStatus = trade.plan?.entryStatus || "";
      if (["A+ SETUP", "READY"].includes(gate) && score >= 70 && /Bull|Bear|Trend/i.test(regime)) return "Trend continuation";
      if (entryStatus === "CONFIRM" || /confirm/i.test(gate)) return "Confirmation watch";
      if (entryStatus === "WAIT" || /WAIT|REJECT|AVOID/i.test(gate)) return "Forced trade risk";
      if ((data?.confidence || 0) >= 80) return "Momentum continuation";
      return "Paper setup";
    }

    function tradeDnaSetupKey(trade) {
      const data = symbols[trade.symbol] || {};
      const score = Number(trade.plan?.signalScore ?? trade.processScore ?? data.confidence);
      const direction = trade.plan?.direction || data.type || trade.signal || "Directional";
      const timeframe = trade.plan?.timeframe || trade.timeframe || activeRange || "Active TF";
      const rsi = indicatorValue(data, "rsi", NaN);
      const style = tradeDnaSetupStyle(trade, data, score);
      return `${direction} · ${tradeDnaScoreBand(score)} · ${timeframe} · ${tradeDnaRsiBand(rsi)} · ${style}`;
    }

    function tradeDnaTimeBucket(time = "") {
      const match = String(time).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) return "Untracked";
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const meridian = match[3]?.toUpperCase();
      if (meridian === "PM" && hour < 12) hour += 12;
      if (meridian === "AM" && hour === 12) hour = 0;
      const minutes = (hour * 60) + minute;
      if (minutes < 10 * 60) return "Opening window";
      if (minutes < 12 * 60) return "Morning trend";
      if (minutes < 14 * 60) return "Midday";
      return "Power hour";
    }

    function tradeDnaGroupStats(items, keyFn) {
      const groups = items.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) acc[key] = { key, count: 0, pnl: 0, wins: 0, losses: 0, moves: [] };
        const pnl = Number(item.pnl) || 0;
        const move = Number(item.percentMove ?? item.pnlPercent);
        acc[key].count += 1;
        acc[key].pnl += pnl;
        if (pnl > 0) acc[key].wins += 1;
        if (pnl < 0) acc[key].losses += 1;
        if (Number.isFinite(move)) acc[key].moves.push(move);
        return acc;
      }, {});
      return Object.values(groups).map(group => ({
        ...group,
        winRate: group.count ? group.wins / group.count : 0,
        expectancy: group.count ? group.pnl / group.count : 0,
        avgMove: group.moves.length ? average(group.moves) : null
      }));
    }

    function tradeDnaConfidenceLabel(sampleSize) {
      if (sampleSize >= 100) return "Very high confidence";
      if (sampleSize >= 30) return "High confidence";
      if (sampleSize >= 12) return "Medium confidence";
      if (sampleSize >= 6) return "Early read";
      return "Learning sample";
    }

    function tradeDnaPercent(value) {
      return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : "--";
    }

    function tradeDnaPill(label, tone = "zinc") {
      const tones = {
        emerald: "bg-emerald-400/10 text-emerald-200",
        amber: "bg-amber-400/10 text-amber-100",
        rose: "bg-rose-400/10 text-rose-100",
        cyan: "bg-cyan-400/10 text-cyan-100",
        zinc: "bg-zinc-800 text-zinc-300"
      };
      return `<span class="rounded-full px-2 py-1 text-[11px] font-bold ${tones[tone] || tones.zinc}">${escapeHtml(label)}</span>`;
    }

    function buildTradeDna() {
      const closed = practiceAccount.history.filter(trade => trade.action === "CLOSE");
      const wins = closed.filter(trade => Number(trade.pnl) > 0);
      const losses = closed.filter(trade => Number(trade.pnl) < 0);
      const completedJournal = journalEntries.filter(entry => ["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome));
      const mistakes = recurringMistakes(closed, journalEntries);
      const buried = signalGraveyardItems();
      const setupGroups = tradeDnaGroupStats(closed, tradeDnaSetupKey).sort((a, b) => b.expectancy - a.expectancy || b.pnl - a.pnl);
      const timeGroups = tradeDnaGroupStats(closed, trade => tradeDnaTimeBucket(trade.time)).sort((a, b) => b.expectancy - a.expectancy || b.winRate - a.winRate);
      const sampleSize = closed.length + completedJournal.length + Math.min(signalMemory.length, 20);
      const winRate = closed.length ? wins.length / closed.length : 0;
      const journalCoverage = closed.length ? Math.min(1, completedJournal.length / closed.length) : completedJournal.length ? 1 : 0;
      const cleanTrades = closed.filter(trade => !trade.issues?.length && !["C", "D"].includes(trade.grade)).length;
      const cleanRate = closed.length ? cleanTrades / closed.length : journalCoverage;
      const mistakePressure = Math.min(1, mistakes.reduce((sum, item) => sum + item.count, 0) / Math.max(1, closed.length + completedJournal.length));
      const graveyardPressure = Math.min(1, buried.length / Math.max(8, signalMemory.length || 1));
      const disciplineScore = Math.max(0, Math.min(100, Math.round((cleanRate * 46) + (journalCoverage * 32) + ((1 - mistakePressure) * 16) + ((1 - graveyardPressure) * 6))));
      const edgeScore = Math.max(0, Math.min(100, Math.round((winRate * 36) + (disciplineScore * .38) + (Math.min(closed.length, 20) * 1.3) + (journalCoverage * 10))));
      const qualifiedGroups = setupGroups.filter(group => group.count >= (closed.length >= 10 ? 2 : 1));
      const bestSetup = qualifiedGroups.find(group => group.pnl >= 0) || setupGroups.find(group => group.pnl >= 0) || setupGroups[0];
      const worstSetup = [...setupGroups].reverse().find(group => group.count >= 1 && group.pnl < 0) || setupGroups[setupGroups.length - 1];
      const bestTime = timeGroups.find(group => group.key !== "Untracked") || timeGroups[0];
      const confidenceLabel = tradeDnaConfidenceLabel(sampleSize);
      const winMoves = wins.map(trade => Number(trade.percentMove)).filter(Number.isFinite);
      const lossMoves = losses.map(trade => Number(trade.percentMove)).filter(Number.isFinite);
      const avgWinningMove = winMoves.length ? average(winMoves) : null;
      const avgLosingMove = lossMoves.length ? average(lossMoves) : null;
      const replayExamples = signalReplayItems().length;
      const strengths = [];
      const fixes = [];

      if (winRate >= .6 && closed.length >= 3) strengths.push("Positive win consistency");
      if (bestSetup?.expectancy > 0) strengths.push(`${bestSetup.key.split(" · ").slice(0, 3).join(" · ")} edge`);
      if (disciplineScore >= 75) strengths.push("Strong rule discipline");
      if (journalCoverage >= .75) strengths.push("Good journaling habit");
      if (replayExamples >= 6) strengths.push("Replay sample building");
      if (buried.length >= 3) strengths.push("Rejection engine learning");
      if (!strengths.length) strengths.push("Data foundation forming");

      if (mistakes[0]) fixes.push(mistakes[0].label);
      if (journalCoverage < .6) fixes.push("Journal every closed trade");
      if (losses.length && average(losses.map(trade => Math.abs(trade.pnl))) > average(wins.map(trade => trade.pnl || 0))) fixes.push("Cut average loss faster");
      if (buried.length) fixes.push(graveyardWarningLabel(buried[0].cause));
      if (!fixes.length) fixes.push("Keep sample size building");

      const recommendation = (() => {
        if (sampleSize < 6) return "Eagle DNA needs more reps. Paper trade, close positions, replay signals, and journal outcomes so STRIKEPULSE can find your real edge.";
        if (worstSetup?.pnl < 0 && mistakes[0]) return `Your next upgrade is simple: reject ${worstSetup.key} when ${mistakes[0].label.toLowerCase()} shows up. Force confirmation before sizing.`;
        if (bestSetup?.expectancy > 0) return `Your best current setup is ${bestSetup.key}. Repeat it in paper trading and keep logging outcomes before increasing risk.`;
        return "Your edge is still mixed. Prioritize clean 2:1 setups, smaller size, and journal completion until the pattern gets obvious.";
      })();

      return {
        sampleSize,
        edgeScore,
        disciplineScore,
        bestSetup,
        worstSetup,
        bestTime,
        holdProfile: `${confidenceLabel} · ${sampleSize} samples`,
        topMistake: mistakes[0],
        strengths: strengths.slice(0, 4),
        fixes: fixes.slice(0, 4),
        recommendation,
        closedCount: closed.length,
        journalCount: completedJournal.length,
        replayCount: replayExamples,
        winRate,
        avgWinningMove,
        avgLosingMove
      };
    }

    function renderTradeDna() {
      const panel = document.getElementById("tradeDnaPanel");
      if (!panel) return;
      const dna = buildTradeDna();
      const pilot = buildPilotStatus();
      const scoreTone = dna.edgeScore >= 75 ? "border-emerald-300/30 text-emerald-100" : dna.edgeScore >= 50 ? "border-cyan-300/30 text-cyan-100" : "border-amber-300/30 text-amber-100";
      document.getElementById("tradeDnaScore").textContent = dna.sampleSize ? `${dna.edgeScore}/100 DNA` : "Learning";
      document.getElementById("tradeDnaScore").className = `shrink-0 rounded-full border ${scoreTone} bg-zinc-950/70 px-2 py-1 text-[11px] font-black`;
      document.getElementById("tradeDnaSummary").textContent = dna.sampleSize
        ? `${dna.closedCount} demo outcomes, ${dna.journalCount} journal decisions, ${dna.replayCount} replay lessons, and ${signalMemory.length} signal memories shaping what STRIKEPULSE remembers.`
        : "Trade DNA learns what setups you handle best after each journal and replay.";
      document.getElementById("tradeDnaBestSetup").textContent = dna.bestSetup ? `${dna.bestSetup.key} · ${money(dna.bestSetup.expectancy)}/trade` : "--";
      document.getElementById("tradeDnaWorstSetup").textContent = dna.worstSetup ? `${dna.worstSetup.key} · ${money(dna.worstSetup.expectancy)}/trade` : "--";
      document.getElementById("tradeDnaBestTime").textContent = dna.bestSetup ? `${Math.round(dna.bestSetup.winRate * 100)}% win · ${tradeDnaPercent(dna.bestSetup.avgMove ?? dna.avgWinningMove)} avg move` : "--";
      document.getElementById("tradeDnaHoldProfile").textContent = dna.holdProfile;
      document.getElementById("tradeDnaTopMistake").textContent = dna.topMistake ? `${dna.topMistake.label} · ${dna.topMistake.count}` : "None detected";
      document.getElementById("tradeDnaDiscipline").textContent = `${dna.disciplineScore}/100`;
      document.getElementById("tradeDnaStrengths").innerHTML = dna.strengths.map(item => tradeDnaPill(item, "emerald")).join("");
      const pilotFix = pilot.blockers[0] && pilot.blockers[0] !== "No major trader-risk blocker detected" ? `Pilot: ${pilot.blockers[0]}` : `Pilot: ${pilot.status}`;
      document.getElementById("tradeDnaFixes").innerHTML = [...dna.fixes, pilotFix].slice(0, 5).map(item => tradeDnaPill(item, item.includes("Journal") || item.includes("sample") || item.includes("Mission") || item.includes("Selective") ? "cyan" : "amber")).join("");
      document.getElementById("tradeDnaRecommendation").textContent = `${dna.recommendation} Pilot Status: ${pilot.status} (${pilot.readinessScore}/100). ${pilot.recommendations[0]}`;
      if (activeSignalContext?.signalId) {
        updateActiveSignalContext({
          signalId: activeSignalContext.signalId,
          symbol: activeSignalContext.symbol || currentSymbol,
          source: "trade-dna",
          learning: {
            tradeDnaEdgeScore: dna.edgeScore,
            tradeDnaDisciplineScore: dna.disciplineScore,
            tradeDnaBestSetup: dna.bestSetup?.key || null,
            tradeDnaWorstSetup: dna.worstSetup?.key || null,
            tradeDnaRecommendation: dna.recommendation
          }
        }, "tradeDna");
      }
      renderSignalStoryStatus();
    }

    function replaySignalScore(item) {
      const score = Number(item.plan?.signalScore ?? item.processScore ?? item.replay?.signalScore ?? item.eagleScore ?? item.confidence);
      if (Number.isFinite(score) && score > 0) return Math.round(score);
      const nineSig = Number(item.plan?.nineSig);
      if (Number.isFinite(nineSig) && nineSig > 0) return Math.round((nineSig / 9) * 100);
      const confidenceTag = (item.tags || []).find(tag => /\d+\/9 Sig/i.test(tag));
      if (confidenceTag) {
        const match = confidenceTag.match(/(\d+)\/9/);
        if (match) return Math.round((Number(match[1]) / 9) * 100);
      }
      return null;
    }

    function replayMarketText(market = {}) {
      const parts = [
        `Regime ${market.regime || "Range Bound"}`,
        `SPY ${market.spy || "Neutral"}`,
        `QQQ ${market.qqq || "Neutral"}`,
        `VIX ${market.vix || "Unknown"}`,
        `Breadth ${market.breadth || "Mixed"}`,
        `Sector ${market.sector || "Mixed"}`
      ];
      return parts.join(" / ");
    }

    function replayActualOutcome(item) {
      if (item.type === "memory") {
        return {
          label: item.outcome || "PENDING",
          favorable: false,
          detail: item.outcome ? "Outcome attached to signal memory" : "Outcome not recorded yet"
        };
      }
      if (item.type === "paper") {
        if (item.pnl > 0) return { label: "WIN", favorable: true, detail: `${money(item.pnl)} realized P/L` };
        if (item.pnl < 0) return { label: "LOSS", favorable: false, detail: `${money(item.pnl)} realized P/L` };
        return { label: "BREAKEVEN", favorable: false, detail: "$0.00 realized P/L" };
      }
      const outcome = String(item.outcome || "Planned").toUpperCase();
      return {
        label: outcome,
        favorable: outcome === "WIN",
        detail: item.note || "Journal outcome recorded"
      };
    }

    function replayPrediction(item, score) {
      const verdict = item.plan?.qualityGate || item.qualityGate?.verdict || item.signal || item.replay?.verdict || "WAIT";
      const prediction = item.plan?.predictedOutcome || item.replay?.predictedOutcome || predictionFromSignal(score, verdict, item.plan?.direction || item.signal || symbols[item.symbol]?.type || "Bullish");
      const expectedFavorable = ["A+ SETUP", "READY", "STRONG BUY", "BUY"].includes(verdict) || Number(score) >= 70;
      const expectedWait = ["WAIT", "CONFIRM", "AVOID", "REJECT"].includes(verdict) || Number(score) < 70;
      return { verdict, prediction, expectedFavorable, expectedWait };
    }

    function replayComparison(predicted, actual) {
      if (predicted.expectedFavorable && actual.favorable) {
        return "Prediction aligned: the signal expected follow-through and the outcome was positive.";
      }
      if (predicted.expectedFavorable && !actual.favorable) {
        return "Prediction miss: the signal expected follow-through, but the trade did not pay. Review blockers, entry timing, and volatility.";
      }
      if (predicted.expectedWait && !actual.favorable) {
        return "Warning aligned: the signal was cautious and the actual result did not justify aggression.";
      }
      return "Caution was too conservative: the signal was mixed, but the outcome improved. Look for the confirmation that arrived after the first read.";
    }

    function signalReplayItems() {
      const closedTrades = practiceAccount.history
        .filter(trade => trade.action === "CLOSE")
        .map((trade, index) => ({
          ...trade,
          type: "paper",
          replayId: `paper-${index}-${trade.id || trade.time}`,
          replayLabel: `${trade.symbol} ${trade.contract} · ${trade.time} · ${money(trade.pnl)}`
        }));
      const completedJournal = journalEntries
        .filter(entry => ["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome))
        .map((entry, index) => ({
          ...entry,
          type: "journal",
          replayId: `journal-${index}-${entry.time}-${entry.symbol}`,
          replayLabel: `${entry.symbol} ${entry.contract} · ${entry.outcome} · ${entry.time}`
        }));
      const memoryItems = signalMemory.slice(0, 20).map((item, index) => ({
        ...item,
        type: "memory",
        replayId: `memory-${index}-${item.id}`,
        replayLabel: `${item.symbol} memory · ${item.suggestedAction} · ${item.timeLabel || item.timestamp}`
      }));
      return [...closedTrades, ...completedJournal, ...memoryItems].slice(0, 30);
    }

    function renderSignalReplayOptions() {
      const select = document.getElementById("signalReplaySelect");
      if (!select) return [];
      const items = signalReplayItems();
      const selected = select.value;
      select.innerHTML = items.length
        ? items.map(item => `<option value="${escapeHtml(item.replayId)}">${escapeHtml(item.replayLabel)}</option>`).join("")
        : `<option value="">No replayable signals yet</option>`;
      if (items.some(item => item.replayId === selected)) {
        select.value = selected;
      }
      return items;
    }

    function selectLearningReplayForJournal(entry, options = {}) {
      const select = document.getElementById("signalReplaySelect");
      if (!select || !entry?.signalId) return null;
      const items = renderSignalReplayOptions();
      if (!items.length) return null;
      const exactMatches = items.filter(item => item.signalId === entry.signalId);
      const match = exactMatches.find(item => item.journalId === entry.journalId)
        || exactMatches.find(item => item.type === "journal")
        || exactMatches[0]
        || null;
      if (!match) return null;
      select.value = match.replayId;
      renderSignalReplay({ activateChart: Boolean(options.activateReplay) });
      if (options.activateReplay) {
        markStartFlowStep("replay");
        document.getElementById("signalReplaySelect")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return match;
    }

    function clearSignalReplay() {
      document.getElementById("signalReplayStatus").textContent = "Empty";
      document.getElementById("signalReplayScore").textContent = "--";
      document.getElementById("signalReplayPredicted").textContent = "--";
      document.getElementById("signalReplayActual").textContent = "--";
      document.getElementById("signalReplayMarket").textContent = "No replay yet. Journal a wait, reject, or demo decision to create the first lesson.";
      document.getElementById("signalReplayIndicators").innerHTML = "";
      document.getElementById("signalReplayCompare").textContent = "Replay shows what to repeat and what to avoid next time.";
      const pulseTitle = document.getElementById("signalReplayPulseTitle");
      const pulseAction = document.getElementById("signalReplayPulseAction");
      if (pulseTitle) pulseTitle.textContent = "No saved decision yet";
      if (pulseAction) pulseAction.textContent = "Journal one decision to unlock the first lesson.";
      resetTradeReplay();
      renderSignalStoryStatus();
    }

    function replayNumericSeed(item) {
      const text = `${item.replayId || item.id || ""}${item.symbol || ""}${item.time || item.timestamp || ""}`;
      return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) || 73;
    }

    function replayBasePrice(item) {
      const symbolPrice = symbols[item.symbol]?.price;
      const entryPremium = Number(item.entryPremium);
      const closePremium = Number(item.lastPremium);
      return Number.isFinite(entryPremium) && entryPremium > 0
        ? entryPremium
        : Number.isFinite(closePremium) && closePremium > 0
          ? closePremium
          : Number.isFinite(symbolPrice) ? symbolPrice : 100;
    }

    function buildTradeReplayTimeline(item, score) {
      const seed = replayNumericSeed(item);
      const count = item.type === "memory" ? 24 : 36;
      const base = replayBasePrice(item);
      const direction = item.plan?.direction || item.signal || symbols[item.symbol]?.type || "Bullish";
      const pnl = Number(item.pnl) || 0;
      const outcomeBias = pnl > 0 ? 1 : pnl < 0 ? -1 : 0;
      const trendBias = direction === "Bearish" ? -1 : 1;
      const startScore = Math.max(25, Math.min(95, (Number(score) || item.confidence || item.eagleScore || 62) - 9));
      const graveyard = item.type === "memory"
        ? signalGraveyardItems().some(dead => dead.id === item.id)
        : (item.issues || []).length >= 2 || item.grade === "D";
      let price = base * (1 - (trendBias * .018));
      return Array.from({ length: count }, (_, index) => {
        const progress = count <= 1 ? 1 : index / (count - 1);
        const wave = Math.sin((index + seed % 9) / 2.4) * base * .006;
        const drift = base * .0035 * trendBias * (outcomeBias || .55);
        const riskFade = graveyard && progress > .55 ? -base * .004 * trendBias : 0;
        const open = price;
        const close = Math.max(.01, open + drift + wave + riskFade);
        const high = Math.max(open, close) + base * (.004 + ((seed + index) % 5) * .001);
        const low = Math.min(open, close) - base * (.004 + ((seed + index + 2) % 4) * .001);
        price = close;
        const eagleDrift = Math.round((outcomeBias || .35) * progress * 14 - (graveyard && progress > .6 ? 18 * (progress - .6) : 0));
        const eagleScore = Math.max(5, Math.min(100, Math.round(startScore + eagleDrift + Math.sin(index / 3) * 3)));
        const strikeIn = eagleScore >= 72 && progress > .28 && !graveyard;
        const strikeOut = graveyard && (progress > .55 || eagleScore < 58);
        return {
          index,
          open,
          high,
          low,
          close,
          volume: Math.round(700000 + ((seed * (index + 3)) % 2800000)),
          eagleScore,
          marker: strikeIn ? "Strike In" : strikeOut ? "Strike Out" : "Watching",
          graveyard: graveyard && progress > .5,
          note: strikeIn
            ? "Momentum, trend, and quality aligned."
            : strikeOut
              ? "Risk warnings overtook the setup."
              : "Waiting for candle confirmation."
        };
      });
    }

    function stopTradeReplay() {
      if (tradeReplayState.timer) {
        clearInterval(tradeReplayState.timer);
        tradeReplayState.timer = null;
      }
      tradeReplayState.playing = false;
      ["tradeReplayPlay", "eagleCommandReplayPlay"].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.innerHTML = `<i class="fa-solid fa-play mr-1"></i> Play`;
      });
      const label = document.getElementById("tradeReplayStateLabel");
      if (label) {
        label.textContent = tradeReplayState.timeline.length ? "Paused" : "Idle";
        label.className = "w-fit rounded-full border border-indigo-300/30 bg-zinc-950/70 px-2 py-1 text-[11px] font-black text-indigo-100";
      }
    }

    function tradeReplayLessonForFrame(candle, previous, item) {
      if (!candle) return {
        lesson: "Select a replayable signal to study the setup.",
        action: "Replay should teach one rule: confirm, wait, reject, or exit sooner.",
        state: "Idle",
        tone: "indigo",
        decision: "Study",
        keyFrames: ["Load a replay"]
      };
      const scoreDelta = previous ? candle.eagleScore - previous.eagleScore : 0;
      const direction = item?.plan?.direction || item?.signal || symbols[item?.symbol]?.type || "Directional";
      if (candle.marker === "Strike In") return {
        lesson: `Strike In appeared at Eagle ${candle.eagleScore}/100.`,
        action: `Practice confirming ${direction.toLowerCase()} continuation only after momentum and price structure agree.`,
        state: "Confirm",
        tone: "emerald",
        decision: "Confirm",
        keyFrames: ["Momentum aligned", "Strike In", "Watch follow-through"]
      };
      if (candle.marker === "Strike Out" || candle.graveyard) return {
        lesson: `Risk warning appeared while Eagle Score was ${candle.eagleScore}/100.`,
        action: "Practice rejecting or exiting when the signal quality deteriorates instead of hoping it recovers.",
        state: "Reject / Exit",
        tone: "rose",
        decision: "Reject",
        keyFrames: ["Risk increased", "Strike Out", "Protect capital"]
      };
      if (scoreDelta <= -5) return {
        lesson: `Eagle Score dropped ${Math.abs(scoreDelta)} points on this candle.`,
        action: "Practice waiting. A falling score means confirmation is weakening before the outcome is obvious.",
        state: "Wait",
        tone: "amber",
        decision: "Wait",
        keyFrames: ["Score falling", "Confirmation weak", "No chase"]
      };
      if (scoreDelta >= 5) return {
        lesson: `Eagle Score improved ${scoreDelta} points on this candle.`,
        action: "Practice watching for follow-through instead of entering before confirmation completes.",
        state: "Building",
        tone: "cyan",
        decision: "Prepare",
        keyFrames: ["Score building", "Need trigger", "Stay patient"]
      };
      return {
        lesson: `${direction} setup is developing with Eagle ${candle.eagleScore}/100.`,
        action: "Practice patience: no new action unless the replay gives a clear Strike In, Strike Out, or rule break.",
        state: "Study",
        tone: "indigo",
        decision: "Study",
        keyFrames: ["No clear action", "Read structure", "Wait for evidence"]
      };
    }

    function tradeReplayToneClasses(tone) {
      const tones = {
        emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
        rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
        amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
        cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
        indigo: "border-indigo-300/30 bg-zinc-950/70 text-indigo-100"
      };
      return tones[tone] || tones.indigo;
    }

    function replayChartContext(item, frame) {
      const base = symbols[item?.symbol] || symbols[currentSymbol];
      const direction = item?.plan?.direction || item?.signal || base.type || "Bullish";
      const stop = direction === "Bearish"
        ? Math.max(frame.close, frame.high) * 1.018
        : Math.min(frame.close, frame.low) * .982;
      const target = direction === "Bearish"
        ? Math.min(...tradeReplayState.timeline.map(candle => candle.low))
        : Math.max(...tradeReplayState.timeline.map(candle => candle.high));
      return {
        ...base,
        type: direction,
        price: frame.close,
        target,
        stopPct: Math.max(.008, Math.abs(frame.close - stop) / Math.max(.01, frame.close)),
        confidence: frame.eagleScore,
        sector: base.sector || "Replay"
      };
    }

    function activateTradeReplayChart() {
      const frame = tradeReplayState.timeline[tradeReplayState.index];
      if (!frame) return;
      if (!tradeReplayState.chartLinked) {
        tradeReplayState.liveCandles = candles.slice();
        tradeReplayState.chartLinked = true;
      }
      tradeReplayState.chartContext = replayChartContext(tradeReplayState.item, frame);
      candles = tradeReplayState.timeline.slice(0, tradeReplayState.index + 1).map(candle => ({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
      const label = document.getElementById("chartModeLabel");
      if (label) label.textContent = `Replay Mode - ${tradeReplayState.item?.symbol || currentSymbol} candle ${tradeReplayState.index + 1}/${tradeReplayState.timeline.length}`;
      setChartEngineLabel("Replay driving chart", "amber");
      drawChart();
    }

    function restoreLiveChartFromReplay() {
      if (!tradeReplayState.chartLinked) return;
      candles = Array.isArray(tradeReplayState.liveCandles) && tradeReplayState.liveCandles.length
        ? tradeReplayState.liveCandles.slice()
        : candles;
      tradeReplayState.chartLinked = false;
      tradeReplayState.liveCandles = null;
      tradeReplayState.chartContext = null;
      const label = document.getElementById("chartModeLabel");
      if (label) label.textContent = `Options scalp view - ${activeRange} candles`;
      setChartEngineLabel(professionalChartState.status === "ready" ? "TradingView Lightweight" : "Canvas fallback", professionalChartState.status === "ready" ? "emerald" : "amber");
      drawChart();
    }

    function resetTradeReplay() {
      stopTradeReplay();
      restoreLiveChartFromReplay();
      tradeReplayState = { ...tradeReplayState, itemId: null, item: null, timeline: [], index: 0 };
      renderTradeReplayFrame();
    }

    function loadTradeReplay(item, score, activateChart = false) {
      if (!item?.replayId) return;
      if (tradeReplayState.itemId !== item.replayId || !tradeReplayState.timeline.length) {
        stopTradeReplay();
        restoreLiveChartFromReplay();
        tradeReplayState.itemId = item.replayId;
        tradeReplayState.item = item;
        tradeReplayState.timeline = buildTradeReplayTimeline(item, score);
        tradeReplayState.index = 0;
      }
      linkSignalLedger(item.signalId, "replay", item.replayId);
      renderTradeReplayFrame();
      if (activateChart) activateTradeReplayChart();
    }

    function setTradeReplayIndex(index) {
      if (!tradeReplayState.timeline.length) return;
      tradeReplayState.index = Math.max(0, Math.min(tradeReplayState.timeline.length - 1, index));
      renderTradeReplayFrame();
      activateTradeReplayChart();
      if (tradeReplayState.index >= tradeReplayState.timeline.length - 1) stopTradeReplay();
    }

    function playTradeReplay() {
      if (!tradeReplayState.timeline.length) return;
      if (tradeReplayState.playing) {
        stopTradeReplay();
        return;
      }
      if (tradeReplayState.index >= tradeReplayState.timeline.length - 1) {
        tradeReplayState.index = 0;
      }
      tradeReplayState.playing = true;
      ["tradeReplayPlay", "eagleCommandReplayPlay"].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.innerHTML = `<i class="fa-solid fa-pause mr-1"></i> Pause`;
      });
      const label = document.getElementById("tradeReplayStateLabel");
      if (label) {
        label.textContent = "Playing";
        label.className = "w-fit rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] font-black text-emerald-100";
      }
      activateTradeReplayChart();
      tradeReplayState.timer = setInterval(() => {
        setTradeReplayIndex(tradeReplayState.index + 1);
      }, tradeReplayState.speedMs);
    }

    function renderTradeReplayFrame() {
      const timeline = tradeReplayState.timeline;
      const candle = timeline[tradeReplayState.index];
      const previous = tradeReplayState.index > 0 ? timeline[tradeReplayState.index - 1] : null;
      const scrubber = document.getElementById("tradeReplayScrubber");
      const candlesEl = document.getElementById("tradeReplayCandles");
      if (!scrubber || !candlesEl) return;
      const lesson = tradeReplayLessonForFrame(candle, previous, tradeReplayState.item);
      const progress = timeline.length ? ((tradeReplayState.index + 1) / timeline.length) * 100 : 0;
      scrubber.max = Math.max(0, timeline.length - 1);
      scrubber.value = tradeReplayState.index;
      document.getElementById("tradeReplayClock").textContent = timeline.length ? `${tradeReplayState.index + 1}/${timeline.length}` : "0/0";
      document.getElementById("tradeReplayCandle").textContent = candle ? `${money(candle.open)} -> ${money(candle.close)}` : "--";
      document.getElementById("tradeReplayEagle").textContent = candle ? `${candle.eagleScore}/100` : "--";
      document.getElementById("tradeReplayLightning").textContent = candle ? candle.marker : "--";
      document.getElementById("tradeReplayGraveyard").textContent = candle ? (candle.graveyard ? "Warning active" : "Clear") : "--";
      document.getElementById("tradeReplayLesson").textContent = lesson.lesson;
      document.getElementById("tradeReplayAction").textContent = lesson.action;
      const progressEl = document.getElementById("tradeReplayProgress");
      if (progressEl) {
        progressEl.style.width = `${progress}%`;
        progressEl.className = `h-full rounded-full transition-all duration-300 ${lesson.tone === "emerald" ? "bg-emerald-300" : lesson.tone === "rose" ? "bg-rose-300" : lesson.tone === "amber" ? "bg-amber-300" : lesson.tone === "cyan" ? "bg-cyan-300" : "bg-indigo-300"}`;
      }
      const decisionBadge = document.getElementById("tradeReplayDecisionBadge");
      if (decisionBadge) {
        decisionBadge.textContent = `Decision: ${lesson.decision}`;
        decisionBadge.className = `w-fit rounded-full border ${tradeReplayToneClasses(lesson.tone)} px-2 py-1 text-[11px] font-black`;
      }
      const keyFrames = document.getElementById("tradeReplayKeyFrames");
      if (keyFrames) {
        keyFrames.innerHTML = (lesson.keyFrames || []).map(item => `<span class="rounded-full bg-zinc-950/80 px-2 py-1 text-[11px] font-bold text-zinc-300">${escapeHtml(item)}</span>`).join("");
      }
      const stateLabel = document.getElementById("tradeReplayStateLabel");
      if (stateLabel && !tradeReplayState.playing) {
        stateLabel.textContent = lesson.state;
        stateLabel.className = `w-fit rounded-full border ${tradeReplayToneClasses(lesson.tone)} px-2 py-1 text-[11px] font-black`;
      }
      candlesEl.style.gridTemplateColumns = timeline.length ? `repeat(${timeline.length}, minmax(3px, 1fr))` : "1fr";
      candlesEl.innerHTML = timeline.length
        ? timeline.map((bar, index) => {
          const active = index === tradeReplayState.index;
          const height = Math.max(16, Math.min(92, 28 + (bar.eagleScore * .52)));
          const tone = bar.marker === "Strike In" ? "bg-emerald-300" : bar.marker === "Strike Out" ? "bg-rose-300" : bar.close >= bar.open ? "bg-cyan-300" : "bg-amber-300";
          return `<button data-replay-index="${index}" class="w-full rounded-t ${tone} ${active ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"}" style="height:${height}%" title="Candle ${index + 1}: ${bar.marker}, Eagle ${bar.eagleScore}"></button>`;
        }).join("")
        : `<div class="self-center text-center text-xs font-bold text-zinc-500">Select a replayable signal.</div>`;
      candlesEl.querySelectorAll("[data-replay-index]").forEach(button => {
        button.addEventListener("click", () => setTradeReplayIndex(Number(button.dataset.replayIndex)));
      });
      renderEagleScoutCommandCenter();
    }

    function renderSignalReplay(options = {}) {
      const items = renderSignalReplayOptions();
      const select = document.getElementById("signalReplaySelect");
      if (!items.length || !select?.value) {
        clearSignalReplay();
        return;
      }
      const item = items.find(candidate => candidate.replayId === select.value) || items[0];
      const score = replaySignalScore(item);
      const predicted = replayPrediction(item, score);
      const actual = replayActualOutcome(item);
      const market = item.plan?.marketConditions || item.replay?.marketConditions || item.marketConditions || {
        regime: item.marketRegime,
        spy: marketContext.spy?.trend,
        qqq: marketContext.qqq?.trend,
        vix: marketContext.vix?.state,
        breadth: marketContext.breadth?.state,
        sector: item.sectorRotation?.context
      } || currentMarketSnapshot(item.symbol);
      const indicators = item.plan?.indicators || item.replay?.indicators || item.lightning?.factors?.map(factor => ({ label: factor, value: item.confidence || item.eagleScore || 0, detail: item.marketWeather?.label || "" })) || [];
      const compare = replayComparison(predicted, actual);
      const hit = compare.includes("aligned") || compare.includes("conservative");
      loadTradeReplay(item, score, Boolean(options.activateChart));
      if (options.activateChart) markStartFlowStep("replay");
      if (item.signalId) {
        updateActiveSignalContext({
          signalId: item.signalId,
          symbol: item.symbol || currentSymbol,
          source: "replay",
          eagleScore: score,
          suggestedAction: hit ? "Replay aligned" : "Replay review",
          learning: {
            replayId: item.replayId,
            predictedOutcome: predicted.prediction,
            actualOutcome: actual.label,
            replayComparison: compare
          }
        }, "replay");
        linkActiveSignalContext("replay", item.replayId);
      }
      renderSignalStoryStatus();
      document.getElementById("signalReplayStatus").textContent = hit ? "Matched" : "Review";
      document.getElementById("signalReplayScore").textContent = score === null ? "--" : `${score}/100`;
      document.getElementById("signalReplayPredicted").textContent = predicted.prediction;
      document.getElementById("signalReplayActual").textContent = `${actual.label} · ${actual.detail}`;
      const pulseTitle = document.getElementById("signalReplayPulseTitle");
      const pulseAction = document.getElementById("signalReplayPulseAction");
      if (pulseTitle) pulseTitle.textContent = `${item.symbol || currentSymbol} · ${hit ? "Signal aligned" : "Review the mismatch"}`;
      if (pulseAction) pulseAction.textContent = hit
        ? "Study what confirmed the move, then journal the reusable pattern."
        : "Find the warning sign that would have improved the entry, exit, or rejection.";
      document.getElementById("signalReplayMarket").textContent = replayMarketText(market);
      document.getElementById("signalReplayIndicators").innerHTML = indicators.length
        ? indicators.slice(0, 8).map(indicator => `
          <span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-300">${escapeHtml(indicator.label)} ${Number.isFinite(indicator.value) ? `${indicator.value}/100` : ""}</span>
        `).join("")
        : `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-400">No indicator snapshot on this older signal</span>`;
      document.getElementById("signalReplayCompare").textContent = compare;
    }

    function graveyardWarningLabel(text = "") {
      const value = text.toLowerCase();
      if (value.includes("reward/risk") || value.includes("2:1")) return "Poor reward/risk";
      if (value.includes("liquidity") || value.includes("spread")) return "Contract liquidity";
      if (value.includes("entry") || value.includes("confirmation") || value.includes("trigger")) return "No confirmation";
      if (value.includes("volatility") || value.includes("vix") || value.includes("weather")) return "Bad market weather";
      if (value.includes("sector") || value.includes("tape")) return "Fighting sector/tape";
      if (value.includes("iv") || value.includes("premium")) return "Premium risk";
      if (value.includes("0dte") || value.includes("otm")) return "Contract selection";
      return text || "Unclear warning";
    }

    function graveyardCause(snapshot) {
      if (snapshot.tradeRejection?.verdict === "REJECT") return snapshot.tradeRejection.mainReason || "Trade Rejection Engine blocked the setup.";
      if (snapshot.lightning?.strikeOutProbability >= 66) return `Lightning Strike Out risk rose to ${snapshot.lightning.strikeOutProbability}%.`;
      if (["Storm", "Danger"].includes(snapshot.marketWeather?.label)) return `Market Weather was ${snapshot.marketWeather.label}.`;
      if ((snapshot.qualityGate?.score || 0) < 58) return `Quality score was weak at ${snapshot.qualityGate.score}/100.`;
      return "Signal showed enough warning signs to archive for review.";
    }

    function graveyardPrevention(snapshot) {
      const blockers = snapshot.activeBlockers || snapshot.tradeRejection?.blockers || [];
      if (blockers.length) return `Prevent entry by respecting: ${blockers.slice(0, 2).join(" / ")}.`;
      if (snapshot.lightning?.strikeOutProbability >= 66) return "Prevent entry by waiting for Strike Out probability to cool below risk threshold.";
      if (["Storm", "Danger"].includes(snapshot.marketWeather?.label)) return "Prevent entry by reducing size or waiting for better Market Weather.";
      return "Prevent entry by requiring confirmation, clean spread, and 2:1 reward/risk.";
    }

    function signalGraveyardItems() {
      return signalMemory
        .filter(snapshot => {
          const rejected = snapshot.tradeRejection?.verdict === "REJECT" || snapshot.qualityGate?.verdict === "REJECT";
          const strikeOut = Number(snapshot.lightning?.strikeOutProbability) >= 66 || String(snapshot.lightning?.verdict || "").includes("Strike Out");
          const hostileWeather = ["Storm", "Danger"].includes(snapshot.marketWeather?.label) && (snapshot.activeBlockers || []).length;
          const weakQuality = Number(snapshot.qualityGate?.score) > 0 && Number(snapshot.qualityGate?.score) < 58;
          return rejected || strikeOut || hostileWeather || weakQuality;
        })
        .map(snapshot => ({
          ...snapshot,
          cause: graveyardCause(snapshot),
          prevention: graveyardPrevention(snapshot),
          warningSigns: [...new Set((snapshot.activeBlockers || snapshot.tradeRejection?.blockers || []).map(graveyardWarningLabel))]
        }))
        .slice(0, 12);
    }

    function renderSignalGraveyard() {
      const list = document.getElementById("signalGraveyardList");
      if (!list) return;
      const items = signalGraveyardItems();
      const rejected = items.filter(item => item.tradeRejection?.verdict === "REJECT" || item.qualityGate?.verdict === "REJECT").length;
      const strikeOut = items.filter(item => Number(item.lightning?.strikeOutProbability) >= 66 || String(item.lightning?.verdict || "").includes("Strike Out")).length;
      const preventable = items.filter(item => (item.warningSigns || []).length || (item.activeBlockers || []).length).length;
      const warningCounts = {};
      items.flatMap(item => item.warningSigns || []).forEach(label => {
        warningCounts[label] = (warningCounts[label] || 0) + 1;
      });
      const commonWarnings = Object.entries(warningCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      items.forEach(item => {
        linkSignalLedger(item.signalId, "replay", `graveyard-${item.id}`, {
          graveyard: {
            buried: true,
            failureReasons: item.warningSigns?.length ? item.warningSigns : [item.cause]
          }
        });
      });

      document.getElementById("signalGraveyardCount").textContent = `${items.length} buried`;
      document.getElementById("graveyardRejectedCount").textContent = rejected;
      document.getElementById("graveyardStrikeOutCount").textContent = strikeOut;
      document.getElementById("graveyardPreventableCount").textContent = preventable;
      document.getElementById("signalGraveyardSummary").textContent = items.length
        ? `${items[0].symbol} is the latest buried signal: ${items[0].cause}`
        : "Rejected and failed-risk signals will appear here as memory builds.";
      const graveyardPulseTitle = document.getElementById("graveyardPulseTitle");
      const graveyardPulseAction = document.getElementById("graveyardPulseAction");
      if (graveyardPulseTitle) {
        graveyardPulseTitle.textContent = items.length
          ? `${items[0].symbol}: ${items[0].cause || "Failed-risk pattern"}`
          : "No failed-risk lesson yet";
      }
      if (graveyardPulseAction) {
        graveyardPulseAction.textContent = items.length
          ? (items[0].prevention || "Review the warning signs before taking a similar paper setup.")
          : "When a signal fails or gets rejected, this panel will preserve the warning signs instead of hiding them.";
      }
      document.getElementById("graveyardWarningSigns").innerHTML = commonWarnings.length
        ? commonWarnings.map(([label, count]) => `<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-300">${escapeHtml(label)} · ${count}</span>`).join("")
        : `<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-emerald-200">No recurring warning signs yet</span>`;
      list.innerHTML = items.length
        ? items.map(item => `
          <article class="rounded-lg border border-rose-300/20 bg-zinc-950/80 p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-black text-zinc-100">${escapeHtml(item.symbol)} <span class="text-xs text-zinc-500">${escapeHtml(item.source || "memory")} · ${escapeHtml(item.timeLabel || "")}</span></p>
                <p class="mt-1 text-xs leading-relaxed text-rose-100/80">${escapeHtml(item.cause)}</p>
              </div>
              <span class="shrink-0 rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-[11px] font-black text-rose-100">${item.tradeRejection?.verdict || item.qualityGate?.verdict || "RISK"}</span>
            </div>
            <div class="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
                <p class="font-bold uppercase text-zinc-500">Eagle</p>
                <p class="mt-1 font-black text-zinc-200">${item.eagleScore ?? item.confidence ?? "--"}/100</p>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
                <p class="font-bold uppercase text-zinc-500">Weather</p>
                <p class="mt-1 font-black text-zinc-200">${escapeHtml(item.marketWeather?.label || "--")}</p>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
                <p class="font-bold uppercase text-zinc-500">Strike Out</p>
                <p class="mt-1 font-black text-rose-200">${item.lightning?.strikeOutProbability ?? "--"}%</p>
              </div>
            </div>
            <p class="mt-2 text-xs leading-relaxed text-zinc-400">${escapeHtml(item.prevention)}</p>
          </article>
        `).join("")
        : `<div class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-sm text-zinc-500">No buried signals yet. As STRIKEPULSE scans, rejected setups and Strike Out warnings will appear here.</div>`;
    }

    function renderJournal() {
      const list = document.getElementById("journalList");
      renderJournalAnalytics();
      renderTradeDna();
      renderSignalReplay();
      renderSignalGraveyard();
      renderProofEngine();
      renderReplayOutcomeLibrary();
      const commandRanked = rankSetups().sort((a, b) => b.opportunityScore - a.opportunityScore);
      renderDailyCommandCenter(commandRanked, commandRanked[0], getMarketWeather(currentSymbol));
      renderPilotStatus();
      renderSignalStoryStatus();
      if (!journalEntries.length) {
        list.innerHTML = `
          <div class="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50/80">
            <p class="font-black text-cyan-100">No journal memory yet</p>
            <p class="mt-1 text-xs leading-relaxed">Save one decision. That note starts the lesson.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = journalEntries.slice(0, 4).map(entry => `
        <article class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-black">${entry.symbol} <span class="text-xs text-zinc-500">${entry.outcome}</span></p>
              <p class="mt-1 text-xs text-zinc-400">${entry.contract}</p>
            </div>
            <span class="shrink-0 text-[11px] text-zinc-500">${entry.time}</span>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-zinc-300">${escapeHtml(entry.note || "No note added.")}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            ${entry.tags.map(tag => `<span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-300">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </article>
      `).join("");
    }

    function saveJournalEntry() {
      const contextSymbol = activeSignalContext?.symbol && symbols[activeSignalContext.symbol] ? activeSignalContext.symbol : currentSymbol;
      const data = symbols[contextSymbol] || symbols[currentSymbol];
      const context = ensureSignalContext(contextSymbol, "journal");
      const rawNote = document.getElementById("journalNote").value.trim();
      const redactedNote = redactPersonalInfo(rawNote);
      const signalId = context?.signalId || currentSignalReference(contextSymbol);
      const journalId = `J-${Date.now()}-${contextSymbol}`;
      const entry = {
        journalId,
        signalId,
        symbol: contextSymbol,
        signal: data.type,
        contract: currentContractLabelFor(contextSymbol),
        entryTrigger: data.entry.trigger,
        stop: money(getStopPrice(data)),
        target: money(data.target),
        outcome: document.getElementById("journalOutcome").value,
        tags: [...selectedJournalTags],
        replay: {
          signalScore: data.confidence,
          verdict: getQualityGate(data).verdict,
          predictedOutcome: predictionFromSignal(data.confidence, getQualityGate(data).verdict, data.type),
          marketConditions: currentMarketSnapshot(contextSymbol),
          indicators: currentIndicatorSnapshot(data)
        },
        note: redactedNote,
        date: todayKey(),
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };

      journalEntries = [entry, ...journalEntries].slice(0, 12);
      localStorage.setItem("strikepulseJournal", JSON.stringify(journalEntries));
      if (["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome)) {
        linkSignalLedger(signalId, "journal", journalId, {
          userVerdict: entry.outcome,
          outcome: {
            status: entry.outcome === "Skipped" ? "Skipped" : "Closed",
            winLoss: entry.outcome,
            source: "local-journal"
          }
        });
      } else {
        linkSignalLedger(signalId, "journal", journalId, { userVerdict: entry.outcome });
      }
      updateActiveSignalContext({
        signalId,
        symbol: entry.symbol,
        source: "journal",
        suggestedAction: entry.outcome,
        learning: {
          journalOutcome: entry.outcome,
          journalTags: entry.tags,
          journalNoteSaved: Boolean(entry.note)
        }
      }, "journal");
      const journalContextPatch = { userVerdict: entry.outcome };
      if (["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome)) {
        journalContextPatch.outcome = {
          status: entry.outcome === "Skipped" ? "Skipped" : "Closed",
          winLoss: entry.outcome,
          source: "local-journal"
        };
      }
      linkActiveSignalContext("journal", journalId, journalContextPatch);
      queueCloudSync("journal-entry");
      document.getElementById("journalNote").value = "";
      selectedJournalTags = [];
      document.querySelectorAll(".journal-tag").forEach(button => {
        button.className = "journal-tag rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800";
      });
      renderJournal();
      const completedOutcome = ["Win", "Loss", "Breakeven", "Skipped"].includes(entry.outcome);
      const replayMatch = selectLearningReplayForJournal(entry, { activateReplay: completedOutcome });
      renderTradeDna();
      const dna = buildTradeDna();
      if (replayMatch && completedOutcome) {
        showNeutralToast(rawNote !== redactedNote ? "Journal saved with personal info redacted. Replay is loaded." : `${entry.symbol} journal saved. Replay loaded for the lesson.`);
      } else if (replayMatch) {
        showNeutralToast(rawNote !== redactedNote ? "Journal saved with personal info redacted. Pattern refreshed." : `${entry.symbol} journal saved. Pattern refreshed with ${dna.sampleSize} learning samples.`);
      } else {
        showNeutralToast(rawNote !== redactedNote ? "Journal saved with personal info redacted" : `${entry.symbol} journal note saved`);
      }
    }

    function journalSignalTicket() {
      const snapshot = optionSignalSnapshot();
      if (!snapshot) {
        showNeutralToast("Load a live signal before journaling");
        return;
      }
      const note = [
        `${snapshot.optionTicker} live signal ticket.`,
        `Verdict ${snapshot.verdict}, score ${snapshot.score}/100, grade ${snapshot.grade}, ${snapshot.nineSig}/9 Sig.`,
        `Asset profile ${snapshot.assetProfile}, adjusted confidence ${snapshot.adjustedConfidence}/100.`,
        Number.isFinite(snapshot.premium) ? `Last option candle ${money(snapshot.premium)}.` : "No live option candle price available.",
        [...snapshot.blockers, ...snapshot.profileBlockers].length ? `Blockers: ${[...snapshot.blockers, ...snapshot.profileBlockers].join("; ")}.` : "No signal-engine blockers."
      ].join(" ");
      const entry = {
        journalId: `J-${Date.now()}-${snapshot.symbol}`,
        signalId: snapshot.signalId,
        symbol: snapshot.symbol,
        signal: snapshot.contractType ? snapshot.contractType.toUpperCase() : "Options",
        contract: snapshot.contract,
        entryTrigger: "Live options signal ticket",
        stop: "--",
        target: "--",
        outcome: "Planned",
        tags: ["Signal Ticket", snapshot.verdict, snapshot.assetProfile, `${snapshot.nineSig}/9 Sig`],
        replay: {
          signalScore: snapshot.score,
          verdict: snapshot.verdict,
          predictedOutcome: snapshot.predictedOutcome,
          marketRegime: snapshot.marketRegime,
          baseConfidence: snapshot.baseConfidence,
          regimeAdjustment: snapshot.regimeAdjustment,
          marketConditions: snapshot.marketConditions,
          eventRisk: snapshot.eventRisk,
          indicators: snapshot.scoreBreakdown.map(factor => ({
            label: factor.factor,
            value: factor.rawScore,
            detail: factor.detail
          }))
        },
        note: redactPersonalInfo(note),
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };
      journalEntries = [entry, ...journalEntries].slice(0, 12);
      localStorage.setItem("strikepulseJournal", JSON.stringify(journalEntries));
      linkSignalLedger(snapshot.signalId, "journal", entry.journalId, { userVerdict: "Planned" });
      updateActiveSignalContext({
        signalId: snapshot.signalId,
        symbol: snapshot.symbol,
        source: "journal-signal-ticket",
        suggestedAction: "Planned",
        learning: {
          journalOutcome: "Planned",
          optionTicker: snapshot.optionTicker,
          contract: snapshot.contract
        }
      }, "journal");
      linkActiveSignalContext("journal", entry.journalId, { userVerdict: "Planned" });
      queueCloudSync("journal-signal-ticket");
      renderJournal();
      showNeutralToast(`${snapshot.optionTicker} journal ticket saved`);
    }

    function alertLabel(type, symbol = currentSymbol) {
      const data = symbols[symbol];
      const premium = getPremiumModel(data);
      const labels = {
        entry: `${symbol}: entry trigger - ${data.entry.trigger}`,
        quality: `${symbol}: Quality Gate turns READY or better`,
        ninesig: `${symbol}: 9-Sig reaches 7/9`,
        brewing: `${symbol}: setup starts brewing at 6/9 confluence or A+ Quality Gate`,
        spread: `${symbol}: spread exceeds ${money(premium.spread * 1.8)}`,
        stop: `${symbol}: stop level breaks at ${money(getStopPrice(data))}`,
        premium: `${symbol}: premium stop hits ${money(premium.premiumStop)}`
      };
      return labels[type] || `${symbol}: custom alert`;
    }

    function saveAlert(type) {
      const contract = currentContractLabel();
      const duplicate = alertEntries.find(alert =>
        alert.symbol === currentSymbol &&
        alert.type === type &&
        alert.contract === contract
      );
      if (duplicate) {
        showNeutralToast(`${currentSymbol} ${type} alert already saved`);
        return;
      }
      const alert = {
        id: Date.now(),
        symbol: currentSymbol,
        type,
        label: alertLabel(type),
        contract,
        created: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      };
      alertEntries = [alert, ...alertEntries].slice(0, 10);
      localStorage.setItem("strikepulseAlerts", JSON.stringify(alertEntries));
      renderAlerts();
      showNeutralToast(`${currentSymbol} alert saved`);
    }

    function renderAlerts() {
      document.getElementById("alertCount").textContent = `${alertEntries.length} active`;
      const list = document.getElementById("alertList");
      if (!alertEntries.length) {
        list.innerHTML = `<div class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-sm text-zinc-500">No alerts saved yet.</div>`;
        renderEliteDashboard();
        return;
      }

      list.innerHTML = alertEntries.slice(0, 5).map(alert => `
        <article class="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-black">${alert.symbol} <span class="text-xs text-zinc-500">${alert.type}</span></p>
              <p class="mt-1 text-xs leading-relaxed text-zinc-400">${escapeHtml(alert.label)}</p>
              <p class="mt-1 text-[11px] text-zinc-500">${escapeHtml(alert.contract)}</p>
            </div>
            <span class="shrink-0 text-[11px] text-zinc-500">${alert.created}</span>
          </div>
        </article>
      `).join("");
      renderEliteDashboard();
    }

    function renderNotificationCenter() {
      const list = document.getElementById("notificationList");
      if (!notificationEvents.length) {
        list.innerHTML = `<div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-500">No setup notifications yet.</div>`;
        return;
      }

      list.innerHTML = notificationEvents.slice(0, 5).map(event => `
        <article class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-black text-zinc-100">${event.title}</p>
              <p class="mt-1 text-xs leading-relaxed text-zinc-400">${escapeHtml(event.body)}</p>
            </div>
            <span class="shrink-0 text-[11px] text-zinc-500">${event.time}</span>
          </div>
        </article>
      `).join("");
    }

    function buildSanitizedAiPayload() {
      const data = symbols[currentSymbol];
      const gate = getQualityGate(data);
      const nineSig = getNineSig(data);
      const premium = getPremiumModel(data);
      const recentTags = [...new Set(journalEntries.slice(0, 5).flatMap(entry => entry.tags))];
      const payload = {
        symbol: currentSymbol,
        direction: data.type,
        qualityGate: gate.verdict,
        qualityBlockers: gate.reasons.slice(0, 4),
        nineSig: `${nineSig.score}/9`,
        contract: currentContractLabel(),
        entryStatus: data.entry.status,
        entryTrigger: data.entry.trigger,
        stop: money(getStopPrice(data)),
        target: money(data.target),
        premium: {
          estimate: money(premium.basePremium),
          stop: money(premium.premiumStop),
          target: money(premium.premiumTarget),
          thetaPerDay: money(premium.theta)
        },
        journalTags: recentTags
      };

      if (!privacyModeEnabled && shareJournalNotes) {
        payload.optInJournalNotes = journalEntries.slice(0, 3).map(entry => ({
          outcome: entry.outcome,
          note: entry.note,
          tags: entry.tags
        }));
      }

      return payload;
    }

    function renderPrivacyPreview() {
      const toggle = document.getElementById("privacyModeToggle");
      const notes = document.getElementById("shareJournalNotes");
      notes.checked = shareJournalNotes;
      notes.disabled = privacyModeEnabled;
      toggle.textContent = privacyModeEnabled ? "On" : "Off";
      toggle.className = privacyModeEnabled
        ? "rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/20"
        : "rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/20";
      document.getElementById("privacyPayloadPreview").textContent = JSON.stringify(buildSanitizedAiPayload(), null, 2);
      localStorage.setItem("strikepulsePrivacyMode", String(privacyModeEnabled));
      localStorage.setItem("strikepulseShareJournalNotes", String(shareJournalNotes));
    }

    async function generateSetupReview() {
      const data = symbols[currentSymbol];
      const gate = getQualityGate(data);
      const nineSig = getNineSig(data);
      const premium = getPremiumModel(data);
      const payload = buildSanitizedAiPayload();
      const blockers = gate.reasons.length ? gate.reasons.slice(0, 2).join(" ") : "No major blockers are currently flagged.";
      try {
        const result = await apiFetch("/api/ai/setup-review", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        dataHealth.backend = "connected";
        document.getElementById("aiCopilotSummary").textContent = result.review;
      } catch (error) {
        dataHealth.backend = appConfig.backendEnabled ? "offline" : "disabled";
        const review = `${payload.symbol} is ${payload.qualityGate} with ${payload.nineSig} confluence. Contract: ${payload.contract}. Premium estimate ${payload.premium.estimate}, stop ${payload.premium.stop}, target ${payload.premium.target}. Main read: ${data.entry.summary} ${blockers}`;
        document.getElementById("aiCopilotSummary").textContent = review;
      }
      renderPrivacyPreview();
      renderAppHealth();
      showNeutralToast("AI setup review generated");
    }

    function generateJournalCoach() {
      const latestClosed = practiceAccount.history.find(trade => trade.action === "CLOSE");
      renderEagleScoutCoach(latestClosed);
      renderPrivacyPreview();
      showNeutralToast("Eagle Scout coach generated");
    }

    function latestJournalPattern() {
      const recent = journalEntries.slice(0, 5);
      const tags = recent.flatMap(entry => entry.tags || []);
      const tagCounts = tags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }

    function buildEagleScoutCoach(trade = null) {
      const closed = practiceAccount.history.filter(item => item.action === "CLOSE");
      const dna = buildTradeDna();
      const latest = trade || closed[0] || null;
      const topJournalTag = latestJournalPattern();
      if (!latest) {
        return {
          grade: "Learning",
          entryQuality: "Need closed trade",
          riskRule: "Paper only",
          summary: topJournalTag
            ? `Journal pattern detected: ${topJournalTag}. Close a paper trade to unlock full post-trade coaching.`
            : "Close a paper trade to unlock full Eagle Scout coaching. Journal planned, skipped, winning, and losing trades so STRIKEPULSE can learn your patterns.",
          wentRight: topJournalTag ? [`Journal awareness: ${topJournalTag}`] : ["Local privacy-first coaching ready"],
          wentWrong: ["No closed paper trade selected yet"],
          exitPlan: "After closing a paper trade, STRIKEPULSE will compare the plan, grade, blockers, P/L, and Trade DNA profile.",
          nextRule: "Next rule: paper trade only, close it, then journal the outcome."
        };
      }

      const plan = latest.plan || {};
      const pnl = Number(latest.pnl) || 0;
      const issues = latest.issues || [];
      const wentRight = [];
      const wentWrong = [];
      if (pnl > 0) wentRight.push(`Protected a ${money(pnl)} win`);
      if (pnl < 0) wentWrong.push(`${money(Math.abs(pnl))} loss needs review`);
      if (["A+ SETUP", "READY"].includes(plan.qualityGate)) wentRight.push(`Quality Gate: ${plan.qualityGate}`);
      if ((plan.nineSig || 0) >= 6) wentRight.push(`${plan.nineSig}/9 signal confluence`);
      if (["Elite", "Decent", "Live"].includes(plan.liquidity)) wentRight.push(`${plan.liquidity} liquidity`);
      if ((plan.rr || 0) >= 2) wentRight.push(`${Number(plan.rr).toFixed(2)}:1 reward/risk`);
      issues.forEach(issue => wentWrong.push(issue));
      (plan.blockers || []).slice(0, 2).forEach(blocker => wentWrong.push(blocker));
      if (topJournalTag) wentWrong.push(`Watch journal pattern: ${topJournalTag}`);
      if (!wentRight.length) wentRight.push("Trade was recorded, graded, and available for review");
      if (!wentWrong.length) wentWrong.push("No major process issue flagged");

      const entryQuality = (() => {
        if (plan.entryStatus === "READY" && (plan.nineSig || 0) >= 6) return "Clean confirmation";
        if (plan.entryStatus === "WAIT") return "Entered before wait cleared";
        if (plan.entryStatus === "CONFIRM") return "Needed more confirmation";
        return plan.entryTrigger || "Review entry trigger";
      })();
      const riskRule = (() => {
        if ((plan.rr || 0) < 2) return "Reject under 2:1 R/R";
        if (!["Elite", "Decent", "Live"].includes(plan.liquidity)) return "Avoid weak liquidity";
        if ((plan.nineSig || 0) < 6) return "Require 6/9 confluence";
        return "Repeat only with planned stop";
      })();
      const exitPlan = pnl >= 0
        ? "For similar winners, scale only after confirmation and protect gains near target or when Strike Out risk rises."
        : "For similar losers, reduce size, honor the original stop, and skip entries when the Quality Gate or timing engine says wait.";
      const nextRule = issues[0]
        ? `Next rule: do not enter when ${issues[0].toLowerCase()}.`
        : dna.fixes?.[0]
          ? `Next rule: fix ${dna.fixes[0].toLowerCase()} before increasing size.`
          : "Next rule: repeat the setup only when confidence, risk/reward, and entry timing align.";
      return {
        grade: `${latest.grade || "Ungraded"} · ${money(pnl)}`,
        entryQuality,
        riskRule,
        summary: `${latest.symbol} coach read: ${pnl >= 0 ? "profitable outcome" : pnl < 0 ? "loss review" : "breakeven review"} with process grade ${latest.grade || "ungraded"}. Trade DNA score is ${dna.edgeScore}/100 and discipline is ${dna.disciplineScore}/100.`,
        wentRight: [...new Set(wentRight)].slice(0, 5),
        wentWrong: [...new Set(wentWrong)].slice(0, 5),
        exitPlan,
        nextRule
      };
    }

    function renderEagleScoutCoach(trade = null) {
      const grade = document.getElementById("aiCoachGrade");
      if (!grade) return;
      const coach = buildEagleScoutCoach(trade);
      document.getElementById("aiCopilotSummary").textContent = coach.summary;
      document.getElementById("aiCoachGrade").textContent = coach.grade;
      document.getElementById("aiCoachEntryZones").textContent = coach.entryQuality;
      document.getElementById("aiCoachRiskRule").textContent = coach.riskRule;
      document.getElementById("aiCoachWentRight").innerHTML = coach.wentRight.map(item => tradeDnaPill(item, "emerald")).join("");
      document.getElementById("aiCoachWentWrong").innerHTML = coach.wentWrong.map(item => tradeDnaPill(item, item.includes("No major") ? "cyan" : "amber")).join("");
      document.getElementById("aiCoachExitPlan").textContent = coach.exitPlan;
      document.getElementById("aiCoachNextRule").textContent = coach.nextRule;
    }

    function renderSetupRadar() {
      const button = document.getElementById("setupRadarToggle");
      button.textContent = setupRadarEnabled ? "On" : "Off";
      button.className = setupRadarEnabled
        ? "rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/20"
        : "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-zinc-800";
      document.getElementById("setupRadarStatus").textContent = setupRadarEnabled
        ? "Watching for 9-Sig brewing setups"
        : "Setup radar paused";
      localStorage.setItem("strikepulseSetupRadar", String(setupRadarEnabled));
    }

    function scanForBrewingSetups(force = false) {
      if (!setupRadarEnabled && !force) return;
      const candidates = Object.entries(symbols).map(([symbol, data]) => {
        const nineSig = getNineSig(data);
        const gate = getQualityGate(data);
        const rejection = evaluateTradeRejection(data, gate, symbol);
        const lightning = evaluateLightningStrike(data, gate, rejection, symbol);
        return { symbol, data, nineSig, gate, rejection, lightning };
      }).filter(item => item.nineSig.score >= 6 || item.gate.verdict === "A+ SETUP" || item.lightning.inProbability >= 68 || item.lightning.outProbability >= 66);

      candidates.forEach(item => {
        const lightningAlert = appConfig.features.lightningStrikeAlerts && (item.lightning.inProbability >= 82 || item.lightning.outProbability >= 66);
        const key = `${item.symbol}-${item.nineSig.score}-${item.gate.verdict}-${item.lightning.verdict}`;
        const last = notifiedSetups[key] || 0;
        const freshEnough = Date.now() - last > appConfig.alerts.cooldownMs;
        if (force || freshEnough) {
          const title = lightningAlert
            ? `${item.symbol} ${item.lightning.verdict}`
            : item.nineSig.score >= 7
              ? `${item.symbol} 9-Sig setup`
              : `${item.symbol} setup brewing`;
          const body = lightningAlert
            ? `${item.lightning.summary} Alerts tier: ${premiumTierLabel("lightningStrikeAlerts")}.`
            : `${item.nineSig.score}/9 confluence, Quality Gate: ${item.gate.verdict}`;
          rememberSignalSnapshot(item.symbol, lightningAlert ? "lightning-alert" : "setup-radar");
          sendSetupNotification(title, body);
          notifiedSetups[key] = Date.now();
        }
      });
      localStorage.setItem("strikepulseNotifiedSetups", JSON.stringify(notifiedSetups));
    }

    function renderAlertPreview(data) {
      document.getElementById("entryAlertPreview").textContent = data.entry.trigger;
    }

    function applyFocusMode() {
      document.body.dataset.advancedMode = focusMode ? "true" : "false";
      const button = document.getElementById("focusToggle");
      button.className = focusMode
        ? "inline-flex h-10 w-10 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-sm font-bold text-emerald-100 hover:bg-emerald-500/20 sm:w-auto sm:px-3"
        : "inline-flex h-10 w-10 items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-sm font-bold text-cyan-100 hover:bg-cyan-500/20 sm:w-auto sm:px-3";
      button.setAttribute("aria-label", focusMode ? "Return to core Signal Story" : "Show advanced controls");
      button.querySelector("span").textContent = focusMode ? "Core" : "Advanced";
      localStorage.setItem("strikepulseFocus", String(focusMode));
      requestAnimationFrame(resizeCanvas);
    }

    async function setSignal(symbol, notify = true) {
      const data = symbols[symbol];
      if (!data) return;
      if (tradeReplayState.chartLinked || tradeReplayState.playing) {
        resetTradeReplay();
      }
      currentSymbol = symbol;
      try {
        const quote = await dataAdapter.getQuote(symbol);
        if (Number.isFinite(quote.price)) data.price = quote.price;
        if (Number.isFinite(quote.changePercent)) data.move = quote.changePercent;
        candles = await dataAdapter.getCandles(symbol, activeRange);
        await refreshEnrichedData(symbol);
      } catch (error) {
        candles = generateCandles(data.price, data.type);
        updateDataHealth(performance.now(), false);
      }
      const bullish = data.type === "Bullish";

      document.getElementById("symbol").textContent = symbol;
      document.getElementById("sector").textContent = data.sector;
      document.getElementById("price").textContent = money(data.price);
      document.getElementById("move").textContent = `${data.move > 0 ? "+" : ""}${data.move.toFixed(2)}% today`;
      document.getElementById("move").className = `text-sm font-black ${data.move >= 0 ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("confidence").textContent = `${data.confidence}%`;
      document.getElementById("target").textContent = money(data.target);
      document.getElementById("targetMove").textContent = `${(((data.target - data.price) / data.price) * 100).toFixed(1)}% ${data.target >= data.price ? "upside" : "downside"}`;
      document.getElementById("targetMove").className = `mt-1 text-sm ${data.target >= data.price ? "text-emerald-300" : "text-rose-300"}`;
      document.getElementById("risk").textContent = data.risk;

      const badge = document.getElementById("signalBadge");
      badge.className = `inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-2 text-sm font-black ${bullish ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`;
      badge.innerHTML = `<i class="fa-solid ${bullish ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}"></i>${bullish ? "STRONG BULLISH" : "BEARISH ALERT"}`;
      const gate = getQualityGate(data);
      const rejection = evaluateTradeRejection(data, gate, symbol);
      renderMarketContext(data);
      renderMarketWeather(symbol);
      renderQualityGate(data);
      renderLightningTicket(evaluateLightningStrike(data, gate, rejection, symbol));
      renderBreakdown(data);
      renderEntryTiming(data);
      renderStopPlan(data);
      renderTradeManagement(data);
      renderOptionsEdge(data);
      renderContractSelector(data);
      renderPremiumTracker(data);
      renderPracticeAccount();
      renderAlertPreview(data);
      renderPrivacyPreview();
      drawChart();
      rememberSignalSnapshot(symbol, notify ? "ticker-scan" : "refresh");
      renderShareSignalCard(symbol);
      renderEagleScoutCommandCenter();
      syncScreenshotContext();
      if (notify) markStartFlowStep("ticket");
      if (notify) showToast(symbol, data.type);
    }

    function renderButtons() {
      document.getElementById("tickerStrip").innerHTML = Object.keys(symbols).map(symbol => {
        const data = symbols[symbol];
        const color = data.type === "Bullish" ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300";
        return `<button data-symbol="${symbol}" class="shrink-0 rounded-lg border ${color} bg-zinc-900 px-4 py-2 text-left text-sm font-black hover:bg-zinc-800">${symbol} <span class="ml-1 text-xs text-zinc-400">${data.type}</span></button>`;
      }).join("");

      document.getElementById("queue").innerHTML = ["QQQ", "TQQQ", "NVDA", "AMD", "XLE", "USO"].map(symbol => {
        const data = symbols[symbol];
        const color = data.type === "Bullish" ? "text-emerald-300" : "text-rose-300";
        return `<button data-symbol="${symbol}" class="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-left hover:border-zinc-600"><span><span class="block font-black">${symbol}</span><span class="text-xs text-zinc-500">${data.sector}</span></span><span class="${color} text-sm font-black">${data.confidence}%</span></button>`;
      }).join("");

      document.querySelectorAll("[data-symbol]").forEach(button => {
        button.addEventListener("click", () => {
          markStartFlowStep("ticker");
          openSignalExplanation(button.dataset.symbol, "live");
        });
      });
    }

    function addMessage(text, sender) {
      const chat = document.getElementById("chat");
      const message = document.createElement("div");
      message.className = sender === "bot" ? "max-w-[86%] rounded-lg bg-zinc-800 p-3 text-sm" : "ml-auto max-w-[86%] rounded-lg bg-cyan-500 p-3 text-sm font-bold text-zinc-950";
      message.textContent = text;
      chat.appendChild(message);
      chat.scrollTop = chat.scrollHeight;
    }

    document.getElementById("mentorButton").addEventListener("click", () => {
      document.getElementById("mentorModal").classList.remove("hidden");
      if (!document.getElementById("chat").children.length) addMessage("Welcome. Ask about entries, risk, or the current signal setup.", "bot");
    });
    document.getElementById("authButton").addEventListener("click", openAuthModal);
    document.getElementById("openAuthFromHealth").addEventListener("click", openAuthModal);
    document.getElementById("closeAuth").addEventListener("click", () => document.getElementById("authModal").classList.add("hidden"));
    document.getElementById("authModal").addEventListener("click", event => {
      if (event.target.id === "authModal") document.getElementById("authModal").classList.add("hidden");
    });
    document.getElementById("authCreateAccount").addEventListener("click", () => handleAuthShell("create"));
    document.getElementById("authSignIn").addEventListener("click", () => handleAuthShell("sign-in"));
    document.getElementById("authSignOut").addEventListener("click", () => handleAuthShell("sign-out"));
    document.getElementById("closeMentor").addEventListener("click", () => document.getElementById("mentorModal").classList.add("hidden"));
    document.getElementById("mentorModal").addEventListener("click", event => {
      if (event.target.id === "mentorModal") document.getElementById("mentorModal").classList.add("hidden");
    });
    document.getElementById("chatForm").addEventListener("submit", event => {
      event.preventDefault();
      const input = document.getElementById("chatInput");
      const value = input.value.trim();
      if (!value) return;
      addMessage(value, "user");
      input.value = "";
      setTimeout(() => {
        const data = symbols[currentSymbol];
        addMessage(`${currentSymbol} is flagged ${data.type.toLowerCase()} with ${data.confidence}% confidence. Confirm the setup against your own entry, stop, and risk rules before acting.`, "bot");
      }, 500);
    });
    document.getElementById("search").addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const symbol = event.currentTarget.value.trim().toUpperCase();
      if (symbols[symbol]) {
        markStartFlowStep("ticker");
        openSignalExplanation(symbol, "live");
      }
      else showToast(symbol || "Symbol", "Bearish");
    });
    document.getElementById("screenshotUpload").addEventListener("change", event => {
      setScreenshotPreview(event.currentTarget.files?.[0]);
    });
    document.getElementById("screenshotDropZone").addEventListener("dragover", event => {
      event.preventDefault();
      event.currentTarget.classList.add("border-indigo-200");
    });
    document.getElementById("screenshotDropZone").addEventListener("dragleave", event => {
      event.currentTarget.classList.remove("border-indigo-200");
    });
    document.getElementById("screenshotDropZone").addEventListener("drop", event => {
      event.preventDefault();
      event.currentTarget.classList.remove("border-indigo-200");
      setScreenshotPreview(event.dataTransfer?.files?.[0]);
    });
    document.addEventListener("paste", event => {
      const imageItem = [...(event.clipboardData?.items || [])].find(item => item.type === "image/png" || item.type === "image/jpeg");
      if (imageItem) setScreenshotPreview(imageItem.getAsFile());
    });
    document.getElementById("runScreenshotCheck").addEventListener("click", () => {
      runScreenshotSignalCheck();
      markStartFlowStep("screenshot");
    });
    document.getElementById("clearScreenshotCheck").addEventListener("click", clearScreenshotSignalCheck);
    document.getElementById("riskBudget").addEventListener("change", () => renderStopPlan(symbols[currentSymbol]));
    ["riskManagerAccount", "riskManagerRiskPct", "riskManagerEntry", "riskManagerStop", "riskManagerTarget"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderRiskManager);
    });
    document.getElementById("expiryChoice").addEventListener("change", () => {
      renderContractSelector(symbols[currentSymbol]);
      renderPremiumTracker(symbols[currentSymbol]);
      renderPracticeAccount();
      renderQualityGate(symbols[currentSymbol]);
      renderTradeManagement(symbols[currentSymbol]);
      renderSetupRankings();
      renderAlertPreview(symbols[currentSymbol]);
    });
    document.getElementById("moneynessChoice").addEventListener("change", () => {
      renderContractSelector(symbols[currentSymbol]);
      renderPremiumTracker(symbols[currentSymbol]);
      renderPracticeAccount();
      renderQualityGate(symbols[currentSymbol]);
      renderTradeManagement(symbols[currentSymbol]);
      renderSetupRankings();
      renderAlertPreview(symbols[currentSymbol]);
    });
    document.getElementById("refreshOptionIntel").addEventListener("click", refreshOptionIntelligence);
    document.getElementById("searchReferenceTickers").addEventListener("click", searchReferenceTickers);
    document.getElementById("paperTradeSignal").addEventListener("click", () => {
      paperTradeSignalTicket();
      markStartFlowStep("paper");
    });
    document.getElementById("launchPaperTrade")?.addEventListener("click", () => {
      paperTradeSignalTicket();
      markStartFlowStep("paper");
    });
    document.getElementById("launchCorePaperTrade")?.addEventListener("click", () => {
      paperTradeSignalTicket();
      markStartFlowStep("paper");
    });
    document.getElementById("launchWaitDecision")?.addEventListener("click", () => {
      fillLaunchDecisionJournal("Wait");
    });
    document.getElementById("launchCoreWaitDecision")?.addEventListener("click", () => {
      fillLaunchDecisionJournal("Wait");
    });
    document.getElementById("launchRejectDecision")?.addEventListener("click", () => {
      fillLaunchDecisionJournal("Reject");
    });
    document.getElementById("launchCoreRejectDecision")?.addEventListener("click", () => {
      fillLaunchDecisionJournal("Reject");
    });
    document.getElementById("journalSignal").addEventListener("click", () => {
      journalSignalTicket();
      markStartFlowStep("journal");
    });
    document.querySelectorAll(".alert-preset").forEach(button => {
      button.addEventListener("click", () => saveAlert(button.dataset.alertType));
    });
    document.getElementById("saveAllAlerts").addEventListener("click", () => {
      ["entry", "quality", "ninesig", "brewing", "spread", "stop", "premium"].forEach(saveAlert);
    });
    document.getElementById("setupRadarToggle").addEventListener("click", () => {
      setupRadarEnabled = !setupRadarEnabled;
      renderSetupRadar();
    });
    document.getElementById("enableBrowserNotifications").addEventListener("click", async () => {
      if (!("Notification" in window)) {
        showNeutralToast("Browser notifications are not supported here");
        return;
      }
      const permission = await Notification.requestPermission();
      showNeutralToast(permission === "granted" ? "Browser notifications enabled" : "Notifications not enabled");
    });
    document.getElementById("testSetupNotification").addEventListener("click", () => scanForBrewingSetups(true));
    document.getElementById("clearNotifications").addEventListener("click", () => {
      notificationEvents = [];
      localStorage.removeItem("strikepulseNotifications");
      renderNotificationCenter();
      showNeutralToast("Notification center cleared");
    });
    document.getElementById("generateAiReview").addEventListener("click", generateSetupReview);
    document.getElementById("generateAiCoach").addEventListener("click", generateJournalCoach);
    document.getElementById("privacyModeToggle").addEventListener("click", () => {
      privacyModeEnabled = !privacyModeEnabled;
      if (privacyModeEnabled) shareJournalNotes = false;
      renderPrivacyPreview();
    });
    document.getElementById("shareJournalNotes").addEventListener("change", event => {
      shareJournalNotes = event.currentTarget.checked;
      renderPrivacyPreview();
    });
    document.getElementById("refreshPrivacyPreview").addEventListener("click", renderPrivacyPreview);
    document.getElementById("copyShareSignalCard").addEventListener("click", copyShareSignalCard);
    document.getElementById("downloadShareSignalCard").addEventListener("click", downloadShareSignalCard);
    document.getElementById("markMissionStudied").addEventListener("click", markMissionStudied);
    document.getElementById("eagleCommandLightningToggle").addEventListener("change", renderEagleScoutCommandCenter);
    document.getElementById("eagleCommandReplayPlay").addEventListener("click", playTradeReplay);
    document.getElementById("eagleCommandReplayPause").addEventListener("click", stopTradeReplay);
    document.getElementById("eagleCommandReplaySpeed").addEventListener("change", event => {
      tradeReplayState.speedMs = Number(event.currentTarget.value) || 700;
      localStorage.setItem("strikepulseTradeReplaySpeed", String(tradeReplayState.speedMs));
      const primarySpeed = document.getElementById("tradeReplaySpeed");
      if (primarySpeed) primarySpeed.value = String(tradeReplayState.speedMs);
      if (tradeReplayState.playing) {
        stopTradeReplay();
        playTradeReplay();
      }
      renderEagleScoutCommandCenter();
    });
    document.querySelectorAll(".eagle-command-ai").forEach(button => {
      button.addEventListener("click", () => {
        document.getElementById("eagleCommandCenter").dataset.aiMode = button.dataset.commandAi;
        renderEagleScoutCommandCenter();
      });
    });
    document.getElementById("saveFeedback").addEventListener("click", saveFeedbackEntry);
    document.getElementById("practiceBuy").addEventListener("click", () => {
      buyPracticeContract();
      markStartFlowStep("paper");
    });
    document.getElementById("practiceClose").addEventListener("click", closePracticePositions);
    document.getElementById("practiceReset").addEventListener("click", resetPracticeAccount);
    document.getElementById("syncLocalState").addEventListener("click", syncLocalState);
    document.getElementById("exportLocalData").addEventListener("click", exportLocalData);
    document.getElementById("resetLocalData").addEventListener("click", resetLocalData);
    document.getElementById("prefsButton").addEventListener("click", () => {
      renderPreferences();
      document.getElementById("prefsModal").classList.remove("hidden");
    });
    document.getElementById("closePrefs").addEventListener("click", () => {
      document.getElementById("prefsModal").classList.add("hidden");
    });
    document.getElementById("prefsModal").addEventListener("click", event => {
      if (event.target.id === "prefsModal" && userPreferences.onboarded) document.getElementById("prefsModal").classList.add("hidden");
    });
    ["prefStyle", "prefRisk", "prefExpiry", "prefMoneyness", "prefTheme", "prefRadar", "prefFocus", "prefPrivacy"].forEach(id => {
      document.getElementById(id).addEventListener("change", () => {
        const draft = {
          style: document.getElementById("prefStyle").value,
          risk: document.getElementById("prefRisk").value,
          expiry: document.getElementById("prefExpiry").value,
          moneyness: document.getElementById("prefMoneyness").value,
          theme: normalizeTheme(document.getElementById("prefTheme").value),
          radar: document.getElementById("prefRadar").checked,
          focus: document.getElementById("prefFocus").checked,
          privacy: document.getElementById("prefPrivacy").checked
        };
        document.body.dataset.brokerTheme = draft.theme;
        document.getElementById("prefsSummary").textContent = `${draft.style} trader, ${money(Number(draft.risk))} max risk, ${draft.expiry} ${draft.moneyness.toUpperCase()} contracts, ${themeLabels[draft.theme]} theme, radar ${draft.radar ? "on" : "off"}, privacy ${draft.privacy ? "on" : "off"}.`;
      });
    });
    document.getElementById("savePrefs").addEventListener("click", savePreferences);
    document.getElementById("focusToggle").addEventListener("click", () => {
      focusMode = !focusMode;
      userPreferences.focus = focusMode;
      localStorage.setItem("strikepulsePreferences", JSON.stringify(userPreferences));
      applyFocusMode();
    });
    document.querySelectorAll(".journal-tag").forEach(button => {
      button.addEventListener("click", () => {
        const tag = button.dataset.tag;
        const selected = selectedJournalTags.includes(tag);
        selectedJournalTags = selected
          ? selectedJournalTags.filter(item => item !== tag)
          : [...selectedJournalTags, tag];
        button.className = selected
          ? "journal-tag rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
          : "journal-tag rounded-full border border-cyan-400 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200";
      });
    });
    document.getElementById("saveJournal").addEventListener("click", () => {
      saveJournalEntry();
      markStartFlowStep("journal");
    });
    document.getElementById("resetStartFlow").addEventListener("click", () => {
      startFlowProgress = {};
      saveStartFlowProgress();
      renderStartFlow();
      showNeutralToast("Start Here progress reset");
    });
    document.getElementById("startFirstAnalysis")?.addEventListener("click", () => {
      markStartFlowStep("ticker");
      openSignalExplanation("NVDA", "live");
      showNeutralToast("Eagle Scout analysis loading");
    });
    document.getElementById("loadDemoMode")?.addEventListener("click", loadDemoMode);
    document.getElementById("signalReplaySelect").addEventListener("change", () => renderSignalReplay({ activateChart: true }));
    document.getElementById("signalReplayRun").addEventListener("click", () => renderSignalReplay({ activateChart: true }));
    document.getElementById("eagleScoutOpenPaper")?.addEventListener("click", openEagleScoutPrimaryAction);
    document.getElementById("eagleScoutOpenReplay")?.addEventListener("click", openEagleScoutReplay);
    document.getElementById("eagleScoutOpenScreenshot")?.addEventListener("click", openEagleScoutScreenshotCheck);
    document.getElementById("eagleScoutOpenJournal")?.addEventListener("click", openEagleScoutJournal);
    document.getElementById("tradeReplayPlay").addEventListener("click", playTradeReplay);
    document.getElementById("tradeReplayStepBack").addEventListener("click", () => setTradeReplayIndex(tradeReplayState.index - 1));
    document.getElementById("tradeReplayStepForward").addEventListener("click", () => setTradeReplayIndex(tradeReplayState.index + 1));
    document.getElementById("tradeReplayScrubber").addEventListener("input", event => setTradeReplayIndex(Number(event.target.value)));
    document.getElementById("tradeReplaySpeed").addEventListener("change", event => {
      tradeReplayState.speedMs = Number(event.target.value) || 700;
      localStorage.setItem("strikepulseTradeReplaySpeed", String(tradeReplayState.speedMs));
      if (tradeReplayState.playing) {
        stopTradeReplay();
        playTradeReplay();
      }
    });
    document.getElementById("clearJournal").addEventListener("click", () => {
      if (!confirmDestructiveAction("Clear all local journal notes on this device?")) {
        return;
      }
      journalEntries = [];
      localStorage.removeItem("strikepulseJournal");
      renderJournal();
      showNeutralToast("Journal cleared");
    });
    document.getElementById("zoomIn").addEventListener("click", () => {
      setChartZoom(zoomLevel + .5);
    });
    document.getElementById("zoomOut").addEventListener("click", () => {
      setChartZoom(zoomLevel - .5);
    });
    document.getElementById("resetZoom").addEventListener("click", () => {
      resetChartView();
    });
    document.getElementById("chartTypeSelect")?.addEventListener("change", event => {
      setChartType(event.target.value);
    });
    document.getElementById("saveChartLayout")?.addEventListener("click", saveChartLayout);
    document.getElementById("loadChartLayout")?.addEventListener("click", loadChartLayout);
    document.querySelectorAll("[data-eagle-layer]").forEach(button => {
      button.addEventListener("click", () => toggleEagleLayer(button.dataset.eagleLayer));
    });
    eagleChartOverlay?.addEventListener("click", event => {
      const marker = event.target.closest("[data-eagle-scout-marker]");
      if (!marker) return;
      event.preventDefault();
      event.stopPropagation();
      activeEagleScoutMarker = marker.dataset.eagleScoutMarker || "live";
      renderEagleScoutExplanation(activeEagleScoutMarker);
      document.getElementById("eagleScoutExplainPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    eagleChartOverlay?.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      const marker = event.target.closest("[data-eagle-scout-marker]");
      if (!marker) return;
      event.preventDefault();
      activeEagleScoutMarker = marker.dataset.eagleScoutMarker || "live";
      renderEagleScoutExplanation(activeEagleScoutMarker);
    });
    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      const step = event.deltaY < 0 ? .35 : -.35;
      setChartZoom(zoomLevel + step);
    }, { passive: false });
    canvas.addEventListener("dblclick", () => {
      resetChartView();
    });
    canvas.addEventListener("pointerdown", event => {
      chartDragStart = { x: event.clientX, offset: chartPanOffset };
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (!chartDragStart) return;
      const visibleCount = Math.max(14, Math.round(candles.length / zoomLevel));
      const candleWidth = Math.max(8, canvas.clientWidth / visibleCount);
      const deltaCandles = Math.round((chartDragStart.x - event.clientX) / candleWidth);
      setChartPanOffset(chartDragStart.offset + deltaCandles);
    });
    canvas.addEventListener("pointerup", event => {
      chartDragStart = null;
      canvas.releasePointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointercancel", () => {
      chartDragStart = null;
    });
    canvas.addEventListener("touchstart", event => {
      if (event.touches.length === 2) {
        chartTouchDistance = getTouchDistance(event.touches);
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", event => {
      if (event.touches.length !== 2 || !chartTouchDistance) return;
      event.preventDefault();
      const nextDistance = getTouchDistance(event.touches);
      const delta = (nextDistance - chartTouchDistance) / 120;
      if (Math.abs(delta) >= .08) {
        setChartZoom(zoomLevel + delta);
        chartTouchDistance = nextDistance;
      }
    }, { passive: false });
    canvas.addEventListener("touchend", () => {
      chartTouchDistance = null;
    });
    function syncRangeButtons() {
      document.querySelectorAll(".range").forEach(item => {
        const active = item.dataset.range === activeRange;
        item.className = `range h-12 rounded-lg border px-4 text-sm font-black ${active ? "border-cyan-500 bg-cyan-500/15 text-cyan-200" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`;
      });
      document.querySelectorAll(".launch-range").forEach(item => {
        item.classList.toggle("is-active", item.dataset.range === activeRange);
      });
    }

    document.querySelectorAll(".range, .launch-range").forEach(button => {
      button.addEventListener("click", () => {
        activeRange = button.dataset.range;
        zoomLevel = 1;
        chartPanOffset = 0;
        renderChartHud();
        syncScreenshotContext();
        syncRangeButtons();
        setSignal(currentSymbol, false);
      });
    });
    document.getElementById("trialButton").addEventListener("click", () => {
      document.getElementById("billingModal").classList.remove("hidden");
    });
    document.getElementById("closeBilling").addEventListener("click", () => {
      document.getElementById("billingModal").classList.add("hidden");
    });
    document.getElementById("billingModal").addEventListener("click", event => {
      if (event.target.id === "billingModal") document.getElementById("billingModal").classList.add("hidden");
    });
    document.querySelectorAll(".scoreHelp").forEach(button => {
      button.addEventListener("click", () => document.getElementById("scoreModal").classList.remove("hidden"));
    });
    document.getElementById("closeScoreModal").addEventListener("click", () => {
      document.getElementById("scoreModal").classList.add("hidden");
    });
    document.getElementById("scoreModal").addEventListener("click", event => {
      if (event.target.id === "scoreModal") document.getElementById("scoreModal").classList.add("hidden");
    });
    window.addEventListener("resize", resizeCanvas);

    function isMobileLaunchSurface() {
      return window.matchMedia?.("(max-width: 640px)")?.matches
        || window.matchMedia?.("(display-mode: standalone)")?.matches
        || window.navigator.standalone === true;
    }

    function focusMissionBriefingFirstScreen({ force = false } = {}) {
      if (window.location.hash && !force) return;
      const mission = document.getElementById("launchCoreMission") || document.getElementById("eagleCommandCenter");
      if (!mission) return;
      requestAnimationFrame(() => {
        mission.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }

    function registerStrikepulsePwa() {
      if (!("serviceWorker" in navigator)) return;
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(() => {
          // PWA install remains optional; local-first app behavior is unchanged if registration fails.
        });
      });
    }

    renderButtons();
    renderEagleLayerControls();
    renderScreenshotControls();
    clearScreenshotSignalCheck();
    renderStartFlow();
    promoteChartPanel();
    initializeProfessionalChart();
    renderPreferences();
    applyPreferences();
    renderSetupRankings();
    renderSetupTape();
    renderLightningTicket(evaluateLightningStrike(symbols[currentSymbol], getQualityGate(symbols[currentSymbol]), evaluateTradeRejection(symbols[currentSymbol]), currentSymbol));
    document.getElementById("tradeReplaySpeed").value = String(tradeReplayState.speedMs);
    document.getElementById("eagleCommandReplaySpeed").value = String(tradeReplayState.speedMs);
    renderJournal();
    renderPracticeAccount();
    renderEagleScoutCoach(practiceAccount.history.find(trade => trade.action === "CLOSE"));
    renderAlerts();
    renderNotificationCenter();
    renderFeedbackCenter();
    renderQuickFeedbackButtons();
    renderEagleScoutCommandCenter();
    syncRangeButtons();
    initializeFirstUseCoach();
    focusMissionBriefingFirstScreen();
    registerStrikepulsePwa();
    initializeSupabaseAuth();
    refreshBackendHealth();
    if (!userPreferences.onboarded && !isMobileLaunchSurface()) {
      document.getElementById("prefsModal").classList.remove("hidden");
    }
    renderAppHealth();
    requestAnimationFrame(resizeCanvas);
    setInterval(() => {
      if (document.hidden) return;
      tickCounter += 1;
      const data = symbols[currentSymbol];
      const liveVolatility = activeRange === "1m" ? .18 : activeRange === "5m" ? .3 : activeRange === "15m" ? .48 : .72;
      data.price = Math.max(1, data.price + (Math.random() - .45) * liveVolatility);
      document.getElementById("price").textContent = money(data.price);
      document.getElementById("updated").textContent = "Updated just now";
      renderStopPlan(data);
      renderPremiumTracker(data);
      renderPracticeAccount();
      if (tickCounter % appConfig.dataRefresh.qualityEveryTicks === 0) {
        renderTradeManagement(data);
        renderMarketContext(data);
        renderMarketWeather(currentSymbol);
        renderQualityGate(data);
        renderLightningTicket(evaluateLightningStrike(data, getQualityGate(data), evaluateTradeRejection(data), currentSymbol));
      }
      if (tickCounter % appConfig.dataRefresh.rankingEveryTicks === 0) {
        renderSetupRankings();
        renderSetupTape();
      }
      if (tickCounter % appConfig.alerts.scanEveryTicks === 0) {
        scanForBrewingSetups();
      }
      if (tickCounter % appConfig.dataRefresh.enrichEveryTicks === 0) {
        refreshEnrichedData(currentSymbol);
      }
      if (tradeReplayState.chartLinked) return;
      if (!candles.length) return;
      const previous = candles[candles.length - 1].close;
      candles.push({
        open: previous,
        close: data.price,
        high: Math.max(previous, data.price) + Math.random(),
        low: Math.min(previous, data.price) - Math.random(),
        volume: Math.round(900000 + Math.random() * 3000000)
      });
      candles.shift();
      drawChart();
    }, appConfig.dataRefresh.liveTickMs);
  
