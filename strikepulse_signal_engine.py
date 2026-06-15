"""
STRIKEPULSE signal engine.

Pure scoring utilities for backend-side signal, options, and indicator analysis.
This module intentionally performs no network calls and stores no user data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def grade(score: float) -> str:
    if score >= 90:
        return "A+"
    if score >= 82:
        return "A"
    if score >= 74:
        return "B"
    if score >= 64:
        return "C"
    return "D"


@dataclass(frozen=True)
class IndicatorSnapshot:
    price: float
    sma: float | None = None
    ema: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None
    rsi: float | None = None


@dataclass(frozen=True)
class ContractSnapshot:
    spread: float | None = None
    midpoint: float | None = None
    volume: int | None = None
    open_interest: int | None = None
    implied_volatility: float | None = None
    days_to_expiration: int | None = None
    options_flow_score: float | None = None


@dataclass(frozen=True)
class MarketSnapshot:
    signal_confidence: float
    direction: str
    entry_confirmed: bool
    reward_risk: float
    market_aligned: bool
    breadth_aligned: bool
    vix_supportive: bool
    news_sentiment: float | None = None
    market_regime: str | None = None
    event_risk_score: float | None = None
    event_blockers: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SignalReport:
    score: int
    confidence: int
    grade: str
    verdict: str
    nine_sig: int
    score_breakdown: list[dict[str, Any]] = field(default_factory=list)
    checks: list[dict[str, Any]] = field(default_factory=list)
    blockers: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    rejection: dict[str, Any] = field(default_factory=dict)
    market_regime: str = "Range Bound"
    regime_weights: dict[str, int] = field(default_factory=dict)
    base_confidence: int = 0
    regime_adjustment: int = 0


FACTOR_WEIGHTS = {
    "Trend": 15,
    "Momentum": 15,
    "RSI": 10,
    "MACD": 10,
    "Volume": 10,
    "Volatility": 10,
    "Market breadth": 10,
    "News sentiment": 10,
    "Options flow": 10,
}

REGIME_WEIGHT_MAPS = {
    "Trending Bull": {
        "Trend": 18,
        "Momentum": 17,
        "RSI": 9,
        "MACD": 12,
        "Volume": 10,
        "Volatility": 8,
        "Market breadth": 12,
        "News sentiment": 6,
        "Options flow": 8,
    },
    "Trending Bear": {
        "Trend": 18,
        "Momentum": 17,
        "RSI": 9,
        "MACD": 12,
        "Volume": 10,
        "Volatility": 10,
        "Market breadth": 12,
        "News sentiment": 6,
        "Options flow": 6,
    },
    "Range Bound": {
        "Trend": 10,
        "Momentum": 10,
        "RSI": 16,
        "MACD": 10,
        "Volume": 11,
        "Volatility": 13,
        "Market breadth": 10,
        "News sentiment": 10,
        "Options flow": 10,
    },
    "High Volatility": {
        "Trend": 12,
        "Momentum": 10,
        "RSI": 8,
        "MACD": 7,
        "Volume": 12,
        "Volatility": 18,
        "Market breadth": 8,
        "News sentiment": 13,
        "Options flow": 12,
    },
    "Low Volatility": {
        "Trend": 13,
        "Momentum": 12,
        "RSI": 13,
        "MACD": 12,
        "Volume": 8,
        "Volatility": 14,
        "Market breadth": 10,
        "News sentiment": 8,
        "Options flow": 10,
    },
}


def normalize_regime(regime: str | None) -> str | None:
    if not regime:
        return None
    normalized = regime.strip().replace("_", " ").replace("-", " ").lower()
    aliases = {
        "trending bull": "Trending Bull",
        "bull trend": "Trending Bull",
        "risk on": "Trending Bull",
        "trending bear": "Trending Bear",
        "bear trend": "Trending Bear",
        "risk off": "Trending Bear",
        "range bound": "Range Bound",
        "range": "Range Bound",
        "mixed": "Range Bound",
        "high volatility": "High Volatility",
        "high vol": "High Volatility",
        "volatile": "High Volatility",
        "low volatility": "Low Volatility",
        "low vol": "Low Volatility",
        "quiet": "Low Volatility",
    }
    return aliases.get(normalized)


def detect_market_regime(market: MarketSnapshot) -> str:
    explicit = normalize_regime(market.market_regime)
    if explicit:
        return explicit
    if not market.vix_supportive:
        return "High Volatility"
    if market.market_aligned and market.breadth_aligned:
        return "Trending Bull" if market.direction.lower() == "bullish" else "Trending Bear"
    if market.vix_supportive and not market.market_aligned and not market.breadth_aligned:
        return "Low Volatility"
    return "Range Bound"


def weights_for_regime(regime: str) -> dict[str, int]:
    return REGIME_WEIGHT_MAPS.get(regime, FACTOR_WEIGHTS)


def factor_status(score: float) -> str:
    if score >= 85:
        return "elite"
    if score >= 70:
        return "healthy"
    if score >= 55:
        return "mixed"
    return "weak"


def breakdown_item(name: str, weight: int, score: float, detail: str) -> dict[str, Any]:
    raw_score = int(round(clamp(score)))
    return {
        "factor": name,
        "weight": weight,
        "rawScore": raw_score,
        "weightedScore": round(raw_score * weight / 100, 2),
        "status": factor_status(raw_score),
        "detail": detail,
    }


def weighted_average(items: list[dict[str, Any]]) -> int:
    weighted = sum(item["weightedScore"] for item in items)
    total_weight = sum(item["weight"] for item in items) or 100
    return int(round(clamp(weighted / total_weight * 100)))


def score_trend(market: MarketSnapshot, indicators: IndicatorSnapshot) -> tuple[float, str]:
    bullish = market.direction.lower() == "bullish"
    checks: list[bool] = []
    if indicators.sma is not None:
        checks.append(indicators.price >= indicators.sma if bullish else indicators.price <= indicators.sma)
    if indicators.ema is not None:
        checks.append(indicators.price >= indicators.ema if bullish else indicators.price <= indicators.ema)
    if market.market_aligned:
        checks.append(True)
    if not checks:
        return 55, "Trend has limited moving-average context."
    score = sum(1 for check in checks if check) / len(checks) * 100
    return score, f"{sum(1 for check in checks if check)}/{len(checks)} trend checks aligned."


def score_momentum(market: MarketSnapshot, indicators: IndicatorSnapshot) -> tuple[float, str]:
    score = market.signal_confidence * 0.60
    score += (20 if market.entry_confirmed else 5)
    score += clamp(market.reward_risk / 2.5 * 100) * 0.20
    if indicators.macd_histogram is not None:
        score += 8 if indicators.macd_histogram > 0 else -8
    return score, f"Signal confidence {market.signal_confidence:.0f}, reward/risk {market.reward_risk:.2f}."


def score_rsi(indicators: IndicatorSnapshot, direction: str) -> tuple[float, str]:
    if indicators.rsi is None:
        return 55, "RSI unavailable; neutral score applied."
    bullish = direction.lower() == "bullish"
    rsi = indicators.rsi
    if bullish:
        if 50 <= rsi <= 68:
            score = 95
        elif 45 <= rsi < 50 or 68 < rsi <= 74:
            score = 76
        elif 38 <= rsi < 45 or 74 < rsi <= 82:
            score = 55
        else:
            score = 32
    else:
        if 32 <= rsi <= 50:
            score = 95
        elif 26 <= rsi < 32 or 50 < rsi <= 56:
            score = 76
        elif 18 <= rsi < 26 or 56 < rsi <= 62:
            score = 55
        else:
            score = 32
    return score, f"RSI {rsi:.1f} measured against {direction.lower()} setup range."


def score_macd(indicators: IndicatorSnapshot, direction: str) -> tuple[float, str]:
    if indicators.macd is None or indicators.macd_signal is None:
        return 55, "MACD unavailable; neutral score applied."
    bullish = direction.lower() == "bullish"
    aligned = indicators.macd >= indicators.macd_signal if bullish else indicators.macd <= indicators.macd_signal
    histogram = indicators.macd_histogram
    score = 84 if aligned else 38
    if histogram is not None:
        score += 10 if (histogram >= 0 if bullish else histogram <= 0) else -10
    return score, f"MACD {'aligned' if aligned else 'not aligned'} with signal line."


def score_volume(contract: ContractSnapshot) -> tuple[float, str]:
    score = 55.0
    details: list[str] = []
    if contract.volume is not None:
        volume_score = clamp(contract.volume / 1500 * 100)
        score = volume_score if score == 55 else (score + volume_score) / 2
        details.append(f"volume {contract.volume}")
    if contract.open_interest is not None:
        oi_score = clamp(contract.open_interest / 5000 * 100)
        score = (score + oi_score) / 2
        details.append(f"open interest {contract.open_interest}")
    if not details:
        return 50, "Volume/open-interest unavailable; conservative score applied."
    return score, ", ".join(details) + "."


def score_volatility(market: MarketSnapshot, contract: ContractSnapshot) -> tuple[float, str]:
    score = 82.0 if market.vix_supportive else 48.0
    details = ["VIX supportive" if market.vix_supportive else "VIX not supportive"]
    if contract.implied_volatility is not None:
        iv = contract.implied_volatility
        iv_score = 88 if 25 <= iv <= 65 else 62 if iv < 75 else 38
        score = (score + iv_score) / 2
        details.append(f"IV {iv:.1f}")
    if contract.days_to_expiration is not None and contract.days_to_expiration <= 1:
        score -= 12
        details.append("near-expiry risk")
    return score, ", ".join(details) + "."


def score_market_breadth(market: MarketSnapshot) -> tuple[float, str]:
    score = 50
    if market.market_aligned:
        score += 25
    if market.breadth_aligned:
        score += 25
    return score, f"Market aligned: {market.market_aligned}; breadth aligned: {market.breadth_aligned}."


def score_news_sentiment(market: MarketSnapshot) -> tuple[float, str]:
    scores: list[float] = []
    details: list[str] = []
    if market.news_sentiment is not None:
        scores.append(market.news_sentiment)
        details.append(f"news sentiment {market.news_sentiment:.0f}/100")
    if market.event_risk_score is not None:
        scores.append(market.event_risk_score)
        details.append(f"event risk {market.event_risk_score:.0f}/100")
    if not scores:
        return 55, "News/event risk unavailable; neutral score applied."
    return sum(scores) / len(scores), ", ".join(details) + "."


def score_options_flow(contract: ContractSnapshot) -> tuple[float, str]:
    if contract.options_flow_score is not None:
        return contract.options_flow_score, f"Options flow score {contract.options_flow_score:.0f}/100."
    score = 55.0
    details = ["options flow unavailable"]
    if contract.volume is not None and contract.open_interest:
        volume_oi = contract.volume / max(contract.open_interest, 1)
        if volume_oi >= 0.75:
            score = 85
        elif volume_oi >= 0.30:
            score = 70
        elif volume_oi >= 0.10:
            score = 58
        else:
            score = 42
        details.append(f"volume/OI {volume_oi:.2f}")
    return score, ", ".join(details) + "."


def indicator_alignment(snapshot: IndicatorSnapshot, direction: str) -> dict[str, Any]:
    bullish = direction.lower() == "bullish"
    checks: list[dict[str, Any]] = []

    if snapshot.sma is not None:
        checks.append({"name": "SMA", "pass": snapshot.price >= snapshot.sma if bullish else snapshot.price <= snapshot.sma})
    if snapshot.ema is not None:
        checks.append({"name": "EMA", "pass": snapshot.price >= snapshot.ema if bullish else snapshot.price <= snapshot.ema})
    if snapshot.macd is not None and snapshot.macd_signal is not None:
        checks.append({"name": "MACD", "pass": snapshot.macd >= snapshot.macd_signal if bullish else snapshot.macd <= snapshot.macd_signal})
    if snapshot.rsi is not None:
        rsi_pass = 45 <= snapshot.rsi <= 72 if bullish else 28 <= snapshot.rsi <= 55
        checks.append({"name": "RSI", "pass": rsi_pass})

    if not checks:
        return {"score": 50, "checks": [], "note": "No indicator values supplied."}

    passed = sum(1 for check in checks if check["pass"])
    return {"score": round((passed / len(checks)) * 100), "checks": checks}


def contract_health(contract: ContractSnapshot) -> dict[str, Any]:
    score = 100.0
    blockers: list[str] = []
    notes: list[str] = []

    if contract.spread is not None and contract.midpoint:
        spread_pct = contract.spread / contract.midpoint
        if spread_pct > 0.18:
            score -= 35
            blockers.append("Spread is too wide for clean execution.")
        elif spread_pct > 0.08:
            score -= 14
            notes.append("Spread needs caution.")

    if contract.open_interest is not None:
        if contract.open_interest < 250:
            score -= 28
            blockers.append("Open interest is thin.")
        elif contract.open_interest < 1000:
            score -= 10
            notes.append("Open interest is acceptable but not elite.")

    if contract.volume is not None and contract.volume < 100:
        score -= 12
        notes.append("Contract volume is light.")

    if contract.implied_volatility is not None and contract.implied_volatility >= 75:
        score -= 12
        notes.append("IV is elevated; premium may be expensive.")

    if contract.days_to_expiration is not None and contract.days_to_expiration <= 1:
        score -= 10
        notes.append("0DTE/near-expiry gamma and theta risk are high.")

    final_score = int(round(clamp(score)))
    return {"score": final_score, "grade": grade(final_score), "blockers": blockers, "notes": notes}


def nine_sig(market: MarketSnapshot, indicator_score: float, contract_score: float) -> dict[str, Any]:
    checks = [
        {"name": "Signal", "pass": market.signal_confidence >= 80},
        {"name": "Entry", "pass": market.entry_confirmed},
        {"name": "Contract", "pass": contract_score >= 74},
        {"name": "Reward/Risk", "pass": market.reward_risk >= 2.0},
        {"name": "Market", "pass": market.market_aligned},
        {"name": "Breadth", "pass": market.breadth_aligned},
        {"name": "VIX", "pass": market.vix_supportive},
        {"name": "Indicators", "pass": indicator_score >= 60},
        {"name": "Discipline", "pass": market.signal_confidence >= 70 and market.reward_risk >= 2.0},
    ]
    score = sum(1 for check in checks if check["pass"])
    return {"score": score, "checks": checks}


def build_signal_report(
    market: MarketSnapshot,
    indicators: IndicatorSnapshot,
    contract: ContractSnapshot,
) -> SignalReport:
    market_regime = detect_market_regime(market)
    factor_weights = weights_for_regime(market_regime)
    indicator_result = indicator_alignment(indicators, market.direction)
    contract_result = contract_health(contract)
    nine = nine_sig(market, indicator_result["score"], contract_result["score"])

    trend_score, trend_detail = score_trend(market, indicators)
    momentum_score, momentum_detail = score_momentum(market, indicators)
    rsi_score, rsi_detail = score_rsi(indicators, market.direction)
    macd_score, macd_detail = score_macd(indicators, market.direction)
    volume_score, volume_detail = score_volume(contract)
    volatility_score, volatility_detail = score_volatility(market, contract)
    breadth_score, breadth_detail = score_market_breadth(market)
    news_score, news_detail = score_news_sentiment(market)
    flow_score, flow_detail = score_options_flow(contract)

    score_breakdown = [
        breakdown_item("Trend", factor_weights["Trend"], trend_score, trend_detail),
        breakdown_item("Momentum", factor_weights["Momentum"], momentum_score, momentum_detail),
        breakdown_item("RSI", factor_weights["RSI"], rsi_score, rsi_detail),
        breakdown_item("MACD", factor_weights["MACD"], macd_score, macd_detail),
        breakdown_item("Volume", factor_weights["Volume"], volume_score, volume_detail),
        breakdown_item("Volatility", factor_weights["Volatility"], volatility_score, volatility_detail),
        breakdown_item("Market breadth", factor_weights["Market breadth"], breadth_score, breadth_detail),
        breakdown_item("News sentiment", factor_weights["News sentiment"], news_score, news_detail),
        breakdown_item("Options flow", factor_weights["Options flow"], flow_score, flow_detail),
    ]
    base_score_breakdown = [
        breakdown_item("Trend", FACTOR_WEIGHTS["Trend"], trend_score, trend_detail),
        breakdown_item("Momentum", FACTOR_WEIGHTS["Momentum"], momentum_score, momentum_detail),
        breakdown_item("RSI", FACTOR_WEIGHTS["RSI"], rsi_score, rsi_detail),
        breakdown_item("MACD", FACTOR_WEIGHTS["MACD"], macd_score, macd_detail),
        breakdown_item("Volume", FACTOR_WEIGHTS["Volume"], volume_score, volume_detail),
        breakdown_item("Volatility", FACTOR_WEIGHTS["Volatility"], volatility_score, volatility_detail),
        breakdown_item("Market breadth", FACTOR_WEIGHTS["Market breadth"], breadth_score, breadth_detail),
        breakdown_item("News sentiment", FACTOR_WEIGHTS["News sentiment"], news_score, news_detail),
        breakdown_item("Options flow", FACTOR_WEIGHTS["Options flow"], flow_score, flow_detail),
    ]
    blockers = list(contract_result["blockers"])
    blockers.extend(market.event_blockers)
    if not market.entry_confirmed:
        blockers.append("Entry has not confirmed yet.")
    if market.reward_risk < 2:
        blockers.append("Reward/risk is below the 2:1 minimum.")

    base_confidence = weighted_average(base_score_breakdown)
    final_score = weighted_average(score_breakdown)
    regime_adjustment = final_score - base_confidence

    rejection_reasons: list[str] = []
    if market.reward_risk < 2:
        rejection_reasons.append(f"Poor reward/risk: {market.reward_risk:.2f}:1 is below the 2:1 minimum.")
    if contract_result["blockers"]:
        rejection_reasons.extend(contract_result["blockers"])
    if volume_score < 42:
        rejection_reasons.append("Weak volume/liquidity confirmation.")
    if flow_score < 42:
        rejection_reasons.append("Options flow is not confirming the setup.")
    if market_regime == "High Volatility" and not market.vix_supportive:
        rejection_reasons.append("Market regime is high-volatility and unfavorable for clean execution.")
    if not market.market_aligned and not market.breadth_aligned and final_score < 70:
        rejection_reasons.append("Market breadth and broad tape are both fighting the setup.")
    if market.event_risk_score is not None and market.event_risk_score <= 30:
        rejection_reasons.append("High-impact event risk is too close to the trade window.")

    rejection_reasons = list(dict.fromkeys(rejection_reasons))
    hard_rejected = bool(rejection_reasons)
    if hard_rejected:
        verdict = "REJECT"
    elif final_score >= 85 and not blockers:
        verdict = "STRONG BUY"
    elif final_score >= 70:
        verdict = "BUY"
    elif final_score >= 55:
        verdict = "WAIT"
    else:
        verdict = "AVOID"

    notes = list(contract_result["notes"])
    if indicator_result.get("note"):
        notes.append(indicator_result["note"])
    notes.append(f"Market regime: {market_regime}; signal weights adjusted automatically.")

    return SignalReport(
        score=final_score,
        confidence=final_score,
        grade=grade(final_score),
        verdict=verdict,
        nine_sig=nine["score"],
        score_breakdown=score_breakdown,
        checks=nine["checks"] + indicator_result["checks"],
        blockers=blockers,
        notes=notes,
        rejection={
            "rejected": hard_rejected,
            "primaryReason": rejection_reasons[0] if rejection_reasons else "",
            "reasons": rejection_reasons,
            "rules": [
                "Reject reward/risk under 2:1.",
                "Reject wide spreads or thin open interest.",
                "Reject weak liquidity/flow confirmation.",
                "Reject hostile high-volatility regimes.",
                "Reject setups fighting both market breadth and broad tape.",
                "Reject high-impact event risk inside the trade window.",
            ],
        },
        market_regime=market_regime,
        regime_weights=factor_weights,
        base_confidence=base_confidence,
        regime_adjustment=regime_adjustment,
    )


def report_to_dict(report: SignalReport) -> dict[str, Any]:
    return {
        "score": report.score,
        "confidence": report.confidence,
        "grade": report.grade,
        "verdict": report.verdict,
        "nineSig": report.nine_sig,
        "scoreBreakdown": report.score_breakdown,
        "marketRegime": report.market_regime,
        "regimeWeights": report.regime_weights,
        "baseConfidence": report.base_confidence,
        "regimeAdjustment": report.regime_adjustment,
        "checks": report.checks,
        "blockers": report.blockers,
        "notes": report.notes,
        "rejection": report.rejection,
    }
