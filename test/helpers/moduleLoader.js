const fs = require('fs');
const path = require('path');
const vm = require('vm');

function parseImportClause(clause) {
  const trimmed = clause.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('*')) {
    const match = trimmed.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    return match ? [match[1]] : [];
  }

  const parts = [];
  let cursor = 0;
  const firstBrace = trimmed.indexOf('{');

  if (firstBrace === -1) {
    parts.push(trimmed);
  } else {
    const beforeBrace = trimmed.slice(0, firstBrace).replace(/,\s*$/, '').trim();
    if (beforeBrace) parts.push(beforeBrace);
    const namedBlock = trimmed.slice(firstBrace + 1, trimmed.lastIndexOf('}'));
    namedBlock
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .forEach(part => parts.push(part));
    cursor = trimmed.lastIndexOf('}') + 1;
    const afterBrace = trimmed.slice(cursor).replace(/^,/, '').trim();
    if (afterBrace) parts.push(afterBrace);
  }

  return parts
    .map(part => {
      if (part.startsWith('*')) {
        const starMatch = part.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
        return starMatch ? starMatch[1] : '';
      }
      if (part.includes(' as ')) {
        const pieces = part.split(/\s+as\s+/).map(v => v.trim());
        return pieces[1] || pieces[0];
      }
      return part.trim();
    })
    .filter(Boolean);
}

function convertImportClause(clause) {
  const locals = parseImportClause(clause);
  return locals.map(local => `const ${local} = globalThis.${local};`).join('\n');
}

function transpileEsmToCjs(source) {
  const exportMap = [];
  const code = source
    .replace(/^\s*import\s+([^;]+)\s+from\s+['"][^'"]+['"];\s*$/gm, (_, clause) => convertImportClause(clause))
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

module.exports = { loadModuleExports, transpileEsmToCjs };
