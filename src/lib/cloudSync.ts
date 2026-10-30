import type { AppData, Entry, MarkingRange, SessionRecord, Settings } from '../types';

/**
 * 個人版の端末間同期。
 * claude.ai アーティファクトの db に、題材ごと1ドキュメント(entries/<id>)と設定(app/settings)で保存する。
 * 変わったドキュメントだけを書き込み、他の端末の変更は購読で受け取る。
 */

export interface EntryDoc {
  entry: Entry;
  ranges: MarkingRange[];
  sessions: SessionRecord[];
}

export interface RemoteChange {
  settings?: Settings;
  upserts: EntryDoc[];
  deletes: string[];
}

export type SyncStatus = 'connecting' | 'synced' | 'offline' | 'error';

const SETTINGS_PATH = 'app/settings';
const entryPath = (id: string) => `entries/${id}`;

/** キー順を揃え、undefined を落とした JSON(保存先でキー順が変わっても同じ内容と判定するため) */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** アプリの状態を保存用のドキュメントに分ける */
export function toDocs(data: AppData): Map<string, Record<string, unknown>> {
  const docs = new Map<string, Record<string, unknown>>();
  docs.set(SETTINGS_PATH, { settings: data.settings });
  for (const entry of data.entries) {
    const doc: EntryDoc = {
      entry,
      ranges: data.markings.find((m) => m.entryId === entry.id)?.ranges ?? [],
      sessions: data.sessions.filter((s) => s.entryId === entry.id),
    };
    docs.set(entryPath(entry.id), doc as unknown as Record<string, unknown>);
  }
  return docs;
}

/** 保存されたドキュメントからアプリの状態を組み立てる */
export function fromDocs(settings: Settings | undefined, docs: EntryDoc[], fallbackSettings: Settings): AppData {
  const sorted = [...docs].sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt));
  return {
    schemaVersion: 1,
    entries: sorted.map((d) => d.entry),
    markings: sorted.map((d) => ({ entryId: d.entry.id, ranges: d.ranges ?? [] })),
    sessions: sorted.flatMap((d) => d.sessions ?? []).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    settings: settings ?? fallbackSettings,
  };
}

function isEntryDoc(x: unknown): x is EntryDoc {
  const d = x as EntryDoc | undefined;
  return !!d && typeof d.entry?.id === 'string' && Array.isArray(d.entry.tokens) && typeof d.entry.createdAt === 'string';
}

function settingsOf(x: Record<string, unknown> | undefined): Settings | undefined {
  const s = x?.settings as Settings | undefined;
  return s && typeof s.quizRatio === 'number' ? s : undefined;
}

export interface CloudSyncHandlers {
  /** 起動時、クラウドに保存済みのデータがあったとき */
  replaceAll(data: AppData): void;
  /** 他の端末での変更を受け取ったとき */
  applyRemote(change: RemoteChange): void;
  status(status: SyncStatus): void;
}

export class CloudSync {
  /** 最後に保存先と一致していた内容(パス → 正規化JSON) */
  private synced = new Map<string, string>();
  /** 書き込み中のパスと、その後に書くべき最新の内容(null は削除) */
  private writing = new Set<string>();
  private queued = new Map<string, Record<string, unknown> | null>();
  private ready = false;
  private latest: AppData;
  private unsubs: (() => void)[] = [];
  private stopped = false;
  private failed = false;
  private db: ClaudeDb;
  private handlers: CloudSyncHandlers;

  constructor(db: ClaudeDb, initial: AppData, handlers: CloudSyncHandlers) {
    this.db = db;
    this.latest = initial;
    this.handlers = handlers;
  }

  async start(): Promise<void> {
    const [entriesSnap, settingsSnap] = await Promise.all([
      this.db.collection('entries').get(),
      this.db.doc(SETTINGS_PATH).get(),
    ]);
    if (this.stopped) return;
    const remoteDocs = entriesSnap.docs.flatMap((d) => {
      const x = d.data();
      return isEntryDoc(x) ? [x] : [];
    });
    const remoteSettings = settingsSnap.exists ? settingsOf(settingsSnap.data()) : undefined;

    if (remoteDocs.length > 0 || remoteSettings) {
      // クラウドにあるものを正とする(この端末に残っている内容はキャッシュ扱い)
      const data = fromDocs(remoteSettings, remoteDocs, this.latest.settings);
      for (const [path, doc] of toDocs(data)) this.synced.set(path, stableStringify(doc));
      this.latest = data;
      this.handlers.replaceAll(data);
    }
    this.ready = true;
    this.flush(this.latest);
    this.subscribe();
    if (!this.failed) this.handlers.status('synced');
  }

  stop(): void {
    this.stopped = true;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  /** ローカルの状態が変わるたびに呼ぶ。保存先と違うドキュメントだけ書く */
  flush(data: AppData): void {
    this.latest = data;
    if (!this.ready || this.stopped) return;
    const docs = toDocs(data);
    const paths = new Set([...docs.keys(), ...this.synced.keys()]);
    for (const path of paths) {
      const doc = docs.get(path) ?? null;
      const json = doc ? stableStringify(doc) : null;
      if (json === (this.synced.get(path) ?? null)) continue;
      if (json === null) this.synced.delete(path);
      else this.synced.set(path, json);
      this.write(path, doc);
    }
  }

  private write(path: string, doc: Record<string, unknown> | null): void {
    if (this.writing.has(path)) {
      this.queued.set(path, doc);
      return;
    }
    this.writing.add(path);
    const ref = this.db.doc(path);
    const op = doc ? ref.set(doc) : ref.delete();
    op.then(
      () => {
        if (this.failed) {
          this.failed = false;
          this.handlers.status('synced');
        }
      },
      () => {
        // 次の変更で書き直せるよう、一致していた記録を消す
        this.synced.delete(path);
        this.failed = true;
        this.handlers.status('error');
      },
    ).finally(() => {
      this.writing.delete(path);
      if (this.queued.has(path)) {
        const next = this.queued.get(path)!;
        this.queued.delete(path);
        this.write(path, next);
      }
    });
  }

  /** 自分が書き込み途中のドキュメントは、届いた内容が古い可能性があるので無視する */
  private busy(path: string): boolean {
    return this.writing.has(path) || this.queued.has(path);
  }

  private subscribe(): void {
    this.unsubs.push(
      this.db.collection('entries').onSnapshot(
        (snap) => {
          const change: RemoteChange = { upserts: [], deletes: [] };
          for (const c of snap.docChanges()) {
            const path = entryPath(c.doc.id);
            if (this.busy(path) || c.doc.metadata.hasPendingWrites) continue;
            if (c.type === 'removed') {
              if (this.synced.has(path)) {
                this.synced.delete(path);
                change.deletes.push(c.doc.id);
              }
              continue;
            }
            const data = c.doc.data();
            if (!isEntryDoc(data)) continue;
            const json = stableStringify(data);
            if (json === this.synced.get(path)) continue;
            this.synced.set(path, json);
            change.upserts.push(data);
          }
          if (change.upserts.length || change.deletes.length) this.handlers.applyRemote(change);
        },
        () => this.handlers.status('error'),
      ),
      this.db.doc(SETTINGS_PATH).onSnapshot(
        (snap) => {
          if (this.busy(SETTINGS_PATH) || snap.metadata.hasPendingWrites || !snap.exists) return;
          const settings = settingsOf(snap.data());
          if (!settings) return;
          const json = stableStringify({ settings });
          if (json === this.synced.get(SETTINGS_PATH)) return;
          this.synced.set(SETTINGS_PATH, json);
          this.handlers.applyRemote({ settings, upserts: [], deletes: [] });
        },
        () => this.handlers.status('error'),
      ),
    );
  }
}
