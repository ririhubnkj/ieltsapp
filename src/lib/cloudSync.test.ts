import { describe, expect, it, vi } from 'vitest';
import { CloudSync, fromDocs, stableStringify, toDocs, type RemoteChange } from './cloudSync';
import type { AppData } from '../types';

/** 2台の端末が共有する、メモリ上の db の代わり */
class FakeStore {
  docs = new Map<string, Record<string, unknown>>();
  private listeners: { prefix: string; doc: boolean; fn: (changes: { path: string; type: string }[]) => void }[] = [];
  writes: string[] = [];

  db(): ClaudeDb {
    const snapOf = (path: string): ClaudeDocSnapshot => {
      // 保存先ではキー順が変わる想定で、逆順にして返す
      const body = this.docs.get(path);
      const reversed = body && Object.fromEntries(Object.entries(body).reverse());
      return {
        id: path.split('/').pop()!,
        exists: !!body,
        data: () => (reversed ? structuredClone(reversed) : undefined),
        metadata: { fromCache: false, hasPendingWrites: false },
      };
    };
    const docRef = (path: string): ClaudeDocRef => ({
      get: async () => snapOf(path),
      set: async (data) => {
        this.writes.push(path);
        this.docs.set(path, structuredClone(data));
        this.emit(path, 'modified');
      },
      delete: async () => {
        this.writes.push(`-${path}`);
        this.docs.delete(path);
        this.emit(path, 'removed');
      },
      onSnapshot: (next) => {
        const l = { prefix: path, doc: true, fn: () => next(snapOf(path)) };
        this.listeners.push(l);
        return () => (this.listeners = this.listeners.filter((x) => x !== l));
      },
    });
    const removedSnap = new Map<string, ClaudeDocSnapshot>();
    return {
      doc: docRef,
      collection: (name) => ({
        doc: (id) => docRef(`${name}/${id}`),
        get: async () => {
          const docs = [...this.docs.keys()].filter((p) => p.startsWith(`${name}/`)).map(snapOf);
          return { docs, empty: docs.length === 0, docChanges: () => [] };
        },
        onSnapshot: (next) => {
          const l = {
            prefix: `${name}/`,
            doc: false,
            fn: (changes: { path: string; type: string }[]) =>
              next({
                docs: [],
                empty: false,
                docChanges: () =>
                  changes.map((c) => ({
                    type: c.type as 'modified',
                    doc: c.type === 'removed' ? (removedSnap.get(c.path) ?? snapOf(c.path)) : snapOf(c.path),
                  })),
              }),
          };
          this.listeners.push(l);
          return () => (this.listeners = this.listeners.filter((x) => x !== l));
        },
      }),
    };
  }

  private emit(path: string, type: string) {
    for (const l of this.listeners) {
      if (l.doc ? l.prefix === path : path.startsWith(l.prefix)) l.fn([{ path, type }]);
    }
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0));

function sampleData(): AppData {
  return {
    schemaVersion: 1,
    entries: [
      { id: 'e1', createdAt: '2026-01-01T00:00:00.000Z', tokens: ['Hello', '.'], title: 'A' },
      { id: 'e2', createdAt: '2026-01-02T00:00:00.000Z', tokens: ['Bye', '.'] },
    ],
    markings: [
      { entryId: 'e1', ranges: [{ start: 0, end: 0 }] },
      { entryId: 'e2', ranges: [] },
    ],
    sessions: [{ id: 's1', entryId: 'e1', timestamp: '2026-01-03T00:00:00.000Z', totalQuestions: 2, correctCount: 1 }],
    settings: { quizRatio: 0.5 },
  };
}

const EMPTY: AppData = { schemaVersion: 1, entries: [], markings: [], sessions: [], settings: { quizRatio: 0.5 } };

/** 端末1台ぶん。状態を持ち、CloudSync の通知を反映する */
function device(store: FakeStore, initial: AppData) {
  const dev = { data: initial, sync: null as unknown as CloudSync };
  const apply = (c: RemoteChange) => {
    const merged = fromDocs(
      c.settings ?? dev.data.settings,
      [...toDocs(dev.data).entries()]
        .filter(([p]) => p.startsWith('entries/'))
        .map(([, d]) => d as never)
        .filter((d: { entry: { id: string } }) => !c.deletes.includes(d.entry.id) && !c.upserts.some((u) => u.entry.id === d.entry.id))
        .concat(c.upserts as never[]),
      dev.data.settings,
    );
    dev.data = merged;
  };
  dev.sync = new CloudSync(store.db(), initial, {
    replaceAll: (d) => (dev.data = d),
    applyRemote: (c) => {
      apply(c);
      dev.sync.flush(dev.data);
    },
    status: vi.fn(),
  });
  return {
    get data() {
      return dev.data;
    },
    start: () => dev.sync.start(),
    change(next: AppData) {
      dev.data = next;
      dev.sync.flush(next);
    },
  };
}

describe('stableStringify', () => {
  it('ignores key order and undefined fields', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe(stableStringify({ a: [1, { d: 2 }], b: 1 }));
  });
});

describe('toDocs / fromDocs', () => {
  it('round-trips the app data', () => {
    const data = sampleData();
    const docs = [...toDocs(data).entries()];
    const entryDocs = docs.filter(([p]) => p.startsWith('entries/')).map(([, d]) => d as never);
    expect(fromDocs(data.settings, entryDocs, EMPTY.settings)).toEqual(data);
  });
});

describe('CloudSync', () => {
  it('uploads local data when the cloud is empty', async () => {
    const store = new FakeStore();
    const pc = device(store, sampleData());
    await pc.start();
    await settle();
    expect([...store.docs.keys()].sort()).toEqual(['app/settings', 'entries/e1', 'entries/e2']);
  });

  it('loads cloud data on another device and replaces its local cache', async () => {
    const store = new FakeStore();
    const pc = device(store, sampleData());
    await pc.start();
    await settle();

    const phone = device(store, EMPTY);
    await phone.start();
    await settle();
    expect(phone.data).toEqual(sampleData());
  });

  it('sends changes live to the other device without echoing writes back', async () => {
    const store = new FakeStore();
    const pc = device(store, sampleData());
    await pc.start();
    const phone = device(store, EMPTY);
    await phone.start();
    await settle();
    store.writes = [];

    // スマホで穴埋めの割合を変え、題材を1つ消す
    phone.change({
      ...phone.data,
      settings: { quizRatio: 0.8 },
      entries: phone.data.entries.filter((e) => e.id !== 'e2'),
      markings: phone.data.markings.filter((m) => m.entryId !== 'e2'),
    });
    await settle();
    await settle();

    expect(pc.data.settings.quizRatio).toBe(0.8);
    expect(pc.data.entries.map((e) => e.id)).toEqual(['e1']);
    // スマホの2件の書き込みだけで、PCからの書き戻しは起きない
    expect(store.writes.sort()).toEqual(['-entries/e2', 'app/settings']);
  });

  it('does nothing when the data did not change', async () => {
    const store = new FakeStore();
    const pc = device(store, sampleData());
    await pc.start();
    await settle();
    store.writes = [];
    pc.change({ ...pc.data });
    await settle();
    expect(store.writes).toEqual([]);
  });
});
