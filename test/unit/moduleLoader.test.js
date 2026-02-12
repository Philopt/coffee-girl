const assert = require('assert');
const vm = require('vm');
const { transpileEsmToCjs } = require('../helpers/moduleLoader');

function runTranspiled(source, context = {}) {
  const transformed = transpileEsmToCjs(source);
  const scriptContext = vm.createContext({ module: { exports: {} }, exports: {}, ...context });
  vm.runInContext(transformed, scriptContext);
  return scriptContext.module.exports;
}

function testNamespaceImport() {
  const source = `
    import * as Foo from 'pkg';
    export const answer = Foo.value;
  `;
  const exportsObj = runTranspiled(source, { Foo: { value: 42 } });
  assert.strictEqual(exportsObj.answer, 42);
}

function testDefaultImport() {
  const source = `
    import Coffee from 'pkg';
    export default Coffee;
  `;
  const exportsObj = runTranspiled(source, { Coffee: 'latte' });
  assert.strictEqual(exportsObj.default, 'latte');
}

function testNamedImportAlias() {
  const source = `
    import { a as b } from 'pkg';
    export const value = b;
  `;
  const exportsObj = runTranspiled(source, { b: 7 });
  assert.strictEqual(exportsObj.value, 7);
}

function testMixedDefaultAndNamedImports() {
  const source = `
    import MainDrink, { syrup as shot, foam } from 'pkg';
    export const drink = MainDrink;
    export const extras = shot + foam;
  `;
  const exportsObj = runTranspiled(source, { MainDrink: 'mocha', shot: 2, foam: 1 });
  assert.strictEqual(exportsObj.drink, 'mocha');
  assert.strictEqual(exportsObj.extras, 3);
}

function runModuleLoaderUnitTests() {
  testNamespaceImport();
  testDefaultImport();
  testNamedImportAlias();
  testMixedDefaultAndNamedImports();
}

module.exports = { runModuleLoaderUnitTests };
