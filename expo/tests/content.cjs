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

// Regression: Expo releases SharedObjects before later effect cleanups.
// Execute the actual lifecycle effects against objects that throw on ANY access
// after release, reproducing the iPhone failure on lesson transitions.
const ts = require('typescript');
const vm = require('node:vm');
const sourceText = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
const source = ts.createSourceFile('App.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'LessonScreen');
const effects = screen.body.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(source) === 'useEffect').map(n => n.expression.arguments[0]).filter(n => /alive.current = true|AppState.addEventListener/.test(n.getText(source)));
assert.equal(effects.length, 2);
let released = false, removed = 0, paused = 0, stopped = 0, background;
const native = new Proxy({}, { get(_, key) { assert(!released, `Native access after release: ${String(key)}`); return key === 'isRecording' ? true : () => paused++; } });
const alive = { current: true };
const context = { alive, recorder: native, player: native, finishRecording: () => { stopped++; }, AppState: { addEventListener: (_, callback) => { background = callback; return { remove: () => { removed++; } }; } } };
const cleanups = effects.map(n => vm.runInNewContext(ts.transpileModule(`(${n.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context)());
background('background');
assert.equal(paused, 1); assert.equal(stopped, 1);
released = true;
for (const cleanup of cleanups) assert.doesNotThrow(cleanup);
assert.equal(alive.current, false); assert.equal(removed, 1);
assert.doesNotThrow(() => background('background'));
assert.equal(paused, 1);
console.log('PASS: audio cleanup after native release and late background callback do not access disposed objects.');

