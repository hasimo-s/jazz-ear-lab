# Jazz Ear Lab 設計メモ（MVP 第1段階）

## 1. 技術構成

| 領域 | 採用 | バージョン | ライセンス |
|---|---|---|---|
| UI | React + TypeScript | 19.3 / 7.0 | MIT / Apache-2.0 |
| ビルド | Vite | 8.3 | MIT |
| スタイル | Tailwind CSS (`@tailwindcss/vite`) | 4.3 | MIT |
| 音声 | Tone.js (Web Audio API) | 15.1 | MIT |
| 音楽理論 | tonal.js | 6.5 | MIT |
| 永続化 | IndexedDB (`idb`) | 8.0 | ISC |
| 単体テスト | Vitest (+ fake-indexeddb) | 5.1 | MIT / Apache-2.0 |
| E2E | Playwright | 1.65 | Apache-2.0 |
| ピアノ音源 | Salamander Grand Piano V3（`@audio-samples/piano-mp3-velocity8` 経由） | 1.0.5 | 音源本体 **CC BY 3.0**（Alexander Holm）。パッケージは MIT |

音源は CC BY 3.0 のため、アプリ内（ホーム画面下部）と README にクレジットを表示している。

## 2. ディレクトリ構成

```
src/
  theory/      純粋な音楽理論（DOM・音声に依存しない）
    rng.ts         シード付き乱数 (mulberry32) とシード導出
    pitch.ts       MIDI ⇔ 音名、綴り候補、tonal による移調＋MIDI整合チェック
    intervals.ts   音程定義データ（半音数・綴り候補・異名同音の注記）
  engine/      問題生成・検証・採点・集計（純粋関数）
    types.ts             問題・設定・採点のデータモデル
    intervalConfig.ts    難易度ごとの母集団・音域・タイミング
    intervalGenerator.ts 問題生成（シード決定的）・比較再生
    intervalValidation.ts 曖昧さ排除のための検証
    grading.ts           採点
    session.ts           セッション（sessionSeed + index → 問題）
    stats.ts / review.ts 正答率・苦手抽出・復習設定
  audio/player.ts   Tone.Sampler（失敗時は簡易シンセへフォールバック）
  storage/db.ts     IndexedDB
  i18n/             表示文字列（ja.ts）。UI・エンジンは i18n キーのみを扱う
  ui/               画面（Home / CategorySelect / Quiz / Result / History）
e2e/               Playwright
scripts/copy-samples.mjs  音源を public/samples/piano へコピー
```

依存方向は `ui → engine → theory`、`ui → audio / storage / i18n`。engine と theory は React・Tone.js に依存しないため Node 上で高速にテストできる。

## 3. 問題データモデル

```ts
interface NoteEvent { midi: number; time: number; duration: number; velocity: number } // 秒
interface Choice { id: string; labelKey: string }        // 表示文字列は i18n で解決
interface QuestionBase {
  id: string;            // `${category}:${seed}`
  category: 'interval' | 'chord' | 'progression';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  seed: number;
  choices: Choice[];     // 4択、表示順
  answerId: string;
  playback: NoteEvent[]; // 実際に鳴らす音 = 採点の根拠
  itemKey: string;       // 集計キー 例 'interval:M3:ascending'
}
interface IntervalQuestion extends QuestionBase {
  category: 'interval';
  payload: { intervalId; direction; notes: [string, string]; midis: [number, number] };
}
```

- **再現性**: `questionAt(settings, sessionSeed, index)` → `deriveSeed(sessionSeed, index)` → `generate(settings, seed)`。URL の `?seed=123` でセッションを固定できる（画面下部にシードを表示）。
- **生成時検証**: 生成器は毎回 `validate*Question` を実行し、違反があれば例外にする（不正な問題は画面に出ない）。
- **採点**: `grade(q, choiceId)` は `answerId` との単純比較。選択肢外の ID は例外。生成AIは一切使用しない。
- **回答記録** (`AttemptRecord`): questionId, seed, itemKey, answerId, chosenId, correct, playCount, responseMs（問題表示〜回答）, timestamp。

### コード・進行への拡張方針（未実装）
- `ChordQuestion.payload`: `{ quality, rootMidi, bassMidi, voicing: number[] (MIDI), requiredTones: string[] }`
- `ProgressionQuestion.payload`: `{ key, romanNumerals: string[], chords: ChordVoicing[], tempo }`
- `Question` を判別共用体に拡張し、`questionAt` の `switch` に追加する。

## 4. 曖昧さ排除のルール

### インターバル（実装済み・テスト済み）
1. 1つの半音数に1つの音程IDだけを定義する（増4/減5は「増4度/減5度」の1択、♯9 と短10度は同一IDとして扱い解説で注記）。→ 選択肢の半音数はすべて異なる。
2. 鳴る2音の距離・方向 = 正解の半音数・方向。
3. 2音は同じ音量・同じ長さで、重ならずに順に鳴る（旋律的音程）。
4. 2音とも難易度の音域内。
5. 表示音名の MIDI = 鳴る MIDI、ダブル♯/♭を使わない（ルートの綴り候補 × 音程の綴り候補から選択）。
6. 選択肢はすべて難易度の母集団内、正解は必ず選択肢に含まれる。

### コード（実装済み・テスト済み）
データ: `src/theory/chords.ts`。各コードは `degrees`（完全な構成音）と `essential`（省略不可の音）を持つ。
構成音は tonal.js の ChordType と照合するテストがある（7alt は tonal の `7#9b13` から5度を除いたもの）。

**判定基準**: ベース（最低音）＝ルートを前提に、鳴らした音のルート基準ピッチクラス集合 S が
`essential ⊆ S ⊆ degrees` を満たすとき、S はそのコードの正しいボイシングとみなす。

1. ベース＝ルート（C6 と Am7/C、m7♭5 と m6 の転回、dim7・aug の転回による多義性をここで排除）。
2. 正解: S が正解コードの正しいボイシングであること（3度/sus4、7度、変化音、テンションは省略しない。省略してよいのは完全5度のみ）。
3. **曖昧さの排除**: S が他の選択肢のどれの正しいボイシングにもならないこと。生成時はこの条件を満たさない候補を誤答から除外し、検証器でも再確認する。
4. 選択肢どうしの構成音集合がすべて異なること。
5. 和音の全音は同時刻・同じ長さ・同じ音量。
6. 綴りと実音の一致、ダブル臨時記号なし（♯9→短10度、♯5→短6度などの予備綴り）。
7. 音域とロー・インターバル・リミット（C3 未満の隣接音は完全5度以上、G3 未満で2度を作らない）。

難易度ごとのボイシング: 初級=ルート・ポジション密集、中級=ベース＋1オクターブ以上上の上部構造（転回ランダム）、上級=低音ベース＋中音域のガイドトーン＋その上にテンション（5度は50%で省略）。

未対応: 転回形ベース（スラッシュ・コード）での出題、ルートレス・ボイシング単体での出題、6th コード、m11 など。

### 進行（設計のみ・未実装）
- 比較対象の進行は同じキー・同じ音域・同じテンポ・同じ音量で生成し、違いが和声機能のみになるようにする（テストで tempo/velocity/register の一致を検証）。
- 選択肢の進行どうしで、鳴る和音列が完全一致しないことを検証（例: II–♭II7–I と II–V–I は ♭II7 = V7 の裏コードだが構成音が異なるので区別可能、を確認）。

## 5. テスト設計

| 対象 | テスト | 状態 |
|---|---|---|
| rng | 決定性、一様性、deriveSeed の衝突なし | 実装済 |
| 音程表 | 半音数が tonal と一致、半音数の重複なし | 実装済 |
| 綴り | 全MIDI の綴り候補 = MIDI、移調の MIDI 整合 | 実装済 |
| 生成 | 3難易度 × 3方向 × 3000シードすべて validate 通過 | 実装済 |
| 生成 | 全音域 × 全音程 × 両方向でダブル臨時記号なしの綴りが存在 | 実装済 |
| 生成 | 母集団の全音程が出題される／正解位置の偏りなし／上級の紛らわしい誤答 | 実装済 |
| 検証器 | 意図的に壊した問題（音のずれ・異名同音重複・方向不一致・重なり・音量差・綴り不一致・音域外）を検出 | 実装済 |
| 採点 | 正解・不正解・選択肢外ID | 実装済 |
| 集計 | 正答率・平均・苦手抽出・復習設定 | 実装済 |
| 保存 | IndexedDB 保存・取得・消去（fake-indexeddb） | 実装済 |
| E2E | シード固定で画面の選択肢・再生音がエンジンと一致、回答〜結果〜履歴〜再読込 | 実装済（desktop / Pixel 7 エミュレーション） |
| E2E | キーボードのみで回答 | 実装済 |
| コード定義 | tonal.js の ChordType と構成音が一致、essential の妥当性、同一音集合のコードなし | 実装済 |
| コード生成 | 3難易度 × 3000シードすべて validate 通過、全コード出題、正解位置の偏りなし、5度省略の有無 | 実装済 |
| コード生成 | 全ルート × 全コード × 全転回 × 5度省略で、正しいボイシング・綴りが成立し演奏可能な配置が存在 | 実装済 |
| コード検証器 | 転回（ベース≠ルート）・3度欠落・音量差・重複・「13th から 13 を抜くと 9th と区別不能」を検出 | 実装済 |
| E2E | コード 3難易度の回答フロー、分散和音、比較再生、履歴消去の確認 | 実装済 |
| 進行 | 上記「曖昧さ排除のルール」 | 未実装 |

## 6. 技術的リスク

| リスク | 内容 | 対策・現状 |
|---|---|---|
| iOS Safari の自動再生制限 | AudioContext はユーザー操作中に再開が必要 | 「スタート」押下ハンドラ内で `Tone.start()` を同期的に呼ぶ。**実機未検証** |
| iOS のマナーモード | サイレントスイッチ ON で Web Audio が鳴らない場合がある | 未対策（既知の制約） |
| 音源サイズ | 約4MB（22ファイル）を初回に読み込む | 初回のみ「読み込み中」表示。失敗・15秒タイムアウト時は簡易シンセへフォールバック。将来は音域ごとの遅延読み込みを検討 |
| 音源ライセンス | CC BY 3.0 の表示義務 | アプリ・README にクレジット |
| タイミング精度 | 進行の再生ではテンポの安定性が必要 | Transport 上でスケジュール（setTimeout 不使用） |
| 異名同音・理論的曖昧さ | 同じ音に複数の正解 | 半音数で一意なID設計＋生成時検証＋大量シードテスト |
| ブラウザ保存の消失 | プライベートブラウズ、容量逼迫、ユーザー操作で IndexedDB が消える | 保存失敗時は画面に警告。エクスポートは未実装 |
| E2E と実音 | ヘッドレスでは「実際に聞こえるか」は検証できない | 再生要求（MIDI列）を `window.__jelPlaybackLog` に記録して検証。音質・聴感は手動確認が必要 |
| バンドルサイズ | Tone.js 等で JS が約515KB（gzip 148KB） | 将来コード分割 |
