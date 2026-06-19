const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("app.js", "utf8");

function section(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notStrictEqual(start, -1, `${name} exists`);
  const next = source.indexOf("\n    function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function pass(label) {
  console.log(`PASS ${label}`);
}

const replaySection = section("openEagleScoutReplay");
assert(replaySection.includes("item.signalId === context.signalId"), "Replay resolves by exact active SignalContext signalId");
assert(!replaySection.includes("item.symbol === symbol"), "Replay does not fall back to symbol-only matching");
pass("Replay resolves by exact signalId only");

const journalReplaySection = section("selectLearningReplayForJournal");
assert(journalReplaySection.includes("item.signalId === entry.signalId"), "Journal replay selection uses exact signalId");
assert(!journalReplaySection.includes("item.symbol === entry.symbol"), "Journal replay selection does not score symbol-only matches");
assert(!journalReplaySection.includes("items[0]"), "Journal replay selection does not fall back to first replay item");
pass("Journal replay selection is exact signalId only");

assert(source.includes("completedSignalStoryForMission()"), "Tomorrow Mission uses exact completed story selector");
assert(source.includes("saveTomorrowMissionSignalId(signalId)"), "Completed lesson stores exact tomorrow mission signalId");
assert(!section("renderDailyMission").includes("latestCompletedSignalStory()"), "Mission does not consume latest global completed story");
assert(!section("signalStoryPatchForStage").includes("context.suggestedAction || null"), "Mission view does not generate tomorrow lessons from its own verdict");
pass("Tomorrow Mission consumes the exact completed story lesson");

assert(source.includes("latestReusableSignalRecord(symbol, signalDraft)"), "Signal creation checks ledger for reusable setup lifecycle");
assert(source.includes("setupSignature: snapshot.setupSignature || signalSetupSignature(snapshot)"), "Ledger records preserve setup signature");
pass("Setup lifecycle can reuse one Signal ID across memory and ledger");

class SignalStoryHarness {
  constructor() {
    this.active = null;
    this.ledger = new Map();
    this.tomorrowSignalId = null;
    this.sequence = 1;
  }

  signature(path) {
    return `${path.symbol}|${path.setup}|${path.verdict}`;
  }

  ensure(path, stage) {
    const signature = this.signature(path);
    const existing = [...this.ledger.values()].find(item => item.signature === signature);
    const signalId = existing?.signalId || `SP-${path.symbol}-TEST-${String(this.sequence++).padStart(4, "0")}`;
    const story = {
      signalId,
      symbol: path.symbol,
      signature,
      missionViewed: null,
      eagleViewed: null,
      paperTradeOpened: null,
      journalSaved: null,
      replayGenerated: null,
      tradeDnaLesson: null,
      tomorrowMissionLesson: null,
      outcome: null,
      ...(existing || {})
    };
    this.ledger.set(signalId, story);
    this.active = story;
    this.mark(stage);
    return signalId;
  }

  mark(stage, value = true) {
    if (!this.active) throw new Error(`No active story for ${stage}`);
    if (stage === "mission") this.active.missionViewed = value;
    if (stage === "eagle") this.active.eagleViewed = value;
    if (stage === "paper") this.active.paperTradeOpened = value;
    if (stage === "journal") this.active.journalSaved = value;
    if (stage === "replay") this.active.replayGenerated = value;
    if (stage === "tradeDna") {
      this.active.tradeDnaLesson = value;
      this.tomorrowSignalId = this.active.signalId;
    }
    this.ledger.set(this.active.signalId, this.active);
  }

  switchTicker(symbol) {
    this.active = { signalId: `SP-${symbol}-TEST-${String(this.sequence++).padStart(4, "0")}`, symbol, signature: `${symbol}|other|WAIT` };
  }

  restore(path) {
    return this.ensure(path, "eagle");
  }

  assertOneStory(expectedSignalId, label) {
    const story = this.ledger.get(expectedSignalId);
    assert(story, `${label}: story exists`);
    assert.strictEqual(this.active.signalId, expectedSignalId, `${label}: active signalId preserved`);
    return story;
  }

  assertTomorrow(expectedSignalId, label) {
    assert.strictEqual(this.tomorrowSignalId, expectedSignalId, `${label}: tomorrow mission references exact completed Signal Story`);
  }
}

function runPath(label, path, outcome) {
  const app = new SignalStoryHarness();
  const signalId = app.ensure(path, "mission");
  app.ensure(path, "eagle");
  if (path.action === "Confirm") app.mark("paper");
  app.mark("journal", outcome);
  app.mark("replay", `${signalId}:replay`);
  app.mark("tradeDna", `${signalId}: lesson`);
  const story = app.assertOneStory(signalId, label);
  app.assertTomorrow(signalId, label);
  assert.strictEqual(story.signalId, signalId, `${label}: story signalId unchanged`);
  assert.strictEqual(story.journalSaved, outcome, `${label}: journal outcome preserved`);
  pass(label);
}

runPath("Buy path", { symbol: "TQQQ", setup: "trend-continuation", verdict: "READY", action: "Confirm" }, "Planned");
runPath("Wait path", { symbol: "QQQ", setup: "mixed-confirmation", verdict: "WAIT", action: "Wait" }, "Skipped");
runPath("Reject path", { symbol: "USO", setup: "event-risk", verdict: "REJECT", action: "Reject" }, "Skipped");
runPath("Win outcome", { symbol: "NVDA", setup: "momentum", verdict: "READY", action: "Confirm" }, "Win");
runPath("Loss outcome", { symbol: "XLE", setup: "failed-breakout", verdict: "READY", action: "Confirm" }, "Loss");

const switched = new SignalStoryHarness();
const originalPath = { symbol: "TQQQ", setup: "trend-continuation", verdict: "READY", action: "Confirm" };
const originalSignalId = switched.ensure(originalPath, "mission");
switched.ensure(originalPath, "eagle");
switched.switchTicker("QQQ");
const restoredSignalId = switched.restore(originalPath);
assert.strictEqual(restoredSignalId, originalSignalId, "Ticker switch mid-flow restores original setup signalId");
switched.mark("journal", "Skipped");
switched.mark("replay", `${originalSignalId}:replay`);
switched.mark("tradeDna", `${originalSignalId}: lesson`);
switched.assertOneStory(originalSignalId, "Ticker switch mid-flow");
switched.assertTomorrow(originalSignalId, "Ticker switch mid-flow");
pass("Ticker switch mid-flow");
