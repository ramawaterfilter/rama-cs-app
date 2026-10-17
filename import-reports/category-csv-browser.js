/* Paste this whole file into DevTools Console on your hosted Categories page.
 * Loading it does not write data. Run await categoryCsv.preview() first.
 */
(() => {
  'use strict';
  const HOST = 'https://salmon-mule-212046.hostingersite.com';
  if (location.origin !== HOST) throw new Error(`Open ${HOST} first.`);
  if (window.categoryCsv) throw new Error('categoryCsv is already loaded. Refresh to replace it after saving your report.');
  const columns = ['Type of Query', 'Query Category', 'Sub Category', 'Child Category'];
  const levels = ['category', 'subcategory', 'child'];
  const norm = value => String(value).trim().toLowerCase();
  const key = (queryType, level, name) => JSON.stringify([Number(queryType), level, norm(name)]);
  let state = null;
  let busy = false;

  function parseCsv(text) {
    const records = [];
    let row = [], field = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else field += c;
      } else if (c === ',') {
        row.push(field); field = ''; closed = false;
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); records.push(row); row = []; field = ''; closed = false;
      } else if (c === '"' && !field && !closed) quoted = true;
      else {
        if (closed || c === '"') throw new Error('Invalid CSV quoting. Export the sheet as CSV again.');
        field += c;
      }
    }
    if (quoted) throw new Error('Unclosed quoted CSV field.');
    if (field || row.length || closed) { row.push(field); records.push(row); }
    const header = records.shift()?.map(s => s.trim()) || [];
    for (const c of columns) {
      if (header.filter(h => h === c).length !== 1) throw new Error(`Expected one column named: ${c}`);
    }
    const rows = records.map((r, i) => ({r, csvRow: i + 2}))
      .filter(({r}) => r.some(s => s.trim()))
      .map(({r, csvRow}) => {
        if (r.length !== header.length) throw new Error(`Wrong number of columns in CSV record ${csvRow}.`);
        const values = columns.map(c => r[header.indexOf(c)].trim());
        if (values.some(v => !v || v.length > 255)) throw new Error(`Blank or overlong name in CSV record ${csvRow}.`);
        return {csvRow, values};
      });
    if (!rows.length) throw new Error('CSV has no data rows.');
    return rows;
  }

  function chooseFile(accept) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept;
      input.style.display = 'none'; document.body.append(input);
      input.onchange = () => { const file = input.files[0]; input.remove(); file ? resolve(file) : reject(new Error('No file selected.')); };
      input.oncancel = () => { input.remove(); reject(new Error('File selection cancelled.')); };
      input.click();
    });
  }

  async function api(path, method = 'GET', payload) {
    const token = localStorage.getItem('auth_token');
    if (!token || token === 'null' || token === 'undefined') throw new Error('Please log in first.');
    const response = await fetch('/api/' + path, {
      method,
      headers: {Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      ...(payload ? {body: JSON.stringify(payload)} : {})
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  const shape = c => JSON.stringify([c.id, c.name, c.type, c.query_type_id,
    (c.parents || []).map(p => p.id).sort((a, b) => a - b)]);
  const catalogShape = cats => JSON.stringify(cats.map(shape).sort());
  function categoryMap(cats) {
    const map = new Map();
    for (const c of cats) {
      const k = key(c.query_type_id, c.type, c.name);
      if (map.has(k)) throw new Error(`Ambiguous existing category: ${c.name}`);
      map.set(k, c);
    }
    return map;
  }

  function download() {
    if (!state) throw new Error('No preview or report to download.');
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url;
    a.download = `category-import-${state.phase}-${Date.now()}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exclusive(work) {
    if (busy) throw new Error('Another category operation is still running.');
    busy = true;
    try { return await work(); } finally { busy = false; }
  }

  async function preview() {
    return exclusive(async () => {
      if (state && state.phase !== 'preview') throw new Error('Save the current report and refresh before starting another import.');
      const file = await chooseFile('.csv');
      const rows = parseCsv(await file.text());
      const [types, before] = await Promise.all([api('query-types'), api('categories')]);
      const existing = categoryMap(before), nodes = new Map();
      for (const row of rows) {
        const matches = types.filter(t => norm(t.name) === norm(row.values[0]));
        if (matches.length !== 1) throw new Error(`Missing or ambiguous query type: ${row.values[0]}. Create it through the app first.`);
        let parentKey = null;
        levels.forEach((level, i) => {
          const name = row.values[i + 1], k = key(matches[0].id, level, name);
          if (!nodes.has(k)) nodes.set(k, {key: k, name, type: level, query_type_id: matches[0].id, parentKeys: []});
          const n = nodes.get(k);
          if (parentKey && !n.parentKeys.includes(parentKey)) n.parentKeys.push(parentKey);
          parentKey = k;
        });
      }
      state = {version: 1, host: HOST, file: file.name, time: new Date().toISOString(), phase: 'preview',
        rows, types, before, nodes: [...nodes.values()].sort((a, b) => levels.indexOf(a.type) - levels.indexOf(b.type)), journal: [], results: []};
      const summary = {csvRows: rows.length, distinctEntries: nodes.size,
        existingMatches: [...nodes.keys()].filter(k => existing.has(k)).length,
        newEntries: [...nodes.keys()].filter(k => !existing.has(k)).length};
      console.table(summary);
      console.table(state.nodes.map(n => ({name: n.name, level: n.type, action: existing.has(n.key) ? 'Reuse / add missing parents' : 'Create'})));
      console.log('Preview only. No writes. Run await categoryCsv.import() to proceed. Similar-name rules are checked by the server during import.');
      return summary;
    });
  }

  async function verify() {
    const cats = await api('categories'), map = categoryMap(cats);
    const incomplete = [];
    for (const row of state.rows) {
      const qt = state.types.find(t => norm(t.name) === norm(row.values[0]));
      const path = levels.map((l, i) => map.get(key(qt.id, l, row.values[i + 1])));
      const ok = path.every(Boolean) && path.slice(1).every((c, i) => c.parents.some(p => p.id === path[i].id));
      if (!ok) incomplete.push(row);
    }
    state.verification = {completeRows: state.rows.length - incomplete.length, incompleteRows: incomplete.length, incomplete};
    return state.verification;
  }

  async function runImport() {
    return exclusive(async () => {
      if (!state || state.phase !== 'preview') throw new Error('Run preview() first. An import cannot be started twice from the same preview.');
      const current = await api('categories');
      if (catalogShape(current) !== catalogShape(state.before)) throw new Error('Categories changed since preview. Run preview() again.');
      if (!confirm(`Import ${state.rows.length} CSV rows into ${HOST}? Existing entries will be kept. Some rows may be rejected by the API.`)) return 'Cancelled';
      download(); // Original category snapshot; no token is included.
      state.phase = 'importing';
      const map = categoryMap(current);
      try {
        for (const n of state.nodes) {
          const prior = map.get(n.key);
          const parents = n.parentKeys.map(k => map.get(k)?.id).filter(Boolean);
          if (n.parentKeys.length && !parents.length) { state.results.push({...n, status: 'blocked', reason: 'Required parent was rejected'}); continue; }
          const wanted = [...new Set([...(prior?.parents || []).map(p => p.id), ...parents])];
          if (prior && wanted.length === prior.parents.length) { state.results.push({...n, id: prior.id, status: 'reused'}); continue; }
          const path = 'categories' + (prior ? '/' + prior.id : '');
          const payload = prior ? {parent_ids: wanted} : {name: n.name, type: n.type, query_type_id: n.query_type_id, parent_ids: wanted};
          state.pending = {path, method: prior ? 'PUT' : 'POST', payload};
          try {
            const saved = await api(path, state.pending.method, payload);
            if (!saved.id || !Array.isArray(saved.parents)) throw new Error('Unexpected response; inspect the report before retrying.');
            state.journal.push({before: prior || null, after: saved});
            map.set(n.key, saved);
            state.results.push({...n, id: saved.id, status: prior ? 'linked' : 'created'});
            delete state.pending;
          } catch (e) {
            if (e.status !== 422) throw e; // Stop on authentication, network or unexpected errors.
            state.results.push({...n, status: 'rejected', reason: e.message});
            delete state.pending;
          }
          console.log(`Processed ${state.results.length}/${state.nodes.length}: ${n.name}`);
        }
        state.phase = 'finished';
        await verify();
        console.table(state.results.filter(r => ['rejected', 'blocked'].includes(r.status)));
        console.log('Verification:', state.verification);
      } catch (e) {
        state.phase = 'interrupted'; state.error = e.message;
        console.error('Stopped:', e.message, 'A pending request may have reached the server. Save the report and inspect it before retrying.');
        throw e;
      } finally { download(); }
      return state.verification;
    });
  }

  async function loadReport() {
    return exclusive(async () => {
      if (state) throw new Error('Save the current report and refresh before loading another report.');
      const file = await chooseFile('.json');
      const report = JSON.parse(await file.text());
      if (report.version !== 1 || report.host !== HOST || !Array.isArray(report.before) || !Array.isArray(report.journal)) throw new Error('Not a report produced by this script.');
      state = report;
      return {phase: state.phase, changes: state.journal.length};
    });
  }

  async function rollback() {
    return exclusive(async () => {
      if (!state?.journal.length) throw new Error('No recorded changes to undo.');
      if (state.pending) throw new Error('An uncertain request is recorded. Inspect the report and server data before rollback.');
      const current = await api('categories');
      // Require the complete category graph to match this import's expected state.
      // This prevents removing categories or links changed by somebody afterwards.
      const expected = new Map(state.before.map(c => [c.id, c]));
      for (const change of state.journal) expected.set(change.after.id, change.after);
      if (catalogShape(current) !== catalogShape([...expected.values()])) throw new Error('Categories have changed since the import. Stop and review before rollback.');
      if (!confirm(`Undo ${state.journal.length} recorded changes? Use this immediately after an import, before the new categories are used on tickets or products.`)) return 'Cancelled';
      state.phase = 'rolling-back'; state.rollbackResults = [];
      try {
        for (const change of [...state.journal].reverse()) {
          state.pending = {rollbackId: change.after.id};
          if (change.before) await api('categories/' + change.after.id, 'PUT', {parent_ids: change.before.parents.map(p => p.id)});
          else await api('categories/' + change.after.id, 'DELETE');
          state.rollbackResults.push(change.after.id);
          delete state.pending;
        }
        state.rollbackVerified = catalogShape(await api('categories')) === catalogShape(state.before);
        state.phase = 'rolled-back';
        if (!state.rollbackVerified) throw new Error('Rollback verification differs from the snapshot. Review the report.');
        console.log('Rollback verified: original category names and parent relationships restored. Activity logs and update timestamps remain.');
      } catch (e) { state.error = e.message; throw e; }
      finally { download(); }
      return {restored: state.rollbackVerified};
    });
  }

  window.categoryCsv = {preview, import: runImport, downloadReport: download, loadReport, rollback};
  console.log('Loaded without writing data. Next: await categoryCsv.preview()');
})();
