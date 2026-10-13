'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLingopClientData } from './lingop-client-data-provider.js';
import { useUserWordStreaksData } from './user-word-streaks.js';
import { segmentWordListTitle, type SBWordListV3Row, type WordListV3TreeNode } from '../../core/index.js';
import { displayWordListTitleV3 as displayListTitle, createWordListTitleResolverV3, wordListProgressV3 as wordListProgress, type WordListTitleGlossesV3 as ListTitleGlosses } from '../../core/index.js';
import { BilingualWordListTitle } from './bilingual-word-list-title.js';

type TitleResolver = ReturnType<typeof createWordListTitleResolverV3>;
export type WordListSelectionV3 = { id: number; title: string };
export type WordListsSelectorV3Props = {
  tree: WordListV3TreeNode;
  metadata: SBWordListV3Row[];
  titleGlosses?: ListTitleGlosses | undefined;
  titlesLoading?: boolean | undefined;
  guiLang: string;
  focusLang: string;
  onSelect: (list: WordListSelectionV3) => void;
  onDetails: (id: number) => void;
};

/** Word Lists V3 selector for a permitted tree; no Word Lists V2 reads or Prebake provider. */
export function WordListsSelectorV3({ tree, metadata, titleGlosses, titlesLoading = false, guiLang, focusLang, onSelect, onDetails }: WordListsSelectorV3Props) {
  const resolveTitle = useMemo(() => createWordListTitleResolverV3(metadata, titleGlosses), [metadata, titleGlosses]);
  function render(node: WordListV3TreeNode, level = 1): React.ReactNode {
    if (!node.children.length || level >= 2) {
      return <WordListCard key={node.list.id} {...{ node, resolveTitle, titlesLoading, guiLang, focusLang, onSelect, onDetails }} />;
    }
    const gloss = resolveTitle(node.list, guiLang);
    const title = displayListTitle(gloss ?? node.list.title);
    return <section key={node.list.id} className="lingop-word-lists-selector__branch">
      <button type="button" className="lingop-word-lists-selector__branch-title" onClick={() => onSelect({ id: node.list.id, title })}>
        <BilingualWordListTitle title={node.list.title} translatedTitle={gloss} lang={node.list.lang} guiLang={guiLang} loading={titlesLoading} primaryClassName="lingop-word-list-title--strong" />
      </button>
      <div className="lingop-word-lists-selector__leaf-grid">{node.children.map(child => render(child, level + 1))}<span className="lingop-word-lists-selector__scroll-spacer" /></div>
    </section>;
  }
  return <div className="lingop-word-lists-selector">
    {tree && <div className="lingop-word-lists-selector__root">
      {tree.list.words.length > 0 && <WordListCard {...{ node: tree, resolveTitle, titlesLoading, guiLang, focusLang, onSelect, onDetails }} />}
      {tree.children.map(node => <Fragment key={node.list.id}>{render(node)}</Fragment>)}
    </div>}
  </div>;
}

function WordListCard({ node, resolveTitle, titlesLoading, guiLang, focusLang, onSelect, onDetails }: {
  node: WordListV3TreeNode; resolveTitle: TitleResolver; titlesLoading: boolean; guiLang: string; focusLang: string;
  onSelect: (list: WordListSelectionV3) => void; onDetails: (id: number) => void;
}) {
  const { lingopClient } = useLingopClientData();
  const { userWordStreaks } = useUserWordStreaksData();
  const [emoji, setEmoji] = useState('');
  const gloss = resolveTitle(node.list, guiLang);
  const title = displayListTitle(gloss ?? node.list.title);
  const emojiTitle = segmentWordListTitle(resolveTitle(node.list, 'en') ?? '').titleLabel;
  const { titleCounter } = segmentWordListTitle(node.list.title);
  const { seen, total } = wordListProgress(node, userWordStreaks[focusLang] ?? {});
  useEffect(() => {
    let active = true;
    setEmoji('');
    if (!emojiTitle) return;
    void lingopClient.generateEmoji(emojiTitle).then(value => { if (active) setEmoji(value ?? ''); }).catch(() => {});
    return () => { active = false; };
  }, [lingopClient, emojiTitle]);
  const select = () => onSelect({ id: node.list.id, title });
  return <article className="lingop-word-list-leaf" data-list-id={node.list.id}>
    <button type="button" className="lingop-word-list-leaf__main" onClick={select}>
      <span className="lingop-word-list-leaf__emoji emoji-color-font">{emoji || '\u00a0'}{titleCounter}</span>
      <BilingualWordListTitle title={node.list.title} translatedTitle={gloss} lang={node.list.lang} guiLang={guiLang} loading={titlesLoading} layout="stacked" counter="small" primaryClassName="lingop-word-list-leaf__primary-title" secondaryClassName="lingop-word-list-leaf__secondary-title" />
    </button>
    <footer className="lingop-word-list-leaf__toolbar">
      <button type="button" aria-label={`Select ${title}`} onClick={select}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></button>
      <button type="button" className="lingop-word-list-leaf__progress-button" aria-label={`View progress for ${title}: ${seen}/${total}`} disabled={!seen} onClick={() => onDetails(node.list.id)}>
        {!!seen && <span className="lingop-word-list-leaf__progress-track"><span className={`lingop-word-list-leaf__progress-value ${seen >= total ? 'lingop-word-list-leaf__progress-value--complete' : ''}`} style={{ width: `${seen / total * 100}%` }} /></span>}
      </button>
      <button type="button" aria-label={`View details for ${title}`} onClick={() => onDetails(node.list.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg></button>
    </footer>
  </article>;
}
