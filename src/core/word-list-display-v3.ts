import type { WordListV3TreeNode } from './word-lists-v3.js';
import { segmentWordListTitle } from './word-lists.js';

export function wordListDescendantWordsV3(node: WordListV3TreeNode): string[] {
  const words = new Set<string>();
  const visited = new Set<number>();
  function visit(current: WordListV3TreeNode) {
    if (visited.has(current.list.id)) return;
    visited.add(current.list.id);
    current.list.words.forEach(word => words.add(word.text));
    current.children.forEach(visit);
  }
  visit(node);
  return [...words];
}

export function displayWordListTitleV3(title: string): string {
  const { titleLabel, titleCounter } = segmentWordListTitle(title);
  return `${titleLabel}${titleCounter !== null ? ` ${titleCounter}` : ''}`;
}

export function wordListProgressV3(node: WordListV3TreeNode, streaks: Record<string, number>) {
  const words = new Set(wordListDescendantWordsV3(node).map(word => word.toUpperCase()));
  const seen = new Set(Object.keys(streaks).map(word => word.toUpperCase()));
  return { total: words.size, seen: [...words].filter(word => seen.has(word)).length };
}

