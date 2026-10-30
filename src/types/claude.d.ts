// claude.ai のアーティファクト内でだけ使える window.claude の、このアプリが使う部分

interface ClaudeDbSnapshotMeta {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

interface ClaudeDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: ClaudeDbSnapshotMeta;
}

interface ClaudeQuerySnapshot {
  docs: ClaudeDocSnapshot[];
  empty: boolean;
  docChanges(): { type: 'added' | 'modified' | 'removed'; doc: ClaudeDocSnapshot }[];
}

interface ClaudeDocRef {
  get(): Promise<ClaudeDocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (snap: ClaudeDocSnapshot) => void, error?: (e: { code: string }) => void): () => void;
}

interface ClaudeCollectionRef {
  doc(id: string): ClaudeDocRef;
  get(): Promise<ClaudeQuerySnapshot>;
  onSnapshot(next: (snap: ClaudeQuerySnapshot) => void, error?: (e: { code: string }) => void): () => void;
}

interface ClaudeDb {
  doc(path: string): ClaudeDocRef;
  collection(path: string): ClaudeCollectionRef;
}

interface ClaudeDownloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}

interface Window {
  claude?: {
    use(name: 'db'): Promise<ClaudeDb | null>;
    use(name: 'downloads'): Promise<ClaudeDownloads | null>;
  };
}
