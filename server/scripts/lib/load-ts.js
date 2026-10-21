/**
 * Carrega um módulo TypeScript puro (sem imports) do frontend em Node, via esbuild.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const esbuild = require('esbuild');

function loadTsModule(file) {
  const absolute = path.resolve(file);
  const { code } = esbuild.transformSync(fs.readFileSync(absolute, 'utf8'), {
    loader: 'ts',
    format: 'cjs',
    target: 'node18',
    sourcefile: absolute,
  });
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  mod._compile(code, absolute);
  return mod.exports;
}

module.exports = { loadTsModule };
