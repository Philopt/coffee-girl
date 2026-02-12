const assert = require('assert');
const { loadModuleExports } = require('../helpers/moduleLoader');

function runMoodUnitTests() {
  const CustomerState = {
    NORMAL: 'normal',
    BROKEN: 'broken',
    MENDING: 'mending',
    GROWING: 'growing',
    SPARKLING: 'sparkling',
    ARROW: 'arrow'
  };

  const { advanceMood, cycleMood, nextMood } = loadModuleExports('src/domain/mood.js', { CustomerState });

  const advanceCases = [
    [CustomerState.BROKEN, CustomerState.MENDING],
    [CustomerState.MENDING, CustomerState.NORMAL],
    [CustomerState.NORMAL, CustomerState.GROWING],
    [CustomerState.GROWING, CustomerState.SPARKLING],
    [CustomerState.SPARKLING, CustomerState.ARROW],
    [CustomerState.ARROW, CustomerState.ARROW]
  ];

  advanceCases.forEach(([from, to]) => {
    assert.strictEqual(advanceMood(from), to, `advanceMood(${from}) should be ${to}`);
    assert.strictEqual(nextMood(from), to, `nextMood alias should match advanceMood for ${from}`);
  });

  const cycleCases = [
    [CustomerState.BROKEN, CustomerState.MENDING],
    [CustomerState.MENDING, CustomerState.NORMAL],
    [CustomerState.NORMAL, CustomerState.GROWING],
    [CustomerState.GROWING, CustomerState.SPARKLING],
    [CustomerState.SPARKLING, CustomerState.ARROW],
    [CustomerState.ARROW, CustomerState.BROKEN]
  ];

  cycleCases.forEach(([from, to]) => {
    assert.strictEqual(cycleMood(from), to, `cycleMood(${from}) should be ${to}`);
  });

  assert.strictEqual(cycleMood('unknown-state'), CustomerState.NORMAL);
  assert.strictEqual(advanceMood('unknown-state'), 'unknown-state');
}

module.exports = { runMoodUnitTests };
