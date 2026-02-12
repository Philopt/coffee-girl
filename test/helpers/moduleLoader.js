const fs = require('fs');
const path = require('path');
const vm = require('vm');

function convertImportClause(clause) {
  const trimmed = clause.trim();
  if (trimmed.startsWith('{')) {
    const body = trimmed.slice(1, -1).trim();
    if (!body) return '';
    return body
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .map(part => {
        const pieces = part.split(/\s+as\s+/).map(v => v.trim());
        const local = pieces[1] || pieces[0];
        return `const ${local} = globalThis.${local};`;
      })
      .join('\n');
  }
  return `const ${trimmed} = globalThis.${trimmed};`;
}

function transpileEsmToCjs(source) {
  const exportMap = [];
  const code = source
    .replace(/^import\s+([^;]+)\s+from\s+['"][^'"]+['"];\s*$/gm, (_, clause) => convertImportClause(clause))
    .replace(/export\s+function\s+(\w+)\s*\(/g, (_, name) => {
      exportMap.push([name, name]);
      return `function ${name}(`;
    })
    .replace(/export\s+(let|var|const)\s+([^;=]+);/g, (_, kind, names) => {
      names.split(',').map(n => n.trim()).filter(Boolean).forEach(name => exportMap.push([name, name]));
      return `${kind} ${names};`;
    })
    .replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, (_, kind, name) => {
      exportMap.push([name, name]);
      return `${kind} ${name} =`;
    })
    .replace(/export\s+default\s+(\w+)\s*;?/g, (_, name) => {
      exportMap.push([name, 'default']);
      return '';
    })
    .replace(/export\s*\{([^}]+)\};?/g, (_, list) => {
      list.split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
        const [from, asName] = part.split(/\s+as\s+/).map(v => v.trim());
        exportMap.push([from, asName || from]);
      });
      return '';
    });

  const assigns = [...new Map(exportMap.map(([from, to]) => [to, from])).entries()]
    .map(([to, from]) => `${JSON.stringify(to)}: (typeof ${from} !== 'undefined' ? ${from} : undefined)`)
    .join(', ');

  return `${code}\nmodule.exports = { ${assigns} };`;
}

function loadModuleExports(relativePath, context = {}) {
  const filePath = path.join(__dirname, '..', '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = transpileEsmToCjs(source);
  const scriptContext = vm.createContext({ module: { exports: {} }, exports: {}, ...context });
  vm.runInContext(transformed, scriptContext, { filename: relativePath });
  return scriptContext.module.exports;
}

module.exports = { loadModuleExports };
