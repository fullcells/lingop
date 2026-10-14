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

const category = list(3, '食物');
const nestedCategory = list(4, '更多');
const groupedTree: WordListV3TreeNode = {list: tree.list, children: [
  {list: category, children: [{list: nestedCategory, children: [{list: food, children: []}]}]},
]};
const groupedMetadata = [tree.list, category, nestedCategory, food];
const groupedGlosses = new Map([['yue:en', new Map([['食物', 'Food'], ['更多', 'More'], ['點心', 'Dim Sum']])]]);

it('keeps a consumer-supplied secondary action independent of the bilingual heading and cards', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const select = vi.fn(), secondary = vi.fn(), details = vi.fn();
  const CustomIcon = () => <svg data-consumer-icon="shuffle" />;
  let view: ReturnType<typeof create>;
  await act(async () => { view = create(<WordListsSelectorV3 tree={groupedTree}
    metadata={groupedMetadata} titleGlosses={groupedGlosses} guiLang="en" focusLang="yue"
    onSelect={select} onDetails={details}
    secondaryAction={{icon: <CustomIcon />, label: ({title}) => `Practice ${title}`, onSelect: secondary}} />); });
  const heading = view!.root.findByProps({className: 'lingop-word-lists-selector__branch-heading'});
  const buttons = heading.findAllByType('button');
  expect(buttons).toHaveLength(2);
  expect(buttons[0]!.parent).toBe(buttons[1]!.parent);
  expect(buttons[1]!.props.type).toBe('button');
  expect(buttons[1]!.props['aria-label']).toBe('Practice Food');
  expect(buttons[1]!.props.title).toBe('Practice Food');
  expect(buttons[1]!.findByProps({'data-consumer-icon': 'shuffle'})).toBeDefined();
  await act(async () => buttons[1]!.props.onClick());
  expect(secondary).toHaveBeenCalledExactlyOnceWith({id: 3, title: 'Food'});
  expect(select).not.toHaveBeenCalled();
  await act(async () => buttons[0]!.props.onClick());
  expect(select).toHaveBeenCalledExactlyOnceWith({id: 3, title: 'Food'});
  const cardPlay = view!.root.findByProps({'aria-label': 'Select More'});
  await act(async () => cardPlay.props.onClick());
  expect(select).toHaveBeenLastCalledWith({id: 4, title: 'More'});
  expect(secondary).toHaveBeenCalledTimes(1);
  expect(view!.root.findAllByProps({className: 'lingop-word-lists-selector__secondary-action'})).toHaveLength(1);
  await act(async () => view!.unmount());
});

it('preserves the original heading action when no secondary action is supplied', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const select = vi.fn();
  let view: ReturnType<typeof create>;
  await act(async () => { view = create(<WordListsSelectorV3 tree={groupedTree}
    metadata={groupedMetadata} titleGlosses={groupedGlosses} guiLang="en" focusLang="yue"
    onSelect={select} onDetails={() => {}} />); });
  expect(view!.root.findAllByProps({className: 'lingop-word-lists-selector__secondary-action'})).toHaveLength(0);
  const heading = view!.root.findByProps({className: 'lingop-word-lists-selector__branch-heading'});
  expect(heading.findAllByType('button')).toHaveLength(1);
  await act(async () => heading.findByType('button').props.onClick());
  expect(select).toHaveBeenCalledExactlyOnceWith({id: 3, title: 'Food'});
  await act(async () => view!.unmount());
});
