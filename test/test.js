const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const BUTTON_WIDTH = 140;
const BUTTON_HEIGHT = 80;

function testBlinkButton() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const start = code.indexOf('function blinkButton');
  if (start === -1) throw new Error('blinkButton not found');
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
  const match = code.slice(start, end);
  function RectStub(x, y, w, h) {
    return { x, y, width: w, height: h };
  }
  RectStub.Contains = () => true;
  const context = { Phaser: { Geom: { Rectangle: RectStub } } };
  vm.createContext(context);
  context.blinkBtn = null;
  vm.runInContext('const dur=v=>v;\n' + match + '\nblinkBtn=blinkButton;', context);
  const blinkButton = context.blinkBtn;
  let disableCalled = false;
  let setArgs = null;
  const btn = {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    input: { enabled: true },
    disableInteractive() { disableCalled = true; this.input.enabled = false; },
    setInteractive(arg1, arg2) {
      if (arg1 && arg1.hitArea) {
        setArgs = { rect: arg1.hitArea, cb: arg1.hitAreaCallback, useHand: arg1.useHandCursor };
      } else {
        setArgs = { rect: arg1, cb: arg2 };
      }
      this.input.enabled = true;
    }
  };
  const scene = { tweens: { add(cfg) { if (cfg.onComplete) cfg.onComplete(); return {}; } } };
  blinkButton.call(scene, btn);
  assert(disableCalled, 'disableInteractive not called');
  assert.strictEqual(btn.input.enabled, true, 'button not re-enabled');
  assert.ok(setArgs && setArgs.rect && setArgs.cb, 'setInteractive should be called with shape');
  assert.strictEqual(setArgs.useHand, true, 'useHandCursor should be true');
  assert.strictEqual(setArgs.rect.x, -btn.width / 2, 'hitbox x not centered');
  assert.strictEqual(setArgs.rect.y, -btn.height / 2, 'hitbox y not centered');
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
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  assert(code.includes("start-overlay"), "start overlay element missing");
  assert(code.includes("start-button"), "start button element missing");
  console.log("showStartScreen DOM references test passed");
}

function testStartButtonPlaysIntro() {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  assert(/startButton\.onclick/.test(code), "start button click handler missing");
  assert(/playIntro\.call\(scene\)/.test(code), "playIntro not invoked from handler");
  console.log("start button triggers playIntro test passed");
}


function testShowDialogButtons() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const match = /function showDialog\(\)[\s\S]*?btnRef\.setVisible\(true\);[\s\S]*?\}/.exec(code);
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
    btnSell: makeObj(),
    btnGive: makeObj(),
    btnRef: makeObj(),
    tipText: makeObj(),
    activeBubble: null,
    articleFor: () => 'a',
    scaleForY: () => 1,
    ORDER_X: 230,
    ORDER_Y: 310,
    FRIEND_OFFSET: 40,
    queue: [],
    activeCustomer: null,
    drawDialogBubble: () => {},
  };
  const scene = {
    add: { text() { return makeObj(); }, rectangle() { return makeObj(); }, graphics() { return makeObj(); } },
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

async function testIntroSequence() {
  const puppeteer = require('puppeteer');
  const { PNG } = require('pngjs');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8080');
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

async function run() {
  const serverPath = require.resolve('http-server/bin/http-server');
  const server = spawn(process.execPath, [serverPath, '-p', '8080', '-c-1'], { stdio: 'inherit' });

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
    console.error('Failed:', errors);
    server.kill();
    process.exit(1);
  } else {
    console.log('Game loaded without errors');
    testSpawnCustomer();
    testHandleActionSell();
    testShowStartScreen();
    testStartButtonPlaysIntro();
    testBlinkButton();
    testShowDialogButtons();
    await testIntroSequence();
    server.kill();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
