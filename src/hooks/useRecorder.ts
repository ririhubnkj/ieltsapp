import { useCallback, useEffect, useRef, useState } from 'react';
import { pickMimeType } from '../lib/speakingExam';

/** 1回分の録音。音声はメモリ上だけに置き、画面を離れると消す */
export interface Recording {
  url: string;
  /** 録音した長さ(秒)。webm は長さの情報を持たないことがあるので、自分で計る */
  seconds: number;
  mimeType: string;
}

/** unknown はまだマイクを使っていない、ready は録音できる、denied は許可されなかった、unsupported は端末が対応していない */
export type MicStatus = 'unknown' | 'ready' | 'denied' | 'unsupported';

/**
 * MediaRecorder で答えを録音する。prepare でマイクを1度だけ開き、start と stop で1回ずつ録る。
 * 作った object URL は clearRecordings と画面を離れるときに解放する
 */
export function useRecorder() {
  const [status, setStatus] = useState<MicStatus>('unknown');
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const urlsRef = useRef<string[]>([]);
  const aliveRef = useRef(true);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearRecordings = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  const prepare = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      streamRef.current = stream;
      setStatus('ready');
      return true;
    } catch {
      setStatus('denied');
      return false;
    }
  }, []);

  /** 録音を始める。マイクが無ければ false */
  const start = useCallback((): boolean => {
    const stream = streamRef.current;
    if (!stream) return false;
    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      return true;
    } catch {
      return false;
    }
  }, []);

  /** 録音を止めて、聞き直せる形にする。録音していなければ null */
  const stop = useCallback((): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
    const seconds = (Date.now() - startedAtRef.current) / 1000;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (!aliveRef.current || blob.size === 0) return resolve(null);
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        resolve({ url, seconds, mimeType: type });
      };
      recorder.onerror = () => resolve(null);
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // 止められなくても、マイクは下で閉じる
        }
      }
      release();
      clearRecordings();
    };
  }, [release, clearRecordings]);

  return { status, prepare, start, stop, release, clearRecordings };
}
