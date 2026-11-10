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

/** 0.5秒の無音 WAV（8kHz・8bit）。iOS で HTML の audio 要素を鳴らして音声セッションを「再生」扱いにするために使う */
function silentWavUrl(): string {
  const n = 4000;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

class PianoPlayer {
  mode: AudioMode = 'idle';
  private instrument: Instrument | null = null;
  private initPromise: Promise<void> | null = null;
  private listeners = new Set<(m: AudioMode) => void>();
  /** 再生要求の世代。stop() や新しい play() で進み、古い要求（音源読み込み待ち中のもの）を無効にする */
  private generation = 0;

  private silentAudio: HTMLAudioElement | null = null;
  /** 復号済みのピアノ音源（作り直しのときに再ダウンロードしないため） */
  private sampleBuffers: Record<string, AudioBuffer> | null = null;
  /** 画面が裏に回った・中断されたなどで、次の操作のときに音声を作り直す必要があるか */
  needsRevive = false;

  /**
   * ユーザーの操作（タップ・クリック・キー）の中で同期的に呼ぶ。
   * - AudioContext を再開する（iOS は操作の直後でないと再開を許さない）
   * - iOS の消音スイッチ（マナーモード）中でも鳴るよう、音声セッションを「再生」にする
   *   （iOS 17 以降は navigator.audioSession、それ以前は無音の audio 要素を鳴らす）
   */
  unlock(): void {
    if (typeof window === 'undefined') return;
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) {
        if (session.type !== 'playback') session.type = 'playback';
      } else if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        if (!this.silentAudio) {
          const a = document.createElement('audio');
          a.setAttribute('x-webkit-airplay', 'deny');
          a.preload = 'auto';
          a.loop = true;
          a.src = silentWavUrl();
          this.silentAudio = a;
        }
        if (this.silentAudio.paused) void this.silentAudio.play().catch(() => {});
      }
    } catch {
      /* 対応していない環境では何もしない */
    }
    if (this.needsRevive && (this.mode === 'piano' || this.mode === 'synth')) {
      this.revive();
      return;
    }
    if (Tone.getContext().state !== 'running') void Tone.start().catch(() => {});
  }

  /** 診断用: AudioContext の状態（running / suspended / interrupted など） */
  get contextState(): string {
    return Tone.getContext().state;
  }

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
      // 復号済みの音（AudioBuffer）を手元に残し、音声の仕組みを作り直すときに再利用する
      this.sampleBuffers = await new Promise<Record<string, AudioBuffer>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sample load timeout')), LOAD_TIMEOUT_MS);
        const buffers = new Tone.ToneAudioBuffers({
          urls,
          baseUrl,
          onload: () => {
            clearTimeout(timer);
            try {
              resolve(Object.fromEntries(SAMPLE_NOTES.map((n) => [n, buffers.get(n).get()!])));
            } catch (e) {
              reject(e);
            }
          },
          onerror: (err) => { clearTimeout(timer); reject(err); },
        });
      });
      this.instrument = this.buildInstrument();
      this.setMode('piano');
    } catch (err) {
      console.warn('[audio] piano samples unavailable, falling back to synth', err);
      this.sampleBuffers = null;
      this.instrument = this.buildInstrument();
      this.setMode('synth');
    }
    this.watchContext();
  }

  /** 現在の AudioContext 上に楽器を作る（ピアノ音源があればピアノ、なければ簡易シンセ） */
  private buildInstrument(): Instrument {
    if (this.sampleBuffers) {
      return new Tone.Sampler({ urls: this.sampleBuffers, release: 1.2 }).toDestination();
    }
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.6, sustain: 0.25, release: 0.8 },
      volume: -8,
    }).toDestination() as unknown as Instrument;
  }

  /** AudioContext が中断されたら（iOS の 'interrupted' など）、次の操作で作り直す印を付ける */
  private watchContext() {
    const ctx = Tone.getContext();
    ctx.on('statechange', () => {
      if (ctx === Tone.getContext() && ctx.state !== 'running') this.needsRevive = true;
    });
  }

  /**
   * 音声の仕組み（AudioContext と楽器）を新しく作り直す。ユーザー操作の中で同期的に呼ぶこと。
   * iOS Safari では、アプリの切り替えや画面ロックの後に AudioContext が
   * 'interrupted' のままになったり、'running' と報告しながら無音になったりすることがあり、
   * 再開（resume）だけでは直らない場合があるため。
   */
  private revive() {
    this.needsRevive = false;
    this.generation++;
    this.halt();
    const fresh = new Tone.Context();
    Tone.setContext(fresh, true); // 古い AudioContext は閉じる（iOS は同時に持てる数に上限がある）
    void fresh.resume();
    this.instrument = this.buildInstrument();
    this.watchContext();
    this.revivals++;
  }

  /** 診断・テスト用: 作り直した回数 */
  revivals = 0;

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
    // バックグラウンド復帰や着信の後に止まっていたら再開を試みる（操作の外では iOS が応じないことがあるため待ちすぎない）
    if (Tone.getContext().state !== 'running') {
      await Promise.race([Tone.start().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
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

/**
 * 画面上のすべての操作で unlock() を呼ぶ（個々のボタンに書き忘れても iOS で音が出るように）。
 * capture で登録し、ボタン自身の処理より先に AudioContext を再開する。
 */
if (typeof window !== 'undefined') {
  const onGesture = () => player.unlock();
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
  // 画面が裏に回ったら（アプリ切り替え・画面ロック・タブ切り替え）、戻って最初の操作で作り直す
  const markHidden = () => {
    if (document.visibilityState === 'hidden') {
      player.needsRevive = true;
      player.stop();
    }
  };
  document.addEventListener('visibilitychange', markHidden);
  window.addEventListener('pagehide', () => { player.needsRevive = true; player.stop(); });
}
