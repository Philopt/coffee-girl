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
    testBlinkButton();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
