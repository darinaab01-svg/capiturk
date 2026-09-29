import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { assets, defaults, Exercise, fill, Lesson, lessons, Mood, normalize, Profile, vocabulary } from './learning';

const peach = '#E6816C';
function Button({ title, onPress, soft = false, disabled = false }: { title: string; onPress: () => void; soft?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, soft && s.softButton, disabled && { opacity: .4 }, pressed && { transform: [{ scale: .97 }], opacity: .8 }]}><Text style={[s.buttonText, soft && { color: '#26354C' }]}>{title}</Text></Pressable>;
}
function Capi({ mood, small = false }: { mood: Mood; small?: boolean }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    const run = (reduce: boolean) => {
      loop?.stop(); float.setValue(0);
      if (!reduce && AppState.currentState === 'active') { loop = Animated.loop(Animated.sequence([Animated.timing(float, { toValue: 1, duration: 2100, useNativeDriver: true }), Animated.timing(float, { toValue: 0, duration: 2100, useNativeDriver: true })])); loop.start(); }
    };
    let reduced = false;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { reduced = v; run(v); });
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', v => { reduced = v; run(v); });
    const b = AppState.addEventListener('change', () => run(reduced));
    return () => { loop?.stop(); a.remove(); b.remove(); };
  }, [float]);
  return <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}><Image source={assets[mood]} accessibilityLabel={`Капи: ${mood}`} style={[s.mascot, small && { height: 170 }]} resizeMode="contain" /></Animated.View>;
}
function AudioButton({ text, speak }: { text: string; speak: (text: string) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Послушать: ${text}`} onPress={() => speak(text)} style={s.audio}><Text style={s.audioText}>▷  {text}</Text><Text style={s.caption}>Послушать</Text></Pressable>;
}
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
  const speechToken = useRef(0);
  const saveChain = useRef(Promise.resolve());
  const chime = useAudioPlayer(require('./assets/success.wav'));
  useEffect(() => { AsyncStorage.getItem('capiturk-expo-v1').then(raw => { if (raw) { const p = JSON.parse(raw); setProfile({ ...defaults, ...p, completed: Array.isArray(p.completed) ? p.completed.filter((x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 5) : [], positions: p.positions || {} }); } }).catch(() => Alert.alert('Не удалось загрузить прогресс', 'Можно продолжить с начала.')).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) saveChain.current = saveChain.current.then(() => AsyncStorage.setItem('capiturk-expo-v1', JSON.stringify(profile))).catch(() => { Alert.alert('Прогресс не сохранён', 'Проверь свободное место на iPhone.'); }); }, [profile, ready]);
  const update = (p: Partial<Profile>) => setProfile(v => ({ ...v, ...p }));
  const stopSpeech = () => { speechToken.current++; void Speech.stop(); setSpeaking(false); };
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'background') { stopSpeech(); chime.pause(); } }); return () => { sub.remove(); void Speech.stop(); }; }, []);
  async function speak(text: string) {
    const token = ++speechToken.current;
    await Speech.stop();
    if (token !== speechToken.current) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const voices = await Speech.getAvailableVoicesAsync();
      const voice = voices.find(v => v.language.toLowerCase().startsWith('tr'));
      if (token !== speechToken.current) return;
      setSpeaking(true);
      const end = () => { if (token === speechToken.current) setSpeaking(false); };
      Speech.speak(fill(text, profile), { language: 'tr-TR', voice: voice?.identifier, rate: .85, useApplicationAudioSession: true, onDone: end, onStopped: end, onError: () => { end(); Alert.alert('Озвучка недоступна', 'Добавь турецкий голос в настройках iPhone → Универсальный доступ → Устный контент → Голоса.'); } });
    } catch { setSpeaking(false); Alert.alert('Не удалось включить звук', 'Попробуй ещё раз.'); }
  }
  function feedback(success = true) { if (profile.haptics) void Haptics.notificationAsync(success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning); if (success && profile.sound) { void chime.seekTo(0); chime.play(); } }
  function start(l: Lesson) { stopSpeech(); setActive(l.id); setStep(Math.min(profile.positions[l.id] || 0, l.exercises.length - 1)); setDone(false); }
  const lesson = lessons.find(l => l.id === active);
  const nextLesson = lessons.find(l => !profile.completed.includes(l.id)) || lessons[0];
  const nav = (to: string) => { stopSpeech(); setTab(to); if (profile.haptics) void Haptics.selectionAsync(); };
  return <SafeAreaProvider><LinearGradient colors={['#FFF9F5', '#FAE8E1', '#F9F3F0']} style={{ flex: 1 }}><StatusBar barStyle="dark-content" /><SafeAreaView style={{ flex: 1 }}>
    {!ready ? <ActivityIndicator style={{ flex: 1 }} color={peach} /> : <>
      <View style={s.header}>{active !== null ? <Pressable accessibilityRole="button" accessibilityLabel="Закрыть урок" onPress={() => { stopSpeech(); setActive(null); setDone(false); }}><Text style={s.back}>‹</Text></Pressable> : <Text style={s.smallTag}>ТУРЕЦКИЙ В ТВОЁМ ТЕМПЕ</Text>}<Text style={s.logo}>Capi<Text style={{ color: peach }}>türk</Text></Text></View>
      {!profile.onboarded ? <ScrollView contentContainerStyle={s.content}>
        {onboard === 0 ? <><Text style={[s.title, s.center]}>Маленькие шаги{ '\n' }к большим историям</Text><Capi mood={speaking ? 'listening' : 'welcome'} /><View style={s.card}><Text style={[s.title, s.center]}>Merhaba!</Text><Text style={[s.body, s.center]}>Готова учить турецкий вместе?{ '\n' }Капи будет рядом на каждом шаге.</Text><AudioButton text="Merhaba!" speak={speak} /></View><Button title="Давай знакомиться  →" onPress={() => { stopSpeech(); setOnboard(1); }} /></> : <><Text style={s.title}>Твой маленький{ '\n' }ритуал на каждый день</Text><Text style={s.subtitle}>Начнём с простых разговоров. Выбери свой темп.</Text><View style={s.wrap}>{[5, 10, 15].map(minutes => <Chip key={minutes} text={`${minutes} минут`} selected={profile.minutes === minutes} onPress={() => update({ minutes })} />)}</View><ProfileForm profile={profile} update={update} /><Capi mood="profile" small /><Button title="Начать обучение  →" onPress={() => { update({ onboarded: true }); feedback(); }} /></>}
      </ScrollView> : lesson ? done ? <ScrollView contentContainerStyle={s.content}><Text style={[s.title, s.center]}>Урок пройден!</Text><Text style={[s.subtitle, s.center]}>Ещё один маленький шаг.{ '\n' }Капи гордится тобой ♡</Text><Capi mood="celebration" /><View style={s.card}><Text style={s.label}>{lesson.title}</Text><Text style={s.body}>{lesson.exercises.length} шагов практики • {lesson.newWords?.length || 0} новых слов</Text><Text style={s.caption}>Разговорные задания пройдены в режиме самостоятельной практики.</Text></View><Button title="Вернуться к моему пути  →" onPress={() => { setActive(null); setDone(false); setTab('course'); }} /></ScrollView> : <LessonScreen key={`${lesson.id}-${step}`} lesson={lesson} exercise={lesson.exercises[step]} step={step} profile={profile} update={update} speak={speak} stopSpeech={stopSpeech} speaking={speaking} feedback={feedback} next={() => { stopSpeech(); if (step + 1 < lesson.exercises.length) { setStep(step + 1); update({ positions: { ...profile.positions, [lesson.id]: step + 1 } }); } else { update({ completed: [...new Set([...profile.completed, lesson.id])], positions: { ...profile.positions, [lesson.id]: 0 } }); feedback(); setDone(true); } }} /> : <>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {tab === 'home' && <><Text style={s.eyebrow}>MERHABA, {profile.name.toLocaleUpperCase('tr')} ♡</Text><Text style={s.title}>Сегодня отличный день{ '\n' }для турецкого</Text><Text style={s.subtitle}>Без спешки. С теплом. В твоём темпе.</Text><Capi mood={speaking ? 'listening' : 'cafe'} /><View style={s.card}><View style={s.row}><Text style={s.label}>Твой план на сегодня</Text><Text style={s.pill}>{profile.minutes} мин</Text></View><Text style={s.body}>{nextLesson.title}</Text><Button title="Продолжить учиться  →" onPress={() => start(nextLesson)} /></View><View style={s.stats}><Text style={s.body}>✦  {profile.completed.length} / 6 уроков</Text><Text style={s.body}>♡  Маленькие шаги</Text></View></>}
          {tab === 'course' && <><Text style={s.eyebrow}>МОДУЛЬ 01</Text><Text style={s.title}>Твои первые{ '\n' }разговоры</Text><Text style={s.subtitle}>От «привет» до своей маленькой истории.</Text>{lessons.map((l, i) => { const unlocked = i === 0 || profile.completed.includes(lessons[i - 1].id); return <Pressable key={l.id} accessibilityRole="button" onPress={() => unlocked ? start(l) : Alert.alert('Шаг за шагом', 'Сначала заверши предыдущий урок.')} style={[s.courseCard, !unlocked && { opacity: .55 }]}><Image source={assets[(['welcome','cafe','travel','city','profile','celebration'] as Mood[])[i]]} style={s.thumb} /><View style={{ flex: 1 }}><Text style={s.caption}>{profile.completed.includes(l.id) ? '✓ Пройдено' : unlocked ? `Урок ${i + 1}` : 'Закрыто'}</Text><Text style={s.label}>{l.title}</Text><Text style={s.caption}>{l.goal}</Text></View><Text style={s.back}>›</Text></Pressable>; })}</>}
          {tab === 'words' && <><Text style={s.title}>Слова, которые{ '\n' }становятся твоими</Text><Text style={s.subtitle}>Нажми на турецкую строку и послушай.</Text>{lessons.map(l => <View key={l.id}><Text style={s.section}>{l.title}</Text>{[...(l.newWords || []), ...(l.extraWords || [])].map(w => <View key={w.turkish} style={s.card}><AudioButton text={w.turkish} speak={speak} /><Text style={s.body}>{w.russian}</Text><AudioButton text={fill(w.example, profile)} speak={speak} /><Text style={s.caption}>{fill(w.exampleTranslation, profile)}</Text></View>)}{l.phrases?.map((p, i) => <View key={`phrase${i}`} style={s.card}><AudioButton text={fill(p.turkish, profile)} speak={speak} /><Text style={s.body}>{fill(p.russian, profile)}</Text></View>)}{!!l.miniDialogue?.length && <View style={s.card}><Text style={s.label}>Мини-диалог</Text>{l.miniDialogue.map((d, i) => <View key={i}><AudioButton text={fill(d.turkish, profile)} speak={speak} /><Text style={s.caption}>{fill(d.russian, profile)}</Text></View>)}</View>}</View>)}</>}
          {tab === 'profile' && <><Text style={s.title}>Всё под контролем</Text><Text style={s.subtitle}>На твоём пути к турецкому ♡</Text><Capi mood="profile" small /><View style={s.card}><Text style={s.label}>Твой прогресс</Text><Text style={s.big}>{profile.completed.length} / 6</Text><Text style={s.caption}>уроков первого модуля</Text></View><View style={s.wrap}>{[5,10,15].map(minutes => <Chip key={minutes} text={`${minutes} минут`} selected={profile.minutes === minutes} onPress={() => update({ minutes })} />)}</View><View style={s.card}>{(['sound','haptics'] as const).map(k => <View key={k} style={s.row}><Text style={s.body}>{k === 'sound' ? 'Звуки успеха' : 'Тактильный отклик'}</Text><Switch accessibilityLabel={k === 'sound' ? 'Звуки успеха' : 'Тактильный отклик'} value={profile[k]} onValueChange={v => update({ [k]: v })} trackColor={{ true: peach }} /></View>)}</View><ProfileForm profile={profile} update={update} /><Text style={s.caption}>Expo Go · запись и прослушивание голоса. Автоматическая проверка произношения доступна в отдельном SwiftUI-приложении. Прогресс хранится на этом устройстве.</Text></>}
        </ScrollView><View style={s.nav}>{[['home','⌂','Главная'],['course','≋','Курс'],['words','▤','Слова'],['profile','♡','Профиль']].map(([key, icon, title]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => nav(key)} style={s.navItem}><Text style={[s.navIcon, tab === key && { color: peach }]}>{icon}</Text><Text style={[s.navText, tab === key && { color: peach }]}>{title}</Text></Pressable>)}</View>
      </>}
    </>}
  </SafeAreaView></LinearGradient></SafeAreaProvider>;
}

function LessonScreen({ lesson, exercise: e, step, profile, update, speak, stopSpeech, speaking, feedback, next }: { lesson: Lesson; exercise: Exercise; step: number; profile: Profile; update: (p: Partial<Profile>) => void; speak: (t: string) => void; stopSpeech: () => void; speaking: boolean; feedback: (v?: boolean) => void; next: () => void }) {
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
  const mood: Mood = rs.isRecording ? 'speaking' : speaking || ps.playing ? 'listening' : result || (tokens.length || selected ? 'thinking' : e.kind === 'speak' ? 'speaking' : context);
  useEffect(() => { if (ps.didJustFinish) setHeardRecording(true); }, [ps.didJustFinish]);
  useEffect(() => { alive.current = true; const sub = AppState.addEventListener('change', state => { if (state === 'background') { if (recorder.isRecording) void recorder.stop(); player.pause(); } }); return () => { alive.current = false; sub.remove(); if (recorder.isRecording) void recorder.stop(); }; }, []);
  useEffect(() => { if (rs.isRecording && rs.durationMillis >= 45000) void finishRecording(); }, [rs.durationMillis]);
  async function finishRecording() { try { await recorder.stop(); await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); if (alive.current) setRecorded(recorder.uri); } catch { if (alive.current) Alert.alert('Запись не сохранена', 'Попробуй записать ещё раз.'); } }
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
      await recorder.prepareToRecordAsync();
      if (!alive.current) return;
      recorder.record();
      if (profile.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { Alert.alert('Не удалось начать запись', 'Проверь микрофон и попробуй ещё раз.'); } finally { if (alive.current) setBusy(false); }
  }
  function check() { const correct = e.kind === 'build' ? normalize(tokens.map(i => fill(e.tokens![i], profile)).join(' ')) === normalize(target) : selected === e.answer; setResult(correct ? 'correct' : 'retry'); feedback(correct); }
  const audio = (text: string) => { if (recorder.isRecording || busy) return; player.pause(); speak(text); };
  return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.row}><View style={s.progress}><View style={[s.progressFill, { width: `${(step + 1) / lesson.exercises.length * 100}%` }]} /></View><Text style={s.caption}>{step + 1}/{lesson.exercises.length}</Text></View>
    <Text style={s.title}>{e.title}</Text><Text style={s.subtitle}>{fill(e.prompt, profile)}</Text>
    <Capi mood={mood} small />
    {e.kind === 'profile' && <ProfileForm profile={profile} update={update} />}
    {e.kind === 'map' && <View style={s.card}><Text style={[s.big, s.center]}>{e.direction === 'left' ? `🏥   ←   📍` : `📍   →   🏥`}</Text><Text style={[s.label, s.center]}>{e.mapTarget}</Text><Text style={[s.caption, s.center]}>Ты находишься у отметки 📍</Text></View>}
    {word && <View style={s.card}><AudioButton text={word.turkish} speak={audio} /><Text style={[s.body, s.center]}>{word.pronunciation} {word.russian}</Text><AudioButton text={fill(word.example, profile)} speak={audio} /><Text style={s.caption}>{fill(word.exampleTranslation, profile)}</Text></View>}
    {!!e.text && e.kind !== 'build' && <View style={s.card}>{e.kind === 'listen' ? <Button title="▷  Послушать фразу" soft onPress={() => audio(target)} /> : <><AudioButton text={target.replace(/___/g, '…')} speak={audio} />{!e.hideTranslation && !!e.translation && <Text style={[s.body, s.center]}>{fill(e.translation, profile)}</Text>}</>}</View>}
    {e.options?.map(o => <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: selected === o.id }} disabled={result === 'correct'} onPress={() => { setSelected(o.id); setResult(null); if (profile.haptics) void Haptics.selectionAsync(); }} style={[s.option, selected === o.id && s.selected]}><Text style={s.body}>{selected === o.id ? '●  ' : '○  '}{fill(o.text, profile)}</Text></Pressable>)}
    {e.kind === 'build' && <><View style={s.card}><Text style={s.caption}>Твоя фраза · нажми слово, чтобы убрать</Text><View style={[s.wrap, { minHeight: 60 }]}>{tokens.map((i, pos) => <Chip key={i} text={fill(e.tokens![i], profile)} selected onPress={() => { if (result !== 'correct') { setTokens(tokens.filter((_, p) => p !== pos)); setResult(null); } }} />)}</View></View><View style={s.wrap}>{e.tokens?.map((t, i) => !tokens.includes(i) && <Chip key={i} text={fill(t, profile)} selected={false} onPress={() => { if (result !== 'correct') { setTokens([...tokens, i]); setResult(null); } }} />)}</View>{result === 'correct' && <AudioButton text={target} speak={audio} />}</>}
    {e.kind === 'speak' && <View style={s.card}><Text style={s.caption}>Самостоятельная практика · без оценки произношения</Text><Button title={rs.isRecording ? `■  Остановить · ${Math.floor(rs.durationMillis / 1000)} с` : '●  Записать мой голос'} onPress={() => { void toggleRecording(); }} disabled={busy} />{rs.isRecording && <View style={s.meter}><View style={[s.progressFill, { width: `${Math.max(8, Math.min(100, ((rs.metering ?? -60) + 60) / 60 * 100))}%` }]} /></View>}{recorded && <Button soft title={ps.playing ? 'Ⅱ  Пауза' : '▷  Послушать мою запись'} onPress={() => { stopSpeech(); if (ps.playing) player.pause(); else { void player.seekTo(0); player.play(); } }} />}<Text style={s.caption}>{heardRecording ? 'Сравни свою запись с образцом. Можно записать ещё раз или продолжить.' : 'Запиши фразу и прослушай запись до конца. Максимум 45 секунд.'}</Text></View>}
    {result && <View style={[s.card, { backgroundColor: result === 'correct' ? '#E5EFE2' : '#FCE4DA' }]}><Text style={s.label}>{result === 'correct' ? 'Harika! Всё получилось ♡' : 'Попробуем ещё раз ♡'}</Text><Text style={s.body}>{result === 'correct' ? 'Ты на шаг ближе к свободному разговору.' : 'Послушай образец или вспомни значение и выбери другой ответ.'}</Text></View>}
    {tested && result !== 'correct' ? <Button title="Проверить" disabled={e.kind === 'build' ? tokens.length !== e.tokens?.length : selected === null} onPress={check} /> : <Button title="Продолжить  →" disabled={e.kind === 'speak' && (!heardRecording || rs.isRecording || busy)} onPress={() => { player.pause(); next(); }} />}
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 16 }, header: { paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logo: { fontSize: 24, color: '#24364C', letterSpacing: -1 }, smallTag: { fontSize: 8, letterSpacing: 1.1, color: '#8E817D', maxWidth: 130 }, eyebrow: { fontSize: 10, letterSpacing: 2, color: '#BC7969', marginTop: 14 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '600', color: '#23354B', letterSpacing: -.8 }, subtitle: { fontSize: 16, lineHeight: 23, color: '#818087' }, body: { fontSize: 16, lineHeight: 23, color: '#344054' }, caption: { fontSize: 12, lineHeight: 18, color: '#87828A' }, label: { fontSize: 17, fontWeight: '600', color: '#2A3B53', lineHeight: 24 }, center: { textAlign: 'center' }, mascot: { height: 275, width: '100%', borderRadius: 36 }, card: { padding: 20, backgroundColor: '#FFFCF8DD', borderRadius: 26, gap: 12, borderWidth: 1, borderColor: '#FFFFFFCC' }, button: { backgroundColor: peach, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 28, alignItems: 'center', minHeight: 55 }, softButton: { backgroundColor: '#FBD7C7' }, buttonText: { fontSize: 17, color: '#FFF', fontWeight: '600' }, audio: { alignItems: 'center', paddingVertical: 10, gap: 3, minHeight: 50 }, audioText: { fontSize: 24, lineHeight: 31, color: '#293F57', textAlign: 'center', fontWeight: '500' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, pill: { backgroundColor: '#FCE2D7', color: '#A56353', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, fontSize: 12 }, stats: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }, nav: { flexDirection: 'row', backgroundColor: '#FFFCF8EF', borderTopWidth: 1, borderColor: '#F1DDD5', paddingTop: 9, paddingBottom: 5 }, navItem: { flex: 1, alignItems: 'center', gap: 3, padding: 4 }, navIcon: { fontSize: 26, color: '#ABA3A1' }, navText: { fontSize: 10, color: '#928B89' }, courseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBF7CF', borderRadius: 26, padding: 12 }, thumb: { width: 80, height: 90, borderRadius: 24 }, back: { fontSize: 32, color: '#BA8677', minWidth: 32 }, section: { fontSize: 20, color: '#324057', fontWeight: '600', marginVertical: 18 }, big: { fontSize: 42, color: '#35435B', fontWeight: '500' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, chip: { paddingVertical: 13, paddingHorizontal: 18, backgroundColor: '#FFFCF9', borderRadius: 20, borderColor: '#F3E5DF', borderWidth: 1 }, selected: { backgroundColor: '#FCDCCD', borderColor: '#F3AE96' }, input: { color: '#283B51', fontSize: 19, borderBottomColor: '#E7B4A4', borderBottomWidth: 1, padding: 12 }, progress: { height: 5, borderRadius: 6, backgroundColor: '#E5DBD7', flex: 1, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: peach, borderRadius: 6 }, option: { padding: 18, backgroundColor: '#FFFCF8', borderWidth: 1, borderColor: '#F5E8E2', borderRadius: 22 }, meter: { height: 6, backgroundColor: '#F5E4DC', borderRadius: 6, overflow: 'hidden' },
});
