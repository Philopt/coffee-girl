const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

async function run() {
  const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'PressStart2P-Regular.ttf');
  if (!fs.existsSync(fontPath)) {
    const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf';
    const res = spawnSync('curl', ['-L', '-o', fontPath, url]);
    if (res.status !== 0) {
      console.warn('Font download failed');
    }
  }

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

  await new Promise(resolve => {
    http.get('http://localhost:8080/assets/fonts/PressStart2P-Regular.ttf', res => {
      if (res.statusCode !== 200) errors.push(`Font Status ${res.statusCode}`);
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
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
