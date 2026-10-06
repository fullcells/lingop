import { describe, it, expect, vi } from 'vitest';
import { collectPublicWordListsV3, prepareWordListsV3, type WordListsV3Enrichment } from './word-lists-v3.js';
import type { WordListV3 } from '../../core/word-lists-v3.js';
const list=(id:number,lang:string,title:string,anchor:number|null=null,words:string[]=[],children:number[]=[]):WordListV3=>({id,lang,title,anchor_list_id:anchor,updated_at:'2026-10-06',words:words.map((text,i)=>({id:id*10+i,list_id:id,text,position:i+1})),sublists:children.map((child_list_id,i)=>({parent_list_id:id,child_list_id,position:i+1}))});
const fixtures=[list(1,'en','_public',null,[],[2,3]),list(2,'en','Body',null,['eye']),list(3,'en','People',null,['grandfather']),list(20,'th','ร่างกาย',2,['ตา','ตา']),list(30,'th','ผู้คน',3,['ตา'])];
const annotation={lang:'th',lang_text:'ตา',tokens:[{text:'ตา',isWord:1,gloss:"eye / mom's dad"}],containsGloss:true,containsPhonetics:false,ref:null,owner_id:null};
describe('V3 Prebake',()=>{
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
