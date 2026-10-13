import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SBWordRow2} from '../../core/sb-words.js';
import type {AnnotatedText} from '../../core/annotation/types.js';
const context = vi.hoisted(() => ({client: {
  getSBWordsForWords: vi.fn(), getSBWordsForLangDir: vi.fn(), fetchAndGenGloss: vi.fn(),
  getHancharDecomposition: vi.fn(async () => null),
}}));
vi.mock('./lingop-client-data-provider.js', () => ({useLingopClientData: () => ({lingopClient:context.client})}));
vi.mock('./user-word-streaks.js', () => ({useOptionalUserWordStreaksData: () => null}));
vi.mock('./annotated-text.js', () => ({AnnotatedTextView: () => null}));
vi.mock('./stroke-order-view.js', () => ({StrokeOrderView: () => null}));
vi.mock('./word-detail-images.js', () => ({WordDetailImages: () => null}));
import {useL10nWordDetail} from './l10n-word-detail-content.js';
let tree: ReactTestRenderer | undefined;
const annotation = (word: string): AnnotatedText => ({lang:'en',lang_text:word,tokens:[{text:word,isWord:1,gloss:'original'}],containsGloss:true,containsPhonetics:false,ref:null,owner_id:null});
function View({word, guiLang='en'}: {word:string;guiLang?:string}) {
  const data = React.useMemo(() => ({l10nAText:annotation(word)}), [word]);
  const {sbWordGloss} = useL10nWordDetail({l10nWordDetailData:data,guiLang,showWordStreakControls:false});
  return <span>{sbWordGloss}</span>;
}
const row = (id:number, word:string, is_core=true): SBWordRow2 => ({id,word,is_core,word_lang:'en',gloss_lang:'en',gloss:`gloss ${id}`,created_at:'2026-10-14',is_human_verified:true});
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); });
afterEach(async () => { if(tree) await act(async () => tree!.unmount()); tree=undefined; vi.restoreAllMocks(); });
describe('targeted word-detail glosses', () => {
  it('preserves exact spelling then case-insensitive priority, non-core order and missing results', async () => {
    const rows = [row(1,'Tea'),row(2,'TEA',false),row(3,'Tea',false),row(4,' Tea ',false)];
    context.client.getSBWordsForWords.mockResolvedValue(rows);
    const oldRows = [rows[1]!,rows[2]!,rows[3]!,rows[0]!];
    for (const word of ['Tea','TEA','tea',' Tea ','missing']) {
      await act(async () => { if(tree) tree.update(<View word={word}/>); else tree=create(<View word={word}/>); });
      const expected = oldRows.find(r=>r.word===word) ?? oldRows.find(r=>r.word.toLowerCase()===word.toLowerCase());
      expect(tree!.root.findByType('span').props.children).toBe(expected?.gloss ?? null);
      expect(context.client.getSBWordsForWords).toHaveBeenLastCalledWith('en','en',[word]);
    }
    expect(rows.map(r=>r.id)).toEqual([1,2,3,4]);
    expect(context.client.getSBWordsForLangDir).not.toHaveBeenCalled();
    expect(context.client.fetchAndGenGloss).not.toHaveBeenCalled();
  });
  it('skips other GUI languages and ignores a response from the previously selected word', async () => {
    let release!: (rows:SBWordRow2[])=>void;
    context.client.getSBWordsForWords.mockReturnValueOnce(new Promise(resolve=>{release=resolve;})).mockResolvedValue([row(2,'New')]);
    await act(async () => {tree=create(<View word="Old"/>);});
    await act(async () => tree!.update(<View word="New"/>));
    await act(async () => release([row(1,'Old')]));
    expect(tree!.root.findByType('span').props.children).toBe('gloss 2');
    await act(async () => tree!.update(<View word="New" guiLang="ja"/>));
    expect(tree!.root.findByType('span').props.children).toBeNull();
    expect(context.client.getSBWordsForWords).toHaveBeenCalledTimes(2);
  });
  it('handles failed reads without generating a translation', async () => {
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    context.client.getSBWordsForWords.mockRejectedValue(new Error('offline'));
    await act(async () => {tree=create(<View word="Tea"/>);});
    expect(tree!.root.findByType('span').props.children).toBeNull();
    expect(context.client.fetchAndGenGloss).not.toHaveBeenCalled();
  });
});
