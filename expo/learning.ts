import moduleData from './module.json';

export type Word = { turkish: string; russian: string; example: string; exampleTranslation: string; pronunciation?: string | null };
export type Exercise = { id: string; kind: string; title: string; prompt: string; text?: string; translation?: string; word?: string; options?: { id: string; text: string; symbol?: string }[]; answer?: string; tokens?: string[]; direction?: string; mapTarget?: string; hideTranslation: boolean };
export type Lesson = { id: number; title: string; goal: string; newWords: Word[]; extraWords: Word[]; phrases: { turkish: string; russian: string }[]; exercises: Exercise[]; miniDialogue: { role: string; turkish: string; russian: string }[] };
export const lessons = [...moduleData.lessons, moduleData.finalConversation] as unknown as Lesson[];
export const vocabulary = lessons.flatMap(l => [...(l.newWords || []), ...(l.extraWords || [])]).filter((w, i, all) => all.findIndex(x => x.turkish === w.turkish) === i);
export type Profile = { knownWords?: string[]; name: string; city: string; favorite: string; minutes: number; sound: boolean; haptics: boolean; onboarded: boolean; completed: number[]; positions: Record<string, number> };
export const defaults: Profile = { name: 'Alina', city: 'Antalya', favorite: 'Kahve', minutes: 10, sound: true, haptics: true, onboarded: false, completed: [], positions: {} };
export function fill(text: string | undefined, p: Profile) {
  const values: Record<string, string> = { name: p.name.trim() || 'Alina', city: p.city, cityLocative: p.city + (p.city === 'İzmir' ? "'de" : "'da"), cityRussian: ({ Antalya: 'Анталье', İstanbul: 'Стамбуле', Ankara: 'Анкаре', İzmir: 'Измире' } as Record<string, string>)[p.city], favorite: p.favorite, favoriteRussian: ({ Kahve: 'кофе', Çay: 'чай', Türkiye: 'Турцию' } as Record<string, string>)[p.favorite] };
  return (text || '').replace(/\{(\w+)\}/g, (_, k) => values[k] || k);
}
export const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
export const assets = {
  welcome: require('./assets/mascot/welcome.webp'),
  cozy_home: require('./assets/mascot/cozy_home.webp'),
  reading: require('./assets/mascot/reading.webp'),
  listening: require('./assets/mascot/listening.webp'),
  speaking: require('./assets/mascot/speaking.webp'),
  thinking: require('./assets/mascot/thinking.webp'),
  correct: require('./assets/mascot/correct.webp'),
  retry: require('./assets/mascot/retry.webp'),
  cafe: require('./assets/mascot/cafe.webp'),
  travel: require('./assets/mascot/travel.webp'),
  city: require('./assets/mascot/city.webp'),
  profile: require('./assets/mascot/profile.webp'),
  celebration: require('./assets/mascot/celebration.webp'),
  sleepy: require('./assets/mascot/sleepy.webp'),
  learning: require('./assets/mascot/reading.webp'),
};
export type Mood = keyof typeof assets;
