import { describe, expect, it } from 'vitest';
import { getAnnotatedSpelling, getSpellingPartDisplay } from './annotation-spelling.js';
import { SpellingSystem as S } from './spelling-systems.js';
import type { AnnotatedToken, PhoneticToken } from '../annotation/types.js';
const word = (parts: PhoneticToken): AnnotatedToken => ({ text: parts.map(p => p[0]).join(''), isWord: 1, phoneticToken: parts });
const format = (parts: PhoneticToken, system = S.JA_ROMAJI) => getAnnotatedSpelling({lang:'ja',tokens:[word(parts)]}, system);
describe('aligned Japanese spelling', () => {
  it('keeps the doubled consonant attached to small tsu, without mutating annotations', async () => {
    const parts: PhoneticToken = [['か','か'],['っ','っ'],['ぱ','ぱ'],['巻','ま'],['き','き']];
    const before = structuredClone(parts);
    const result = await format(parts);
    expect(result.text).toBe('kappamaki');
    expect(result.tokens[0]!.map(p => [p.chars,p.spelling])).toEqual([['か','ka'],['っ','p'],['ぱ','pa'],['巻','ma'],['き','ki']]);
    expect(parts).toEqual(before);
  });
  it('combines only the source spans needed by contracted kana', async () => {
    const result = await format([['き','き'],['ゃ','ゃ'],['く','く']]);
    expect(result.text).toBe('kyaku');
    expect(result.tokens[0]!.map(p => [p.chars,p.spelling,p.sourcePartIndices])).toEqual([['きゃ','kya',[0,1]],['く','ku',[2]]]);
    expect((await format([['茶','ちゃ']])).tokens[0]![0]!.chars).toBe('茶');
    expect((await format([['大人','おとな']])).tokens[0]).toHaveLength(1);
  });
  it('handles n separators and both kana forms of long vowels', async () => {
    expect((await format([['し','し'],['ん','ん'],['よ','よ'],['う','う']])).text).toBe("shin'you");
    for (const parts of [[['コ','こ'],['ー','ー'],['ヒ','ひ'],['ー','ー']], [['コ','コ'],['ー','ー'],['ヒ','ヒ'],['ー','ー']]] as PhoneticToken[]) {
      const result=await format(parts);
      expect(result.text).toBe('koohii');
      expect(result.tokens[0]!.map(p=>p.spelling)).toEqual(['ko','o','hi','i']);
    }
  });
  it('keeps word and punctuation boundaries while using adjacent counter context', async () => {
    const tokens = [word([['1','いっ']]), word([['本','ぽん']])];
    const result=await getAnnotatedSpelling({lang:'ja',tokens},S.JA_ROMAJI);
    expect(result.text).toBe('ippon');
    expect(result.tokens.map(parts=>parts.map(p=>p.spelling).join(''))).toEqual(['ip','pon']);
    const separated=await getAnnotatedSpelling({lang:'ja',tokens:[tokens[0]!,{text:'。',isWord:0},tokens[1]!]},S.JA_ROMAJI);
    expect(separated.text).toBe('iっ。pon');
  });
  it('retains punctuation inside a lexical token without treating it as a missing reading', async () => {
    const result = await format([['寿司','すし'],['・'],['刺身','さしみ']]);
    expect(result.text).toBe('sushi・sashimi');
    expect(result.tokens[0]![1]).toMatchObject({chars:'・',spelling:'・',unresolved:false});
  });
  it('uses kana fallback but never invents missing kanji pronunciation', async () => {
    expect((await format([['か'],['っ'],['ぱ']])).text).toBe('kappa');
    const result=await format([['猫']]);
    expect(result.tokens[0]![0]).toMatchObject({chars:'猫',spelling:'',unresolved:true});
    expect((await format([['っ']])).text).toBe('っ');
  });
  it('retains full kana spelling when duplicate ruby is hidden', async () => {
    const result=await format([['巻','ま'],['き','き']],S.JA_HIRAGANA);
    expect(result.text).toBe('まき');
    expect(getSpellingPartDisplay(result.tokens[0]![1]!,'ja',true)).toBe('\u00a0');
    expect(getSpellingPartDisplay(result.tokens[0]![1]!,'ja',false)).toBe('き');
    expect((await format([['カッパ','カッパ']],S.JA_HIRAGANA)).text).toBe('かっぱ');
    expect((await format([['巻','ま'],['き','き']],S.JA_KATAKANA)).text).toBe('マキ');
  });
  it('preserves the backend script when no system is selected', async () => {
    const result = await getAnnotatedSpelling({lang:'ja',tokens:[word([['カッパ','カッパ']])]}, null);
    expect(result.text).toBe('カッパ');
  });
  it('preserves non-Japanese spelling conversions', async () => {
    const result=await getAnnotatedSpelling({lang:'yue',tokens:[word([['貓','maau1'],['狗','gau2']])]},S.YUE_JYUTPING);
    expect(result.text).toBe('maau1 gau2');
  });
});
