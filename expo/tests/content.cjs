const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../module.json');
const lessons = [...data.lessons, data.finalConversation];
const words = lessons.flatMap(l => [...l.newWords || [], ...l.extraWords || []]);
const normalize = s => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
const ids = new Set();
for (const l of lessons) {
  assert(l.exercises.length > 0);
  for (const e of l.exercises) {
    assert(!ids.has(e.id), `Duplicate ${e.id}`); ids.add(e.id);
    assert(['scene','word','phrase','choice','listen','build','gap','speak','dialogue','map','profile'].includes(e.kind));
    if (e.word) assert(words.some(w => w.turkish === e.word), e.word);
    if (e.options) assert(e.options.some(o => o.id === e.answer), e.id);
    if (e.kind === 'build') {
      const letters = s => [...normalize(s)].sort().join('');
      assert.equal(letters(e.tokens.join('')), letters(e.text), `Unbuildable ${e.id}`);
    }
    if (e.kind === 'speak') assert(e.text?.length > 0);
  }
}
for (const state of ['welcome','learning','listening','speaking','thinking','correct','retry','cafe','travel','city','profile','celebration']) assert(fs.statSync(path.join(__dirname, '..', 'assets', `${state}.png`)).size > 10000);
assert.equal(lessons.length, 6);
assert.equal(ids.size, 130);
console.log(`PASS: ${lessons.length} lessons, ${ids.size} reachable steps, all word references, answers, build tokens, 12 mascot assets.`);
