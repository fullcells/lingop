import { describe, it, expect, vi } from 'vitest';
import { collectPublicWordListsV3, prepareWordListsV3, type WordListsV3Enrichment } from './word-lists-v3.js';
import type { WordListV3 } from '../../core/word-lists-v3.js';
const list=(id:number,lang:string,title:string,anchor:number|null=null,words:string[]=[],children:number[]=[]):WordListV3=>({id,lang,title,anchor_list_id:anchor,updated_at:'2026-10-06',words:words.map((text,i)=>({id:id*10+i,list_id:id,text,position:i+1})),sublists:children.map((child_list_id,i)=>({parent_list_id:id,child_list_id,position:i+1}))});
const fixtures=[list(1,'en','_public',null,[],[2,3]),list(2,'en','Body',null,['eye']),list(3,'en','People',null,['grandfather']),list(20,'th','ร่างกาย',2,['ตา','ตา']),list(30,'th','ผู้คน',3,['ตา']),list(21,'es','Cuerpo',2),list(31,'es','Personas',3)];
const annotation={lang:'th',lang_text:'ตา',tokens:[{text:'ตา',isWord:1,gloss:"eye / mom's dad"}],containsGloss:true,containsPhonetics:false,ref:null,owner_id:null};
describe('V3 Prebake',()=>{
  it('checkpoints completed work in a failed batch and retries only missing annotations', async () => {
    const cache: WordListsV3Enrichment = {annotations:{},glosses:{},emojis:{}};
    const saved: WordListsV3Enrichment[] = [];
    let fail = true;
    const client = {loadWordListMetaDataV3:async()=>fixtures,loadWordListsV3:async(lang:string)=>fixtures.filter(l=>l.lang===lang),
      fetchAnnotation:vi.fn(async({localization:{text}}:{localization:{text:string}})=>{
        if (fail && text === 'grandfather') throw new Error('temporary failure');
        await Promise.resolve();
        return {...annotation,lang:'en',lang_text:text,tokens:[{text,isWord:1,gloss:text}]};
      }),fetchAndGenGloss:vi.fn(),generateEmojis:vi.fn(async()=>({eye:'👁️',grandfather:'👴'}))};
    const options = {client,rootListId:1,focusLangs:['en'],guiLangs:['en'],enrichment:cache,
      checkpoint:async(data:WordListsV3Enrichment)=>{saved.push(JSON.parse(JSON.stringify(data)));}};
    await expect(prepareWordListsV3(options)).rejects.toThrow('temporary failure');
    expect(saved.at(-1)?.annotations.en?.eye).toBeDefined();
    expect(saved.at(-1)?.annotations.en?.grandfather).toBeUndefined();
    fail = false;
    await prepareWordListsV3({...options,enrichment:saved.at(-1)!});
    expect(client.fetchAnnotation.mock.calls.map(([input])=>input.localization.text)).toEqual(['eye','grandfather','grandfather']);
  });
  it('rejects missing English glosses before requesting translations or emojis', async () => {
    const rows = [list(1,'en','_public',null,[],[2]),list(2,'en','Body',null,['eye','unknown']),list(3,'es','Cuerpo',2)];
    const client = {loadWordListMetaDataV3:async()=>rows,loadWordListsV3:async(lang:string)=>rows.filter(l=>l.lang===lang),
      fetchAnnotation:vi.fn(),fetchAndGenGloss:vi.fn(),generateEmojis:vi.fn()};
    const annotations = Object.fromEntries(['eye','unknown'].map(text=>[text,{...annotation,lang:'en',lang_text:text,tokens:[{text,isWord:1,gloss:text==='eye'?'eye':''}]}]));
    await expect(prepareWordListsV3({client,rootListId:1,focusLangs:['en'],guiLangs:['en','es'],enrichment:{annotations:{en:annotations},glosses:{},emojis:{}}})).rejects.toThrow('Missing V3 English annotation gloss');
    expect(client.fetchAndGenGloss).not.toHaveBeenCalled();
    expect(client.generateEmojis).not.toHaveBeenCalled();
  });
  it('translates only eligible words in a mixed catalogue, once per destination', async () => {
    const rows = [list(1,'en','_public',null,[],[2,3]),list(2,'en','Native',null,['native only','shared']),
      list(3,'en','Common',null,['shared','shared']),list(4,'ja','共通',3)];
    const annotations = Object.fromEntries(['native only','shared'].map(text=>[text,{...annotation,lang:'en',lang_text:text,tokens:[{text,isWord:1,gloss:text}]}]));
    const client = {loadWordListMetaDataV3:async()=>rows,loadWordListsV3:async(lang:string)=>rows.filter(l=>l.lang===lang),
      fetchAnnotation:vi.fn(),fetchAndGenGloss:vi.fn(async()=>({targetWord:'共通',is_human_verified:true})),generateEmojis:vi.fn()};
    const result = await prepareWordListsV3({client,rootListId:1,focusLangs:['en'],guiLangs:['en','ja'],enrichment:{annotations:{en:annotations},glosses:{},emojis:{'native only':'','shared':''}}});
    expect(client.fetchAndGenGloss).toHaveBeenCalledExactlyOnceWith({source_lang:'en',source_word:'shared',target_lang:'ja',generateIfMissing:true});
    expect(result.languages.en?.lists['2']?.words.map(word=>word.glosses)).toEqual([{en:'native only'},{en:'shared'}]);
    expect(result.languages.en?.lists['3']?.words.map(word=>word.glosses)).toEqual([{en:'shared',ja:'共通'},{en:'shared',ja:'共通'}]);
  });
  it('prepares standalone Cantonese content only in English, including its category titles', async () => {
    const rows = [list(1,'en','_public',null,[],[]), list(10,'yue','_公開',1,[],[50]),
      list(50,'yue','廣東美食',null,[],[51]), list(51,'yue','點心',null,['蝦餃','蝦餃'])];
    const a = {...annotation, lang:'yue', lang_text:'蝦餃', tokens:[{text:'蝦餃',isWord:1,gloss:'shrimp dumpling'}]};
    const cache: WordListsV3Enrichment = {annotations:{},glosses:{ja:{'shrimp dumpling':'old cached Japanese'}},emojis:{}};
    const client = {loadWordListMetaDataV3:vi.fn(async()=>rows), loadWordListsV3:vi.fn(async(lang:string)=>rows.filter(l=>l.lang===lang)),
      fetchAnnotation:vi.fn(async()=>a),fetchAndGenGloss:vi.fn(),generateEmojis:vi.fn(async()=>({'shrimp dumpling':'🥟'})),
      getSBWordsForLangDir:vi.fn(async()=>[
        {id:1,word_lang:'yue',gloss_lang:'en',word:'廣東美食',gloss:'Cantonese Food',is_core:false,is_human_verified:true,created_at:'2026-10-13'},
        {id:2,word_lang:'yue',gloss_lang:'en',word:'點心',gloss:'Dim Sum',is_core:false,is_human_verified:true,created_at:'2026-10-13'},
      ])};
    const options = {client,rootListId:1,focusLangs:['yue','en'],guiLangs:['en','ja','yue','es'],enrichment:cache};
    const result = await prepareWordListsV3(options);
    expect(result.languages.en?.lists).toEqual({});
    expect(result.languages.yue?.lists['50']?.titles).toEqual({en:'Cantonese Food'});
    expect(result.languages.yue?.lists['51']?.glossTipLangs).toEqual(['en']);
    expect(result.languages.yue?.lists['51']?.words.map(w=>w.glosses)).toEqual([{en:'shrimp dumpling'},{en:'shrimp dumpling'}]);
    expect(client.getSBWordsForLangDir).toHaveBeenCalledTimes(1);
    expect(client.getSBWordsForLangDir).toHaveBeenCalledWith('yue','en');
    await prepareWordListsV3({...options, enrichment:JSON.parse(JSON.stringify(cache))});
    expect(client.fetchAnnotation).toHaveBeenCalledTimes(1);
    expect(client.fetchAndGenGloss).not.toHaveBeenCalled();
    expect(client.generateEmojis).toHaveBeenCalledTimes(1);
    expect(cache.glosses.ja?.['shrimp dumpling']).toBe('old cached Japanese');
  });
  it('does no enrichment for branches unavailable in the requested GlossTipLang', async () => {
    const rows = [list(1,'en','_public',null,[],[2]),list(2,'en','Standalone',null,['unused'],[3]),
      list(3,'en','Child',null,['also unused']),list(4,'ja','子',3)];
    const client = {loadWordListMetaDataV3:async()=>rows,loadWordListsV3:async(lang:string)=>rows.filter(l=>l.lang===lang),
      fetchAnnotation:vi.fn(),fetchAndGenGloss:vi.fn(),generateEmojis:vi.fn(),getSBWordsForLangDir:vi.fn()};
    const result = await prepareWordListsV3({client,rootListId:1,focusLangs:['en'],guiLangs:['ja']});
    expect(result.languages.en).toEqual({roots:[],lists:{}});
    expect(client.fetchAnnotation).not.toHaveBeenCalled();
    expect(client.fetchAndGenGloss).not.toHaveBeenCalled();
    expect(client.generateEmojis).not.toHaveBeenCalled();
    expect(client.getSBWordsForLangDir).not.toHaveBeenCalled();
  });
  it('requires stored English title glosses before doing enrichment', async () => {
    const rows = [list(1,'en','_public',null,[],[2]),list(2,'yue','未譯',null,['詞'])];
    const client = {loadWordListMetaDataV3:async()=>rows,loadWordListsV3:async(lang:string)=>rows.filter(l=>l.lang===lang),
      fetchAnnotation:vi.fn(),fetchAndGenGloss:vi.fn(),generateEmojis:vi.fn(),getSBWordsForLangDir:vi.fn(async()=>[])};
    await expect(prepareWordListsV3({client,rootListId:1,focusLangs:['yue'],guiLangs:['en']})).rejects.toThrow('Missing stored V3 title gloss');
    expect(client.fetchAnnotation).not.toHaveBeenCalled();
    expect(client.fetchAndGenGloss).not.toHaveBeenCalled();
  });
  it('follows localized edges and preserves duplicate word rows',()=>{const tree=collectPublicWordListsV3(fixtures,'th',1);expect(tree.roots).toEqual([20,30]);expect(tree.lists.find(l=>l.id===20)?.words.map(w=>w.text)).toEqual(['ตา','ตา']);});
  it('omits unavailable content rather than falling back to English',()=>{expect(collectPublicWordListsV3(fixtures,'ja',1).lists).toEqual([]);});
  it('rejects dangling child edges and cycles',()=>{expect(()=>collectPublicWordListsV3([list(1,'en','_public',null,[],[99])],'en',1)).toThrow('Missing V3 child');expect(()=>collectPublicWordListsV3([list(1,'en','_public',null,[],[2]),list(2,'en','Cycle',null,[],[1])],'en',1)).toThrow('cycle');});
  it('retains expanded language-owned words independently of source positions',()=>{const rows=[list(1,'en','_public',null,[],[2]),list(2,'en','Family',null,['brother']),list(20,'cmn-hant','家人',2,['哥哥','弟弟'])];expect(collectPublicWordListsV3(rows,'cmn-hant',1).lists[0]?.words.map(w=>w.text)).toEqual(['哥哥','弟弟']);});
  it('prepares exact homonym glosses once and keeps every row in its list',async()=>{
    const cache:WordListsV3Enrichment={annotations:{th:{'ตา':annotation}},glosses:{},emojis:{}};
    const client={loadWordListMetaDataV3:vi.fn(async()=>fixtures),loadWordListsV3:vi.fn(async(lang:string)=>fixtures.filter(l=>l.lang===lang)),fetchAnnotation:vi.fn(),fetchAndGenGloss:vi.fn(async()=>({targetWord:'ojo / abuelo materno',is_human_verified:true})),generateEmojis:vi.fn(async()=>({"eye / mom's dad":'👁️ / 👴'}))};
    const options={client,rootListId:1,focusLangs:['th'],guiLangs:['en','es'],enrichment:cache};
    const first=await prepareWordListsV3(options);
    expect(first.languages.th?.lists['20']?.words.map(w=>w.id)).toEqual([200,201]);
    expect(first.languages.th?.lists['30']?.words[0]?.glosses.en).toBe("eye / mom's dad");
    expect(first.languages.th?.lists['30']?.words[0]?.glosses.es).toBe('ojo / abuelo materno');
    await prepareWordListsV3(options);
    expect(client.fetchAnnotation).not.toHaveBeenCalled();expect(client.fetchAndGenGloss).toHaveBeenCalledTimes(1);expect(client.generateEmojis).toHaveBeenCalledTimes(1);
    expect(client.loadWordListMetaDataV3).toHaveBeenCalledWith({forceRefresh:true});
  });
  it('uses the privileged batch path only for unresolved interface glosses',async()=>{
    const client={loadWordListMetaDataV3:async()=>fixtures,loadWordListsV3:async(lang:string)=>fixtures.filter(l=>l.lang===lang),fetchAnnotation:vi.fn(),fetchAndGenGloss:vi.fn(async()=>null),generateEmojis:vi.fn(async()=>({}))};
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify([{source_text:"eye / mom's dad",target_text:'ojo / abuelo materno'}]),{status:200}));
    const result=await prepareWordListsV3({client,rootListId:1,focusLangs:['th'],guiLangs:['es'],enrichment:{annotations:{th:{'ตา':annotation}},glosses:{},emojis:{}},services:{privateOverrideKey:'test-only',supabaseUrl:'https://example.test',supabasePublicKey:'public',fetchImpl}});
    expect(client.fetchAndGenGloss).toHaveBeenCalledWith(expect.objectContaining({generateIfMissing:false}));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.languages.th?.lists['20']?.words[0]?.glosses.es).toBe('ojo / abuelo materno');
  });
  it('fails incomplete enrichment instead of publishing missing words silently',async()=>{
    const client={loadWordListMetaDataV3:async()=>fixtures,loadWordListsV3:async(lang:string)=>fixtures.filter(l=>l.lang===lang),fetchAnnotation:async()=>null,fetchAndGenGloss:vi.fn(),generateEmojis:vi.fn()};
    await expect(prepareWordListsV3({client,rootListId:1,focusLangs:['th'],guiLangs:['en']})).rejects.toThrow('Missing V3 annotation');
  });
});
