const { runUnitTests } = require('./unit/core.test');
const { runModuleLoaderUnitTests } = require('./unit/moduleLoader.test');

try {
  runUnitTests();
  runModuleLoaderUnitTests();
} catch (err) {
  console.error(err);
  process.exit(1);
}
