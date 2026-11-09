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

type Instrument = {
  triggerAttack: (note: string, time: number, velocity: number) => unknown;
  triggerRelease: (note: string, time: number) => unknown;
  releaseAll: (time?: number) => unknown;
};

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
  /** 再生要求の世代。stop() や新しい play() で進み、古い要求（音源読み込み待ち中のもの）を無効にする */
  private generation = 0;

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

  /**
   * 再生する。実際に鳴らし始めたら true、より新しい再生や stop() に取って代わられたら false を返す。
   * 音源の読み込みを待っている間に画面を離れても、古い要求が後から鳴ることはない。
   */
  async play(events: readonly NoteEvent[]): Promise<boolean> {
    const gen = ++this.generation;
    if (typeof window !== 'undefined') {
      const log = (window.__jelPlaybackLog ??= []);
      log.push(events.map((e) => e.midi));
      if (log.length > 50) log.splice(0, log.length - 50);
    }
    await this.init();
    // iOS Safari などで、バックグラウンド復帰や着信後に AudioContext が止まっていたら再開する
    if (Tone.getContext().state !== 'running') {
      await Tone.start().catch(() => {});
    }
    if (gen !== this.generation) return false;
    const inst = this.instrument;
    if (!inst) return false;
    this.halt();
    const transport = Tone.getTransport();
    for (const e of events) {
      const note = Tone.Frequency(e.midi, 'midi').toNote();
      // 発音と消音を両方 Transport に載せる（cancel() で確実に取り消せるようにする）
      transport.schedule((time) => inst.triggerAttack(note, time, e.velocity), e.time);
      transport.schedule((time) => inst.triggerRelease(note, time), e.time + e.duration);
    }
    // わずかに先から開始してスケジュール遅延によるクリックを避ける
    transport.start('+0.05');
    return true;
  }

  private halt() {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    this.instrument?.releaseAll();
  }

  stop() {
    this.generation++;
    this.halt();
  }
}

export const player = new PianoPlayer();
