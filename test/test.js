const { spawn } = require('child_process');
const path = require('path');
const puppeteer = require('puppeteer');

async function run() {
  const serverPath = path.join(__dirname, '..', 'node_modules', '.bin', 'http-server');
  const server = spawn(serverPath, ['-p', '8080', '-c-1'], { stdio: 'inherit' });

  // wait a bit for the server to start
  await new Promise(r => setTimeout(r, 1000));

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const errors = [];
  const failed = [];

  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('requestfailed', req => {
    failed.push(`${req.url()} - ${req.failure().errorText}`);
  });

  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
  await page.waitForTimeout(1000);

  await browser.close();
  server.kill();

  if (errors.length || failed.length) {
    console.error('Console errors:', errors);
    console.error('Failed requests:', failed);
    process.exit(1);
  } else {
    console.log('Game loaded without errors');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
