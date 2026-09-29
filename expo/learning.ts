import moduleData from './module.json';

export type Word = { turkish: string; russian: string; example: string; exampleTranslation: string; pronunciation?: string | null };
export type Exercise = { id: string; kind: string; title: string; prompt: string; text?: string; translation?: string; word?: string; options?: { id: string; text: string; symbol?: string }[]; answer?: string; tokens?: string[]; direction?: string; mapTarget?: string; hideTranslation: boolean };
export type Lesson = { id: number; title: string; goal: string; newWords: Word[]; extraWords: Word[]; phrases: { turkish: string; russian: string }[]; exercises: Exercise[]; miniDialogue: { role: string; turkish: string; russian: string }[] };
export const lessons = [...moduleData.lessons, moduleData.finalConversation] as unknown as Lesson[];
export const vocabulary = lessons.flatMap(l => [...(l.newWords || []), ...(l.extraWords || [])]).filter((w, i, all) => all.findIndex(x => x.turkish === w.turkish) === i);
export type Profile = { name: string; city: string; favorite: string; minutes: number; sound: boolean; haptics: boolean; onboarded: boolean; completed: number[]; positions: Record<string, number> };
export const defaults: Profile = { name: 'Alina', city: 'Antalya', favorite: 'Kahve', minutes: 10, sound: true, haptics: true, onboarded: false, completed: [], positions: {} };
export function fill(text: string | undefined, p: Profile) {
  const values: Record<string, string> = { name: p.name.trim() || 'Alina', city: p.city, cityLocative: p.city + (p.city === 'İzmir' ? "'de" : "'da"), cityRussian: ({ Antalya: 'Анталье', İstanbul: 'Стамбуле', Ankara: 'Анкаре', İzmir: 'Измире' } as Record<string, string>)[p.city], favorite: p.favorite, favoriteRussian: ({ Kahve: 'кофе', Çay: 'чай', Türkiye: 'Турцию' } as Record<string, string>)[p.favorite] };
  return (text || '').replace(/\{(\w+)\}/g, (_, k) => values[k] || k);
}
export const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
export const assets = {
  welcome: require('./assets/welcome.png'), learning: require('./assets/learning.png'), listening: require('./assets/listening.png'), speaking: require('./assets/speaking.png'), thinking: require('./assets/thinking.png'), correct: require('./assets/correct.png'), retry: require('./assets/retry.png'), cafe: require('./assets/cafe.png'), travel: require('./assets/travel.png'), city: require('./assets/city.png'), profile: require('./assets/profile.png'), celebration: require('./assets/celebration.png'),
};
export type Mood = keyof typeof assets;
