const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const report = JSON.parse(fs.readFileSync('import-reports/salmon-conflict-resolution-2026-10-14.json', 'utf8'));
const csv = fs.readFileSync('import-reports/RAMA Customer Categories - Ready to Import.csv', 'utf8');
let writes = 0;
const context = {
  location: { origin: report.host },
  window: {},
  localStorage: { getItem: () => 'test-token' },
  console: { table() {}, log() {}, error() {} },
  setTimeout: fn => fn(),
  Blob,
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  confirm: () => true,
  document: {
    body: { append() {} },
    createElement(tag) {
      return tag === 'input'
        ? { style: {}, files: [{ name: 'ready.csv', text: async () => csv }], remove() {}, click() { this.onchange(); } }
        : { click() {} };
    }
  },
  fetch: async (path, options) => {
    if (options.method !== 'GET') { writes++; throw new Error('Unexpected write on repeated import'); }
    const data = path === '/api/categories' ? report.after : path === '/api/query-types' ? report.types : null;
    assert.ok(data, 'Expected API endpoint');
    return { ok: true, json: async () => data };
  }
};
vm.runInNewContext(fs.readFileSync('import-reports/category-csv-browser.js', 'utf8'), context);
(async () => {
  const preview = await context.window.categoryCsv.preview();
  assert.equal(preview.csvRows, 124);
  assert.equal(preview.distinctEntries, 194);
  assert.equal(preview.existingMatches, 194);
  assert.equal(preview.newEntries, 0);
  const result = await context.window.categoryCsv.import();
  assert.equal(result.completeRows, 124);
  assert.equal(result.incompleteRows, 0);
  assert.equal(writes, 0);
  console.log('Passed: prepared CSV verifies all 124 paths; repeating import requires zero writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
