import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
import type { WordListV3, WordListV3TreeNode } from '../../core/word-lists-v3.js';
const { client, streaks } = vi.hoisted(() => ({client:{generateEmoji:vi.fn(async()=> '🥟')},streaks:{yue:{'蝦餃':1}}}));
vi.mock('./lingop-client-data-provider.js',()=>({useLingopClientData:()=>({lingopClient:client})}));
vi.mock('./user-word-streaks.js',()=>({useUserWordStreaksData:()=>({userWordStreaks:streaks})}));
import { WordListsSelectorV3 } from './word-lists-selector-v3.js';
const list = (id:number,title:string):WordListV3=>({id,title,lang:'yue',anchor_list_id:null,updated_at:'2026-10-13',words:[],sublists:[]});
const food = {...list(2,'點心'),words:['蝦餃','蝦餃','燒賣'].map((text,i)=>({id:i,list_id:2,text,position:i}))};
const tree:WordListV3TreeNode={list:list(1,'_公開'),children:[{list:food,children:[]}]};

describe('V3 selector behavior',()=>{
  it('uses English emoji input, preserves numeric selection/details IDs and progress based on actual words',async()=>{
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
    const select=vi.fn(),details=vi.fn();
    let view:ReturnType<typeof create>;
    await act(async()=>{view=create(<WordListsSelectorV3 tree={tree} metadata={[tree.list,food]}
      titleGlosses={new Map([['yue:en',new Map([['點心','Dim Sum']])]])}
      guiLang="en" focusLang="yue" onSelect={select} onDetails={details}/>);});
    expect(client.generateEmoji).toHaveBeenCalledWith('Dim Sum');
    expect(client.generateEmoji).not.toHaveBeenCalledWith('點心');
    const button=(label:string)=>view!.root.findAllByType('button').find(node=>node.props['aria-label']===label)!;
    await act(async()=>button('Select Dim Sum').props.onClick());
    expect(select).toHaveBeenCalledWith({id:2,title:'Dim Sum'});
    await act(async()=>button('View details for Dim Sum').props.onClick());
    expect(details).toHaveBeenCalledWith(2);
    expect(button('View progress for Dim Sum: 1/2').props.disabled).toBe(false);
    await act(async()=>view!.unmount());
  });
});
