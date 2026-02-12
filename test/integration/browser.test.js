const assert = require('assert');
const { PNG } = require('pngjs');
const { startServer, killServer } = require('../helpers/server');

async function testIntroSequence() {
  const puppeteer = require('puppeteer');
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
  await page.mouse.click(rect.x + 240 * (rect.w / 480), rect.y + 508 * (rect.h / 640));
  await new Promise(r => setTimeout(r, 3000));
  const afterBuf = await page.screenshot({ type: 'png' });
  await browser.close();

  const before = PNG.sync.read(beforeBuf);
  const after = PNG.sync.read(afterBuf);
  const pixelX = Math.round(rect.x + 240 * (rect.w / 480));
  const pixelY = Math.round(rect.y + 245 * (rect.h / 640));
  const idx = (pixelY * before.width + pixelX) * 4;
  const changed = before.data[idx] !== after.data[idx] || before.data[idx + 1] !== after.data[idx + 1] || before.data[idx + 2] !== after.data[idx + 2];
  assert.ok(changed, 'truck sprite did not appear to move');
}

async function testFirstOrderDialog() {
  const puppeteer = require('puppeteer');
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
  await page.mouse.click(rect.x + 240 * (rect.w / 480), rect.y + 508 * (rect.h / 640));
  await new Promise(r => setTimeout(r, 12000));

  const startIndex = logs.findIndex(l => l.includes('showDialog start'));
  const endIndex = logs.findIndex(l => l.includes('showDialog end'));
  assert.ok(startIndex !== -1 && endIndex !== -1 && startIndex < endIndex);

  const afterBuf = await page.screenshot({ type: 'png' });
  await browser.close();

  const before = PNG.sync.read(beforeBuf);
  const after = PNG.sync.read(afterBuf);
  const pixelX = Math.round(rect.x + (230 + 8) * (rect.w / 480));
  const pixelY = Math.round(rect.y + (400 + 17) * (rect.h / 640));
  const idx = (pixelY * before.width + pixelX) * 4;
  const changed = before.data[idx] !== after.data[idx] || before.data[idx + 1] !== after.data[idx + 1] || before.data[idx + 2] !== after.data[idx + 2];
  assert.ok(changed, 'order dialog not visible');
}

async function runIntegrationTests() {
  if (process.env.SKIP_PUPPETEER === '1') {
    console.log('SKIP_PUPPETEER=1 set, skipping browser-based tests');
    return;
  }

  await startServer();
  try {
    await testIntroSequence();
    await testFirstOrderDialog();
    console.log('Integration tests passed');
  } finally {
    await killServer();
  }
}

module.exports = { runIntegrationTests };
