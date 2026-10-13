import { describe, it, expect, vi } from 'vitest';
import { createWordListTitleResolverV3, loadWordListTitleGlossesV3 } from './word-list-titles-v3.js';
import type { SBWordListV3Row } from './word-lists-v3.js';
const list = (id: number, lang: string, title: string, anchor_list_id: number | null = null): SBWordListV3Row => ({id, lang, title, anchor_list_id, updated_at: '2026-10-13'});
const row = (id: number, word: string, gloss: string, is_human_verified = false, created_at = '2026-10-13') => ({id, word, gloss, word_lang: 'yue', gloss_lang: 'en', is_core: true, is_human_verified, created_at});

describe('shared V3 title policy', () => {
  it('uses own and family titles before full and segmented saved glosses', () => {
    const lists = [list(1,'en','Colors'), list(2,'yue','顏色',1), list(3,'yue','_點心#2')];
    const glosses = new Map([['yue:en', new Map([['顏色','Colours'],['點心','Dim Sum']])]]);
    const resolve = createWordListTitleResolverV3(lists, glosses);
    expect(resolve(lists[1]!, 'en')).toBe('Colors');
    expect(resolve(lists[1]!, 'yue')).toBe('顏色');
    expect(resolve(lists[2]!, 'en')).toBe('Dim Sum#2');
    expect(resolve(lists[2]!, 'ja')).toBeNull();
    glosses.get('yue:en')!.set('_點心#2','Dim Sum Selection');
    expect(resolve(lists[2]!, 'en')).toBe('Dim Sum Selection');
  });

  it('reads each necessary direction once, excluding variants, other languages and unrelated words', async () => {
    const lists = [list(1,'en','Colors'), list(2,'yue','顏色',1), list(3,'yue','點心'), list(4,'yue','_點心#2')];
    const read = vi.fn(async () => [row(1,'點心','Old',true,'2026-10-01'), row(2,'點心','Dim Sum',true,'2026-10-02'), row(3,'點心','Unverified'), row(4,'OTHER','Other'), {...row(5,'點心','Wrong direction',true),gloss_lang:'ja'}, row(6,'點心','',true)]);
    const client = {getSBWordsForLangDir:read};
    await loadWordListTitleGlossesV3(client, lists, [{list:lists[0]!,langs:['en']},{list:lists[1]!,langs:['en','yue']}]);
    expect(read).not.toHaveBeenCalled();
    const glosses = await loadWordListTitleGlossesV3(client, lists, [2,3,2].map(i=>({list:lists[i]!,langs:['en','en']})));
    expect(read).toHaveBeenCalledExactlyOnceWith('yue','en');
    expect([...glosses.get('yue:en')!]).toEqual([['點心','Dim Sum']]);
  });

  it('does not create its own stale snapshot, and lets failed reads be retried', async () => {
    const native = list(1,'yue','點心');
    const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([row(1,'點心','Dim Sum')]).mockResolvedValueOnce([row(2,'點心','Updated')]);
    const load = () => loadWordListTitleGlossesV3({getSBWordsForLangDir:read},[native],[{list:native,langs:['en']}]);
    await expect(load()).rejects.toThrow('offline');
    expect(createWordListTitleResolverV3([native],await load())(native,'en')).toBe('Dim Sum');
    expect(createWordListTitleResolverV3([native],await load())(native,'en')).toBe('Updated');
  });

  it('prefers the narrow reader without changing saved title priority', async () => {
    const native = list(1, 'yue', '_點心#2');
    const rows = [row(1, '點心', 'Dim Sum'), row(2, '_點心#2', 'Full title', true), row(3, '_點心#2', 'New automatic title')];
    const broad = vi.fn(async () => rows), narrow = vi.fn(async () => rows);
    const requests = [{ list: native, langs: ['en'] }];
    const legacy = await loadWordListTitleGlossesV3({ getSBWordsForLangDir: broad }, [native], requests);
    broad.mockClear();
    const current = await loadWordListTitleGlossesV3({ getSBWordsForLangDir: broad, getSBWordsForWords: narrow }, [native], requests);
    expect(current).toEqual(legacy);
    expect(broad).not.toHaveBeenCalled();
    expect(narrow).toHaveBeenCalledExactlyOnceWith('yue', 'en', ['_點心#2', '點心']);
  });
});
