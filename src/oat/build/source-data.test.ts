import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectOATSourceData } from './source-data.js';
import { extractOATCalleeStringsFromFile } from './source-extractor.js';
import { runOATPreflight } from './preflight.js';
import type { OATConfig } from './config.js';

const dirs: string[] = [];
afterEach(() => { vi.restoreAllMocks(); dirs.splice(0).forEach(dir => fs.rmSync(dir, {recursive:true, force:true})); });
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingop-scan-test-')); dirs.push(dir);
  fs.mkdirSync(path.join(dir, 'course'));
  const file = path.join(dir, 'course', 'page.tsx');
  fs.writeFileSync(file, `const value: string = 'dynamic';
    OAT('Zulu'); OAT2('Focus'); getStaticFocusLangAText('Static');
    OAT('Alpha'); OAT('Zulu'); other.OAT('ignored');
    OAT2(value); OAT(value); getStaticFocusLangAText(\`ignored\`);
    const view = <div>{OAT('JSX')}</div>;
  `);
  fs.writeFileSync(path.join(dir, 'ignored.txt'), "OAT('Ignored')");
  const config: OATConfig = {scanDirs:[path.join(dir, 'course')], guiLangsByScope:{course:['es']}, focusLangsByScope:{}, allGuiLangs:[], allFocusLangs:[], generatedAssetsRoot:path.join(dir,'public')};
  return {dir, file, config};
}
describe('single OAT source scan', () => {
  it('retains sorted/scoped texts, ignores member/dynamic calls, and warns in callee order', () => {
    const {file, config} = fixture();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reads = vi.spyOn(fs, 'readFileSync');
    expect(collectOATSourceData(config)).toEqual({guiTextsByScope:{course:['Alpha','JSX','Zulu']},focusTextsByScope:{_:['Focus']},staticFocusTextsByScope:{_:['Static']}});
    expect(reads.mock.calls.filter(([name]) => name === file)).toHaveLength(1);
    expect(warn.mock.calls.map(([message]) => String(message).match(/\[WARN\] (.*?)\(/)?.[1])).toEqual(['OAT','OAT2','getStaticFocusLangAText']);
    expect(extractOATCalleeStringsFromFile(file, 'OAT')).toEqual(['Zulu','Alpha','Zulu','JSX']);
  });

  it('shares a scan across preparation stages and sees edits on the next run', async () => {
    const {file, config} = fixture();
    config.guiLangsByScope = {};
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const reads = vi.spyOn(fs, 'readFileSync');
    const fetchImpl = vi.fn();
    await runOATPreflight(config, {privateOverrideKey:'unused',fetchImpl});
    expect(reads.mock.calls.filter(([name]) => name === file)).toHaveLength(1);
    fs.appendFileSync(file, "\nOAT('Added');");
    await runOATPreflight(config, {privateOverrideKey:'unused',fetchImpl});
    expect(reads.mock.calls.filter(([name]) => name === file)).toHaveLength(2);
    const output = JSON.parse(fs.readFileSync(path.join(config.generatedAssetsRoot,'i18n/oat/oa._log.sources_by_path.gui.json'),'utf8'));
    expect(output._).toContain('Added');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
