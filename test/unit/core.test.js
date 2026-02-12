const assert = require('assert');
const { loadModuleExports } = require('../helpers/moduleLoader');
const { loadGameState, loadCustomerState } = require('../helpers/state');
const { createBasicScene, createSpawnContext } = require('../helpers/builders');

const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 80;

function testBlinkButton() {
  const { blinkButton } = loadModuleExports('src/ui/helpers.js', {
    Phaser: { Geom: { Rectangle: function Rectangle(x, y, w, h) { return { x, y, width: w, height: h }; } } }
  });

  let disableCalled = false;
  let setArgs = null;
  let duringBlinkEnabled = null;
  const btn = {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    input: { enabled: true },
    disableInteractive() { disableCalled = true; this.input.enabled = false; },
    setInteractive(opts) { setArgs = { options: opts }; this.input.enabled = true; }
  };
  const scene = { tweens: { add(cfg) { duringBlinkEnabled = btn.input.enabled; if (cfg.onComplete) cfg.onComplete(); return {}; } } };
  blinkButton.call(scene, btn);
  assert.strictEqual(disableCalled, false);
  assert.strictEqual(duringBlinkEnabled, false);
  assert.strictEqual(btn.input.enabled, true);
  assert.ok(!setArgs);
}

function testSpawnCustomer() {
  const context = createSpawnContext();
  loadGameState(context);
  loadCustomerState(context);
  const { spawnCustomer } = loadModuleExports('src/entities/customerQueue.js', context);
  spawnCustomer.call(createBasicScene());
  assert.strictEqual(context.wanderers.length, 1);
}

function testSpawnCustomerQueuesWhenEmpty() {
  const context = createSpawnContext();
  context.lureNextWanderer = function() { context.queue.push(context.wanderers.shift()); };
  loadGameState(context);
  loadCustomerState(context);
  const { spawnCustomer } = loadModuleExports('src/entities/customerQueue.js', context);
  spawnCustomer.call(createBasicScene());
  assert.strictEqual(context.queue.length, 0);
  assert.strictEqual(context.wanderers.length, 1);
}

function testSpawnCustomerEmptyAvailable() {
  const called = { scheduled: false };
  const context = createSpawnContext({
    Phaser: { Math: { Between: () => 1, Vector2: class { constructor(x, y) { this.x = x; this.y = y; } length() { return 1; } normalize() { return this; } } }, Utils: { Array: { GetRandom: a => a[0] } } },
    Assets: { keys: [] },
    keys: [],
    scheduleNextSpawn() { called.scheduled = true; }
  });
  loadGameState(context);
  loadCustomerState(context);
  const { spawnCustomer } = loadModuleExports('src/entities/customerQueue.js', context);
  const scene = createBasicScene();
  scene.add.sprite = () => { throw new Error('sprite should not be created'); };
  spawnCustomer.call(scene);
  assert.strictEqual(context.wanderers.length, 0);
}

function testNextMoodProgression() {
  const { nextMood } = loadModuleExports('src/main.js', {
    CustomerState: { NORMAL: 0, GROWING: 1, SPARKLING: 2, ARROW: 3, BROKEN: 4, MENDING: 5 },
    window: undefined,
    document: { readyState: 'loading' }
  });
  const CS = { NORMAL: 0, GROWING: 1, SPARKLING: 2, ARROW: 3 };
  assert.strictEqual(nextMood(CS.NORMAL), CS.GROWING);
  assert.strictEqual(nextMood(CS.GROWING), CS.SPARKLING);
  assert.strictEqual(nextMood(CS.SPARKLING), CS.ARROW);
  assert.strictEqual(nextMood(CS.ARROW), CS.ARROW);
}

function testEmojiFor() {
  const { emojiFor } = loadModuleExports('src/assets.js');
  assert.strictEqual(emojiFor('Iced Mocha'), '🍫 🧊 🧊\n☕');
  assert.strictEqual(emojiFor('Rose Tea'), '🌹\n🍵');
  assert.strictEqual(emojiFor('Hot Chocolate'), '🍫');
}

function runUnitTests() {
  testSpawnCustomer();
  testSpawnCustomerQueuesWhenEmpty();
  testSpawnCustomerEmptyAvailable();
  testBlinkButton();
  testNextMoodProgression();
  testEmojiFor();
  console.log('Unit tests passed');
}

module.exports = { runUnitTests };
