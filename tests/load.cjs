// Laadt de browsermodules in Node (ze hangen alles aan globalThis.Blok).
const path = require('node:path');
const MODULES = ['markers', 'font-data', 'font', 'catalog', 'program', 'render', 'zip', 'sheets', 'recognize', 'structure',
  'validate', 'interpreter', 'assignments', 'ai', 'sb3'];
for (const m of MODULES) require(path.join(__dirname, '..', 'js', m + '.js'));
module.exports = globalThis.Blok;
