const { runUnitTests } = require('./unit/core.test');
const { runModuleLoaderUnitTests } = require('./unit/moduleLoader.test');
const { runMoodUnitTests } = require('./unit/mood.test');

try {
  runUnitTests();
  runModuleLoaderUnitTests();
  runMoodUnitTests();
} catch (err) {
  console.error(err);
  process.exit(1);
}
