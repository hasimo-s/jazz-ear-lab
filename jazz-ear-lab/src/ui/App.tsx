import { useState } from 'react';
import type { QuizSettings } from '../engine/types';
import { randomSeed } from '../theory/rng';
import { player } from '../audio/player';
import { Home } from './screens/Home';
import { CategorySelect } from './screens/CategorySelect';
import { Quiz, type SessionSummary } from './screens/Quiz';
import { Result } from './screens/Result';
import { History } from './screens/History';

export interface QuizConfig {
  settings: QuizSettings;
  sessionSeed: number;
  length: number;
}

type Screen =
  | { name: 'home' }
  | { name: 'categories' }
  | { name: 'quiz'; config: QuizConfig }
  | { name: 'result'; summary: SessionSummary }
  | { name: 'history' };

/** ?seed=123 でセッションのシードを固定できる（テスト・不具合報告用） */
function seedFromUrl(): number | null {
  const v = new URLSearchParams(window.location.search).get('seed');
  if (v === null || !/^\d+$/.test(v)) return null;
  return Number(v) >>> 0;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  const startQuiz = (settings: QuizSettings, length: number) => {
    // iOS Safari 対策: AudioContext の再開はユーザー操作のハンドラ内で同期的に開始する
    player.init().catch(() => {});
    setScreen({ name: 'quiz', config: { settings, length, sessionSeed: seedFromUrl() ?? randomSeed() } });
  };

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onStart={() => setScreen({ name: 'categories' })}
          onHistory={() => setScreen({ name: 'history' })}
          onReview={(s) => startQuiz(s, 10)}
        />
      );
    case 'categories':
      return <CategorySelect onBack={() => setScreen({ name: 'home' })} onStart={startQuiz} />;
    case 'quiz':
      return (
        <Quiz
          key={screen.config.sessionSeed}
          config={screen.config}
          onQuit={() => setScreen({ name: 'home' })}
          onFinish={(summary) => setScreen({ name: 'result', summary })}
        />
      );
    case 'result':
      return (
        <Result
          summary={screen.summary}
          onAgain={() => startQuiz(screen.summary.config.settings, screen.summary.config.length)}
          onHome={() => setScreen({ name: 'home' })}
          onHistory={() => setScreen({ name: 'history' })}
        />
      );
    case 'history':
      return <History onBack={() => setScreen({ name: 'home' })} onReview={(s) => startQuiz(s, 10)} />;
  }
}
