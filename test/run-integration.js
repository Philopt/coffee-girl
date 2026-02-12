const { runIntegrationTests } = require('./integration/browser.test');

runIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
