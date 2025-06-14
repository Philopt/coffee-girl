const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function testBlinkButton() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const match = /function blinkButton\(btn, onComplete\)[\s\S]*?\n\s*\}\);\n\s*\}/.exec(code);
  if (!match) throw new Error('blinkButton not found');
  const context = {};
  vm.createContext(context);
  context.blinkBtn = null;
  vm.runInContext('const dur=v=>v;\n' + match[0] + '\nblinkBtn=blinkButton;', context);
  const blinkButton = context.blinkBtn;
  let disableCalled = false;
  const btn = {
    input: { enabled: true },
    disableInteractive() { disableCalled = true; this.input.enabled = false; },
    setInteractive() { this.setInteractiveCalled = true; this.input.enabled = true; }
  };
  const scene = { tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return {}; } } };
  blinkButton.call(scene, btn);
  assert(disableCalled, 'disableInteractive not called');
  assert.strictEqual(btn.input.enabled, true, 'button not re-enabled');
  assert.ok(btn.setInteractiveCalled, 'setInteractive should be called to re-enable');
  console.log('blinkButton interactivity test passed');
}

function testSpawnCustomer() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const match = /function spawnCustomer\(\)[\s\S]*?\n\s*\}\n(?=\s*function)/.exec(code);
  if (!match) throw new Error('spawnCustomer not found');
  const context = {
    Phaser: { Math: { Between: (min, max) => min }, Utils: { Array: { GetRandom: a => a[0] } } },
    wanderers: [],
    gameOver: false,
    spawnCount: 0,
    maxWanderers: () => 5,
    scheduleNextSpawn: () => {},
    lureNextWanderer: () => {},
    keys: ['c1'],
    MENU: [{ name: 'Coffee', price: 5 }],
    WANDER_TOP: 0,
    WANDER_BOTTOM: 10,
    scaleForY: () => 1,
    dur: v => v,
    fn: null
  };
  vm.createContext(context);
  vm.runInContext(match[0] + '\nfn=spawnCustomer;', context);
  const spawnCustomer = context.fn;
  const scene = {
    add: {
      sprite() { return { setScale() { return this; }, setDepth() { return this; }, destroy() {} }; }
    },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return { progress: 0 }; } }
  };
  spawnCustomer.call(scene);
  assert.strictEqual(context.wanderers.length, 1, 'customer not added to wanderers');
  console.log('spawnCustomer adds wanderer test passed');
}

function testHandleActionSell() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const recMatch = /function receipt\([^)]*\)[\s\S]*?\n\s*\}/.exec(code);
  const actMatch = /function handleAction\(type\)[\s\S]*?\n\s*\}\n(?=\s*function animateLoveChange)/.exec(code);
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
    Phaser: { Math: { Between: () => 1, Clamp: (x, l, h) => Math.max(l, Math.min(h, x)) }, Utils: { Array: { GetRandom: a => a[0] } } },
    moveQueueForward: () => {},
    showFalconAttack: () => {},
    showCustomerRevolt: () => {},
    showEnd: () => {},
    scheduleNextSpawn: () => {},
    updateSideC: () => {},
    clearDialog: () => {},
    animateStatChange: () => {},
    flashMoney: () => {},
    moneyText: { x: 0, y: 0, width: 50, setText() { return this; } },
    loveText: { setText() { return this; } },
    reportLine1: { setStyle() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setVisible() { return this; }, setColor() { return this; } },
    reportLine2: { setStyle() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setVisible() { return this; }, setColor() { return this; } },
    reportLine3: { setStyle() { return this; }, setText() { return this; }, setPosition() { return this; }, setOrigin() { return this; }, setAlpha() { return this; }, setVisible() { return this; }, setColor() { return this; } },
    dialogPriceValue: { setVisible() { return this; }, setDepth() { return this; }, setText() { return this; }, setPosition() { return this; }, setScale() { return this; }, setAlpha() { return this; }, setColor() { return this; } },
    paidStamp: { setText() { return this; }, setScale() { return this; }, setPosition() { return this; }, setAngle() { return this; }, setVisible() { return this; } },
    tipText: { setText() { return this; }, setScale() { return this; }, setPosition() { return this; }, setVisible() { return this; } },
    dialogBg: { setVisible() { return this; } },
    dialogText: { setVisible() { return this; } },
    supers: {},
    fn: null
  };
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
  const cust = { sprite, orders: [{ coins: 10, req: 'Coffee', price: 5, qty: 1 }], atOrder: true };
  context.activeCustomer = cust;
  context.queue = [cust];
  handleAction.call(scene, 'sell');
  assert.strictEqual(context.money, 25.75, 'money not updated correctly');
  assert.strictEqual(context.love, 11, 'love not updated correctly');
  console.log('handleAction("sell") update test passed');
}

function testShowStartScreen() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const match = /function showStartScreen\(scene\)[\s\S]*?\n\s*\}\);\n\s*\}/.exec(code);
  if (!match) throw new Error('showStartScreen not found');
  const context = {};
  vm.createContext(context);
  context.fn = null;
  vm.runInContext('let startOverlay,startButton;const playIntro=()=>{};\n' + match[0] + '\nfn=showStartScreen;', context);
  const showStartScreen = context.fn;
  const calls = { rects: 0, text: null };
  const scene = {
    add: {
      rectangle() { calls.rects++; return { setDepth() { return this; } }; },
      text(x, y, txt, style) {
        const obj = {
          setOrigin() { return obj; },
          setDepth() { return obj; },
          setInteractive() { obj.interactive = true; return obj; },
          on() { return obj; }
        };
        calls.text = { txt, obj };
        return obj;
      }
    }
  };
  showStartScreen.call(scene);
  assert.strictEqual(calls.rects, 1, 'start overlay not created');
  assert.ok(calls.text && calls.text.obj.interactive, 'start button not interactive');
  assert.strictEqual(calls.text.txt, 'Start Shift', 'start button text mismatch');
  console.log('showStartScreen test passed');
}

function testShowDialogButtons() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const match = /function showDialog\(\)[\s\S]*?iconRef\.setVisible\(true\);\n\s*\}/.exec(code);
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
    destroy() { this.destroyed = true; },
  });
  const context = {
    dialogBg: makeObj(),
    dialogText: makeObj(),
    dialogCoins: makeObj(),
    dialogPriceLabel: makeObj(),
    dialogPriceValue: makeObj(),
    btnSell: makeObj(),
    btnGive: makeObj(),
    btnRef: makeObj(),
    iconSell: makeObj(),
    iconGive: makeObj(),
    iconRef: makeObj(),
    tipText: makeObj(),
    activeBubble: null,
    articleFor: () => 'a',
    scaleForY: () => 1,
    ORDER_X: 230,
    ORDER_Y: 310,
    FRIEND_OFFSET: 40,
    queue: [],
    activeCustomer: null,
  };
  const scene = {
    add: { text() { return makeObj(); }, rectangle() { return makeObj(); } },
    tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return {}; } },
  };
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

async function run() {
  const serverPath = require.resolve('http-server/bin/http-server');
  const server = spawn(process.execPath, [serverPath, '-p', '8080', '-c-1'], { stdio: 'inherit' });

  // wait a bit for the server to start
  await new Promise(r => setTimeout(r, 1000));

  const errors = [];

  await new Promise((resolve, reject) => {
    http.get('http://localhost:8080', res => {
      if (res.statusCode !== 200) errors.push(`Status ${res.statusCode}`);
      res.resume();
      res.on('end', resolve);
    }).on('error', err => {
      errors.push(err.message);
      resolve();
    });
  });
  server.kill();

  if (errors.length) {
    console.error('Failed:', errors);
    process.exit(1);
  } else {
    console.log('Game loaded without errors');
    testSpawnCustomer();
    testHandleActionSell();
    testShowStartScreen();
    testBlinkButton();
    testShowDialogButtons();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
