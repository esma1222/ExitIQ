// Online saving failure and recovery, end to end through store.ts and
// remote.ts with a fake Supabase client: a failed online save keeps local work
// and reports local-only; after recovery syncAll pushes the full state once.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Call { table: string; op: string; payload: unknown; filters: [string, unknown][] }

const db = {
  offline: true,
  calls: [] as Call[],
  answers: [] as Record<string, unknown>[],
  n: 0,
};

function exec(q: Call & { single: boolean }) {
  if (db.offline) return { data: null, error: { message: 'Failed to fetch' } };
  db.calls.push({ table: q.table, op: q.op, payload: q.payload, filters: q.filters });
  const id = `${q.table}-${++db.n}`;
  if (q.op === 'insert') {
    if (q.table === 'answers') db.answers.push({ ...(q.payload as object), id });
    return { data: q.single ? { id } : [{ id }], error: null };
  }
  if (q.op === 'update') return { data: [{ id: 'assessments-1' }], error: null };
  if (q.op === 'select' && q.table === 'current_answers') {
    const latest = new Map<string, Record<string, unknown>>();
    for (const r of db.answers) latest.set(r.question_id as string, r);
    return { data: [...latest.values()].map((r) => ({ requires_reconfirmation: false, inactive_since: null, na_reason: null, value: null, points: null, ...r })), error: null };
  }
  return { data: q.single ? null : [], error: null };
}

function from(table: string) {
  const q = { table, op: 'select', payload: null as unknown, filters: [] as [string, unknown][], single: false };
  const api: Record<string, unknown> = {};
  const chain = (f: () => void) => () => { f(); return api; };
  Object.assign(api, {
    insert: (p: unknown) => { q.op = 'insert'; q.payload = p; return api; },
    update: (p: unknown) => { q.op = 'update'; q.payload = p; return api; },
    upsert: (p: unknown) => { q.op = 'upsert'; q.payload = p; return api; },
    delete: chain(() => { q.op = 'delete'; }),
    select: () => api,
    eq: (k: string, v: unknown) => { q.filters.push([k, v]); return api; },
    order: () => api,
    limit: () => api,
    single: chain(() => { q.single = true; }),
    maybeSingle: chain(() => { q.single = true; }),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(exec(q)).then(res, rej),
  });
  return api;
}

vi.mock('./supabase', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  supabase: {
    from,
    auth: {
      getSession: async () => ({ data: { session: db.offline ? null : { user: { id: 'user-1' } } } }),
      signInAnonymously: async () => (db.offline ? { data: { user: null }, error: { message: 'Failed to fetch' } } : { data: { user: { id: 'user-1' } }, error: null }),
      updateUser: async () => ({ error: null }),
      signOut: async () => ({}),
    },
  },
}));
vi.mock('./captcha', () => ({ getCaptchaToken: async () => null, captchaEnabled: false }));

function memoryStorage() {
  const mem = new Map<string, string>();
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 20; i++) await flush();
}

beforeEach(() => {
  vi.resetModules();
  db.offline = true;
  db.calls = [];
  db.answers = [];
  db.n = 0;
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

async function load() {
  const store = await import('./store');
  const remote = await import('./remote');
  const statuses: string[] = [];
  remote.onSyncStatus((s) => statuses.push(s));
  return { store, remote, statuses };
}

describe('online saving failure and recovery', () => {
  it('a failed online save keeps the work in this browser and reports local-only', async () => {
    const { store, remote, statuses } = await load();
    store.setAnswer('Q01', { status: 'substantive', points: 50 });
    store.setAnswer('Q02', { status: 'unknown' });
    await settle();

    expect(statuses).toContain('local-only');
    expect(remote.backupHealth().online).toBe(false);
    expect(store.getState().remoteId).toBeNull();
    expect(store.getState().answers.Q01.points).toBe(50);
    const saved = JSON.parse(localStorage.getItem('exitiq-assessment-v1')!);
    expect(Object.keys(saved.answers).sort()).toEqual(['Q01', 'Q02']);
    expect(remote.saveFailures()).toBeGreaterThan(0);
    expect(await store.syncAll()).toBe(false);
  });

  it('after recovery syncAll pushes the full state once and reports the failures once', async () => {
    const { store, remote } = await load();
    store.setAnswer('Q01', { status: 'substantive', points: 50 });
    store.setAnswer('Q02', { status: 'unknown' });
    store.setDiagnostic('E04', '10-25%');
    store.updateTasks(['T1'], { status: 'done', resolution: { by: 'CFO', note: 'Done', at: '2026-11-14' } });
    await settle();
    expect(remote.saveFailures()).toBeGreaterThan(0);

    db.offline = false;
    expect(await store.syncAll()).toBe(true);
    await settle();

    const inserts = (table: string) => db.calls.filter((c) => c.table === table && c.op === 'insert');
    expect(inserts('assessments')).toHaveLength(1);
    const answerQs = inserts('answers').map((c) => (c.payload as { question_id: string }).question_id).sort();
    expect(answerQs).toEqual(['E04', 'Q01', 'Q02']);
    expect(store.getState().remoteId).toBe('assessments-1');
    expect(remote.backupHealth().online).toBe(true);
    const taskUpdate = db.calls.find((c) => c.table === 'tasks' && c.op === 'update');
    expect(taskUpdate?.payload).toEqual({ status: 'done', agreed_due_date: null, resolution: { by: 'CFO', note: 'Done', at: '2026-11-14' } });

    // One recovery event with the failure count, then the counter is clear.
    const events = inserts('analytics_events').map((c) => c.payload as { event: string; stage: string });
    const recovered = events.filter((e) => e.stage?.startsWith('SAVE_RECOVERED:'));
    expect(recovered).toHaveLength(1);
    expect(recovered[0].event).toBe('save');
    expect(Number(recovered[0].stage.split(':')[1])).toBeGreaterThan(0);
    expect(remote.saveFailures()).toBe(0);

    // A second reconciliation finds nothing new to append.
    const before = inserts('answers').length;
    expect(await store.syncAll()).toBe(true);
    expect(inserts('answers').length).toBe(before);
    expect(inserts('assessments')).toHaveLength(1);
  });

  it('the first assessment_start carries the landing entry as its channel', async () => {
    const { store, remote } = await load();
    remote.markLandingEntry();
    db.offline = false;
    store.setAnswer('Q01', { status: 'substantive', points: 100 });
    await settle();
    const starts = db.calls.filter((c) => c.table === 'analytics_events' && (c.payload as { event: string }).event === 'assessment_start');
    expect(starts).toHaveLength(1);
    expect((starts[0].payload as { channel: string }).channel).toBe('landing_cta');
    expect(sessionStorage.getItem('exitiq-entry')).toBeNull();
  });
});

describe('assessment row stage', () => {
  it('uses SPECIALIST_PATH for specialist reasons and APPLICABILITY_PENDING in the summary and deep stages', async () => {
    const { store } = await load();
    expect(store.rowStage('deep', true, true)).toBe('SPECIALIST_PATH');
    expect(store.rowStage('result', true, false)).toBe('SPECIALIST_PATH');
    expect(store.rowStage('deep', false, true)).toBe('APPLICABILITY_PENDING');
    expect(store.rowStage('summary', false, true)).toBe('APPLICABILITY_PENDING');
    expect(store.rowStage('result', false, true)).toBe('RESULT');
    expect(store.rowStage('deep', false, false)).toBe('DEEP_ASSESSMENT');
    expect(store.rowStage('saved', true, true)).toBe('SAVED');
  });
});

describe('task follow-up in saves', () => {
  it('migrates a status-only save and drops invalid entries', async () => {
    const { store } = await load();
    expect(store.migrateTasks(undefined, { a: 'done', b: 'bogus' })).toEqual({ a: { status: 'done', dueDate: null, resolution: null } });
    expect(store.migrateTasks(undefined, { 'Q:Q27': 'in_progress', 'Q:Q28': 'done' })).toEqual({
      'Q:Q27': { status: 'in_progress', dueDate: null, resolution: null },
      'Q:Q28': { status: 'done', dueDate: null, resolution: null },
      'Q:Q27:company': { status: 'in_progress', dueDate: null, resolution: null },
      'Q:Q27:seller': { status: 'in_progress', dueDate: null, resolution: null },
      'Q:Q28:company': { status: 'done', dueDate: null, resolution: null },
      'Q:Q28:seller': { status: 'done', dueDate: null, resolution: null },
    });
    expect(store.migrateTasks({ c: { status: 'in_progress', dueDate: '2026-12-01', resolution: null }, d: { status: 'x', dueDate: 'soon' } })).toEqual({
      c: { status: 'in_progress', dueDate: '2026-12-01', resolution: null },
      d: { status: 'open', dueDate: null, resolution: null },
    });
  });

  it('reopening a task drops its resolution', async () => {
    const { store } = await load();
    store.updateTasks(['k'], { status: 'done', resolution: { by: 'CFO', note: 'n', at: '2026-11-14' } });
    expect(store.taskMetaOf(store.getState(), 'k').resolution?.by).toBe('CFO');
    store.updateTasks(['k'], { status: 'in_progress' });
    expect(store.taskMetaOf(store.getState(), 'k').resolution).toBeNull();
  });
});
