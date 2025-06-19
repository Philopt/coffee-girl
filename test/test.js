const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 80;

const DEBUG = process.env.DEBUG === '1';
const SKIP_PUPPETEER = process.env.SKIP_PUPPETEER === '1';

let server = null;
function killServer() {
  return new Promise(resolve => {
    if (server && !server.killed) {
      server.once('close', resolve);
      server.kill();
      server = null;
    } else {
      resolve();
    }
  });
}

process.on('SIGINT', () => {
  killServer().then(() => process.exit(1));
});
process.on('SIGTERM', () => {
  killServer().then(() => process.exit(1));
});

function loadGameState(context) {
  const statePath = path.join(__dirname, '..', 'src', 'state.js');
  const code = fs.readFileSync(statePath, 'utf8');
  const m = /export const GameState = (\{[\s\S]*?\});/.exec(code);
  if (m) {
    const defaults = Function(`return ${m[1]}`)();
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in context)) context[k] = v;
    }
  }
  context.GameState = context;
}

function loadCustomerState(context) {
  const constPath = path.join(__dirname, '..', 'src', 'constants.js');
  if (!fs.existsSync(constPath)) return;
  const code = fs.readFileSync(constPath, 'utf8');
  const m = /export const CustomerState = (\{[\s\S]*?\});/.exec(code);
  if (m) {
    context.CustomerState = Function(`return ${m[1]}`)();
  }
}

function loadBirdState(context) {
  const constPath = path.join(__dirname, '..', 'src', 'constants.js');
  if (!fs.existsSync(constPath)) return;
  const code = fs.readFileSync(constPath, 'utf8');
  const m = /export const BirdState = (\{[\s\S]*?\});/.exec(code);
  if (m) {
    context.BirdState = Function(`return ${m[1]}`)();
  }
}

function readModule(...names) {
  for (const n of names) {
    const file = path.join(__dirname, '..', 'src', n);
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8');
    }
  }
  throw new Error('module not found: ' + names.join(', '));
}

function readAndMatch(names, regex) {
  for (const n of names) {
    const file = path.join(__dirname, '..', 'src', n);
    if (fs.existsSync(file)) {
      const code = fs.readFileSync(file, 'utf8');
      const m = regex.exec(code);
      if (m) {
        m[0] = m[0].replace(/^export\s+/, '');
        return m;
      }
    }
  }
  return null;
}

function extractFunction(names, funcName) {
  for (const n of names) {
    const file = path.join(__dirname, '..', 'src', n);
    if (fs.existsSync(file)) {
      const code = fs.readFileSync(file, 'utf8');
      let start = code.indexOf(`function ${funcName}`);
      if (start === -1) start = code.indexOf(`export function ${funcName}`);
      if (start === -1) continue;
      let depth = 0;
      for (let i = start; i < code.length; i++) {
        const ch = code[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) return code.slice(start, i + 1);
        }
      }
    }
  }
  return null;
}

function testBlinkButton() {
  let code = readModule('ui.js', 'main.js');
  let start = code.indexOf('function blinkButton');
  if (start === -1) {
    start = code.indexOf('export function blinkButton');
    if (start === -1) {
      const fallback = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
      start = fallback.indexOf('function blinkButton');
      if (start === -1) start = fallback.indexOf('export function blinkButton');
      if (start === -1) throw new Error('blinkButton not found');
      code = fallback;
    }
  }
  let depth = 0;
  let end = -1;
  for (let i = start; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error('blinkButton not closed');
  const funcSrc = code.slice(start, end);
  function RectStub(x, y, w, h) {
    return { x, y, width: w, height: h };
  }
  RectStub.Contains = () => true;
  const context = { Phaser: { Geom: { Rectangle: RectStub } }, debugLog() {} };
  vm.createContext(context);
  context.blinkBtn = null;
  vm.runInContext('const dur=v=>v;\n' + funcSrc + '\nblinkBtn=blinkButton;', context);
  const blinkButton = context.blinkBtn;
  let disableCalled = false;
  let setArgs = null;
  let duringBlinkEnabled = null;
  const btn = {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    input: { enabled: true },
    disableInteractive() { disableCalled = true; this.input.enabled = false; },
    setInteractive(opts) {
      setArgs = { options: opts };
      this.input.enabled = true;
    }
  };
  const scene = { tweens: { add(cfg) { duringBlinkEnabled = btn.input.enabled; if (cfg.onComplete) cfg.onComplete(); return {}; } } };
  blinkButton.call(scene, btn);
  assert.strictEqual(disableCalled, false, 'disableInteractive should not be called');
  assert.strictEqual(duringBlinkEnabled, false, 'input not disabled during blink');
  assert.strictEqual(btn.input.enabled, true, 'button not re-enabled');
  assert.ok(!setArgs, 'setInteractive should not be called');
  console.log('blinkButton interactivity test passed');
}

function testSpawnCustomer() {
  const src = extractFunction(
    ['entities/customerQueue.js', 'customers.js', 'main.js'],
    'spawnCustomer'
  );
  if (!src) throw new Error('spawnCustomer not found');
  const context = {
    Phaser: { Math: { Between: (min, max) => (min === 0 && max === 4 ? 1 : min) }, Utils: { Array: { GetRandom: a => a[0] } } },
    DOG_TYPES: [{ type: 'standard', emoji: '🐶' }],
    wanderers: [],
    queue: [],
    queueLimit: () => 2,
    gameOver: false,
    maxWanderers: () => 5,
    scheduleNextSpawn: () => {},
    lureNextWanderer: () => {},
    sendDogOffscreen: () => {},
    Assets: { keys: ['c1'] },
    keys: ['c1'],
    customerMemory: {},
    CustomerState: { NORMAL: 0 },
    MENU: [{ name: 'Coffee', price: 5 }],
    WANDER_TOP: 0,
    WANDER_BOTTOM: 10,
    loopsForState: () => 1,
    EDGE_TURN_BUFFER: 40,
    scaleForY: () => 1,
    dur: v => v,
    fn: null,
    floatingEmojis: []
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  vm.runInContext(src + '\nfn=spawnCustomer;', context);
  const spawnCustomer = context.fn;
  const scene = {
    add: {
      sprite() {
        return {
          setScale() { return this; },
          setDepth() { return this; },
          setAngle() { return this; },
          destroy() {}
        };
      }
    },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return { progress: 0 }; } },
    time: {
      addEvent() { return { remove() {} }; },
      delayedCall() { return { remove() {} }; }
    }
  };
  spawnCustomer.call(scene);
  assert.strictEqual(context.wanderers.length, 1, 'customer not added to wanderers');
  console.log('spawnCustomer adds wanderer test passed');
}

function testSpawnCustomerQueuesWhenEmpty() {
  const src = extractFunction(
    ['entities/customerQueue.js', 'customers.js', 'main.js'],
    'spawnCustomer'
  );
  if (!src) throw new Error('spawnCustomer not found');
  const context = {
    Phaser: { Math: { Between: (min, max) => (min === 0 && max === 4 ? 1 : min) }, Utils: { Array: { GetRandom: a => a[0] } } },
    DOG_TYPES: [{ type: 'standard', emoji: '🐶' }],
    wanderers: [],
    queue: [],
    queueLimit: () => 2,
    gameOver: false,
    maxWanderers: () => 5,
    scheduleNextSpawn: () => {},
    sendDogOffscreen: () => {},
    Assets: { keys: ['c1'] },
    keys: ['c1'],
    customerMemory: {},
    CustomerState: { NORMAL: 0 },
    MENU: [{ name: 'Coffee', price: 5 }],
    WANDER_TOP: 0,
    WANDER_BOTTOM: 10,
    loopsForState: () => 1,
    EDGE_TURN_BUFFER: 40,
    scaleForY: () => 1,
    dur: v => v,
    fn: null,
    floatingEmojis: []
  };
  context.lureNextWanderer = function(){ context.queue.push(context.wanderers.shift()); };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  vm.runInContext(src + '\nfn=spawnCustomer;', context);
  const spawnCustomer = context.fn;
  const scene = {
    add: {
      sprite() {
        return { setScale() { return this; }, setDepth() { return this; }, setAngle() { return this; }, destroy() {} };
      }
    },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return { progress: 0 }; } },
    time: { addEvent() { return { remove() {} }; }, delayedCall() { return { remove() {} }; } }
  };
  spawnCustomer.call(scene);
  assert.strictEqual(context.queue.length, 1, 'customer not queued when empty');
  console.log('spawnCustomer enqueues when queue empty test passed');
}

function testHandleActionSell() {
  const recMatch = readAndMatch(['assets.js', 'customers.js', 'main.js'], /(?:export\s+)?function receipt\([^)]*\)[\s\S]*?\n\s*\}/);
  const actMatch = readAndMatch(['customers.js', 'main.js'], /(?:export\s+)?function handleAction\(type\)[\s\S]*?\n\s*\}\n(?=\s*function)/);
  if (!actMatch || !recMatch) throw new Error('handleAction or receipt not found');
  const context = {
    money: 20,
    love: 10,
    queue: [],
    activeCustomer: null,
    MAX_M: 100,
    MAX_L: 100,
    WALK_OFF_BASE: 1000,
    servedCount: 0,
    Phaser: { Math: { Between: (min, max) => { if (min === 0 && max === 1) return 0; if (min === 0 && max === 2) return 1; return min; }, Clamp: (x, l, h) => Math.max(l, Math.min(h, x)) }, Utils: { Array: { GetRandom: a => a[0] } } },
    moveQueueForward: () => {},
    showFalconAttack: () => {},
    showCustomerRevolt: () => {},
    showEnd: () => {},
    scheduleNextSpawn: () => {},
    updateSideC: () => {},
    clearDialog: () => {},
    animateStatChange: () => {},
    emphasizePrice: () => {},
    blinkPriceBorder: () => {},
    flashMoney: () => {},
    moneyText: { x: 0, y: 0, width: 50, setText() { return this; } },
    loveText: { setText() { return this; } },
    reportLine1: { setStyle() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setVisible() { return this; }, setColor() { return this; } },
    reportLine2: { setStyle() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setVisible() { return this; }, setColor() { return this; } },
    reportLine3: { setStyle() { return this; }, setText() { return this; }, setPosition() { return this; }, setOrigin() { return this; }, setAlpha() { return this; }, setVisible() { return this; }, setColor() { return this; } },
    dialogPriceBox: { width: 120, height: 80, setVisible() { return this; }, setDepth() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setAlpha() { return this; }, setColor() { return this; }, setStrokeStyle() { return this; }, setFillStyle() { return this; }, x: 0, y: 0, fillAlpha: 1 },
    dialogPriceValue: { setVisible() { return this; }, setDepth() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setAlpha() { return this; }, setColor() { return this; }, x:0, y:0 },
    dialogPriceContainer: { x:0, y:0, scaleX:1, scaleY:1, setVisible() { return this; }, setPosition(x,y){ this.x=x; this.y=y; return this; }, setScale(s){ this.scaleX=s; this.scaleY=s; return this; }, remove(){ return this; } },
    dialogDrinkEmoji: { x:0, y:0, depth:1, followEvent:null, setVisible(){ return this; }, setPosition(x,y){ this.x=x; this.y=y; return this; }, clearTint(){ return this; } },
    paidStamp: { setText() { return this; }, setScale() { return this; }, setPosition() { return this; }, setAngle() { return this; }, setVisible() { return this; } },
    tipText: { setText() { return this; }, setScale() { return this; }, setPosition() { return this; }, setAngle() { return this; }, setVisible() { return this; } },
    dialogBg: { setVisible() { return this; } },
    dialogText: { setVisible() { return this; } },
    supers: {},
    smallDollar: '$',
    fn: null
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  context.animateLoveChange = function(delta, c, cb) { context.love += delta; if (cb) cb(); };
  vm.runInContext('const dur=v=>v;\n' + recMatch[0] + '\n' + actMatch[0] + '\nfn=handleAction;', context);
  const handleAction = context.fn;
  const scene = {
    tweens: {
      add(cfg) { if (cfg.onComplete) cfg.onComplete.call(cfg.callbackScope || null); return {}; },
      createTimeline({ callbackScope, onComplete }) { return { add() {}, play() { if (onComplete) onComplete.call(callbackScope); } }; }
    },
    time: { delayedCall(d, cb, args, s) { if (cb) cb.apply(s || this, args || []); return {}; } }
  };
  const sprite = { destroy() {}, setDepth() { return this; }, x: 0, y: 0 };
  const cust = { sprite, orders: [{ coins: 5.75, req: 'Coffee', price: 5, qty: 1 }], atOrder: true };
  context.activeCustomer = cust;
  context.queue = [cust];
  handleAction.call(scene, 'sell');
  assert.strictEqual(context.money, 25.75, 'money not updated correctly');
  assert.strictEqual(context.love, 11, 'love not updated correctly');
  console.log('handleAction("sell") update test passed');
}

function testShowStartScreen() {
  const match = readAndMatch(['intro.js', 'ui.js', 'main.js'], /(?:export\s+)?function showStartScreen\(scene\)[\s\S]*?\n\s*\}\);\n\s*\}/);
  if (!match) throw new Error('showStartScreen not found');
  function RectStub(x, y, w, h) {
    return { x, y, width: w, height: h };
  }
  RectStub.Contains = () => true;
  const context = { Phaser: { Geom: { Rectangle: RectStub } }, debugLog() {} };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  context.fn = null;
  vm.runInContext('let startOverlay,startButton,startMsgTimers=[],startMsgBubbles=[];const playIntro=()=>{};\n' + match[0] + '\nfn=showStartScreen;', context);
  const showStartScreen = context.fn;
  const calls = { rects: 0, text: null, container: null };
  const scene = {
    add: {
      rectangle() { calls.rects++; return { setDepth() { return this; } }; },
      text(x, y, txt) {
        const obj = {
          setOrigin() { return obj; },
          setDepth() { return obj; },
          width: 100,
          height: 40
        };
        calls.text = { txt, obj };
        return obj;
      },
      graphics() { return { fillStyle() { return this; }, fillRoundedRect() { return this; } }; },
      sprite() { return { setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; } }; },
      zone() { return { setOrigin() { return this; }, setInteractive() { return this; }, on() { return this; } }; },
      container() {
        const obj = {
          setSize() { return obj; },
          setDepth() { return obj; },
          setVisible() { return obj; },
          setAlpha() { return obj; },
          setInteractive() { obj.interactive = true; return obj; },
          on() { return obj; },
          add() { return obj; }
        };
        if (!calls.container) calls.container = obj;
        return obj;
      }
    }
  };
  showStartScreen.call(scene);
  assert.strictEqual(calls.rects, 1, 'start overlay not created');
  assert.ok(calls.container && calls.container.interactive, 'start button not interactive');
  assert.strictEqual(calls.text.txt, 'Clock In', 'start button text mismatch');
  console.log('showStartScreen test passed');
}

function testStartButtonPlaysIntro() {
  const startMatch = readAndMatch(['intro.js', 'ui.js', 'main.js'], /(?:export\s+)?function showStartScreen\(scene\)[\s\S]*?\n\s*\}\);\n\s*\}/);
  const introMatch = readAndMatch(['intro.js', 'ui.js', 'main.js'], /(?:export\s+)?function playIntro\(scene\)[\s\S]*?intro\.play\(\);\n\s*\}/);
  if (!startMatch || !introMatch) throw new Error('showStartScreen or playIntro not found');
  function RectStub(x, y, w, h) {
    return { x, y, width: w, height: h };
  }
  RectStub.Contains = () => true;
  const context = { Phaser: { Geom: { Rectangle: RectStub } }, spawnCustomer: () => {}, scheduleNextSpawn: () => {}, debugLog() {} };
  context.spawnSparrow = () => {};
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  context.fnStart = null;
  context.fnIntro = null;
  vm.runInContext('var startOverlay,startButton,startMsgTimers=[],startMsgBubbles=[]; const dur=v=>v;\n' +
    introMatch[0] + '\n' + startMatch[0] + '\nfnStart=showStartScreen; fnIntro=playIntro;', context);
  const showStartScreen = context.fnStart;
  const realPlayIntro = context.fnIntro;

  const truck = { x: 0, y: 0, setPosition(x, y) { this.x = x; this.y = y; return this; }, setScale() { return this; }, setDepth() { return this; } };
  const girl = { x: 0, y: 0, visible: true, setPosition(x, y) { this.x = x; this.y = y; return this; }, setVisible(v) { this.visible = v; return this; }, setScale() { return this; }, setDepth() { return this; } };
  context.GameState.truck = truck;
  context.GameState.girl = girl;

  let pointerCb = null;
  const scene = {
    add: {
      rectangle() { return { setDepth() { return this; }, setStrokeStyle() { return this; }, destroy() { this.destroyed = true; } }; },
      text() { return { setOrigin() { return this; }, setDepth() { return this; }, width: 100, height: 40 }; },
      graphics() { return { fillStyle() { return this; }, fillRoundedRect() { return this; } }; },
      sprite() { return { setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; }, setVisible() { return this; } }; },
      zone() { return { setOrigin() { return this; }, setInteractive() { return this; }, on(event, cb) { if (event === 'pointerdown' && !pointerCb) pointerCb = cb; return this; }, emit() {} }; },
      container() {
        const obj = {
          setSize() { return obj; },
          setDepth() { return obj; },
          setVisible() { return obj; },
          setAlpha() { return obj; },
          setInteractive() { return obj; },
          on(event, cb) { if (event === 'pointerdown') pointerCb = cb; return obj; },
          add() { return obj; },
          destroy() { obj.destroyed = true; }
        };
        return obj;
      }
    },
    tweens: {
      createTimeline({ callbackScope, onComplete }) {
        const steps = [];
        return {
          add(cfg) { steps.push(cfg); },
          play() {
            for (const s of steps) {
              if (s.onStart) s.onStart();
              const targets = Array.isArray(s.targets) ? s.targets : [s.targets];
              targets.forEach(t => {
                if (s.x !== undefined) t.x = s.x;
                if (s.y !== undefined) t.y = s.y;
              });
              if (s.onComplete) s.onComplete.call(callbackScope || null);
            }
            if (onComplete) onComplete.call(callbackScope || null);
          }
        };
      }
    }
  };

  showStartScreen.call(scene);
  assert(pointerCb, 'pointerdown handler not set');

  let called = false;
  context.playIntro = function(s) { called = true; return realPlayIntro.call(this, s); };
  pointerCb();

  assert.ok(called, 'playIntro not called');
  assert.strictEqual(truck.x, 240, 'truck x not moved');
  console.log('start button triggers playIntro test passed');
}

function testShowDialogButtons() {
  const match = readAndMatch(['ui.js', 'main.js'], /(?:export\s+)?function showDialog\(\)[\s\S]*?tipText\.setVisible\(false\);[\s\S]*?\n\s*\}/);
  if (!match) throw new Error('showDialog not found');
  const makeObj = () => ({
    visible: false,
    input: { enabled: false },
    setVisible(v) { this.visible = v; return this; },
    setOrigin() { return this; },
    setPosition() { return this; },
    setStyle() { return this; },
    setText() { return this; },
    setDepth() { return this; },
    setAlpha() { return this; },
    setColor() { return this; },
    setScale() { return this; },
    setAngle() { return this; },
    clear() { return this; },
    lineStyle() { return this; },
    fillStyle() { return this; },
    fillRoundedRect() { return this; },
    strokeRoundedRect() { return this; },
    fillTriangle() { return this; },
    strokeTriangle() { return this; },
    destroy() { this.destroyed = true; },
  });
  const context = {
    dialogBg: Object.assign(makeObj(), { width: 360, height: 120, x: 240, y: 460 }),
    dialogText: makeObj(),
    dialogCoins: makeObj(),
    dialogPriceBox: makeObj(),
    dialogPriceLabel: makeObj(),
    dialogPriceValue: makeObj(),
    dialogPriceContainer: { x:0, y:0, scaleX:1, scaleY:1,
      setVisible() { return this; },

      setPosition(x,y){ this.x=x; this.y=y; return this; },
      setScale(s){ this.scaleX=s; this.scaleY=s; return this; },
      add(){ return this; },
      remove(){ return this; }

    },
    dialogDrinkEmoji: { x:0, y:0, followEvent:null, setText(){ return this; }, setVisible(){ return this; }, setPosition(x,y){ this.x=x; this.y=y; return this; }, clearTint(){ return this; }, setTint(){ return this; }, setScale(){ return this; } },
    btnSell: makeObj(),
    btnGive: makeObj(),
    btnRef: makeObj(),
    tipText: makeObj(),
    emojiFor: () => '☕',
    articleFor: () => 'a',
    scaleForY: () => 1,
    ORDER_X: 230,
    ORDER_Y: 315,
    queue: [],
    activeCustomer: null,
    drawDialogBubble: () => {},
    resetPriceBox: () => {},
    fadeInButtons(canAfford) {
      if (canAfford) {
        context.btnSell.setVisible(true);
        if (context.btnSell.input) context.btnSell.input.enabled = true;
      } else {
        context.btnSell.setVisible(false);
        if (context.btnSell.input) context.btnSell.input.enabled = false;
      }
      context.btnGive.setVisible(true);
      if (context.btnGive.input) context.btnGive.input.enabled = true;
      context.btnRef.setVisible(true);
      if (context.btnRef.input) context.btnRef.input.enabled = true;
    },
  };
  const scene = {
    add: { text() { return makeObj(); }, rectangle() { return makeObj(); }, graphics() { return makeObj(); } },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return {}; } },
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  context.fn = null;
  vm.runInContext('const dur=v=>v;\n' + match[0] + '\nfn=showDialog;', context);
  const showDialog = context.fn;

  const customer = {
    orders: [{ qty: 1, req: 'Latte', price: 5, coins: 10 }],
    sprite: { x: context.ORDER_X, y: context.ORDER_Y, setDepth() { return this; } },
    atOrder: true,
  };
  context.activeCustomer = customer;
  context.queue = [customer];

  showDialog.call(scene);
  assert.ok(context.btnSell.visible, 'sell button should be visible when affordable');
  assert.strictEqual(context.btnSell.input.enabled, true, 'sell button should be enabled');
  assert.ok(context.btnGive.visible && context.btnRef.visible, 'give/ref buttons visible');

  // make order unaffordable
  customer.orders[0].coins = 1;
  showDialog.call(scene);
  assert.ok(!context.btnSell.visible, 'sell button hidden when cannot afford');
  assert.strictEqual(context.btnSell.input.enabled, false, 'sell button disabled when cannot afford');
  assert.ok(context.btnGive.visible && context.btnRef.visible, 'give/ref buttons still visible');
  console.log('showDialog button visibility test passed');
}

function testAnimateLoveChange() {
  let code = readModule('ui.js', 'main.js');
  let start = code.indexOf('function animateLoveChange');
  if (start === -1) start = code.indexOf('export function animateLoveChange');
  if (start === -1) {
    code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    start = code.indexOf('function animateLoveChange');
    if (start === -1) start = code.indexOf('export function animateLoveChange');
    if (start === -1) throw new Error('animateLoveChange not found');
  }
  let depth = 0, end = -1;
  for (let i = start; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error('animateLoveChange not closed');
  const funcSrc = code.slice(start, end);
  const context = {
    love: 19,
    loveLevel: 1,
    queueLevelText: {
      text: '',
      visible: false,
      x: 0,
      y: 0,
      depth: 1,
      setText(t) { this.text = t; return this; },
      setVisible(v) { this.visible = v; return this; },
      scene: { add: { text() { return { setOrigin() { return this; }, setDepth() { return this; }, destroy() {} }; } },
               tweens: { add() { return {}; }, createTimeline({ callbackScope }) { const steps = []; return { add(cfg) { steps.push(cfg); }, play() { steps.forEach(s => { if (s.onComplete) s.onComplete.call(callbackScope || null); }); } }; } } },
    },
    loveText: { x: 0, y: 0, setText(t) { this.text = t; return this; } },
    lureNextWanderer: () => {},
    animateStatChange: () => {},
    calcLoveLevel(v) { if (v >= 100) return 4; if (v >= 50) return 3; if (v >= 20) return 2; return 1; },
    updateLevelDisplay: null,
    dur: v => v,
    fn: null,
    floatingEmojis: []
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  vm.runInContext(
    'updateLevelDisplay = function(){ const lvl = calcLoveLevel(love); queueLevelText.setText("Lv. " + lvl); queueLevelText.setVisible(lvl >= 2); loveLevel = lvl; };',
    context
  );
  vm.runInContext(funcSrc + '\nfn=animateLoveChange;', context);
  const animateLoveChange = context.fn;
  const scene = {
    add: { text() { return { setOrigin() { return this; }, setDepth() { return this; }, destroy() {} }; } },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return {}; }, createTimeline({ callbackScope }) { const steps = []; return { add(cfg) { steps.push(cfg); }, play() { steps.forEach(s => { if (s.onComplete) s.onComplete.call(callbackScope || null); }); } }; } },
    time: { delayedCall(d, cb, args, s) { if (cb) cb.apply(s || this, args || []); return {}; } }
  };
  const cust = { x: 100, y: 100 };

  animateLoveChange.call(scene, 1, cust);
  assert.strictEqual(context.love, 20, 'love not incremented');
  assert.strictEqual(context.queueLevelText.text, 'Lv. 2', 'queue level up not reflected');
  assert.strictEqual(context.queueLevelText.visible, true, 'queue level text should be visible');

  animateLoveChange.call(scene, -2, cust);
  assert.strictEqual(context.love, 18, 'love not decremented');
  assert.strictEqual(context.queueLevelText.text, 'Lv. 1', 'queue level down not reflected');
  assert.strictEqual(context.queueLevelText.visible, false, 'queue level text should hide');
  console.log('animateLoveChange update test passed');
}

function testScheduleNextSpawn() {
  const match = readAndMatch(
    ['entities/customerQueue.js', 'customers.js', 'main.js'],
    /(?:export\s+)?function scheduleNextSpawn\([^)]*\)[\s\S]*?\n\s*\}\n(?=\s*(?:export\s+)?function)/
  );
  if (!match) throw new Error('scheduleNextSpawn not found');
  const code = match[0];
  const context = {
    falconActive: false,
    spawnTimer: null,
    queue: [],
    wanderers: [],
    queueLimit: () => 2,
    SPAWN_DELAY: 2000,
    SPAWN_VARIANCE: 1500,
    spawnCustomer: () => {},
    Phaser: { Math: { Between: () => 0 } },
    fn: null
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  vm.runInContext(code + '\nfn=scheduleNextSpawn;', context);
  const scheduleNextSpawn = context.fn;
  const scene = {
    time: {
      delayedCall(delay) {
        scene.lastDelay = delay;
        return { remove() {} };
      }
    }
  };

  let oldTimer = { removed: false, remove() { this.removed = true; } };
  context.spawnTimer = oldTimer;
  scheduleNextSpawn(scene);
  assert.ok(oldTimer.removed, 'existing timer not cleared');
  assert.notStrictEqual(context.spawnTimer, oldTimer, 'spawnTimer not replaced');
  assert.strictEqual(scene.lastDelay, 500, 'short delay expected when slots available');

  oldTimer = { removed: false, remove() { this.removed = true; } };
  context.spawnTimer = oldTimer;
  context.falconActive = true;
  scene.lastDelay = null;
  scheduleNextSpawn(scene);
  assert.strictEqual(context.spawnTimer, oldTimer, 'spawnTimer changed when falconActive');
  assert.ok(!oldTimer.removed, 'timer removed during falcon attack');
  assert.strictEqual(scene.lastDelay, null, 'timer scheduled during falcon attack');
  context.falconActive = false;

  context.spawnTimer = null;
  context.queue = [1, 2];
  scene.lastDelay = null;
  scheduleNextSpawn(scene);
  assert.ok(context.spawnTimer, 'spawnTimer not scheduled when queue full');
  assert.strictEqual(scene.lastDelay, 2000, 'long delay expected when queue full');
  console.log('scheduleNextSpawn behavior test passed');
}

function testSparrowRemovalOffscreen() {
  const srcPath = path.join(__dirname, '..', 'src', 'sparrow.js');
  let code = fs.readFileSync(srcPath, 'utf8');
  code = code.replace(/import[^\n]*\n/g, '').replace(/export\s+(?=const|function|class)/g, '');
  const context = {
    Phaser: {
      Math: {
        Between: (min, max) => min,
        FloatBetween: (min, max) => min,
        Clamp: (v, l, h) => Math.max(l, Math.min(h, v)),
        Linear: (a, b, t) => a + (b - a) * t,
        Vector2: class Vector2 {
          constructor(x = 0, y = 0) { this.x = x; this.y = y; }
          set(x, y) { this.x = x; this.y = y; return this; }
          copy(v) { this.x = v.x; this.y = v.y; return this; }
          normalize() { const l = Math.hypot(this.x, this.y); if (l) { this.x /= l; this.y /= l; } return this; }
          scale(s) { this.x *= s; this.y *= s; return this; }
        },
        Easing: { Sine: { Out: v => v } },
        Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) }
      },
      Curves: { QuadraticBezier: class {
        constructor(p0, p1, p2) { this.p0 = p0; this.p1 = p1; this.p2 = p2; }
        getPoint(t, out) {
          const inv = 1 - t;
          const x = inv * inv * this.p0.x + 2 * inv * t * this.p1.x + t * t * this.p2.x;
          const y = inv * inv * this.p0.y + 2 * inv * t * this.p1.y + t * t * this.p2.y;
          out.x = x; out.y = y; return out;
        }
      } },
      Utils: { Array: { GetRandom: a => a[0] } }
    }
  };
  loadGameState(context);
  loadCustomerState(context);
  loadBirdState(context);
  vm.createContext(context);
  vm.runInContext(code + '\nresult = { spawnSparrow, updateSparrows };', context);
  const spawnSparrow = context.result.spawnSparrow;
  const updateSparrows = context.result.updateSparrows;

  const scene = {
    add: { sprite(x, y) { return { x, y, setDepth() { return this; }, setScale() { return this; }, setPosition(x2, y2) { this.x = x2; this.y = y2; return this; }, anims: { play() {} }, destroy() { this.destroyed = true; } }; } },
    scale: { width: 480, height: 640 },
    gameState: context.GameState,
    time: { delayedCall() { return { remove() {} }; } }
  };

  const bird = spawnSparrow(scene);
  bird.threatCheck = { removed: false, remove() { this.removed = true; } };
  bird.timerEvent = { removed: false, remove() { this.removed = true; } };
  bird.sprite.y = scene.scale.height + 60;

  updateSparrows(scene, 16);

  assert.strictEqual(scene.gameState.sparrows.length, 0, 'sparrow not removed when offscreen');
  assert.ok(bird.threatCheck.removed, 'threatCheck not removed');
  assert.ok(bird.timerEvent.removed, 'timerEvent not removed');
  assert.ok(bird.sprite.destroyed, 'sprite not destroyed');
  console.log('updateSparrows offscreen removal test passed');
}

function testLureNextWandererQueueLimit() {
  const code = extractFunction(['entities/customerQueue.js'], 'lureNextWanderer');
  if (!code) throw new Error('lureNextWanderer not found');
  const context = {
    love: 50,
    queue: [],
    wanderers: [],
    activeCustomer: null,
    queueLimit: () => 4,
    ORDER_X: 230,
    ORDER_Y: 315,
    QUEUE_X: 230 - 36 - 10,
    QUEUE_Y: 320,
    QUEUE_SPACING: 36,
    QUEUE_OFFSET: 8,
    LURE_SPEED: 1,
    showDialog() {},
    checkQueueSpacing() {},
    curvedApproach(scene, sprite, dir, x, y, cb) {
      sprite.x = x;
      sprite.y = y;
      const tw = {};
      if (cb) cb();
      return tw;
    },
    debugLog() {},
    fn: null
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  for (let i = 0; i < 4; i++) {
    context.wanderers.push({ sprite: { x: 0, y: 0, displayHeight: 10, originY: 0, setDepth() {}, setScale() {} } });
  }
  vm.runInContext(code + '\nfn=lureNextWanderer;', context);
  const lureNextWanderer = context.fn;
  const scene = {};
  for (let i = 0; i < context.queueLimit(); i++) {
    lureNextWanderer(scene);
    context.queue[i].walkTween = null;
  }
  assert.strictEqual(context.queue.length, context.queueLimit(), 'queue did not fill to limit');
  console.log('lureNextWanderer queue limit test passed');
}

function testShowEndRestart() {
  const showEndSrc = extractFunction(['ui.js', 'main.js'], 'showEnd');
  const restartSrc = extractFunction(['ui.js', 'main.js'], 'restartGame');
  if (!showEndSrc || !restartSrc) throw new Error('showEnd or restartGame not found');
  const context = {
    gameOver: false,
    endOverlay: null,
    spawnTimer: { removed: false, remove() { this.removed = true; } },
    falconActive: false,
    sideCText: null,
    reportLine1: { setVisible() { return this; } },
    reportLine2: { setVisible() { return this; } },
    reportLine3: { setVisible() { return this; } },
    tipText: { setVisible() { return this; } },
    paidStamp: { setVisible() { return this; } },
    lossStamp: { setVisible() { return this; } },
    money: 10,
    love: 10,
    moneyText: { setText() { return this; } },
    loveText: { setText() { return this; } },
    updateLevelDisplay() {},
    receipt: v => v,
    clearDialog() {},
    activeCustomer: null,
    queue: [],
    wanderers: [],
    servedCount: 0,
    sideCAlpha: 0,
    sideCFadeTween: null,
    showStartScreen() { context.started = true; },
    cleanupFloatingEmojis() {},
    hideOverlayTexts() {},
    dialogDrinkEmoji: {},
    truck: { setPosition() { return this; } },
    girl: { setPosition() { return this; }, setVisible() { return this; } },
    Phaser: { Actions: { Call(arr, cb) { arr.forEach(cb); } } },
    fnEnd: null
  };
  loadGameState(context);
  loadCustomerState(context);
  vm.createContext(context);
  vm.runInContext(`${showEndSrc}\nfnEnd=showEnd;\n${restartSrc}`, context);
  const showEnd = context.fnEnd;

  let pointerCb = null;
  const scene = {
    add: {
      rectangle() { return { setDepth() { return this; }, setStrokeStyle() { return this; }, destroy() { this.destroyed = true; } }; },
      text() { return { setOrigin() { return this; }, setDepth() { return this; }, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, destroy() { this.destroyed = true; } }; },
      zone(x, y, w, h) { return { setOrigin() { return this; }, setInteractive() { return this; }, on(event, cb) { if (event === 'pointerdown') pointerCb = cb; return this; }, width: w, height: h }; },
      image() { return { setScale() { return this; }, setDepth() { return this; }, destroy() {} }; }
    },
    tweens: { killAll() {} },
    time: { removeAllEvents() {} },
    scale: { width: 480 }
  };

  showEnd.call(scene, 'Game Over\nOut of coffee!');
  assert.strictEqual(context.gameOver, true, 'gameOver should be true');
  assert.ok(pointerCb, 'pointerdown handler not set');

  // simulate clicking Try Again
  pointerCb();

  assert.strictEqual(context.gameOver, false, 'gameOver not reset');
  assert.strictEqual(context.endOverlay, null, 'endOverlay not cleared');
  assert.ok(context.started, 'showStartScreen not called');
  console.log('showEnd and restartGame test passed');
}

async function testIntroSequence() {
  const puppeteer = require('puppeteer');
  const { PNG } = require('pngjs');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/?debug=1');
  await new Promise(r => setTimeout(r, 2000));

  const rect = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });


  const beforeBuf = await page.screenshot({ type: 'png' });

  const clickX = rect.x + 240 * (rect.w / 480);
  // click the start button near the bottom of the phone
  const clickY = rect.y + 508 * (rect.h / 640);
  await page.mouse.click(clickX, clickY);
  await new Promise(r => setTimeout(r, 3000));
  const afterBuf = await page.screenshot({ type: 'png' });
  await browser.close();

  const before = PNG.sync.read(beforeBuf);
  const after = PNG.sync.read(afterBuf);
  const pixelX = Math.round(rect.x + 240 * (rect.w / 480));
  const pixelY = Math.round(rect.y + 245 * (rect.h / 640));
  const idx = (pixelY * before.width + pixelX) * 4;
  const changed = before.data[idx] !== after.data[idx] ||
                  before.data[idx + 1] !== after.data[idx + 1] ||
                  before.data[idx + 2] !== after.data[idx + 2];
  if (!changed) throw new Error('truck sprite did not appear to move');
  console.log('intro sequence test passed');
}

async function testFirstOrderDialog() {
  const puppeteer = require('puppeteer');
  const { PNG } = require('pngjs');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  await page.goto('http://localhost:8080/?debug=1');
  await new Promise(r => setTimeout(r, 2000));

  const rect = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const beforeBuf = await page.screenshot({ type: 'png' });

  const clickX = rect.x + 240 * (rect.w / 480);
  const clickY = rect.y + 508 * (rect.h / 640);
  await page.mouse.click(clickX, clickY);
  // allow enough time for the first customer to reach the counter
  await new Promise(r => setTimeout(r, 12000));

  const startIndex = logs.findIndex(l => l.includes('showDialog start'));
  const endIndex = logs.findIndex(l => l.includes('showDialog end'));
  const earlyIndex = logs.findIndex(l => l.includes('showDialog early exit'));
  assert.ok(startIndex !== -1 && endIndex !== -1 && startIndex < endIndex,
            'showDialog logs missing or out of order');
  assert.strictEqual(earlyIndex, -1, 'showDialog early exit logged');

  const afterBuf = await page.screenshot({ type: 'png' });
  await browser.close();

  const before = PNG.sync.read(beforeBuf);
  const after = PNG.sync.read(afterBuf);

  function extractConst(file, name) {
    const code = fs.readFileSync(file, 'utf8');
    const re = new RegExp(`export\\s+(?:const|let|var)\\s+${name}\\s*=\\s*(\\d+)`);
    const m = re.exec(code);
    return m ? Number(m[1]) : null;
  }

  const uiPath = path.join(__dirname, '..', 'src', 'ui.js');
  let orderX = extractConst(uiPath, 'ORDER_X');
  const dialogY = extractConst(uiPath, 'DIALOG_Y');
  if (orderX === null) {
    orderX = extractConst(path.join(__dirname, '..', 'src', 'customers.js'), 'ORDER_X');
  }

  const pixelX = Math.round(rect.x + (orderX + 8) * (rect.w / 480));
  const pixelY = Math.round(rect.y + (dialogY + 17) * (rect.h / 640));
  const idx = (pixelY * before.width + pixelX) * 4;
  const changed = before.data[idx] !== after.data[idx] ||
                  before.data[idx + 1] !== after.data[idx + 1] ||
                  before.data[idx + 2] !== after.data[idx + 2];
  assert.ok(changed, 'order dialog not visible');
  console.log('first order dialog test passed');
}

async function run() {
  if (!SKIP_PUPPETEER) {
    const serverPath = require.resolve('http-server/bin/http-server');
    server = spawn(process.execPath, [serverPath, '-p', '8080', '-c-1'], { stdio: 'inherit' });

    // wait a bit for the server to start
    await new Promise(r => setTimeout(r, 1000));

    const errors = [];

    await new Promise((resolve) => {
      http.get('http://localhost:8080', res => {
        if (res.statusCode !== 200) errors.push(`Status ${res.statusCode}`);
        res.resume();
        res.on('end', resolve);
      }).on('error', err => {
        errors.push(err.message);
        resolve();
      });
    });

    if (errors.length) {
      if (DEBUG) console.error('Failed:', errors);
      await killServer();
      process.exit(1);
    }

    console.log('Game loaded without errors');
  } else {
    console.log('SKIP_PUPPETEER=1 set, skipping browser-based tests');
  }

  try {
    testSpawnCustomer();
    testSpawnCustomerQueuesWhenEmpty();
    testHandleActionSell();
    testShowStartScreen();
    testStartButtonPlaysIntro();
    testBlinkButton();
    testShowDialogButtons();
    testAnimateLoveChange();
    testScheduleNextSpawn();
    testSparrowRemovalOffscreen();
    testLureNextWandererQueueLimit();
    testShowEndRestart();
    if (!SKIP_PUPPETEER) {
      await testIntroSequence();
      await testFirstOrderDialog();
    }
  } finally {
    await killServer();
  }
}

run().catch(async err => {
  if (DEBUG) console.error(err);
  process.exitCode = 1;
  await killServer();
});
