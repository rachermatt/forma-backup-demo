// Pure browser demo model. All files and identities below are synthetic.
export const PROJECTS = Object.freeze([
  { id: 'harbor-point', name: 'Harbor Point Office', code: 'HPO', type: 'Commercial', color: '#3b82f6' },
  { id: 'northstar-health', name: 'Northstar Health Campus', code: 'NHC', type: 'Healthcare', color: '#8b5cf6' },
  { id: 'metro-link', name: 'Metro Link Station', code: 'MLS', type: 'Infrastructure', color: '#14b8a6' },
  { id: 'training-sandbox', name: 'Training Sandbox', code: 'TSB', type: 'Training', color: '#f59e0b' },
]);

export function createInitialState() {
  return { generation: 0, syncFiles: [], snapshots: [], runs: [] };
}

const byteLength = (text) => new TextEncoder().encode(text).length;
const demoNote = 'SYNTHETIC DEMO DATA — illustrative information only.\n';
const detail = Array.from({ length: 7 }, (_, i) =>
  `Demo record ${i + 1}: coordinated project information prepared for the Forma Backup interactive simulation.`
).join('\n');

/** A reproducible source catalogue: eight initial files per project. */
export function sourceFiles(generation = 0) {
  const stage = Math.max(0, Math.min(2, Math.floor(Number(generation) || 0)));
  return PROJECTS.flatMap((project) => {
    const descriptors = [
      ['overview', 'README.md', 1, `# ${project.name}\n\n${demoNote}\nProject code: ${project.code}\n\n${detail}`],
      ['drawing', 'Drawings/general-arrangement.svg', stage >= 2 ? 2 : 1,
        `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#edf3f8"/><g fill="none" stroke="#18598c" stroke-width="5"><rect x="80" y="100" width="800" height="330"/><path d="M400 100V430M650 100V430M80 260H880"/>${stage >= 2 ? '<path d="M400 160H650"/>' : ''}</g><text x="80" y="60" font-size="24">${project.code} — SYNTHETIC DEMO DATA — revision ${stage >= 2 ? 'B' : 'A'}</text><text x="80" y="490" font-size="16">Illustrative arrangement; not for construction</text></svg>`],
      ['model', 'Models/coordination-summary.json', 1,
        JSON.stringify({ notice: demoNote.trim(), project: project.name, model: 'Illustrative coordination summary', disciplines: ['Architecture', 'Structure', 'Services'], elements: 1240, status: 'For demonstration', notes: detail }, null, 2)],
      ['specification', 'Specifications/material-requirements.md', 1,
        `# Material requirements\n\n${demoNote}\nProject: ${project.name}\n\n## Illustrative specification\n\n${detail}\n\nNo real material or procurement requirements are represented.`],
      ['weekly', 'Reports/weekly-progress.md', stage >= 1 ? 2 : 1,
        `# Weekly progress — ${project.code}\n\n${demoNote}\nReporting period: ${stage >= 1 ? 'Week 25' : 'Week 24'}\nStatus: ${stage >= 1 ? 'Updated synthetic coordination review' : 'Initial synthetic coordination review'}\n\n${detail}`],
      ['schedule', 'Schedules/project-programme.csv', stage >= 2 ? 2 : 1,
        `notice,${demoNote.trim()}\nproject,${project.name}\nactivity,start,finish,status\nDesign review,2026-06-01,2026-06-05,Complete\nCoordination,2026-06-08,2026-06-12,${stage >= 2 ? 'Complete' : 'In progress'}\n` + Array.from({ length: 8 }, (_, i) => `Synthetic work package ${i + 1},2026-06-15,2026-06-19,Planned`).join('\n')],
      ['site', 'Site/site-observations.json', 1,
        JSON.stringify({ notice: demoNote.trim(), project: project.code, observations: Array.from({ length: 6 }, (_, i) => ({ id: `DEMO-${i + 1}`, area: `Zone ${i + 1}`, observation: 'Illustrative site observation for backup demonstration', status: 'Reviewed' })) }, null, 2)],
    ];
    if (stage === 0) descriptors.push(['obsolete', 'Archive/superseded-note.txt', 1, `${demoNote}\nThis synthetic note will be removed from the source in the next scenario.\n\n${detail}`]);
    if (stage >= 1) descriptors.push(['briefing', 'Reports/team-briefing.md', 1, `# Team briefing\n\n${demoNote}\nProject: ${project.name}\n\nAdded after the initial backup.\n\n${detail}`]);
    if (stage >= 2) descriptors.push(['handover', 'Handover/closeout-checklist.md', 1, `# Closeout checklist\n\n${demoNote}\nProject: ${project.name}\n\n- Review synthetic drawings\n- Confirm demonstration schedule\n- Archive sample reports\n\n${detail}`]);
    return descriptors.map(([key, relativePath, version, content]) => ({
      id: `${project.id}:${key}`,
      projectId: project.id,
      path: `${project.name}/${relativePath}`,
      version,
      modifiedAt: version > 1 ? (stage >= 2 && ['drawing', 'schedule'].includes(key) ? '2026-06-22T09:00:00Z' : '2026-06-15T09:00:00Z') : key === 'briefing' ? '2026-06-15T09:00:00Z' : key === 'handover' ? '2026-06-22T09:00:00Z' : '2026-06-08T09:00:00Z',
      content,
      size: byteLength(content),
    }));
  });
}

const sameVersion = (a, b) => Boolean(a && a.id === b.id && a.path === b.path &&
  a.version === b.version && a.modifiedAt === b.modifiedAt && a.size === b.size);
const copyFiles = (files) => files.map((file) => ({ ...file }));

/** Simulate local backup semantics without networking, credentials, or disk writes. */
export function simulateBackup(state, options = {}) {
  const mode = options.mode ?? 'sync';
  if (!['sync', 'versioned'].includes(mode)) throw new Error('Choose sync or versioned backup mode.');
  const retention = Math.max(2, Math.floor(Number(options.retention) || 3));
  const knownIds = new Set(PROJECTS.map((project) => project.id));
  const projectIds = [...new Set(options.projectIds ?? PROJECTS.map((project) => project.id))];
  if (!projectIds.length || projectIds.some((id) => !knownIds.has(id))) throw new Error('Select at least one valid synthetic project.');
  const selected = new Set(projectIds);
  const failedProjects = projectIds.includes(options.failProjectId) ? [options.failProjectId] : [];
  const failed = new Set(failedProjects);
  const successful = new Set(projectIds.filter((id) => !failed.has(id)));
  const current = sourceFiles(state.generation).filter((file) => selected.has(file.projectId));
  const previousSnapshot = [...state.snapshots].reverse().find((snapshot) => snapshot.complete);
  const previous = mode === 'sync' ? state.syncFiles : previousSnapshot?.files ?? [];
  const priorById = new Map(previous.map((file) => [file.id, file]));
  const runNumber = state.runs.length + 1;
  const result = {
    id: `run-${String(runNumber).padStart(3, '0')}`, mode, generation: state.generation,
    success: failedProjects.length === 0, projectIds: [...projectIds],
    downloaded: 0, copied: 0, unchanged: 0, deleted: 0,
    bytesDownloaded: 0, bytesReused: 0, totalFiles: current.length,
    files: [], events: [], snapshotId: null, failedProjects,
  };
  for (const projectId of failedProjects) {
    const project = PROJECTS.find((entry) => entry.id === projectId);
    result.events.push({ kind: 'error', file: null, message: `[SIMULATED ERROR] ${project.name}: enumeration failed; project skipped and any existing backup content preserved.` });
  }
  for (const file of current) {
    if (!successful.has(file.projectId)) continue;
    const reused = !options.forceFull && sameVersion(priorById.get(file.id), file);
    const kind = reused ? mode === 'sync' ? 'unchanged' : 'copied' : 'downloaded';
    result[kind] += 1;
    result[reused ? 'bytesReused' : 'bytesDownloaded'] += file.size;
    result.files.push({ ...file });
    result.events.push({ kind, file: { ...file }, message: `[${kind.toUpperCase()}] ${file.path}` });
  }
  let syncFiles = copyFiles(state.syncFiles);
  let snapshots = state.snapshots.map((snapshot) => ({ ...snapshot, projectIds: [...snapshot.projectIds], files: copyFiles(snapshot.files) }));
  if (mode === 'sync') {
    const currentIds = new Set(result.files.map((file) => file.id));
    for (const file of previous) {
      if (successful.has(file.projectId) && !currentIds.has(file.id)) {
        result.deleted += 1;
        result.events.push({ kind: 'deleted', file: { ...file }, message: `[DELETED] ${file.path} (tracked obsolete file)` });
      }
    }
    syncFiles = [...syncFiles.filter((file) => !successful.has(file.projectId)), ...copyFiles(result.files)];
  } else {
    result.snapshotId = `snapshot-${String(runNumber).padStart(3, '0')}`;
    snapshots.push({ id: result.snapshotId, runId: result.id, generation: state.generation, complete: result.success, projectIds: [...projectIds], files: copyFiles(result.files) });
    if (result.success) {
      const retainedComplete = new Set(snapshots.filter((snapshot) => snapshot.complete).slice(-retention).map((snapshot) => snapshot.id));
      snapshots = snapshots.filter((snapshot) => !snapshot.complete || retainedComplete.has(snapshot.id));
    }
  }
  return {
    state: { generation: state.generation, syncFiles, snapshots, runs: [...state.runs, result] },
    result,
  };
}
