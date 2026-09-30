import React, { useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { assets, defaults, Exercise, fill, Lesson, lessons, Mood, normalize, Profile, vocabulary } from './learning';

import { AudioButton, Button, Capi, Choice, colors, Confetti, Entrance, Icon, preloadMascots, Progress, Pulse, Sound, UIContext, Waveform } from './design';
import { Home, Course, Words } from './screens';
const peach = colors.accentCoral;
function ProfileForm({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => void }) {
  return <View style={s.card}><Text style={s.label}>Имя для турецких фраз (латиницей)</Text><TextInput accessibilityLabel="Имя латиницей" value={profile.name} onChangeText={name => update({ name: name.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü '\-]/g, '').slice(0, 30) })} placeholder="Alina" style={s.input} autoCorrect={false} /><Text style={s.label}>Твой город</Text><View style={s.wrap}>{['Antalya', 'İstanbul', 'Ankara', 'İzmir'].map(city => <Chip key={city} text={city} selected={profile.city === city} onPress={() => update({ city })} />)}</View><Text style={s.label}>Что тебе нравится?</Text><View style={s.wrap}>{['Kahve', 'Çay', 'Türkiye'].map(favorite => <Chip key={favorite} text={favorite} selected={profile.favorite === favorite} onPress={() => update({ favorite })} />)}</View></View>;
}
function Chip({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.selected]}><Text style={s.body}>{text}</Text></Pressable>; }

export default function App() {
  const [profile, setProfile] = useState<Profile>(defaults);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('home');
  const [onboard, setOnboard] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [playingText, setPlayingText] = useState<string | null>(null);
  const tapPlayer = useAudioPlayer(require('./assets/tap.wav'));
  const completePlayer = useAudioPlayer(require('./assets/lesson_complete.wav'));
  const recordStartPlayer = useAudioPlayer(require('./assets/record_start.wav'));
  const recordStopPlayer = useAudioPlayer(require('./assets/record_stop.wav'));
  const revealPlayer = useAudioPlayer(require('./assets/word_reveal.wav'));

  const speechToken = useRef(0);
  const saveChain = useRef(Promise.resolve());
  const chime = useAudioPlayer(require('./assets/success.wav'));
  const effects = { tap: tapPlayer, correct: chime, lesson_complete: completePlayer, record_start: recordStartPlayer, record_stop: recordStopPlayer, word_reveal: revealPlayer };
  const sound = (name: Sound) => { if (!profile.sound) return; const p = effects[name]; void p.seekTo(0).then(() => p.play()).catch(() => {}); };
  useEffect(() => { void preloadMascots(); }, []);
  useEffect(() => { AsyncStorage.getItem('capiturk-expo-v1').then(raw => { if (raw) { const p = JSON.parse(raw); setProfile({ ...defaults, ...p, completed: Array.isArray(p.completed) ? p.completed.filter((x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 5) : [], positions: p.positions || {} }); } }).catch(() => Alert.alert('Не удалось загрузить прогресс', 'Можно продолжить с начала.')).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) saveChain.current = saveChain.current.then(() => AsyncStorage.setItem('capiturk-expo-v1', JSON.stringify(profile))).catch(() => { Alert.alert('Прогресс не сохранён', 'Проверь свободное место на iPhone.'); }); }, [profile, ready]);
  const update = (p: Partial<Profile>) => setProfile(v => ({ ...v, ...p }));
  const stopSpeech = () => { speechToken.current++; void Speech.stop(); setSpeaking(false); setPlayingText(null); };
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'background') { stopSpeech(); chime.pause(); } }); return () => { sub.remove(); void Speech.stop(); }; }, []);
  async function speak(text: string, rate = .85) {
    const token = ++speechToken.current;
    await Speech.stop();
    if (token !== speechToken.current) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const voices = await Speech.getAvailableVoicesAsync();
      const voice = voices.find(v => v.language.toLowerCase().startsWith('tr'));
      if (token !== speechToken.current) return;
      setSpeaking(true); setPlayingText(fill(text, profile));
      const end = () => { if (token === speechToken.current) { setSpeaking(false); setPlayingText(null); } };
      Speech.speak(fill(text, profile), { language: 'tr-TR', voice: voice?.identifier, rate, useApplicationAudioSession: true, onDone: end, onStopped: end, onError: () => { end(); Alert.alert('Озвучка недоступна', 'Добавь турецкий голос в настройках iPhone → Универсальный доступ → Устный контент → Голоса.'); } });
    } catch { setSpeaking(false); setPlayingText(null); Alert.alert('Не удалось включить звук', 'Попробуй ещё раз.'); }
  }
  function feedback(success = true) { if (profile.haptics) { if (success) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); else void Haptics.selectionAsync(); } if (success) sound('correct'); }
  function start(l: Lesson) { stopSpeech(); setActive(l.id); setStep(Math.min(profile.positions[l.id] || 0, l.exercises.length - 1)); setDone(false); }
  const lesson = lessons.find(l => l.id === active);
  const nextLesson = lessons.find(l => !profile.completed.includes(l.id)) || lessons[0];
  const nav = (to: string) => { sound('tap'); stopSpeech(); setTab(to); if (profile.haptics) void Haptics.selectionAsync(); };
  return <UIContext.Provider value={{ playing: playingText, sound }}><SafeAreaProvider><LinearGradient colors={[colors.surfacePrimary, colors.surfaceSecondary, colors.surfacePrimary]} style={{ flex: 1 }}><StatusBar barStyle="dark-content" /><SafeAreaView style={{ flex: 1 }}>
    {!ready ? <ActivityIndicator style={{ flex: 1 }} color={peach} /> : <>
      <View style={s.header}>{active !== null ? <Pressable accessibilityRole="button" accessibilityLabel="Закрыть урок" onPress={() => { stopSpeech(); setActive(null); setDone(false); }}><Text style={s.back}>‹</Text></Pressable> : <Text style={s.smallTag}>ТУРЕЦКИЙ В ТВОЁМ ТЕМПЕ</Text>}<Text style={s.logo}>Capi<Text style={{ color: peach }}>türk</Text></Text></View>
      {!profile.onboarded ? <ScrollView contentContainerStyle={s.content}>
        {onboard === 0 ? <><Text style={[s.title, s.center]}>Маленькие шаги{ '\n' }к большим историям</Text><Capi mood={speaking ? 'listening' : 'welcome'} /><View style={s.card}><Text style={[s.title, s.center]}>Merhaba!</Text><Text style={[s.body, s.center]}>Готова учить турецкий вместе?{ '\n' }Капи будет рядом на каждом шаге.</Text><AudioButton text="Merhaba!" speak={speak} /></View><Button title="Давай знакомиться  →" onPress={() => { stopSpeech(); setOnboard(1); }} /></> : <><Text style={s.title}>Твой маленький{ '\n' }ритуал на каждый день</Text><Text style={s.subtitle}>Начнём с простых разговоров. Выбери свой темп.</Text><View style={s.wrap}>{[5, 10, 15].map(minutes => <Chip key={minutes} text={`${minutes} минут`} selected={profile.minutes === minutes} onPress={() => update({ minutes })} />)}</View><ProfileForm profile={profile} update={update} /><Capi mood="profile" small /><Button title="Начать обучение  →" onPress={() => { update({ onboarded: true }); feedback(); }} /></>}
      </ScrollView> : lesson ? done ? <ScrollView contentContainerStyle={s.content}><Text style={[s.title, s.center]}>Урок пройден!</Text><Text style={[s.subtitle, s.center]}>Ещё один маленький шаг.{ '\n' }Капи гордится тобой ♡</Text><View><Confetti /><Capi mood="celebration" /></View><View style={s.card}><Text style={s.label}>{lesson.title}</Text><Text style={s.body}>{lesson.exercises.length} шагов практики • {lesson.newWords?.length || 0} новых слов</Text><Text style={s.caption}>Разговорные задания пройдены в режиме самостоятельной практики.</Text></View><Button title="Вернуться к моему пути  →" onPress={() => { setActive(null); setDone(false); setTab('course'); }} /></ScrollView> : <LessonScreen key={`${lesson.id}-${step}`} lesson={lesson} exercise={lesson.exercises[step]} step={step} profile={profile} update={update} speak={speak} stopSpeech={stopSpeech} speaking={speaking} feedback={feedback} next={() => { stopSpeech(); if (step + 1 < lesson.exercises.length) { setStep(step + 1); update({ positions: { ...profile.positions, [lesson.id]: step + 1 } }); } else { update({ completed: [...new Set([...profile.completed, lesson.id])], positions: { ...profile.positions, [lesson.id]: 0 } }); if (profile.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sound('lesson_complete'); setDone(true); } }} /> : <>
        <Entrance identity={tab}><ScrollView key={tab} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {tab === 'home' && <Home profile={profile} start={start} />}
          {tab === 'course' && <Course profile={profile} start={start} />}
          {tab === 'words' && <Words profile={profile} update={update} speak={speak} />}
          {tab === 'profile' && <><Text style={s.title}>Всё под контролем</Text><Text style={s.subtitle}>На твоём пути к турецкому ♡</Text><Capi mood="profile" small /><View style={s.card}><Text style={s.label}>Твой прогресс</Text><Text style={s.big}>{profile.completed.length} / 6</Text><Text style={s.caption}>уроков первого модуля</Text></View><View style={s.wrap}>{[5,10,15].map(minutes => <Chip key={minutes} text={`${minutes} минут`} selected={profile.minutes === minutes} onPress={() => update({ minutes })} />)}</View><View style={s.card}>{(['sound','haptics'] as const).map(k => <View key={k} style={s.row}><Text style={s.body}>{k === 'sound' ? 'Звуки успеха' : 'Тактильный отклик'}</Text><Switch accessibilityLabel={k === 'sound' ? 'Звуки успеха' : 'Тактильный отклик'} value={profile[k]} onValueChange={v => update({ [k]: v })} trackColor={{ true: peach }} /></View>)}</View><ProfileForm profile={profile} update={update} /><Text style={s.caption}>Expo Go · запись и прослушивание голоса. Автоматическая проверка произношения доступна в отдельном SwiftUI-приложении. Прогресс хранится на этом устройстве.</Text></>}
        </ScrollView></Entrance><View style={s.nav}>{([['home','home-outline','Главная'],['course','trail-sign-outline','Курс'],['words','book-outline','Слова'],['profile','person-outline','Профиль']] as const).map(([key, icon, title]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => nav(key)} style={s.navItem}><Icon name={icon} color={tab === key ? peach : colors.textSecondary} size={22} /><Text style={[s.navText, tab === key && { color: peach }]}>{title}</Text></Pressable>)}</View>
      </>}
    </>}
  </SafeAreaView></LinearGradient></SafeAreaProvider></UIContext.Provider>;
}

function LessonScreen({ lesson, exercise: e, step, profile, update, speak, stopSpeech, speaking, feedback, next }: { lesson: Lesson; exercise: Exercise; step: number; profile: Profile; update: (p: Partial<Profile>) => void; speak: (t: string, rate?: number) => void; stopSpeech: () => void; speaking: boolean; feedback: (v?: boolean) => void; next: () => void }) {
  const ui = useContext(UIContext);
  useEffect(() => { if (e.kind === 'word') ui.sound('word_reveal'); }, [e.id]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tokens, setTokens] = useState<number[]>([]);
  const [result, setResult] = useState<'correct' | 'retry' | null>(null);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rs = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(recorded);
  const ps = useAudioPlayerStatus(player);
  const [heardRecording, setHeardRecording] = useState(false);
  const alive = useRef(true);
  const word = vocabulary.find(w => w.turkish === e.word);
  const target = fill(e.text || word?.turkish, profile);
  const tested = !!e.options || e.kind === 'build';
  const context: Mood = lesson.id === 1 ? 'cafe' : lesson.id === 2 ? 'travel' : lesson.id === 3 ? 'city' : lesson.id === 4 ? 'profile' : 'learning';
  const mood: Mood = rs.isRecording ? 'listening' : speaking || ps.playing ? 'listening' : result || (tokens.length || selected ? 'thinking' : e.kind === 'speak' ? 'speaking' : e.kind === 'word' ? 'reading' : context);
  useEffect(() => { if (ps.didJustFinish) setHeardRecording(true); }, [ps.didJustFinish]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Expo owns native audio disposal. Its hooks release the shared objects
      // before this cleanup runs; even reading recorder.isRecording here crashes.
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && alive.current) {
        if (recorder.isRecording) void finishRecording();
        player.pause();
      }
    });
    // A new recording replaces the player. Never retain the old released player.
    return () => sub.remove();
  }, [recorder, player]);
  useEffect(() => { if (rs.isRecording && rs.durationMillis >= 45000) void finishRecording(); }, [rs.durationMillis]);
  async function finishRecording() { try { await recorder.stop(); if (!alive.current) return; const uri = recorder.uri; await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); if (alive.current) { setRecorded(uri); ui.sound('record_stop'); } } catch { if (alive.current) Alert.alert('Запись не сохранена', 'Попробуй записать ещё раз.'); } }
  async function toggleRecording() {
    if (busy) return; setBusy(true);
    try {
      if (recorder.isRecording) { await finishRecording(); return; }
      stopSpeech(); player.pause();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive.current) return;
      if (!permission.granted) { Alert.alert('Нужен доступ к микрофону', 'Разреши микрофон для Expo Go в настройках iPhone.', [{ text: 'Позже' }, { text: 'Открыть настройки', onPress: () => { void Linking.openSettings(); } }]); return; }
      setRecorded(null); setHeardRecording(false);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!alive.current) return;
      await recorder.prepareToRecordAsync();
      if (!alive.current) return;
      recorder.record(); ui.sound('record_start');
      if (profile.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { if (alive.current) Alert.alert('Не удалось начать запись', 'Проверь микрофон и попробуй ещё раз.'); } finally { if (alive.current) setBusy(false); }
  }
  function check() { const correct = e.kind === 'build' ? normalize(tokens.map(i => fill(e.tokens![i], profile)).join(' ')) === normalize(target) : selected === e.answer; setResult(correct ? 'correct' : 'retry'); feedback(correct); }
  const audio = (text: string, rate?: number) => { if (recorder.isRecording || busy) return; player.pause(); speak(text, rate); };
  return <Entrance identity={e.id}><View style={{ flex: 1 }}><View style={s.lessonTop}>
    <View style={s.row}><Progress value={(step + 1) / lesson.exercises.length} /><Text style={s.caption}>{step + 1}/{lesson.exercises.length}</Text></View>
    </View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Text style={s.title}>{e.title}</Text><Text style={s.subtitle}>{fill(e.prompt, profile)}</Text>
    {!word && <Capi mood={mood} small height={120} />}
    {e.kind === 'profile' && <ProfileForm profile={profile} update={update} />}
    {e.kind === 'map' && <View style={s.card}><Text style={[s.big, s.center]}>{e.direction === 'left' ? `🏥   ←   📍` : `📍   →   🏥`}</Text><Text style={[s.label, s.center]}>{e.mapTarget}</Text><Text style={[s.caption, s.center]}>Ты находишься у отметки 📍</Text></View>}
    {word && <View style={s.card}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1, gap: 8 }}><AudioButton text={word.turkish} speak={audio} slow /><Text style={[s.caption, s.center]}>{word.pronunciation}</Text><Text style={[s.body, s.center]}>{word.russian}</Text></View><View style={{ width: 112 }}><Capi mood={mood} height={144} /></View></View><View style={{ height: .5, backgroundColor: colors.dividerSoft }} /><Text style={s.eyebrow}>В МАЛЕНЬКОМ РАЗГОВОРЕ</Text><AudioButton text={fill(word.example, profile)} speak={audio} compact /><Text style={s.caption}>{fill(word.exampleTranslation, profile)}</Text></View>}
    {!!e.text && e.kind !== 'build' && <View style={s.card}>{e.kind === 'listen' ? <Button title="▷  Послушать фразу" soft onPress={() => audio(target)} /> : <><AudioButton text={target.replace(/___/g, '…')} speak={audio} slow />{!e.hideTranslation && !!e.translation && <Text style={[s.body, s.center]}>{fill(e.translation, profile)}</Text>}</>}</View>}
    {e.options?.map(o => <Choice key={o.id} text={fill(o.text, profile)} selected={selected === o.id} correct={result === 'correct'} onPress={() => { if (result === 'correct') return; setSelected(o.id); setResult(null); ui.sound('tap'); if (profile.haptics) void Haptics.selectionAsync(); }} />)}
    {e.kind === 'build' && <><View style={s.card}><Text style={s.caption}>Твоя фраза · нажми слово, чтобы убрать</Text><View style={[s.wrap, { minHeight: 60 }]}>{tokens.map((i, pos) => <Chip key={i} text={fill(e.tokens![i], profile)} selected onPress={() => { if (result !== 'correct') { setTokens(tokens.filter((_, p) => p !== pos)); setResult(null); } }} />)}</View></View><View style={s.wrap}>{e.tokens?.map((t, i) => !tokens.includes(i) && <Chip key={i} text={fill(t, profile)} selected={false} onPress={() => { if (result !== 'correct') { setTokens([...tokens, i]); setResult(null); } }} />)}</View>{result === 'correct' && <AudioButton text={target} speak={audio} />}</>}
    {e.kind === 'speak' && <View style={s.card}><Text style={s.caption}>Самостоятельная практика · без оценки произношения</Text><Pulse active={rs.isRecording}><View style={{ alignItems: 'center', padding: 8 }}><Icon name={rs.isRecording ? 'mic' : 'mic-outline'} size={32} /></View><Button title={rs.isRecording ? `■  Остановить · ${Math.floor(rs.durationMillis / 1000)} с` : '●  Записать мой голос'} onPress={() => { void toggleRecording(); }} disabled={busy} /></Pulse>{rs.isRecording && <Waveform level={rs.metering ?? -60} />}{recorded && <Button soft title={ps.playing ? 'Ⅱ  Пауза' : '▷  Послушать мою запись'} onPress={() => { stopSpeech(); if (ps.playing) player.pause(); else { void player.seekTo(0); player.play(); } }} />}<Text style={s.caption}>{heardRecording ? 'Сравни свою запись с образцом. Можно записать ещё раз или продолжить.' : 'Запиши фразу и прослушай запись до конца. Максимум 45 секунд.'}</Text></View>}
    </ScrollView><View style={s.lessonFooter}>{result && <View accessibilityLiveRegion="polite" style={s.feedback}><Icon name={result === 'correct' ? 'checkmark-circle-outline' : 'heart-outline'} /><View style={{ flex: 1 }}><Text style={s.label}>{result === 'correct' ? 'Harika! Всё получилось' : 'Попробуем ещё раз'}</Text><Text style={s.caption}>{result === 'correct' ? e.kind === 'build' ? target : fill(e.options?.find(o => o.id === e.answer)?.text, profile) : 'Капи рядом. Выбери другой ответ.'}</Text></View></View>}
    {tested && result !== 'correct' ? <Button title="Проверить" disabled={e.kind === 'build' ? tokens.length !== e.tokens?.length : selected === null} onPress={check} /> : <Button title="Продолжить  →" disabled={e.kind === 'speak' && (!heardRecording || rs.isRecording || busy)} onPress={() => { player.pause(); next(); }} />}
  </View></View></Entrance>;
}

const s = StyleSheet.create({
  lessonTop: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 20 },
  lessonFooter: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 12, backgroundColor: colors.surfaceGlass, borderTopWidth: .5, borderTopColor: colors.dividerSoft },
  feedback: { backgroundColor: colors.successSoft, borderRadius: 20, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 16 }, header: { paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logo: { fontSize: 24, color: colors.textPrimary, letterSpacing: -1 }, smallTag: { fontSize: 8, letterSpacing: 1.1, color: colors.textSecondary, maxWidth: 130 }, eyebrow: { fontSize: 10, letterSpacing: 2, color: '#BC7969', marginTop: 14 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '600', color: colors.textPrimary, letterSpacing: -.8 }, subtitle: { fontSize: 16, lineHeight: 23, color: colors.textSecondary }, body: { fontSize: 16, lineHeight: 23, color: colors.textPrimary }, caption: { fontSize: 12, lineHeight: 18, color: colors.textSecondary }, label: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, lineHeight: 24 }, center: { textAlign: 'center' }, mascot: { height: 275, width: '100%', borderRadius: 36 }, card: { padding: 20, backgroundColor: colors.surfaceGlass, borderRadius: 24, gap: 12, borderWidth: .5, borderColor: colors.dividerSoft }, button: { backgroundColor: peach, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 28, alignItems: 'center', minHeight: 55 }, softButton: { backgroundColor: '#FBD7C7' }, buttonText: { fontSize: 17, color: '#FFF', fontWeight: '600' }, audio: { alignItems: 'center', paddingVertical: 10, gap: 3, minHeight: 50 }, audioText: { fontSize: 24, lineHeight: 31, color: '#293F57', textAlign: 'center', fontWeight: '500' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, pill: { backgroundColor: '#FCE2D7', color: '#A56353', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, fontSize: 12 }, stats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }, nav: { flexDirection: 'row', backgroundColor: colors.surfaceGlass, borderTopWidth: 1, borderColor: colors.dividerSoft, paddingTop: 9, paddingBottom: 5 }, navItem: { flex: 1, alignItems: 'center', gap: 3, padding: 4 }, navIcon: { fontSize: 26, color: colors.muted }, navText: { fontSize: 10, color: colors.textSecondary }, courseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBF7CF', borderRadius: 26, padding: 12 }, thumb: { width: 80, height: 90, borderRadius: 24 }, back: { fontSize: 32, color: '#BA8677', minWidth: 44 }, section: { fontSize: 20, color: colors.textPrimary, fontWeight: '600', marginVertical: 18 }, big: { fontSize: 42, color: colors.textPrimary, fontWeight: '500' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, chip: { paddingVertical: 13, paddingHorizontal: 18, backgroundColor: colors.surfaceGlass, borderRadius: 20, borderColor: colors.dividerSoft, borderWidth: 1 }, selected: { backgroundColor: colors.successSoft, borderColor: colors.accentPeach }, input: { color: colors.textPrimary, fontSize: 19, borderBottomColor: colors.accentPeach, borderBottomWidth: 1, padding: 12 }, progress: { height: 5, borderRadius: 6, backgroundColor: colors.dividerSoft, flex: 1, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: peach, borderRadius: 6 }, option: { padding: 18, backgroundColor: '#FFFCF8', borderWidth: 1, borderColor: '#F5E8E2', borderRadius: 22 }, meter: { height: 6, backgroundColor: colors.dividerSoft, borderRadius: 6, overflow: 'hidden' },
});
