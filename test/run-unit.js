const { runUnitTests } = require('./unit/core.test');

try {
  runUnitTests();
} catch (err) {
  console.error(err);
  process.exit(1);
}
