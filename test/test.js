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
  assert.ok(!btn.setInteractiveCalled, 'setInteractive should not be called');
  console.log('blinkButton interactivity test passed');
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
  const serverPath = path.join(__dirname, '..', 'node_modules', '.bin', 'http-server');
  const server = spawn(serverPath, ['-p', '8080', '-c-1'], { stdio: 'inherit' });

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
    testShowStartScreen();
    testBlinkButton();
    testShowDialogButtons();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
