import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVoice, spokenText } from '../src/audio/speech.ts';
import type { Shown } from '../src/display.ts';

test('pickVoice prefers zh-HK, accepts yue, ignores Mandarin', () => {
  assert.equal(pickVoice([{ lang: 'zh-CN', name: 'Ting' }, { lang: 'en-US', name: 'Alex' }]), undefined);
  assert.equal(pickVoice([{ lang: 'zh-CN', name: 'a' }, { lang: 'zh_HK', name: 'Sinji' }])?.name, 'Sinji');
  assert.equal(pickVoice([{ lang: 'yue-Hant-HK', name: 'x' }])?.name, 'x');
  assert.equal(pickVoice([{ lang: 'yue-HK', name: 'y' }, { lang: 'zh-HK', name: 'z' }])?.name, 'z');
  assert.equal(pickVoice([]), undefined);
});

test('spokenText reads the spoken form, not the formal one', () => {
  const s: Shown = { kind: 'title', lines: [{ chars: '阿爸', rom: 'aa3 baa1' }], formal: { chars: '父親', rom: 'fu6 can1' } };
  assert.equal(spokenText(s), '阿爸');
});

test('spokenText joins older/younger and reads the formal term of by-name relatives', () => {
  const two: Shown = { kind: 'byAge', lines: [{ label: 'older', chars: '表哥' }, { label: 'younger', chars: '表弟' }] };
  assert.equal(spokenText(two), '表哥，表弟');
  const half: Shown = { kind: 'byAge', lines: [{ label: 'older', chars: '哥哥' }, { label: 'younger', chars: '弟弟', rom: 'dai6 dai2', byName: true }] };
  assert.equal(spokenText(half), '哥哥，弟弟');
});

test('spokenText skips the bare "by name" placeholder', () => {
  assert.equal(spokenText({ kind: 'title', lines: [{ chars: 'by name', byName: true }] }), '');
  const mixed: Shown = { kind: 'byAge', lines: [{ label: 'older', chars: '哥哥' }, { label: 'younger', chars: 'by name', byName: true }] };
  assert.equal(spokenText(mixed), '哥哥');
});

test('pickVoice for Mandarin takes zh-CN, zh-Hans or cmn and skips Cantonese and Taiwan voices', () => {
  const v = [{ lang: 'zh-HK', name: 'Sinji' }, { lang: 'zh-TW', name: 'Meijia' }, { lang: 'zh-CN', name: 'Tingting' }];
  assert.equal(pickVoice(v, 'cmn')?.name, 'Tingting');
  assert.equal(pickVoice([{ lang: 'cmn-Hans-CN', name: 'x' }], 'cmn')?.name, 'x');
  assert.equal(pickVoice([{ lang: 'zh_CN', name: 'y' }, { lang: 'zh-Hans', name: 'z' }], 'cmn')?.name, 'y');
  assert.equal(pickVoice([{ lang: 'zh-HK', name: 'a' }, { lang: 'zh-TW', name: 'b' }, { lang: 'yue-HK', name: 'c' }], 'cmn'), undefined);
  assert.equal(pickVoice(v, 'yue')?.name, 'Sinji');
});
