/**
 * Zero-dependency unit tests for the Attention Engine's pure layers.
 *
 *   node tests/run.js
 *
 * The engagement model is deliberately a pure function — snapshot in,
 * {score, mode, meta} out — precisely so it can be swapped for a trained
 * model later. These tests pin down that contract, so a future replacement
 * can be checked against the same behavioural expectations instead of
 * "it still looks about right in a browser".
 *
 * The source files are browser globals (IIFEs taking `window`), so we hand
 * them a stand-in global rather than restructuring them for Node.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- tiny test harness -------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  [32m✓[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  [31m✗[0m ${name}`);
    console.log(`      ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'values differ'}: expected ${expected}, got ${actual}`);
  }
}

function assertBetween(value, min, max, message) {
  if (!(value >= min && value <= max)) {
    throw new Error(`${message || 'out of range'}: ${value} not within [${min}, ${max}]`);
  }
}

// --- load the browser modules into a sandbox ---------------------------------
const sandbox = { console, performance: { now: () => Date.now() } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(relPath) {
  const full = path.join(__dirname, '..', relPath);
  vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
}

load('js/utils/utils.js');
load('js/attention/engagementModel.js');

const { clamp, lerp, map } = sandbox.AEUtils;
const { computeEngagement, CONFIG } = sandbox.AEEngagementModel;

// A neutral snapshot; individual tests override just what they care about.
function snapshot(overrides = {}) {
  return Object.assign(
    {
      t: 0,
      idleMs: 0,
      pointerSpeed: 0,
      scrollSpeed: 0,
      scrollDirection: 0,
      clicksPerWindow: 0,
      interactionsPerWindow: 0,
      currentSection: 'hero',
      currentSectionDwellMs: 0,
      sectionsVisited: 1,
      scrollDepth: 0,
      repeatedActionScore: 0,
      fixatedTargetKey: null,
      rateWindowMs: 12000,
    },
    overrides
  );
}

console.log('\nAEUtils');
test('clamp bounds values on both sides', () => {
  assertEqual(clamp(5, 0, 1), 1);
  assertEqual(clamp(-5, 0, 1), 0);
  assertEqual(clamp(0.5, 0, 1), 0.5);
});

test('lerp hits both endpoints exactly', () => {
  assertEqual(lerp(0, 10, 0), 0);
  assertEqual(lerp(0, 10, 1), 10);
  assertEqual(lerp(0, 10, 0.5), 5);
});

test('map clamps out-of-range input rather than extrapolating', () => {
  assertEqual(map(15, 0, 10, 0, 1), 1);
  assertEqual(map(-5, 0, 10, 0, 1), 0);
});

test('map degrades safely on a zero-width input range', () => {
  assertEqual(map(5, 3, 3, 0, 1), 0);
});

console.log('\nEngagement model — score bounds');
test('score always stays within 0..1 across extreme inputs', () => {
  const extremes = [
    snapshot(),
    snapshot({ pointerSpeed: 99, scrollSpeed: 99, interactionsPerWindow: 999, scrollDepth: 1, sectionsVisited: 99, currentSectionDwellMs: 999999 }),
    snapshot({ pointerSpeed: -5, scrollSpeed: -5, interactionsPerWindow: -20 }),
    snapshot({ idleMs: 999999 }),
  ];
  extremes.forEach((s, i) => {
    const { score } = computeEngagement(s);
    assertBetween(score, 0, 1, `extreme case ${i}`);
  });
});

test('every returned mode is one the adapter knows how to render', () => {
  const known = new Set([...CONFIG.modes.map((m) => m.id), 'fixated']);
  const cases = [
    snapshot(),
    snapshot({ idleMs: 999999 }),
    snapshot({ repeatedActionScore: 1, fixatedTargetKey: 'card-0' }),
    snapshot({ pointerSpeed: 2, scrollSpeed: 3, interactionsPerWindow: 40, scrollDepth: 1, sectionsVisited: 8, currentSectionDwellMs: 30000 }),
  ];
  cases.forEach((s, i) => {
    const { mode } = computeEngagement(s);
    assert(known.has(mode), `case ${i} produced unknown mode "${mode}"`);
  });
});

console.log('\nEngagement model — behaviour');
test('a still, silent visitor reads as idle', () => {
  const { meta, mode } = computeEngagement(snapshot({ idleMs: CONFIG.idle.gentleMs + 500 }));
  assert(meta.isIdle, 'expected isIdle');
  assertEqual(meta.idleDepth, 'gentle');
  assert(mode !== 'flow', 'an idle visitor must never read as flow');
});

test('idle deepens past the deep threshold', () => {
  const { meta, mode } = computeEngagement(snapshot({ idleMs: CONFIG.idle.deepMs + 1000 }));
  assertEqual(meta.idleDepth, 'deep');
  assertEqual(mode, 'dormant');
});

test('activity scores strictly above stillness', () => {
  const still = computeEngagement(snapshot()).score;
  const busy = computeEngagement(
    snapshot({ pointerSpeed: 1.0, scrollSpeed: 1.5, interactionsPerWindow: 10, scrollDepth: 0.7, sectionsVisited: 4, currentSectionDwellMs: 6000 })
  ).score;
  assert(busy > still, `expected busy (${busy}) > still (${still})`);
});

test('repeated hits on one target flag fixation, carrying the target key', () => {
  const { mode, meta } = computeEngagement(
    snapshot({ repeatedActionScore: 1, fixatedTargetKey: 'card-2', pointerSpeed: 0.4 })
  );
  assertEqual(mode, 'fixated');
  assertEqual(meta.fixatedTargetKey, 'card-2');
});

test('fixation below the configured threshold is not flagged', () => {
  const below = CONFIG.fixation.scoreThreshold - 0.01;
  const { mode } = computeEngagement(snapshot({ repeatedActionScore: below, fixatedTargetKey: 'card-2' }));
  assert(mode !== 'fixated', 'should not flag fixation below threshold');
});

test('deep exploration outscores shallow, all else equal', () => {
  const shallow = computeEngagement(snapshot({ scrollDepth: 0.05, sectionsVisited: 1 })).score;
  const deep = computeEngagement(snapshot({ scrollDepth: 1, sectionsVisited: 6 })).score;
  assert(deep > shallow, `expected deep (${deep}) > shallow (${shallow})`);
});

test('the model is pure — same input, same output, no snapshot mutation', () => {
  const input = snapshot({ pointerSpeed: 0.5, scrollDepth: 0.4 });
  const copy = JSON.parse(JSON.stringify(input));
  const a = computeEngagement(input);
  const b = computeEngagement(input);
  assertEqual(a.score, b.score, 'repeated calls diverged');
  assertEqual(a.mode, b.mode, 'repeated calls diverged on mode');
  assertEqual(JSON.stringify(input), JSON.stringify(copy), 'input snapshot was mutated');
});

test('mode thresholds are ordered, so pickMode is monotonic', () => {
  for (let i = 1; i < CONFIG.modes.length; i++) {
    assert(
      CONFIG.modes[i].min > CONFIG.modes[i - 1].min,
      `mode "${CONFIG.modes[i].id}" threshold is not above "${CONFIG.modes[i - 1].id}"`
    );
  }
});

test('rising engagement never moves the mode backwards', () => {
  const rank = { dormant: 0, ambient: 1, curious: 2, engaged: 3, flow: 4 };
  let previous = -1;
  for (let level = 0; level <= 1.0001; level += 0.05) {
    const { mode } = computeEngagement(
      snapshot({
        pointerSpeed: level * CONFIG.normalization.pointerSpeedMax,
        scrollSpeed: level * CONFIG.normalization.scrollSpeedMax,
        interactionsPerWindow: level * CONFIG.normalization.interactionsPerWindowMax,
        currentSectionDwellMs: level * CONFIG.normalization.focusDwellMsMax,
        scrollDepth: level,
        sectionsVisited: Math.round(level * 6),
      })
    );
    const current = rank[mode];
    assert(current >= previous, `mode regressed to "${mode}" as engagement rose`);
    previous = current;
  }
});

// --- summary -----------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) {
  failures.forEach(({ name, err }) => console.error(`FAILED: ${name}\n${err.stack}\n`));
  process.exit(1);
}
