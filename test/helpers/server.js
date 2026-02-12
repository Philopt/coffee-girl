const { spawn } = require('child_process');
const http = require('http');

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

async function startServer() {
  const serverPath = require.resolve('http-server/bin/http-server');
  server = spawn(process.execPath, [serverPath, '-p', '8080', '-c-1'], { stdio: 'inherit' });
  await new Promise(r => setTimeout(r, 1000));

  await new Promise((resolve, reject) => {
    http.get('http://localhost:8080', res => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode}`));
      } else {
        res.resume();
        res.on('end', resolve);
      }
    }).on('error', reject);
  });
}

process.on('SIGINT', () => {
  killServer().then(() => process.exit(1));
});
process.on('SIGTERM', () => {
  killServer().then(() => process.exit(1));
});

module.exports = { startServer, killServer };
