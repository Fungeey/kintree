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
  const s: Shown = { kind: 'title', lines: [{ chars: '阿爸', jyutping: 'aa3 baa1' }], formal: { chars: '父親', jyutping: 'fu6 can1' } };
  assert.equal(spokenText(s), '阿爸');
});

test('spokenText joins older/younger and skips by-name lines', () => {
  const two: Shown = { kind: 'byAge', lines: [{ label: 'older', chars: '表哥' }, { label: 'younger', chars: '表弟' }] };
  assert.equal(spokenText(two), '表哥，表弟');
  const half: Shown = { kind: 'byAge', lines: [{ label: 'older', chars: '哥哥' }, { label: 'younger', chars: '弟弟', byName: true }] };
  assert.equal(spokenText(half), '哥哥');
  assert.equal(spokenText({ kind: 'title', lines: [{ chars: '弟弟', byName: true }] }), '');
});
