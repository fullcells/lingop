import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { BilingualWordListTitle } from './bilingual-word-list-title.js';
const props = {title:'_點心#2',translatedTitle:'Dim Sum#2',lang:'yue',guiLang:'en'};
describe('shared bilingual list label', () => {
  it('supports opposite app title orders while retaining language attributes and counters', () => {
    const sourceFirst = renderToStaticMarkup(<BilingualWordListTitle {...props} layout="stacked" counter="small" />);
    expect(sourceFirst.indexOf('點心')).toBeLessThan(sourceFirst.indexOf('Dim Sum'));
    expect(sourceFirst).toContain('lang="yue"'); expect(sourceFirst).toContain('lang="en"');
    expect(sourceFirst.match(/<small>2<\/small>/g)).toHaveLength(2);
    const guiFirst = renderToStaticMarkup(<BilingualWordListTitle {...props} priority="gui" counter="suffix" />);
    expect(guiFirst.indexOf('Dim Sum')).toBeLessThan(guiFirst.indexOf('點心'));
    expect(guiFirst.match(/#2/g)).toHaveLength(1);
  });
  it('renders same-language titles once and distinguishes loading from absent glosses', () => {
    const same = renderToStaticMarkup(<BilingualWordListTitle {...props} guiLang="yue" />);
    expect(same.match(/點心/g)).toHaveLength(1); expect(same).not.toContain('Dim Sum'); expect(same).not.toContain(' / ');
    const missing = renderToStaticMarkup(<BilingualWordListTitle {...props} translatedTitle={null} />);
    expect(missing).toContain('—'); expect(missing.match(/點心/g)).toHaveLength(1);
    expect(renderToStaticMarkup(<BilingualWordListTitle {...props} translatedTitle={null} loading />)).toContain('…');
  });
});
