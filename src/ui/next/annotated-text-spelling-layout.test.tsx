import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import type {AnnotatedText} from '../../core/annotation/types.js';

const state = vi.hoisted(() => ({streaks: {貓: 5, 狗: 5}}));
vi.mock('./user-word-streaks.js', () => ({
  useOptionalUserWordStreaksData: () => ({userWordStreaks: {yue: state.streaks}}),
}));
import {AnnotatedTextView} from './annotated-text.js';

const annotation: AnnotatedText = {
  lang: 'yue', lang_text: '貓狗。', containsPhonetics: true, containsGloss: false,
  ref: null, owner_id: null,
  tokens: [
    {text: '貓', isWord: 1, phoneticToken: [['貓', 'maau1']]},
    {text: '狗', isWord: 1, phoneticToken: [['狗', 'gau2']]},
    {text: '。', isWord: 0},
  ],
};
function render(props: Partial<React.ComponentProps<typeof AnnotatedTextView>> = {}) {
  return renderToStaticMarkup(<AnnotatedTextView annotatedText={annotation}
    showSpelling="ON_HINT" showGlossText="NEVER" showGlossEmoji="NEVER"
    l10nWordDetailHandler={() => {}} {...props}/>);
}
function rows(html: string) {
  return html.match(/<span class="phonic-spelling"[^>]*>/g) ?? [];
}
describe('empty spelling row layout', () => {
  it('marks the entire row collapsible when all hints are hidden', () => {
    state.streaks = {貓: 5, 狗: 5};
    expect(rows(render())).toHaveLength(3);
    expect(rows(render()).every(row => row.includes('data-empty="true"'))).toBe(true);
  });
  it('retains a shared row when a hint appears, including punctuation placeholders', () => {
    state.streaks = {貓: 5, 狗: 1};
    const spellingRows = rows(render());
    expect(spellingRows.map(row => row.includes('data-empty="true"'))).toEqual([true, false, true]);
  });
  it('preserves always-visible and spelling-only content', () => {
    expect(rows(render({showSpelling: 'ALWAYS'})).filter(row => !row.includes('data-empty'))).toHaveLength(2);
    expect(rows(render({showSpelling: 'ALWAYS', showMainText: false})).every(row => !row.includes('data-empty'))).toBe(true);
    expect(rows(render({showSpelling: 'NEVER'}))).toHaveLength(0);
  });
  it('also identifies empty spelling placed below the main text', () => {
    state.streaks = {貓: 5, 狗: 5};
    expect(rows(render({astyle: {spellingOnBottom: true}})).every(row => row.includes('data-empty="true"'))).toBe(true);
  });
});
