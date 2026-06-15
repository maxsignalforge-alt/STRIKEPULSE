    export const symbols = {
      NVDA: {
        price: 142.87, move: 2.34, target: 158.4, confidence: 87, type: "Bullish", sector: "Semiconductors", risk: "Moderate", stopPct: 0.032, stopType: "VWAP reclaim",
        options: { grade: "A+", liquidity: "Elite", spread: "$0.05", iv: 42, flow: "Calls", setup: "Weekly ATM call after 1m candle holds above VWAP. Avoid entries when spread exceeds $0.10." },
        entry: { status: "READY", tone: "emerald", summary: "Actionable only if the next candle holds above VWAP and breaks the signal high.", trigger: "Break and hold above $143.20", noTrade: "Below VWAP or below $141.80", chase: "Skip if extended more than 1.2% above trigger", checklist: ["1m candle closes above trigger", "QQQ is green or reclaiming VWAP", "Contract spread stays at or below $0.10", "Stop level is accepted before entry"] },
        thesis: "Momentum is expanding while price holds above intraday support.",
        note: "Wait for a pullback or clean continuation candle before chasing strength.",
        indicators: [
          { label: "Volume Surge", value: 92, detail: "2.4x average volume confirms unusual participation." },
          { label: "Trend Stack", value: 84, detail: "Price is above short and medium moving averages." },
          { label: "RSI Momentum", value: 76, detail: "RSI is strong without reaching an extreme reading." },
          { label: "VWAP Hold", value: 88, detail: "Repeated bids appeared near VWAP after the breakout." }
        ]
      },
      ASTC: {
        price: 8.42, move: 8.91, target: 10.18, confidence: 91, type: "Bullish", sector: "Aerospace", risk: "Elevated", stopPct: 0.071, stopType: "Breakout failure",
        options: { grade: "C", liquidity: "Thin", spread: "$0.35", iv: 71, flow: "Calls", setup: "Only consider small size. Prefer shares or skip if contracts are illiquid." },
        entry: { status: "WAIT", tone: "amber", summary: "Signal strength is high, but options liquidity makes execution fragile.", trigger: "Only above $8.65 with expanding volume", noTrade: "Wide spread or failed breakout retest", chase: "Do not chase more than 0.5% above trigger", checklist: ["Spread narrows before entry", "Volume stays above breakout pace", "Use reduced size", "No market orders"] },
        thesis: "A high-volume breakout is pressing through a narrow consolidation range.",
        note: "Elevated risk: reduce size if the spread widens or volume fades.",
        indicators: [
          { label: "Breakout Range", value: 95, detail: "Price cleared the prior range high with force." },
          { label: "Relative Volume", value: 94, detail: "Current pace is far above the baseline scan threshold." },
          { label: "Momentum Slope", value: 89, detail: "Short-term candles are accelerating upward." },
          { label: "Liquidity Risk", value: 66, detail: "Smaller names can reverse sharply after alerts." }
        ]
      },
      MGRT: {
        price: 21.15, move: 5.42, target: 24.7, confidence: 84, type: "Bullish", sector: "Fintech", risk: "Moderate", stopPct: 0.045, stopType: "Higher-low failure",
        options: { grade: "B-", liquidity: "Selective", spread: "$0.18", iv: 58, flow: "Calls", setup: "Use nearest liquid strike only. Skip if open interest is weak." },
        entry: { status: "WAIT", tone: "amber", summary: "Needs a higher-low confirmation before the option entry is worth the spread.", trigger: "Reclaim $21.40 after pullback", noTrade: "Below $20.80 or fading volume", chase: "Skip if premium jumps before stock confirms", checklist: ["Pullback holds above prior low", "Volume improves on reclaim", "Open interest clears minimum", "Limit order near midpoint"] },
        thesis: "Buyers are defending higher lows while momentum rotates back in.",
        note: "Best confirmation is a hold above the previous resistance zone.",
        indicators: [
          { label: "Higher Lows", value: 86, detail: "Recent candles show constructive demand." },
          { label: "MACD Turn", value: 82, detail: "Momentum crossover is early but improving." },
          { label: "Volume Trend", value: 79, detail: "Volume is rising into the move." },
          { label: "Target Room", value: 88, detail: "The next resistance band leaves meaningful upside." }
        ]
      },
      MGN: {
        price: 35.64, move: -4.18, target: 31.2, confidence: 78, type: "Bearish", sector: "Healthcare", risk: "High", stopPct: 0.049, stopType: "Reclaimed support",
        options: { grade: "B", liquidity: "Decent", spread: "$0.14", iv: 64, flow: "Puts", setup: "Put scalp only after failed reclaim. Use limit orders; avoid market orders." },
        entry: { status: "CONFIRM", tone: "rose", summary: "Bearish setup needs a failed support reclaim before entering puts.", trigger: "Reject $36.10 and lose $35.40", noTrade: "Back above broken support", chase: "Skip after a fast flush into target zone", checklist: ["Failed reclaim candle appears", "Bid/ask spread holds under $0.18", "Down volume expands", "Exit quickly if support is reclaimed"] },
        thesis: "Support failed while sellers increased pressure into the breakdown.",
        note: "Bearish alerts need strict invalidation above reclaimed support.",
        indicators: [
          { label: "Support Break", value: 87, detail: "Price lost a level that previously attracted buyers." },
          { label: "Sell Volume", value: 81, detail: "Down candles are printing on heavier volume." },
          { label: "Trend Damage", value: 75, detail: "Short-term averages are rolling over." },
          { label: "Reversal Risk", value: 69, detail: "High risk because breakdowns can squeeze if support is reclaimed." }
        ]
      },
      TSLA: {
        price: 188.32, move: -1.27, target: 176.1, confidence: 72, type: "Bearish", sector: "EVs", risk: "High", stopPct: 0.038, stopType: "Resistance reclaim",
        options: { grade: "A", liquidity: "Elite", spread: "$0.06", iv: 55, flow: "Puts", setup: "ATM put only if price rejects resistance again. Watch IV expansion before entry." },
        entry: { status: "WAIT", tone: "amber", summary: "Liquidity is excellent, but the signal needs cleaner market confirmation.", trigger: "Lose $187.50 after resistance rejection", noTrade: "Reclaim above $191.00", chase: "Avoid puts after two extended red candles", checklist: ["SPY/QQQ not trending upward", "Rejection candle closes weak", "IV is not spiking too fast", "Premium stop is planned"] },
        thesis: "Momentum is weakening under resistance with limited confirmation so far.",
        note: "This is a weaker signal; require confirmation before sizing aggressively.",
        indicators: [
          { label: "Resistance Reject", value: 78, detail: "Price rejected the same supply zone twice." },
          { label: "RSI Fade", value: 71, detail: "Momentum is drifting lower while price stalls." },
          { label: "Volume Quality", value: 63, detail: "Sell volume is present but not decisive." },
          { label: "Volatility Risk", value: 76, detail: "Wide range makes stop placement more demanding." }
        ]
      },
      AMD: {
        price: 164.51, move: 3.08, target: 181.25, confidence: 81, type: "Bullish", sector: "Semiconductors", risk: "Moderate", stopPct: 0.034, stopType: "Moving-average loss",
        options: { grade: "A", liquidity: "Elite", spread: "$0.07", iv: 48, flow: "Calls", setup: "Weekly or next-week ATM call after sector confirmation. Avoid far OTM lottery strikes." },
        entry: { status: "READY", tone: "emerald", summary: "Entry is acceptable if semiconductor strength continues and AMD holds above the reclaim level.", trigger: "Hold $164.00 then break $165.20", noTrade: "Semis fade or price loses $163.20", chase: "Skip if move is already above $167.00", checklist: ["NVDA/SOX are supportive", "1m candle closes above trigger", "Spread remains below $0.10", "Target offers at least 2:1 reward"] },
        thesis: "Sector strength is helping price reclaim momentum above a key average.",
        note: "Look for sector confirmation from peers before treating this as a standalone move.",
        indicators: [
          { label: "Sector Tailwind", value: 85, detail: "Semiconductor peers are trading constructively." },
          { label: "Moving Average Reclaim", value: 82, detail: "Price is back above a watched trend line." },
          { label: "Momentum Reset", value: 78, detail: "The move is early after a shallow pullback." },
          { label: "Upside Room", value: 80, detail: "Target is near the next visible supply zone." }
        ]
      },
      QQQ: {
        price: 455.2, move: 1.12, target: 462.8, confidence: 86, type: "Bullish", sector: "Index ETF", risk: "Moderate", stopPct: 0.018, stopType: "VWAP loss",
        options: { grade: "A+", liquidity: "Elite", spread: "$0.03", iv: 36, flow: "Calls", setup: "ATM call scalps work best when breadth and megacap tech are aligned." },
        entry: { status: "READY", tone: "emerald", summary: "Index trend is supportive; wait for a clean continuation candle.", trigger: "Hold $454.70 then break $456.00", noTrade: "Below VWAP or breadth turns negative", chase: "Skip if extended above $457.80", checklist: ["Breadth stays positive", "AAPL/MSFT/NVDA support the move", "Spread under $0.05", "No major event candle incoming"] },
        thesis: "Broad tech participation is confirming the intraday trend.",
        note: "Index contracts can move cleanly, but do not overstay when momentum stalls.",
        indicators: [
          { label: "Market Alignment", value: 90, detail: "Megacap tech is supporting the tape." },
          { label: "Spread Quality", value: 96, detail: "Contracts remain very tight for active trading." },
          { label: "VWAP Structure", value: 84, detail: "Price is respecting VWAP on pullbacks." },
          { label: "Trend Breadth", value: 82, detail: "Participation is broad enough for continuation." }
        ]
      },
      TQQQ: {
        assetProfile: "leveragedEtf",
        price: 73.42, move: 3.18, target: 78.9, confidence: 82, type: "Bullish", sector: "Index ETF", risk: "High", stopPct: 0.038, stopType: "QQQ trend failure",
        options: { grade: "A", liquidity: "Elite", spread: "$0.04", iv: 54, flow: "Calls", setup: "Leveraged ETF calls only when QQQ/Nasdaq trend and VIX are supportive. Size smaller than QQQ." },
        entry: { status: "CONFIRM", tone: "amber", summary: "Needs QQQ continuation and calm VIX because leverage magnifies failed entries.", trigger: "QQQ holds VWAP and TQQQ breaks $73.80", noTrade: "QQQ loses VWAP or VIX expands", chase: "Skip if extended more than 1.5% above trigger", checklist: ["QQQ trend confirms", "Nasdaq breadth stays positive", "VIX is calm or falling", "Use reduced size"] },
        thesis: "Leveraged Nasdaq exposure is tracking a constructive QQQ trend.",
        note: "Use this only when benchmark confirmation is clean; leverage punishes chop.",
        indicators: [
          { label: "QQQ Context", value: 84, detail: "Underlying Nasdaq ETF trend is supportive." },
          { label: "Leverage Momentum", value: 86, detail: "TQQQ is responding strongly to index strength." },
          { label: "VIX Backdrop", value: 74, detail: "Volatility is acceptable but must stay contained." },
          { label: "Execution Risk", value: 68, detail: "Leveraged ETFs need tighter sizing and faster invalidation." }
        ]
      },
      SPY: {
        price: 532.45, move: 0.38, target: 536.2, confidence: 74, type: "Bullish", sector: "Index ETF", risk: "Moderate", stopPct: 0.014, stopType: "Range loss",
        options: { grade: "A+", liquidity: "Elite", spread: "$0.02", iv: 31, flow: "Calls", setup: "Use SPY when the market trend is clean; avoid chop around midday ranges." },
        entry: { status: "WAIT", tone: "amber", summary: "Liquidity is excellent, but the signal needs a cleaner breakout from range.", trigger: "Break $533.20 with breadth confirmation", noTrade: "Inside range or below $531.60", chase: "Avoid entries after three small green candles", checklist: ["Range break is real", "VIX is not rising", "Contract spread stays tiny", "Time stop is defined"] },
        thesis: "Market is constructive but not forceful enough yet.",
        note: "SPY is often best when conditions are clean; chop can bleed premiums.",
        indicators: [
          { label: "Liquidity", value: 98, detail: "Options execution quality is excellent." },
          { label: "Range Break", value: 68, detail: "Price has not fully cleared the intraday range." },
          { label: "VIX Context", value: 76, detail: "Volatility backdrop is acceptable." },
          { label: "Momentum", value: 70, detail: "Trend is positive but not urgent." }
        ]
      },
      META: {
        price: 487.6, move: -2.08, target: 471.4, confidence: 80, type: "Bearish", sector: "Megacap Tech", risk: "High", stopPct: 0.028, stopType: "Resistance reclaim",
        options: { grade: "A", liquidity: "Elite", spread: "$0.09", iv: 52, flow: "Puts", setup: "ATM put only after failed reclaim; avoid chasing flushes after the first move." },
        entry: { status: "CONFIRM", tone: "rose", summary: "Bearish pressure is real, but puts need a failed reclaim first.", trigger: "Reject $490.00 then lose $486.50", noTrade: "Back above $492.00", chase: "Skip if already down more than 1.5% from trigger", checklist: ["Failed reclaim prints", "QQQ is not rallying", "Put spread stays under $0.12", "Premium stop is defined"] },
        thesis: "Sellers are pressing below a rejected resistance area.",
        note: "Confirmation matters because megacap reversals can squeeze quickly.",
        indicators: [
          { label: "Resistance Reject", value: 82, detail: "Price rejected a visible supply zone." },
          { label: "Sell Volume", value: 78, detail: "Downside candles carry stronger participation." },
          { label: "Market Drag", value: 72, detail: "Broader tech pressure would improve this setup." },
          { label: "Liquidity", value: 88, detail: "Option chain is strong enough for tactical puts." }
        ]
      },
      AAPL: {
        price: 191.28, move: 0.22, target: 194.2, confidence: 69, type: "Bullish", sector: "Megacap Tech", risk: "Moderate", stopPct: 0.019, stopType: "Range failure",
        options: { grade: "A", liquidity: "Elite", spread: "$0.04", iv: 29, flow: "Calls", setup: "Only take calls after range expansion; otherwise premium can drift sideways." },
        entry: { status: "WAIT", tone: "amber", summary: "Contract quality is excellent, but the stock setup is still too quiet.", trigger: "Break $192.10 with volume", noTrade: "Stays inside range under $192.00", chase: "Skip if breakout candle is mostly wick", checklist: ["Volume wakes up", "QQQ supports the move", "Candle closes outside range", "Premium does not lag stock"] },
        thesis: "AAPL has good execution quality but needs stronger movement.",
        note: "Great liquidity does not fix a slow underlying.",
        indicators: [
          { label: "Liquidity", value: 94, detail: "Options spreads are excellent." },
          { label: "Momentum", value: 61, detail: "Price is still inside a quiet range." },
          { label: "Volume", value: 58, detail: "Participation is not yet convincing." },
          { label: "Risk Control", value: 77, detail: "Stops can be placed tightly around the range." }
        ]
      },
      XLE: {
        assetProfile: "energyOil",
        price: 94.35, move: 1.46, target: 98.8, confidence: 79, type: "Bullish", sector: "Energy", risk: "Moderate", stopPct: 0.028, stopType: "Crude trend failure",
        options: { grade: "B+", liquidity: "Decent", spread: "$0.09", iv: 39, flow: "Calls", setup: "Energy ETF calls need crude oil trend and energy breadth confirmation. Avoid before major inventory reports." },
        entry: { status: "CONFIRM", tone: "amber", summary: "Energy strength is constructive, but crude trend confirmation matters.", trigger: "Hold $94.00 then break $94.90", noTrade: "Crude reverses or XLE loses $93.20", chase: "Skip if oil headline spike already ran", checklist: ["Crude oil confirms", "Energy sector breadth supports", "No inventory report immediately ahead", "Spread stays controlled"] },
        thesis: "Energy sector strength is improving alongside crude oil momentum.",
        note: "Oil inventory and OPEC/news risk can override the chart.",
        indicators: [
          { label: "Crude Oil Trend", value: 78, detail: "Oil direction is supportive but headline-sensitive." },
          { label: "Energy Breadth", value: 81, detail: "Sector participation is improving." },
          { label: "Volume Quality", value: 72, detail: "Participation is adequate for ETF options." },
          { label: "News Risk", value: 61, detail: "Inventory/news risk requires caution." }
        ]
      },
      USO: {
        assetProfile: "commodityEtf",
        price: 82.18, move: 2.04, target: 86.7, confidence: 76, type: "Bullish", sector: "Commodity ETF", risk: "High", stopPct: 0.041, stopType: "Crude reversal",
        options: { grade: "B", liquidity: "Decent", spread: "$0.12", iv: 47, flow: "Calls", setup: "USO calls require crude trend confirmation and awareness of inventory/news risk." },
        entry: { status: "WAIT", tone: "amber", summary: "Commodity ETF setup needs crude trend confirmation and no immediate inventory risk.", trigger: "Break $82.70 with crude holding bid", noTrade: "Inventory/news risk or crude reversal", chase: "Skip after a headline spike", checklist: ["Crude oil trend confirms", "Inventory report risk checked", "Spread remains tradable", "Volatility is not disorderly"] },
        thesis: "Crude oil momentum is lifting USO, but event risk remains elevated.",
        note: "Inventory and geopolitical headlines can gap through stops.",
        indicators: [
          { label: "Crude Trend", value: 80, detail: "Underlying oil trend is constructive." },
          { label: "ETF Momentum", value: 74, detail: "USO is moving with the futures trend." },
          { label: "Volatility Risk", value: 63, detail: "Commodity volatility can expand quickly." },
          { label: "Event Risk", value: 58, detail: "Inventory/news risk must be checked before entry." }
        ]
      },
      XLF: {
        price: 44.18, move: 0.84, target: 45.9, confidence: 77, type: "Bullish", sector: "Financials", risk: "Moderate", stopPct: 0.022, stopType: "Sector rotation failure",
        options: { grade: "A-", liquidity: "Elite", spread: "$0.04", iv: 28, flow: "Calls", setup: "Financial ETF calls work best when yields and bank breadth support rotation. Avoid before major Fed or CPI events." },
        entry: { status: "CONFIRM", tone: "amber", summary: "Financials are constructive, but need sector follow-through before chasing calls.", trigger: "Hold $44.00 then break $44.35", noTrade: "Banks fade or XLF loses $43.70", chase: "Skip if rotation candle is already extended", checklist: ["Bank leaders confirm", "SPY remains constructive", "Spread stays under $0.06", "No Fed headline risk immediately ahead"] },
        thesis: "Capital is rotating into banks and brokers as broad-market risk appetite improves.",
        note: "Financials can reverse quickly around rate expectations and Fed commentary.",
        indicators: [
          { label: "Sector Rotation", value: 78, detail: "Financials are showing relative strength versus the broad tape." },
          { label: "Liquidity", value: 90, detail: "ETF contracts are tight enough for tactical options." },
          { label: "Breadth", value: 73, detail: "Bank participation is constructive but not universal." },
          { label: "Event Risk", value: 62, detail: "Rate-sensitive sectors need calendar awareness." }
        ]
      },
      JPM: {
        price: 204.72, move: 1.18, target: 211.4, confidence: 80, type: "Bullish", sector: "Financials", risk: "Moderate", stopPct: 0.026, stopType: "Bank rotation failure",
        options: { grade: "A", liquidity: "Elite", spread: "$0.08", iv: 34, flow: "Calls", setup: "ATM call only after bank-sector confirmation. Watch Fed calendar and yield moves." },
        entry: { status: "READY", tone: "emerald", summary: "Large-bank strength is tradable if XLF and market breadth stay supportive.", trigger: "Hold $203.80 then break $205.30", noTrade: "XLF fades or JPM loses $202.60", chase: "Avoid after a fast move into $208", checklist: ["XLF confirms", "Spread holds under $0.10", "No Fed headline risk", "Reward/risk remains above 2:1"] },
        thesis: "Bank leadership is improving while buyers defend the prior breakout area.",
        note: "JPM is cleaner when sector ETF confirmation is present.",
        indicators: [
          { label: "Bank Leadership", value: 82, detail: "JPM is leading the financial group." },
          { label: "Trend Stack", value: 80, detail: "Price is holding above short-term trend support." },
          { label: "Options Quality", value: 86, detail: "Liquidity is strong enough for limit-order execution." },
          { label: "Macro Sensitivity", value: 66, detail: "Rates and Fed commentary can change the setup quickly." }
        ]
      },
      WMT: {
        price: 68.44, move: 0.51, target: 70.25, confidence: 73, type: "Bullish", sector: "Consumer Staples", risk: "Low", stopPct: 0.018, stopType: "Range loss",
        options: { grade: "B+", liquidity: "Decent", spread: "$0.08", iv: 24, flow: "Calls", setup: "Use WMT for defensive trend continuation, not explosive momentum. Prefer tight stops and realistic targets." },
        entry: { status: "CONFIRM", tone: "amber", summary: "Defensive strength is steady but needs range expansion to justify premium.", trigger: "Break $68.75 with volume", noTrade: "Stays under $68.60 or SPY fades hard", chase: "Skip if premium widens without stock movement", checklist: ["Range expands", "Volume improves", "Spread stays controlled", "Target remains realistic"] },
        thesis: "Consumer staples strength is defensive and steady, offering lower-volatility confirmation.",
        note: "Staples options can be slower; avoid overpaying for quiet movement.",
        indicators: [
          { label: "Defensive Trend", value: 76, detail: "Price is grinding higher in a controlled structure." },
          { label: "Volatility", value: 70, detail: "Lower volatility supports tighter risk control." },
          { label: "Volume", value: 66, detail: "Participation is acceptable but not aggressive." },
          { label: "Premium Risk", value: 64, detail: "Slow movers need careful contract selection." }
        ]
      },
      AMZN: {
        price: 184.12, move: 1.34, target: 190.6, confidence: 79, type: "Bullish", sector: "Consumer Discretionary", risk: "Moderate", stopPct: 0.031, stopType: "Retail rotation failure",
        options: { grade: "A", liquidity: "Elite", spread: "$0.07", iv: 43, flow: "Calls", setup: "Consumer discretionary calls need QQQ support and retail/e-commerce strength. Avoid chasing after extended candles." },
        entry: { status: "READY", tone: "emerald", summary: "AMZN is actionable if discretionary strength and QQQ support continue.", trigger: "Hold $183.50 then break $184.80", noTrade: "QQQ fades or AMZN loses $182.70", chase: "Skip above $187 without a pullback", checklist: ["QQQ supports", "Discretionary sector is not fading", "Spread stays under $0.10", "Volume confirms breakout"] },
        thesis: "Consumer discretionary leadership is improving as buyers rotate into liquid growth names.",
        note: "AMZN can be clean, but it still needs broad tech support.",
        indicators: [
          { label: "Relative Strength", value: 80, detail: "AMZN is outperforming many discretionary peers." },
          { label: "Liquidity", value: 88, detail: "Options chain supports tactical execution." },
          { label: "Momentum", value: 77, detail: "Trend continuation is building from a controlled base." },
          { label: "Market Dependency", value: 70, detail: "QQQ confirmation improves the odds." }
        ]
      },
      CAT: {
        price: 336.8, move: -0.92, target: 325.5, confidence: 71, type: "Bearish", sector: "Industrials", risk: "Moderate", stopPct: 0.026, stopType: "Reclaim of breakdown level",
        options: { grade: "B+", liquidity: "Decent", spread: "$0.16", iv: 38, flow: "Puts", setup: "Industrial puts need failed reclaim confirmation and controlled spread. Avoid if cyclicals rotate back in." },
        entry: { status: "CONFIRM", tone: "rose", summary: "Industrial weakness is developing, but puts need a failed reclaim first.", trigger: "Reject $338.50 then lose $335.80", noTrade: "Reclaim above $340.00", chase: "Skip after a fast flush toward $330", checklist: ["Failed reclaim prints", "Industrials stay weak", "Spread stays under $0.18", "Reward/risk remains above 2:1"] },
        thesis: "Cyclical industrial momentum is weakening below a rejected supply zone.",
        note: "Industrials can reverse when economic-growth rotation improves.",
        indicators: [
          { label: "Trend Damage", value: 74, detail: "Price is failing near a prior support zone." },
          { label: "Cyclical Pressure", value: 70, detail: "Industrial leadership is not confirming the broader tape." },
          { label: "Put Liquidity", value: 72, detail: "Contracts are tradable but require limit orders." },
          { label: "Reversal Risk", value: 67, detail: "A reclaim would invalidate the bearish setup." }
        ]
      },
      XLU: {
        price: 71.32, move: -0.36, target: 69.4, confidence: 66, type: "Bearish", sector: "Utilities", risk: "Low", stopPct: 0.017, stopType: "Defensive reclaim",
        options: { grade: "B", liquidity: "Decent", spread: "$0.07", iv: 22, flow: "Puts", setup: "Utilities puts are slower; use only when rates/yields pressure defensive sectors. Avoid if market risk-off rotation appears." },
        entry: { status: "WAIT", tone: "amber", summary: "Utilities weakness needs confirmation because defensive flows can return quickly.", trigger: "Lose $71.00 with sector weakness", noTrade: "Reclaim $71.80 or risk-off tape", chase: "Avoid if downside is already extended", checklist: ["Sector confirms", "Rates remain a headwind", "Spread stays tight", "Use smaller targets"] },
        thesis: "Defensive utilities are lagging while risk appetite favors other sectors.",
        note: "Utilities are slower and can catch safety bids during market stress.",
        indicators: [
          { label: "Defensive Lag", value: 68, detail: "Utilities are underperforming the current tape." },
          { label: "Rate Sensitivity", value: 64, detail: "Yield pressure can weigh on the sector." },
          { label: "Liquidity", value: 70, detail: "ETF contracts are adequate but not elite." },
          { label: "Speed Risk", value: 58, detail: "Slow movement can bleed option premium." }
        ]
      },
      XLRE: {
        price: 39.88, move: 0.44, target: 41.1, confidence: 68, type: "Bullish", sector: "Real Estate", risk: "Moderate", stopPct: 0.025, stopType: "Rate-sensitive reversal",
        options: { grade: "B", liquidity: "Selective", spread: "$0.13", iv: 27, flow: "Calls", setup: "Real estate calls need falling-rate confirmation and tight spread control. Skip if liquidity thins." },
        entry: { status: "WAIT", tone: "amber", summary: "Real estate is improving but not liquid enough for aggressive options yet.", trigger: "Break $40.10 with rates supportive", noTrade: "Rates rise or XLRE loses $39.40", chase: "Skip if spread widens beyond $0.16", checklist: ["Rate backdrop supports", "Spread narrows", "Volume improves", "Use smaller size"] },
        thesis: "Rate-sensitive real estate is trying to rotate higher from support.",
        note: "Selective liquidity means the signal must be cleaner than average.",
        indicators: [
          { label: "Rate Backdrop", value: 66, detail: "Lower-rate expectations would improve this setup." },
          { label: "Sector Rotation", value: 65, detail: "Early rotation is visible but not decisive." },
          { label: "Liquidity Risk", value: 58, detail: "Options require strict limit orders." },
          { label: "Support Hold", value: 72, detail: "Price is holding a constructive base." }
        ]
      },
      TLT: {
        price: 92.74, move: -0.88, target: 89.6, confidence: 70, type: "Bearish", sector: "Bonds", risk: "Moderate", stopPct: 0.021, stopType: "Yield reversal",
        options: { grade: "A-", liquidity: "Elite", spread: "$0.05", iv: 33, flow: "Puts", setup: "Bond ETF puts depend on yield direction and macro calendar. Avoid before Fed/CPI unless intentionally trading the event." },
        entry: { status: "CONFIRM", tone: "amber", summary: "Bond weakness is tradable only if yields continue higher and event risk is understood.", trigger: "Lose $92.30 with yields rising", noTrade: "Reclaim $93.20 or yields reverse lower", chase: "Skip after a large macro candle", checklist: ["Yields confirm", "Fed/CPI calendar checked", "Spread stays under $0.07", "Stop is respected"] },
        thesis: "Long bonds are weakening as rate pressure returns.",
        note: "Macro headlines can dominate the chart; respect event risk.",
        indicators: [
          { label: "Yield Pressure", value: 73, detail: "Rising yields are pressuring long-duration bonds." },
          { label: "Liquidity", value: 84, detail: "TLT options are liquid enough for tactical puts." },
          { label: "Macro Risk", value: 60, detail: "Fed/CPI events can flip the setup." },
          { label: "Trend Damage", value: 70, detail: "Price is losing short-term support." }
        ]
      }
    };


    export const marketContext = {
      spy: { trend: "Bullish", score: 78 },
      qqq: { trend: "Bullish", score: 84 },
      vix: { state: "Calm", score: 74 },
      breadth: { state: "Positive", score: 69 },
      sectors: {
        "Semiconductors": "Aligned",
        "Index ETF": "Aligned",
        "Megacap Tech": "Mixed",
        "Energy": "Aligned",
        "Commodity ETF": "Mixed",
        "Financials": "Aligned",
        "Consumer Staples": "Mixed",
        "Consumer Discretionary": "Aligned",
        "Industrials": "Mixed",
        "Utilities": "Fighting",
        "Real Estate": "Mixed",
        "Bonds": "Fighting",
        "EVs": "Mixed",
        "Fintech": "Mixed",
        "Healthcare": "Fighting",
        "Aerospace": "Fighting"
      }
    };



