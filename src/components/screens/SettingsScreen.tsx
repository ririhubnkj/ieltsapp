import { useRef, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useEntries } from '../../hooks/useEntries';
import { useSettings } from '../../hooks/useSettings';
import { buildExportFile, mergeAppData, parseImportFile, type ImportError } from '../../lib/exportImport';
import { joinTokens } from '../../lib/joinTokens';
import { BackButton } from '../common/BackButton';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TrashIcon } from '../common/icons';
import type { Entry } from '../../types';
import { HAS_PRESETS, IS_PERSONAL } from '../../lib/target';

function importErrorMessage(kind: ImportError['kind']): string {
  switch (kind) {
    case 'parse':
      return 'ファイルを読み込めませんでした。JSON形式のバックアップファイルを選択してください。';
    case 'unsupported-version':
      return '対応していないバージョンのバックアップファイルです。';
    case 'invalid-shape':
      return 'データ形式が不正です。破損している可能性があります。';
    case 'invalid-reference':
      return 'データの参照関係が不正です。破損している可能性があります。';
  }
}

export function SettingsScreen() {
  const { data, dispatch } = useAppData();
  const { settings, quizMode } = useSettings();
  const { entries, deleteEntry } = useEntries();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImportRaw, setPendingImportRaw] = useState<string | null>(null);
  const [confirmPresetDelete, setConfirmPresetDelete] = useState(false);
  // 公開版から外した教材ライブラリの題材(以前に追加したものが端末に残っている場合だけ出す)
  const presetEntries = HAS_PRESETS ? [] : entries.filter((e) => e.presetId);

  // 引き継ぎ(iPhone では Safari とホーム画面のアプリで保存場所が分かれるので、コピー&貼り付けで移す)
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const copyForTransfer = async () => {
    const json = JSON.stringify(buildExportFile(data));
    try {
      await navigator.clipboard.writeText(json).catch(() => {
        // 古いブラウザや許可が無いときは、見えない入力欄を選択してコピーする
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, json.length);
        const ok = document.execCommand('copy');
        ta.remove();
        if (!ok) throw new Error('copy failed');
      });
      setTransferMessage(`${entries.length}本の英文をコピーしました。引き継ぎ先で「貼り付けて引き継ぐ」を押してください。`);
    } catch {
      setTransferMessage('コピーできませんでした。「データをエクスポート」でファイルに書き出してください。');
    }
  };

  const openPaste = async () => {
    setTransferMessage(null);
    setPasteOpen(true);
    // 読み取りを許可してもらえれば、コピーしたデータを自動で入れる。断られたら手で貼り付けてもらう
    const text = await navigator.clipboard?.readText().catch(() => '');
    if (text) setPasteText(text);
  };

  const applyPaste = () => {
    const result = parseImportFile(pasteText.trim());
    if (!result.ok) {
      setTransferMessage('引き継ぎ用のデータではないようです。もう一度コピーしてから貼り付けてください。');
      return;
    }
    const { data: merged, added } = mergeAppData(data, result.data);
    if (added > 0) dispatch({ type: 'REPLACE_ALL', data: merged });
    setPasteOpen(false);
    setPasteText('');
    setTransferMessage(added > 0 ? `${added}本の英文を引き継ぎました。` : '新しく引き継ぐ英文はありませんでした(すべて登録済みです)。');
  };

  const handleExport = async () => {
    const file = buildExportFile(data);
    const json = JSON.stringify(file, null, 2);
    const filename = `eiwaku-backup-${new Date().toISOString().slice(0, 10)}.json`;
    // アーティファクトの枠内では通常のダウンロードが効かないので、専用の保存機能を使う
    const downloads = IS_PERSONAL ? await window.claude?.use('downloads').catch(() => null) : null;
    if (downloads) {
      await downloads.save({ filename, data: json }).catch(() => undefined);
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    const text = await file.text();
    const result = parseImportFile(text);
    if (!result.ok) {
      setImportError(importErrorMessage(result.error.kind));
      return;
    }
    setPendingImportRaw(text);
  };

  const confirmImport = () => {
    if (!pendingImportRaw) return;
    const result = parseImportFile(pendingImportRaw);
    if (result.ok) {
      dispatch({ type: 'REPLACE_ALL', data: result.data });
    }
    setPendingImportRaw(null);
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <BackButton to="/" />
        <div className="topbar-title">設定</div>
      </div>

      <div className="screen-body">
        <div>
          <div className="section-label">学習設定</div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14.5 }}>出題する割合</span>
              <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                {quizMode === 'allWords' ? '全単語' : 'マーキング'}から{Math.round(settings.quizRatio * 100)}%(学習開始画面で変更)
              </span>
            </div>
          </div>
        </div>

        {!IS_PERSONAL && (
          <div>
            <div className="section-label">データの引き継ぎ</div>
            <div className="card" style={{ padding: 0 }}>
              <button
                onClick={copyForTransfer}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', textAlign: 'left', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ fontSize: 14.5, color: 'var(--text)' }}>引き継ぎ用にコピー</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>コピー</span>
              </button>
              <button onClick={openPaste} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', textAlign: 'left' }}>
                <span style={{ fontSize: 14.5, color: 'var(--text)' }}>コピーしたデータを貼り付けて引き継ぐ</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>貼り付け</span>
              </button>
              {pasteOpen && (
                <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="ここを長押しして「ペースト」"
                    style={{
                      width: '100%',
                      height: 90,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 12,
                      color: 'var(--text)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="secondary-btn" style={{ flex: 1, padding: '9px' }} onClick={() => setPasteOpen(false)}>
                      キャンセル
                    </button>
                    <button className="primary-btn" style={{ flex: 1, padding: '9px' }} disabled={!pasteText.trim()} onClick={applyPaste}>
                      引き継ぐ
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
              iPhone では、Safari で開いたときとホーム画面のアプリで開いたときで、保存場所が別になります。
              英文を移したいときは、移す元で「コピー」、移す先で「貼り付け」を押してください。今ある英文は消えず、足りない英文だけが加わります。
            </p>
            {transferMessage && (
              <p style={{ fontSize: 12.5, color: 'var(--accent)', marginTop: 6 }}>{transferMessage}</p>
            )}
          </div>
        )}

        <div>
          <div className="section-label">データ管理</div>
          <div className="card" style={{ padding: 0 }}>
            <button
              onClick={handleExport}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left' }}
            >
              <span style={{ fontSize: 14.5, color: 'var(--text)' }}>データをエクスポート</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>書き出す</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', textAlign: 'left' }}
            >
              <span style={{ fontSize: 14.5, color: 'var(--text)' }}>データをインポート</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>読み込む</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
          </div>
          {importError && (
            <p style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 8 }}>{importError}</p>
          )}
        </div>

        {presetEntries.length > 0 && (
          <div>
            <div className="section-label">教材ライブラリ</div>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
                以前に「まとめて追加」した題材が {presetEntries.length}本 あります
              </span>
              <button
                className="secondary-btn"
                style={{ padding: '8px 14px', fontSize: 13, color: 'var(--danger)', flexShrink: 0 }}
                onClick={() => setConfirmPresetDelete(true)}
              >
                まとめて削除
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="section-label">英文の削除</div>
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>登録済みの英文はありません</p>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    gap: 12,
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 13.5,
                      flex: 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {joinTokens(entry.tokens.slice(0, 12))}...
                  </span>
                  <button
                    onClick={() => setDeleteTarget(entry)}
                    aria-label="削除"
                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', flexShrink: 0 }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="この英文を削除しますか？"
          detail={`${joinTokens(deleteTarget.tokens.slice(0, 16))}...`}
          body="マーキングと学習履歴もすべて削除されます。この操作は取り消せません。"
          confirmLabel="削除する"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteEntry(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}

      {confirmPresetDelete && (
        <ConfirmDialog
          title={`教材ライブラリの題材 ${presetEntries.length}本を削除しますか？`}
          body="自分で登録した英文は残ります。削除した題材のマーキングと学習履歴も消え、元に戻せません。"
          confirmLabel="削除する"
          danger
          onCancel={() => setConfirmPresetDelete(false)}
          onConfirm={() => {
            presetEntries.forEach((e) => deleteEntry(e.id));
            setConfirmPresetDelete(false);
          }}
        />
      )}

      {pendingImportRaw && (
        <ConfirmDialog
          title="現在のデータを置き換えますか？"
          body="インポートしたデータで現在のすべての英文・マーキング・学習履歴を置き換えます。元に戻せません。"
          confirmLabel="置き換える"
          danger
          onCancel={() => setPendingImportRaw(null)}
          onConfirm={confirmImport}
        />
      )}
    </div>
  );
}
