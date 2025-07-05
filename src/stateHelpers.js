import { GameState } from './state.js';

export function setActiveCustomer(cust) {
  GameState.activeCustomer = cust;
}

export function addWanderer(cust) {
  GameState.wanderers.push(cust);
}

export function updateMoney(delta) {
  GameState.money = +(GameState.money + delta).toFixed(2);
}
