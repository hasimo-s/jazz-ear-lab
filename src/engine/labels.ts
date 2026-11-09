import type { Category } from './types';

/** 回答ID → 表示ラベルの i18n キー */
export function choiceLabelKey(category: Category, id: string): string {
  switch (category) {
    case 'interval': return `interval.name.${id}`;
    case 'chord': return `chord.name.${id}`;
    case 'progression': return `progression.name.${id}`;
  }
}
