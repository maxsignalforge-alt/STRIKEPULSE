export const appConfig = {
  appName: "STRIKEPULSE",
  version: "0.1.0-prototype",
  providerMode: "mock",
  apiBaseUrl: "http://127.0.0.1:8787",
  backendEnabled: true,
  supabase: {
    enabled: true,
    url: "https://nllomtyefgmehnwxnjez.supabase.co",
    anonKey: "sb_publishable_9daUEJG1k5z_6pLyilzekg_1nELR_WB",
    authMode: "supabase-js",
    localFallback: true,
    cloudSyncEnabled: false
  },
  pricing: {
    free: "$0",
    pro: "$29/mo",
    eliteAi: "$59/mo",
    desk: "$149/mo"
  },
  features: {
    aiCopilot: true,
    phonePush: false,
    browserNotifications: true,
    setupRadar: true,
    privacyMode: true,
    affiliateStack: true,
    marketWeather: true,
    lightningStrikeSystem: true,
    lightningStrikeAlerts: true
  },
  premiumControls: {
    lightningStrikeAlerts: "pro",
    eagleScoutEliteLayers: "eliteAi",
    screenshotAiAnalysis: "eliteAi",
    tradeReplayArchive: "pro",
    aiCoach: "eliteAi"
  },
  alerts: {
    defaultNineSigThreshold: 6,
    cooldownMs: 45000,
    scanEveryTicks: 5
  },
  dataRefresh: {
    liveTickMs: 3000,
    enrichEveryTicks: 10,
    rankingEveryTicks: 4,
    qualityEveryTicks: 2
  },
  compliance: {
    simulatedData: true,
    educationalOnly: true,
    noFinancialAdvice: true,
    noGuaranteedOutcomes: true
  }
};
