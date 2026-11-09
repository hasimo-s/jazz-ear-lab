import { ja, type MessageKey } from './ja';

const messages: Record<string, string> = ja;

/** キーから文字列を引き、{name} 形式のパラメータを埋める。未定義キーはキー自体を返す */
export function t(key: MessageKey | (string & {}), params: Record<string, string | number> = {}): string {
  const template = messages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export function hasMessage(key: string): boolean {
  return key in messages;
}

export type { MessageKey };
