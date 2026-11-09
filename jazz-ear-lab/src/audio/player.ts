import * as Tone from 'tone';
import type { NoteEvent } from '../engine/types';

/**
 * ピアノ再生。Salamander Grand Piano のサンプルを Tone.Sampler で鳴らす。
 * サンプルを読み込めない場合は簡易シンセにフォールバックする（状態は mode で公開）。
 * 再生は Transport 上にスケジュールし、再生し直すときは前の予定をすべて取り消す。
 */
export type AudioMode = 'idle' | 'loading' | 'piano' | 'synth' | 'error';

const SAMPLE_NOTES = ['A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7'];
const LOAD_TIMEOUT_MS = 15_000;

type Instrument = { triggerAttackRelease: Tone.Sampler['triggerAttackRelease']; releaseAll: (time?: number) => unknown };

declare global {
  interface Window {
    /** E2E テスト用: 直近に再生要求された音（MIDI）の記録 */
    __jelPlaybackLog?: number[][];
  }
}

class PianoPlayer {
  mode: AudioMode = 'idle';
  private instrument: Instrument | null = null;
  private initPromise: Promise<void> | null = null;
  private listeners = new Set<(m: AudioMode) => void>();

  subscribe(fn: (m: AudioMode) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setMode(m: AudioMode) {
    this.mode = m;
    this.listeners.forEach((fn) => fn(m));
  }

  /** ユーザー操作（クリック/キー）の中から呼ぶこと（ブラウザの自動再生制限） */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((e) => {
        this.initPromise = null;
        this.setMode('error');
        throw e;
      });
    }
    return this.initPromise;
  }

  private async doInit() {
    this.setMode('loading');
    await Tone.start();
    const baseUrl = `${import.meta.env.BASE_URL}samples/piano/`;
    const urls = Object.fromEntries(SAMPLE_NOTES.map((n) => [n, `${n.replace('#', 's')}.mp3`]));
    try {
      const sampler = await new Promise<Tone.Sampler>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sample load timeout')), LOAD_TIMEOUT_MS);
        const s = new Tone.Sampler({
          urls,
          baseUrl,
          release: 1.2,
          onload: () => { clearTimeout(timer); resolve(s); },
          onerror: (err) => { clearTimeout(timer); reject(err); },
        }).toDestination();
      });
      this.instrument = sampler;
      this.setMode('piano');
    } catch (err) {
      console.warn('[audio] piano samples unavailable, falling back to synth', err);
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.6, sustain: 0.25, release: 0.8 },
        volume: -8,
      }).toDestination();
      this.instrument = synth as unknown as Instrument;
      this.setMode('synth');
    }
  }

  async play(events: readonly NoteEvent[]): Promise<void> {
    if (typeof window !== 'undefined') {
      (window.__jelPlaybackLog ??= []).push(events.map((e) => e.midi));
    }
    await this.init();
    const inst = this.instrument;
    if (!inst) return;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    inst.releaseAll();
    for (const e of events) {
      const note = Tone.Frequency(e.midi, 'midi').toNote();
      transport.schedule((time) => inst.triggerAttackRelease(note, e.duration, time, e.velocity), e.time);
    }
    // わずかに先から開始してスケジュール遅延によるクリックを避ける
    transport.start('+0.05');
  }

  stop() {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    this.instrument?.releaseAll();
  }
}

export const player = new PianoPlayer();
