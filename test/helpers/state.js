const { loadModuleExports } = require('./moduleLoader');

function loadGameState(context) {
  const { GameState } = loadModuleExports('src/state.js');
  for (const [k, v] of Object.entries(GameState)) {
    if (!(k in context)) context[k] = v;
  }
  context.GameState = context;
}

function loadCustomerState(context) {
  const { CustomerState } = loadModuleExports('src/constants.js');
  context.CustomerState = CustomerState;
}

function loadBirdState(context) {
  const { BirdState } = loadModuleExports('src/constants.js');
  context.BirdState = BirdState;
}

module.exports = { loadGameState, loadCustomerState, loadBirdState };
