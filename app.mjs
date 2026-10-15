import { PROJECTS, createInitialState, sourceFiles, simulateBackup } from './model.mjs';
import { makeZip } from './zip.mjs';

const $ = (id) => document.getElementById(id);
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes = (size) => size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const totalSize = (files) => files.reduce((n, f) => n + f.size, 0);
const storageKey = 'forma-backup-web-demo-v1';
let state = createInitialState();
let selected = PROJECTS.map((p) => p.id);
let mode = 'sync';
let retention = 3;
let snapshotId = null;
let running = false;
let toastTimer;
let logText = 'Forma Backup browser demo initialized.\nAll project data and transfers are synthetic.\n';
const expanded = {source: new Set([PROJECTS[0].id]), backup: new Set([PROJECTS[0].id])};
let previewUrl = null;

try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey));
  if (saved?.schema === 1 && saved.state && [0, 1, 2].includes(saved.state.generation)
    && Array.isArray(saved.state.syncFiles) && Array.isArray(saved.state.snapshots) && Array.isArray(saved.state.runs)
    && Array.isArray(saved.selected) && saved.selected.every((id) => PROJECTS.some((p) => p.id === id))) {
    state = saved.state;
    selected = saved.selected;
    mode = saved.mode === 'versioned' ? 'versioned' : 'sync';
    retention = [2,3,5].includes(saved.retention) ? saved.retention : 3;
    logText = typeof saved.logText === 'string' ? saved.logText : logText;
  }
} catch { /* Storage is optional; the demo also works entirely in memory. */ }

function save() {
  try { sessionStorage.setItem(storageKey, JSON.stringify({schema:1,state,selected,mode,retention,logText})); }
  catch { /* Private browsing or full storage must not interrupt a demonstration. */ }
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

function latest() { return [...state.runs].reverse().find((r) => r.mode === mode); }
function activeSnapshot() { return state.snapshots.find((s) => s.id === snapshotId) ?? state.snapshots.at(-1); }
function displayedRun() { return mode === 'versioned' && activeSnapshot() ? state.runs.find((r) => r.id === activeSnapshot().runId) : latest(); }
function destinationFiles() { return mode === 'sync' ? state.syncFiles : activeSnapshot()?.files ?? []; }
function selectedSource() { return sourceFiles(state.generation).filter((f) => selected.includes(f.projectId)); }

function projectList() {
  const files = sourceFiles(state.generation);
  $('project-list').innerHTML = PROJECTS.map((p) => {
    const list = files.filter((f) => f.projectId === p.id);
    return `<label class="project-row"><input type="checkbox" data-project="${p.id}" aria-label="Include ${escape(p.name)}" ${selected.includes(p.id) ? 'checked' : ''} ${running ? 'disabled' : ''}><span class="project-initials">${p.code}</span><span><span class="project-name">${escape(p.name)}</span><span class="project-type">${p.type} · synthetic project</span></span><span class="project-size">${plural(list.length,'file')}<br>${bytes(totalSize(list))}</span></label>`;
  }).join('');
  $('selected-summary').textContent = `${selected.length} of ${PROJECTS.length} projects included`;
  $('select-all').textContent = selected.length === PROJECTS.length ? 'Clear selection' : 'Select all';
}

function treeMarkup(files, side) {
  if (!files.length) return side === 'source'
    ? '<div class="empty-state"><h3>No projects selected</h3><p>Include at least one project to begin.</p></div>'
    : '<div class="empty-state"><div class="empty-archive" aria-hidden="true">▱</div><h3>Your backup will appear here</h3><p>Run a backup to create a synthetic copy<br>of the selected project files.</p></div>';
  const run = displayedRun();
  const eventMap = new Map(run?.events.filter((e) => e.file).map((e) => [e.file.id, e.kind]));
  return PROJECTS.filter((p) => files.some((f) => f.projectId === p.id)).map((p) => {
    const list = files.filter((f) => f.projectId === p.id);
    const groups = new Map();
    for (const f of list) {
      const relative = f.path.split('/').slice(1);
      const folder = relative.slice(0,-1).join('/') || 'Project root';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(f);
    }
    return `<details class="tree-project" data-tree-project="${p.id}" data-side="${side}" ${expanded[side].has(p.id) ? 'open' : ''}><summary><span class="folder-symbol" aria-hidden="true">▰</span>${escape(p.name)}<small>${plural(list.length,'file')}</small></summary><div class="tree-files">${[...groups].map(([folder, group]) => `<div class="folder-group">${escape(folder)}</div>${group.map((file) => {
      const kind = side === 'backup' && run?.files.some((f) => f.id === file.id && f.version === file.version) ? eventMap.get(file.id) : null;
      const label = file.path.split('/').at(-1);
      return `<button class="file-row" data-file="${escape(file.id)}" data-side="${side}" aria-label="Preview ${escape(label)} in ${escape(p.name)} ${side}"><span class="file-extension">${escape(label.split('.').at(-1).toUpperCase())}</span><span class="file-name">${escape(label)}</span>${kind ? `<span class="file-badge ${kind}">${kind.toUpperCase()}</span>` : ''}<span class="file-size">${bytes(file.size)}</span><span class="file-version">v${file.version}</span></button>`;
    }).join('')}`).join('')}</div></details>`;
  }).join('');
}

function renderTrees() {
  const source = selectedSource();
  const backup = destinationFiles();
  $('source-tree').innerHTML = treeMarkup(source, 'source');
  $('backup-tree').innerHTML = treeMarkup(backup, 'backup');
  $('source-count').textContent = `${plural(source.length,'file')} · ${bytes(totalSize(source))}`;
  $('destination-count').textContent = backup.length ? `${plural(backup.length,'file')} · ${bytes(totalSize(backup))}` : 'Empty';
  $('source-generation').textContent = `Synthetic source · generation ${state.generation + 1}`;
  $('snapshot-picker').hidden = mode !== 'versioned' || !state.snapshots.length;
  $('snapshot-select').innerHTML = [...state.snapshots].reverse().map((s) => `<option value="${s.id}" ${s.id === activeSnapshot()?.id ? 'selected' : ''}>${s.id} · generation ${s.generation + 1}${s.complete ? '' : ' · INCOMPLETE'}</option>`).join('');
}

function renderOverview() {
  const files = selectedSource();
  const run = latest();
  $('summary-projects').textContent = `${selected.length} / ${PROJECTS.length}`;
  $('summary-files').textContent = files.length;
  $('summary-size').textContent = bytes(totalSize(files));
  $('summary-status').textContent = running ? 'Running' : !run ? 'Ready' : !run.success ? 'Needs review' : run.generation !== state.generation ? 'Changes pending' : 'Up to date';
  $('summary-note').textContent = running ? 'Processing synthetic files' : !run ? 'Start an initial backup' : `${run.id} · ${plural(run.files.length,'file')} processed`;
  $('topology-mode').textContent = mode === 'sync' ? 'IN-PLACE SYNC' : `${retention} RETAINED VERSIONS`;
  $('destination-path').textContent = mode === 'sync' ? '/Backups/Northstar/Sync' : '/Backups/Northstar/Versions';
}

function setPhase(phase, percent) {
  const phases = ['discover','compare','transfer','complete'];
  document.querySelectorAll('[data-phase]').forEach((element) => {
    const index = phases.indexOf(element.dataset.phase);
    element.classList.toggle('active', element.dataset.phase === phase);
    element.classList.toggle('done', index < phases.indexOf(phase));
  });
  $('run-progress').value = percent;
}

function renderMetrics() {
  const run = displayedRun();
  const currentRun = latest();
  $('reuse-label').textContent = mode === 'sync' ? 'UNCHANGED' : 'COPIED FORWARD';
  $('metric-downloaded').textContent = run ? String(run.downloaded) : '—';
  $('metric-reused').textContent = run ? String(run.unchanged + run.copied) : '—';
  $('metric-deleted').textContent = run ? String(run.deleted) : '—';
  const total = run ? run.bytesDownloaded + run.bytesReused : 0;
  $('metric-efficiency').textContent = run ? `${total ? Math.round(run.bytesReused / total * 100) : 0}%` : '—';
  $('metric-download-bytes').textContent = run ? `${bytes(run.bytesDownloaded)} · simulated transfer` : 'New or modified files';
  $('metric-reused-bytes').textContent = run ? `${bytes(run.bytesReused)} · locally reused` : 'Reused from your backup';
  $('run-count').textContent = state.runs.length ? plural(state.runs.length,'run') + ' in this session' : 'No runs yet';
  if (!running) {
    const current = currentRun?.generation === state.generation;
    $('run-status').textContent = !currentRun ? 'Ready for your first backup.' : !current ? 'Sample source has changed. Run a backup to compare.' : currentRun.success ? `${currentRun.id} complete · ${plural(currentRun.projectIds.length,'project')} · ${plural(currentRun.files.length,'file')} processed` : `${currentRun.id} incomplete · failed project skipped; any existing backup preserved`;
    $('run-status').parentElement.classList.toggle('error', Boolean(current && currentRun && !currentRun.success));
  }
  $('run').disabled = running || !selected.length;
  $('run').innerHTML = running ? '<span class="progress-indicator" aria-hidden="true"></span>Running…' : '<span aria-hidden="true">▶</span>Run backup';
  $('change-source').disabled = running || !state.runs.length || state.generation >= 2;
  $('change-source').textContent = state.generation >= 2 ? '✓ All sample changes applied' : '＋ Simulate changes';
  $('export').disabled = running || !destinationFiles().length;
  $('download-log').disabled = running || !state.runs.length;
  $('export-report').disabled = running || !state.runs.length;
  $('reset').disabled = running;
  $('select-all').disabled = running;
  for (const element of document.querySelectorAll('input[name=mode],#retention,#force-full,#fail-project')) element.disabled = running;
  const finishedChanged = state.runs.some((r) => r.success && r.generation > 0 && r.generation === state.generation);
  $('step-1').className = state.runs.length ? 'done' : 'current';
  $('step-2').className = !state.runs.length ? '' : state.generation ? 'done' : 'current';
  $('step-3').className = state.generation ? (finishedChanged ? 'done' : 'current') : '';
}

function configureMode() {
  document.querySelector(`input[name=mode][value=${mode}]`).checked = true;
  document.querySelectorAll('.mode-card').forEach((card) => card.classList.toggle('selected', card.querySelector('input').checked));
  $('retention').value = String(retention);
  $('retention-wrap').hidden = mode !== 'versioned';
  $('mode-note').hidden = mode === 'versioned';
}

function renderHistory() {
  $('history-count').textContent = state.runs.length;
  if (!state.runs.length) {
    $('history-list').innerHTML = '<div class="history-empty"><h2>No backup runs yet</h2><p>Run your first synthetic backup to see results here.</p><a class="button primary" href="#workspace">Open backup workspace →</a></div>';
    return;
  }
  const versions = state.snapshots.filter((s) => s.complete).length;
  const partial = state.snapshots.filter((s) => !s.complete).length;
  $('history-list').innerHTML = `<div class="panel snapshots-summary"><strong>${plural(versions,'complete version')} retained${partial ? ` · ${plural(partial,'incomplete version')} preserved` : ''}</strong>Sync and versioned destinations are separate in this demo. Changing the project selection preserves unselected projects in the sync destination.</div>` + [...state.runs].reverse().map((r) => {
    const total = r.bytesDownloaded + r.bytesReused;
    const retained = r.snapshotId && state.snapshots.some((s) => s.id === r.snapshotId);
    return `<article class="panel history-card"><div class="panel-heading"><div class="history-id"><h2>${r.id}</h2><span class="run-badge ${r.success ? '' : 'error'}">${r.success ? 'COMPLETE' : 'INCOMPLETE'}</span></div><p>${r.mode === 'sync' ? 'In-place sync' : 'Versioned backup'} · generation ${r.generation + 1} · ${plural(r.projectIds.length,'project')}</p></div><div class="metrics"><div><span class="metric-label">DOWNLOADED</span><strong>${r.downloaded}</strong><small>${bytes(r.bytesDownloaded)}</small></div><div><span class="metric-label">${r.mode === 'sync' ? 'UNCHANGED' : 'COPIED'}</span><strong>${r.unchanged + r.copied}</strong><small>${bytes(r.bytesReused)}</small></div><div><span class="metric-label">REMOVED</span><strong>${r.deleted}</strong><small>Tracked obsolete files</small></div><div><span class="metric-label">REUSED</span><strong>${total ? Math.round(r.bytesReused / total * 100) : 0}%</strong><small>Of processed bytes</small></div></div><div class="history-note">${r.mode === 'sync' ? 'Single synchronized destination' : `${r.snapshotId} · ${retained ? 'retained' : 'rotated after a later successful run'}`}${!r.success ? ' · Failed enumeration was simulated; successful project work remains available.' : ''}</div></article>`;
  }).join('');
}

function command() {
  if (!selected.length) return '# Select at least one synthetic project to generate an example command.';
  const count = mode === 'sync' ? 1 : retention;
  return `FormaBackup --backupdirectory "./Backups/${mode === 'sync' ? 'Sync' : 'Versions'}" --backupstorotate ${count}${selected.length < PROJECTS.length && selected.length ? ` --projectstobackup "${selected.map((id) => PROJECTS.find((p) => p.id === id).name).join(', ')}"` : ''}${$('force-full').checked ? ' --force-full-download' : ''}`;
}

function render() {
  projectList();
  configureMode();
  renderTrees();
  renderMetrics();
  renderHistory();
  renderOverview();
  if (!running) setPhase(latest()?.generation === state.generation ? 'complete' : '', latest()?.generation === state.generation ? 100 : 0);
  $('command').textContent = command();
}

function navigate() {
  const view = ['workspace','history','guide'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'workspace';
  for (const id of ['workspace','history','guide']) $(id + '-view').hidden = id !== view;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === view);
    if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('page-name').textContent = {workspace:'Backup workspace',history:'Run history',guide:'How it works'}[view];
}

function appendLog(message, kind = '') {
  const row = document.createElement('div');
  row.className = 'log-line' + (kind === 'error' ? ' error' : '');
  const prefix = document.createElement('span');
  prefix.className = 'log-time';
  prefix.textContent = 'DEMO  ';
  row.append(prefix, document.createTextNode(message));
  $('console').append(row);
  while ($('console').childElementCount > 180) $('console').firstElementChild.remove();
  $('console').scrollTop = $('console').scrollHeight;
  logText += `DEMO  ${message}\n`;
}

async function runBackup() {
  if (running || !selected.length) return;
  running = true;
  render();
  $('run-status').parentElement.classList.remove('error');
  $('run-status').textContent = 'Enumerating synthetic project files…';
  setPhase('discover', 5);
  const options = {mode,retention,projectIds:[...selected],forceFull:$('force-full').checked,failProjectId:$('fail-project').checked ? selected[0] : null};
  try {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) await new Promise(resolve => setTimeout(resolve, 180));
    const next = simulateBackup(state, options);
    appendLog(`Starting ${next.result.id} · ${mode === 'sync' ? 'in-place sync' : 'versioned backup'} · source generation ${state.generation + 1}`);
    appendLog(`Synthetic data only. No APS connection. Processing ${plural(selected.length,'project')}.`);
    setPhase('compare', 14);
    if (!reduced) await new Promise(resolve => setTimeout(resolve, 180));
    for (const [i, event] of next.result.events.entries()) {
      if (!reduced) await new Promise((resolve) => setTimeout(resolve, 32));
      appendLog(event.message, event.kind);
      setPhase('transfer', 18 + Math.round((i + 1) / next.result.events.length * 78));
      $('run-status').textContent = `Processing ${i + 1} of ${next.result.events.length} simulated file actions…`;
    }
    state = next.state;
    snapshotId = next.result.snapshotId;
    const r = next.result;
    appendLog(`${r.success ? 'COMPLETE' : 'INCOMPLETE'} · ${r.downloaded} downloaded · ${r.unchanged + r.copied} reused · ${r.deleted} removed`, r.success ? '' : 'error');
    if (mode === 'versioned') appendLog(`${plural(state.snapshots.filter((s) => s.complete).length,'complete snapshot')} retained; incomplete runs never trigger rotation.`);
    appendLog('Demo manifest updated. Transfers and elapsed animation are illustrative.');
    setPhase('complete', 100);
    toast(r.success ? 'Backup complete. Expand a project to inspect its files.' : 'Simulated partial failure. Failed project skipped; any existing backup preserved.');
    save();
  } catch (error) {
    appendLog(error.message, 'error');
    toast(error.message);
  } finally {
    running = false;
    render();
  }
}

function showFile(id, side) {
  const file = (side === 'source' ? selectedSource() : destinationFiles()).find((f) => f.id === id);
  if (!file) return;
  $('file-location').textContent = side === 'source' ? 'SYNTHETIC SOURCE FILE' : 'SYNTHETIC BACKUP FILE';
  $('file-name').textContent = file.path.split('/').at(-1);
  $('file-meta').replaceChildren(...[file.path,`Version ${file.version}`,bytes(file.size),file.modifiedAt].map((text) => {
    const span = document.createElement('span'); span.textContent = text; return span;
  }));
  $('file-content').textContent = file.content;
  $('file-content').hidden = file.path.endsWith('.svg');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  $('file-visual').hidden = !file.path.endsWith('.svg');
  if (file.path.endsWith('.svg')) {
    previewUrl = URL.createObjectURL(new Blob([file.content], {type:'image/svg+xml'}));
    $('file-visual').src = previewUrl;
  } else $('file-visual').removeAttribute('src');
  $('file-dialog').showModal();
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBackup() {
  const files = destinationFiles();
  if (!files.length) return;
  const snapshot = mode === 'versioned' ? activeSnapshot() : null;
  const metadata = {sourceKind:'synthetic-web-demo',schema:1,notice:'SYNTHETIC DEMO DATA. This is not a production Forma Backup manifest.',mode,generation: snapshot?.generation ?? latest()?.generation ?? state.generation,snapshotId:snapshot?.id ?? null,complete:snapshot?.complete ?? latest()?.success ?? true,files:files.map(({content,...metadata})=>metadata)};
  const entries = files.map((f) => ({name:`backup/${f.path}`,content:f.content}));
  entries.push({name:'DemoManifest.json',content:JSON.stringify(metadata,null,2)});
  entries.push({name:'DEMO-README.txt',content:'FORMA BACKUP — SYNTHETIC BROWSER DEMO\n\nAll project records and files are synthetic. No Autodesk account was accessed.\nDemoManifest.json uses a simulation schema; do not use this folder as a live CLI backup root.\nThe browser demo illustrates decisions; it does not execute the .NET engine or measure production speed.\n'});
  download(`forma-backup-demo-${mode}${snapshot ? '-'+snapshot.id : ''}.zip`,makeZip(entries),'application/zip');
  toast('Synthetic sample backup exported as a ZIP.');
}

$('project-list').addEventListener('change', (event) => {
  const id = event.target.dataset.project;
  if (!id || running) return;
  selected = event.target.checked ? [...selected,id] : selected.filter((p) => p !== id);
  render(); save();
});
$('select-all').addEventListener('click', () => { selected = selected.length === PROJECTS.length ? [] : PROJECTS.map((p) => p.id); render(); save(); });
document.querySelectorAll('input[name=mode]').forEach((input) => input.addEventListener('change', () => { mode = input.value; snapshotId = null; render(); save(); }));
$('retention').addEventListener('change', () => { retention = Number($('retention').value); $('command').textContent = command(); renderOverview(); save(); });
$('force-full').addEventListener('change', () => { $('command').textContent = command(); });
$('snapshot-select').addEventListener('change', () => { snapshotId = $('snapshot-select').value; renderTrees(); renderMetrics(); });
document.querySelectorAll('.tree').forEach((element) => {
  element.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!details.dataset.treeProject) return;
    const set = expanded[details.dataset.side];
    if (details.open) set.add(details.dataset.treeProject); else set.delete(details.dataset.treeProject);
  }, true);
  element.addEventListener('click', (event) => { const button = event.target.closest('[data-file]'); if (button) showFile(button.dataset.file,button.dataset.side); });
});
$('run').addEventListener('click', runBackup);
$('change-source').addEventListener('click', () => {
  if (running || state.generation >= 2) return;
  state = {...state,generation:state.generation+1};
  appendLog(state.generation === 1 ? 'SOURCE CHANGED · each project: 1 revised report, 1 new briefing, 1 removed archive file.' : 'SOURCE CHANGED · each project: 1 revised diagram, 1 revised schedule, 1 new closeout checklist.');
  render(); save(); toast('Sample source changed. Run backup again to compare.');
});
$('close-dialog').addEventListener('click', () => $('file-dialog').close());
$('file-dialog').addEventListener('close', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; });
$('reset').addEventListener('click', () => $('reset-dialog').showModal());
$('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
$('confirm-reset').addEventListener('click', () => {
  state = createInitialState(); selected = PROJECTS.map((p) => p.id); mode = 'sync'; retention = 3; snapshotId = null;
  expanded.source.clear(); expanded.backup.clear(); expanded.source.add(PROJECTS[0].id); expanded.backup.add(PROJECTS[0].id);
  setPhase('', 0);
  $('force-full').checked = false; $('fail-project').checked = false;
  logText = 'Forma Backup browser demo initialized.\nAll project data and transfers are synthetic.\n';
  $('console').replaceChildren(); appendLog('Demo reset. Ready for an initial backup.');
  $('reset-dialog').close(); render(); save(); toast('Fresh synthetic workspace ready.');
});
$('export').addEventListener('click', exportBackup);
$('download-log').addEventListener('click', () => download('forma-backup-demo.log',logText,'text/plain;charset=utf-8'));
$('export-report').addEventListener('click', () => {
  const report = {sourceKind:'synthetic-web-demo',notice:'All results illustrate browser simulation behavior, not .NET execution or APS availability.',generation:state.generation,retainedSnapshots:state.snapshots.map(({files,...s})=>({...s,fileCount:files.length})),runs:state.runs.map(({files,events,...r})=>r)};
  download('forma-backup-demo-report.json',JSON.stringify(report,null,2),'application/json');
});
$('copy-command').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(command()); toast('Command copied. Configure APS environment variables before running it.'); }
  catch { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents($('command')); selection.removeAllRanges(); selection.addRange(range); toast('Select and copy the highlighted command.'); }
});
window.addEventListener('hashchange', navigate);
render(); navigate();
if (state.runs.length) { $('console').replaceChildren(); for (const line of logText.trim().split('\n').slice(-100)) { const div = document.createElement('div'); div.className = 'log-line'; div.textContent = line; $('console').append(div); } }
