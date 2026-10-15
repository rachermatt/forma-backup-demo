import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, createInitialState, sourceFiles, simulateBackup } from './model.mjs';

test('baseline and unchanged sync are deterministic and preserve their input', () => {
  const initial = createInitialState();
  const before = structuredClone(initial);
  const first = simulateBackup(initial);
  assert.deepEqual(initial, before);
  assert.equal(first.result.downloaded, 32);
  assert.equal(first.result.bytesDownloaded, sourceFiles().reduce((sum, file) => sum + file.size, 0));
  assert.equal(first.state.syncFiles.length, 32);
  const second = simulateBackup(first.state);
  assert.equal(second.result.unchanged, 32);
  assert.equal(second.result.downloaded, 0);
  assert.equal(second.result.bytesDownloaded, 0);
  assert.equal(second.result.id, 'run-002');
  assert.deepEqual(sourceFiles(), sourceFiles());
});

test('source changes download modified and new files, retain unchanged files, and remove obsolete tracked files', () => {
  const first = simulateBackup(createInitialState());
  const changed = simulateBackup({ ...first.state, generation: 1 });
  assert.equal(changed.result.downloaded, 8);
  assert.equal(changed.result.unchanged, 24);
  assert.equal(changed.result.deleted, 4);
  assert.equal(changed.state.syncFiles.length, 32);
  assert.equal(changed.state.syncFiles.some((file) => file.id.endsWith(':obsolete')), false);
  const next = simulateBackup({ ...changed.state, generation: 2 });
  assert.equal(next.result.downloaded, 12);
  assert.equal(next.result.unchanged, 24);
  assert.equal(next.state.syncFiles.length, 36);
});

test('project filters preserve unselected project backups', () => {
  const first = simulateBackup(createInitialState());
  const changed = simulateBackup({ ...first.state, generation: 1 }, { projectIds: [PROJECTS[0].id] });
  assert.equal(changed.result.totalFiles, 8);
  assert.equal(changed.result.deleted, 1);
  assert.equal(changed.result.downloaded, 2);
  assert.equal(changed.state.syncFiles.filter((file) => file.id.endsWith(':obsolete')).length, 3);
  assert.deepEqual(changed.state.syncFiles.filter((file) => file.projectId === PROJECTS[1].id), first.state.syncFiles.filter((file) => file.projectId === PROJECTS[1].id));
});

test('failed enumeration preserves the previous sync project while successful projects advance', () => {
  const first = simulateBackup(createInitialState());
  const prior = structuredClone(first.state);
  const changed = simulateBackup({ ...first.state, generation: 1 }, { failProjectId: PROJECTS[0].id });
  assert.equal(changed.result.success, false);
  assert.deepEqual(changed.result.failedProjects, [PROJECTS[0].id]);
  assert.equal(changed.result.downloaded, 6);
  assert.equal(changed.result.deleted, 3);
  assert.deepEqual(changed.state.syncFiles.filter((file) => file.projectId === PROJECTS[0].id), prior.syncFiles.filter((file) => file.projectId === PROJECTS[0].id));
  assert.deepEqual(first.state, prior);
});

test('versioned runs copy from their latest complete snapshot and retain the configured complete versions', () => {
  let state = createInitialState();
  state = simulateBackup(state, { mode: 'versioned', retention: 2 }).state;
  const second = simulateBackup(state, { mode: 'versioned', retention: 2 });
  assert.equal(second.result.copied, 32);
  assert.equal(second.result.unchanged, 0);
  assert.equal(second.result.downloaded, 0);
  assert.equal(second.state.snapshots.every((snapshot) => snapshot.files.length === 32), true);
  const third = simulateBackup({ ...second.state, generation: 1 }, { mode: 'versioned', retention: 2 });
  assert.equal(third.result.downloaded, 8);
  assert.equal(third.result.copied, 24);
  assert.equal(third.result.deleted, 0);
  assert.deepEqual(third.state.snapshots.map((snapshot) => snapshot.id), ['snapshot-002', 'snapshot-003']);
  assert.equal(third.state.syncFiles.length, 0);
});

test('partial versioned runs do not rotate complete snapshots and incomplete snapshots remain on later success', () => {
  let state = createInitialState();
  for (let i = 0; i < 3; i++) state = simulateBackup(state, { mode: 'versioned', retention: 3 }).state;
  const partial = simulateBackup({ ...state, generation: 1 }, { mode: 'versioned', retention: 2, failProjectId: PROJECTS[0].id });
  assert.equal(partial.state.snapshots.length, 4);
  assert.equal(partial.state.snapshots.at(-1).complete, false);
  assert.equal(partial.state.snapshots.at(-1).files.length, 24);
  const recovered = simulateBackup(partial.state, { mode: 'versioned', retention: 2 });
  assert.equal(recovered.result.downloaded, 8);
  assert.equal(recovered.result.copied, 24);
  assert.deepEqual(recovered.state.snapshots.map((snapshot) => snapshot.id), ['snapshot-003', 'snapshot-004', 'snapshot-005']);
});

test('modes never reuse each other and force-full bypasses reuse', () => {
  const sync = simulateBackup(createInitialState());
  const versioned = simulateBackup(sync.state, { mode: 'versioned' });
  assert.equal(versioned.result.downloaded, 32);
  assert.equal(versioned.result.copied, 0);
  const full = simulateBackup(sync.state, { forceFull: true });
  assert.equal(full.result.downloaded, 32);
  assert.equal(full.result.unchanged, 0);
});

test('synthetic files have valid deterministic metadata, literal demo notices, and supported text extensions', () => {
  for (const generation of [0, 1, 2]) {
    const files = sourceFiles(generation);
    assert.equal(new Set(files.map((file) => file.id)).size, files.length);
    for (const file of files) {
      assert.equal(file.size, new TextEncoder().encode(file.content).length);
      assert.match(file.content, /SYNTHETIC DEMO DATA/);
      assert.match(file.path, /\.(md|json|csv|svg|txt)$/);
      assert.ok(Number.isFinite(Date.parse(file.modifiedAt)));
      if (file.path.endsWith('.json')) assert.doesNotThrow(() => JSON.parse(file.content));
    }
  }
});
