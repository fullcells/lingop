'use client';

import { useMemo, useState } from 'react';
import { AnchoredPopover } from './anchored-popover.js';
import { useUserWordStreaksData } from './user-word-streaks.js';
import { WordChipsArrayView } from './word-chips-array-view.js';
import { WORD_STREAKS_MASTERY_THRESHOLD, type WordListV3TreeNode } from '../../core/index.js';
import { useOAT } from '../../oat/react/index.js';
import { wordListDescendantWordsV3 as descendantWords, displayWordListTitleV3 as displayListTitle, createWordListTitleResolverV3 } from '../../core/index.js';
import { BilingualWordListTitle } from './bilingual-word-list-title.js';
import type { WordListsSelectorV3Props } from './word-lists-selector-v3.js';

export type WordListViewV3Props = Omit<WordListsSelectorV3Props, 'onSelect' | 'onDetails'>;
/** Word Lists V3 detail/streak UI for a permitted tree. Never reads Word Lists V2 tables. */
export function WordListViewV3({ tree, metadata, titleGlosses, titlesLoading = false, guiLang, focusLang }: WordListViewV3Props) {
  const { OAT } = useOAT();
  const resolveTitle = useMemo(() => createWordListTitleResolverV3(metadata, titleGlosses), [metadata, titleGlosses]);
  const streaks = useUserWordStreaksData();
  const [selection, setSelection] = useState<{ node: WordListV3TreeNode; anchor: HTMLElement } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  async function updateStreaks(reset: boolean) {
    if (!selection || busy) return;
    setBusy(true);
    setSaveError(false);
    try {
      const words = descendantWords(selection.node);
      if (reset) await streaks.deleteUserWordStreaks(focusLang, words);
      else await streaks.setUserWordStreaksToValue(focusLang, words, WORD_STREAKS_MASTERY_THRESHOLD);
      setSelection(null);
    } catch { setSaveError(true); }
    finally { setBusy(false); }
  }
  function render(node: WordListV3TreeNode, level = 0): React.ReactNode {
    const title = displayListTitle(resolveTitle(node.list, guiLang) ?? (titlesLoading ? '…' : '—'));
    return <section key={node.list.id} className={`lingop-word-list-view__node ${level === 0 ? 'lingop-word-list-view__node--root' : level === 1 ? 'lingop-word-list-view__node--outlined' : ''}`}>
      <header className="lingop-word-list-view__title">
        <BilingualWordListTitle className="lingop-word-list-view__bilingual-title" title={node.list.title} translatedTitle={resolveTitle(node.list, guiLang)} lang={node.list.lang} guiLang={guiLang} loading={titlesLoading} />
        <button type="button" className="lingop-word-list-view__title-streak" aria-label={`${OAT('Word Streaks')}: ${title}`} onClick={event => {
          setSaveError(false);
          setSelection(selection?.anchor === event.currentTarget ? null : { node, anchor: event.currentTarget });
        }}><MasteryIcon /></button>
      </header>
      {!!node.list.words.length && <div className="lingop-word-list-view__leaf"><WordChipsArrayView words={node.list.words.map(word => word.text)} lang={focusLang} guiLang={guiLang} showWordStreaks /></div>}
      {!!node.children.length && <div className="lingop-word-list-view__children">{node.children.map(child => render(child, level + 1))}</div>}
      {!node.list.words.length && !node.children.length && <p>0 {OAT('Words')}</p>}
    </section>;
  }
  return <>
    <div className="lingop-word-list-view" lang={focusLang}>
      {tree && render(tree)}
    </div>
    {selection && <AnchoredPopover anchor={selection.anchor} open onOpenChange={open => { if (!open && !busy) setSelection(null); }} ariaLabel={OAT('Word Streaks')} className="lingop-word-list-view__streak-popover" placement="bottom" showArrow arrowClassName="lingop-word-list-view__streak-popover-arrow" arrowFill="#fff" arrowStroke="rgba(15, 23, 42, 0.16)">
      <div className="lingop-word-list-view__streak-popover-panel">
        <div className="lingop-word-list-view__streak-actions">
          <button type="button" disabled={busy} className="lingop-word-list-view__streak-action lingop-word-list-view__streak-action--mastered" aria-label={`${OAT('Learnt')}: ${displayListTitle(selection.node.list.title)}`} onClick={() => void updateStreaks(false)}><MasteryIcon filled /><span>{WORD_STREAKS_MASTERY_THRESHOLD}</span></button>
          <button type="button" disabled={busy} className="lingop-word-list-view__streak-action lingop-word-list-view__streak-action--reset" aria-label={`${OAT('Reset')}: ${displayListTitle(selection.node.list.title)}`} onClick={() => void updateStreaks(true)}><MasteryIcon /><span>0</span></button>
          <details className="lingop-word-list-view__streak-info"><summary aria-label={OAT('About Word Streaks')}>ⓘ</summary><div className="lingop-word-list-view__streak-info-content">
            <p>{OAT('Word Streaks')}</p><p>{OAT('Word Streaks represent how well you know a word.')}</p>
            <p>{OAT('The more you see a word, or answer questions with a word, the more that word’s word streak will increase.')}</p>
            <p>{OAT('If you request a lot of hints for a word, or answer questions with the word incorrectly, its word streak decreases.')}</p>
            <p>{OAT('Use the buttons to set Word Streaks to a specific value.')}</p>
          </div></details>
        </div>
        {saveError && <p role="alert">{OAT('Something went wrong.')}</p>}
      </div>
    </AnchoredPopover>}
  </>;
}

function MasteryIcon({ filled = false }: { filled?: boolean }) {
  return <svg className="lingop-word-list-view__icon" viewBox="0 0 24 24" aria-hidden="true">
    {filled && <path className="lingop-word-list-view__mastery-fill" d="M2 9 12 4l10 5-10 5L2 9Z" />}
    <path d="M2 9 12 4l10 5-10 5L2 9Z" /><path d="M6 11v5c2.8 2.4 9.2 2.4 12 0v-5" /><path d="M22 9v6" />
  </svg>;
}
