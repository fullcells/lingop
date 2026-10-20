import React, {createRef} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {act, create} from 'react-test-renderer';
import {describe,expect,it} from 'vitest';
import type {AnnotatedText} from '../../core/annotation/types.js';
import {getAnnotatedSpelling} from '../../core/language/annotation-spelling.js';
import {SpellingSystem as S} from '../../core/language/spelling-systems.js';
import {AnnotatedTextView, getAnnotatedTextHTMLTableExport, type AnnotatedTextViewHandle} from './annotated-text.js';

const annotation: AnnotatedText = {lang:'ja',lang_text:'かっぱ巻き',containsPhonetics:true,containsGloss:true,ref:null,owner_id:null,tokens:[{text:'かっぱ巻き',isWord:1,gloss:'cucumber roll',phoneticToken:[['か','か'],['っ','っ'],['ぱ','ぱ'],['巻','ま'],['き','き']]}]};
const props={annotatedText:annotation,showGlossEmoji:'NEVER' as const,showGlossText:'NEVER' as const,showSpelling:'ALWAYS' as const,showLocalMainTextReadingGuide:false,enableWordStreaks:false};
const rows=(html:string)=>[...html.matchAll(/class="phonic-spelling"[^>]*>([^<]*)<\/span>/g)].map(m=>m[1]);
describe('Japanese contextual renderer',()=>{
 it('renders prepared spelling on the server with each pronunciation over its characters',async()=>{
  const preparedSpelling=await getAnnotatedSpelling(annotation,S.JA_ROMAJI);
  const html=renderToStaticMarkup(<AnnotatedTextView {...props} preparedSpelling={preparedSpelling}/>);
  expect(rows(html)).toEqual(['ka','p','pa','ma','ki']);
  expect((html.match(/class="phonic"/g)??[])).toHaveLength(5);
  expect(getAnnotatedTextHTMLTableExport(annotation,preparedSpelling)).toContain('<td>ka</td><td>p</td><td>pa</td><td>ma</td><td>ki</td>');
 });
 it('hides only duplicate ruby while pronunciation-only mode retains every kana',async()=>{
  const preparedSpelling=await getAnnotatedSpelling(annotation,S.JA_HIRAGANA);
  expect(rows(renderToStaticMarkup(<AnnotatedTextView {...props} preparedSpelling={preparedSpelling}/>))).toEqual(['\u00a0','\u00a0','\u00a0','ま','\u00a0']);
  expect(rows(renderToStaticMarkup(<AnnotatedTextView {...props} preparedSpelling={preparedSpelling} showMainText={false}/>)).join('')).toBe('かっぱまき');
  expect(preparedSpelling.text).toBe('かっぱまき');
 });
 it('uses contextual formatting for live selection and keeps exports synchronized',async()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  const ref=createRef<AnnotatedTextViewHandle>();
  let tree: ReturnType<typeof create>;
  await act(async()=>{tree=create(<AnnotatedTextView {...props} ref={ref} spellingSystem={S.JA_ROMAJI}/>);});
  expect(ref.current?.getSpelling()).toBe('kappamaki');
  await act(async()=>{tree.update(<AnnotatedTextView {...props} ref={ref} spellingSystem={S.JA_KATAKANA}/>);});
  expect(ref.current?.getSpelling()).toBe('カッパマキ');
  expect(await ref.current?.requestHTMLTableExport()).toContain('<td>カ</td><td>ッ</td><td>パ</td><td>マ</td><td>キ</td>');
  await act(async()=>tree.unmount());
 });
});
