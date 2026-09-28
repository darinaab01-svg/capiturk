// Run with Node.js: node Tools/validate-module.cjs
// Validates the shipped content, not an independent copy of the lesson data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = path.join(__dirname, '..', 'Capiturk', 'Module1.json');
const moduleData = JSON.parse(fs.readFileSync(source, 'utf8').replace(/^\uFEFF/, ''));
const kinds = new Set(['scene','word','phrase','choice','listen','build','gap','speak','dialogue','map','profile']);
const graded = new Set(['choice','listen','build','gap','dialogue','map']);
const normalize = s => s.replaceAll('’', "'").toLocaleLowerCase('tr').replace(/[\p{P}\s]+/gu, ' ').trim();
const substitutions = {
 name:'Darina',city:'İzmir',cityLocative:"İzmir'de",cityRussian:'в Измире',favorite:'Çay',favoriteRussian:'чай'
};
const resolve = s => s.replace(/\{([^}]+)\}/g, (_, key) => {
 assert.ok(key in substitutions, `Unknown profile placeholder ${key}`); return substitutions[key];
});
const words = s => normalize(resolve(s)).split(' ').filter(Boolean);
function permutations(values) {
 if(values.length === 0) return [[]];
 return values.flatMap((v,i)=>permutations(values.filter((_,j)=>j!==i)).map(t=>[v,...t]));
}
function validate(data) {
 assert.equal(data.version,2);
 assert.equal(data.lessons.length,5);
 const all = [...data.lessons,data.finalConversation];
 const ids = new Set(), vocabulary = new Set(), taughtTokens = new Set();
 const signatures=[];
 for (const [i,lesson] of all.entries()) {
  assert.equal(lesson.id,i); assert.ok(lesson.title && lesson.goal && lesson.result);
  assert.ok(lesson.exercises.length > 0);
  assert.ok(lesson.exercises.some(e=>e.kind==='speak'),`${lesson.title}: speech missing`);
  assert.ok(lesson.exercises.some(e=>e.kind==='listen'),`${lesson.title}: listening missing`);
  assert.ok(lesson.exercises.some(e=>e.kind==='build'||e.kind==='gap'),`${lesson.title}: construction practice missing`);
  assert.ok(lesson.exercises.some(e=>e.isFinal),`${lesson.title}: final task missing`);
  if(i<5) {
   assert.ok(lesson.newWords.length>=6 && lesson.newWords.length<=7);
   assert.ok(lesson.miniDialogue.length>=3);
   if(i>0) {
    assert.ok(lesson.reviewWords.length>=2 && lesson.reviewWords.length<=4);
    for(const word of lesson.reviewWords) assert.ok(vocabulary.has(word),`Review before introduction: ${word}`);
   }
  } else {
   assert.equal(lesson.newWords.length,0);assert.equal(lesson.extraWords.length,0);
  }
  const localWords = [...lesson.newWords,...lesson.extraWords];
  for(const word of localWords) {
   assert.ok(word.example && word.exampleTranslation,`No context for ${word.turkish}`);
   assert.ok(lesson.exercises.some(e=>e.kind==='word' && e.word===word.turkish),`Word not taught: ${word.turkish}`);
   assert.ok(!vocabulary.has(word.turkish),`Duplicate vocabulary ${word.turkish}`);
   vocabulary.add(word.turkish);
   words(word.example).forEach(w=>taughtTokens.add(w));
   words(word.turkish).forEach(w=>taughtTokens.add(w));
  }
  for(const e of lesson.exercises) {
   assert.ok(!ids.has(e.id),`Duplicate exercise ${e.id}`);ids.add(e.id);
   assert.ok(kinds.has(e.kind),`Unknown kind ${e.kind}`);
   assert.equal(typeof e.isFinal,'boolean'); assert.equal(typeof e.hideTranslation,'boolean');
   for(const value of [e.title,e.prompt,e.text,e.translation,...(e.tokens??[]),...(e.options??[]).map(o=>o.text)]) if(value) resolve(value);
   if(e.kind==='word') assert.ok(localWords.some(w=>w.turkish===e.word),`Broken word reference ${e.word}`);
   if(graded.has(e.kind) && e.kind!=='build') {
    assert.ok(e.options?.length>=2,`${e.id}: options missing`);
    assert.equal(new Set(e.options.map(o=>o.id)).size,e.options.length);
    assert.equal(e.options.filter(o=>o.id===e.answer).length,1,`${e.id}: missing/ambiguous answer`);
   }
   if(e.kind==='build') {
    assert.ok(e.tokens?.length>1 && e.tokens.length<=7);
    assert.ok(permutations(e.tokens).some(p=>normalize(resolve(p.join(' ')))===normalize(resolve(e.text))),`Unsolvable build ${e.id}`);
   }
   if(e.kind==='gap') assert.ok(e.text.includes('___'));
   if(['scene','listen','speak','phrase'].includes(e.kind)) assert.ok(e.text,`${e.id}: no audio text`);
   if(e.kind==='map') {
    assert.ok(['left','right'].includes(e.direction));
    assert.equal(e.options.find(o=>o.id===e.answer).text,e.direction==='right'?'Sağda.':'Solda.');
   }
   if(i<5) {
    if(e.text) words(e.text).forEach(w=>taughtTokens.add(w));
    if(['dialogue','gap','map'].includes(e.kind)) e.options.forEach(o=>words(o.text).forEach(w=>taughtTokens.add(w)));
   } else {
    for(const value of [e.text,...(e.tokens??[]),...(e.options??[]).map(o=>o.text)]) {
     if(!value || /[а-яА-ЯёЁ]/.test(value)) continue;
     for(const word of words(value)) assert.ok(taughtTokens.has(word),`Final introduces unlearned word: ${word}`);
    }
    assert.equal(e.hideTranslation,true,`${e.id}: final should not show translations`);
   }
  }
  signatures.push(lesson.exercises.map(e=>e.kind).join(','));
 }
 assert.equal(new Set(signatures).size,6,'Lesson sequences should vary');
 assert.equal(data.lessons.flatMap(l=>l.newWords).length,32);
 assert.equal(data.lessons.flatMap(l=>l.phrases).length,15);
 assert.equal(ids.size,130);
 return {lessons:5, finalConversations:1, activeWords:32, extraWords:vocabulary.size-32, phrases:15, exercises:ids.size};
}
const stats=validate(moduleData);
// Verify the validator rejects important authoring regressions.
const brokenAnswer=structuredClone(moduleData);
brokenAnswer.lessons[0].exercises.find(e=>e.kind==='choice').answer='missing';
assert.throws(()=>validate(brokenAnswer));
const brokenBuild=structuredClone(moduleData);
brokenBuild.lessons[0].exercises.find(e=>e.kind==='build').tokens=['kahve','istiyorum'];
assert.throws(()=>validate(brokenBuild));
const newFinalWord=structuredClone(moduleData);
newFinalWord.finalConversation.exercises[0].text='Beklenmedik!';
assert.throws(()=>validate(newFinalWord));
console.log('PASS — module content, solvable exercises, review links, personalized templates, map answers, and no new final vocabulary');
console.log('PASS — negative checks: broken answer, impossible sentence, unfamiliar final word');
console.log(JSON.stringify(stats,null,2));
