import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import { assets, Mood } from './learning';

export const colors = {
  surfacePrimary: '#FFF9F3', surfaceSecondary: '#F9EBE2', surfaceGlass: '#FFFCF5E6',
  textPrimary: '#27394C', textSecondary: '#776B68', accentCoral: '#B45B48', accentPeach: '#F8CEBB',
  successSoft: '#FCE5D6', dividerSoft: '#EBD8CB', muted: '#AD8A7B', white: '#FFFFFF',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, page: 24, section: 32, hero: 40 };
export const radius = { small: 12, medium: 20, large: 32, capsule: 100 };
export type Sound = 'tap' | 'correct' | 'lesson_complete' | 'record_start' | 'record_stop' | 'word_reveal';
export const UIContext = createContext<{ playing: string | null; sound: (name: Sound) => void }>({ playing: null, sound: () => {} });
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => { let live = true; AccessibilityInfo.isReduceMotionEnabled().then(v => { if (live) setReduced(v); }); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced); return () => { live = false; sub.remove(); }; }, []);
  return reduced;
}
export function Icon({ name, size = 20, color = colors.accentCoral }: { name: React.ComponentProps<typeof Ionicons>['name']; size?: number; color?: string }) { return <Ionicons name={name} size={size} color={color} accessible={false} />; }
export function Entrance({ children, identity }: { children: React.ReactNode; identity: string | number }) {
  const reduced = useReducedMotion(); const value = useRef(new Animated.Value(1)).current;
  useEffect(() => { value.stopAnimation(); if (reduced) { value.setValue(1); return; } value.setValue(0); const animation = Animated.timing(value, { toValue: 1, duration: 220, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [identity, reduced]);
  return <Animated.View style={{ flex: 1, opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}
export function Pulse({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion(); const value = useRef(new Animated.Value(1)).current;
  useEffect(() => { value.stopAnimation(); value.setValue(1); if (!active || reduced) return; const loop = Animated.loop(Animated.sequence([Animated.timing(value, { toValue: 1.06, duration: 600, useNativeDriver: true }), Animated.timing(value, { toValue: 1, duration: 600, useNativeDriver: true })])); loop.start(); const sub = AppState.addEventListener('change', s => { if (s !== 'active') { loop.stop(); value.setValue(1); } else loop.start(); }); return () => { loop.stop(); sub.remove(); }; }, [active, reduced]);
  return <Animated.View style={{ transform: [{ scale: value }] }}>{children}</Animated.View>;
}
export function Button({ title, onPress, soft = false, disabled = false }: { title: string; onPress: () => void; soft?: boolean; disabled?: boolean }) {
  const ui = useContext(UIContext);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { ui.sound('tap'); onPress(); }} style={({ pressed }) => [d.button, soft && d.soft, disabled && d.disabled, pressed && { transform: [{ scale: .98 }] }]}><Text style={[d.buttonText, (soft || disabled) && { color: colors.textPrimary }]}>{title}</Text></Pressable>;
}
export function Choice({ text, selected, correct, onPress }: { text: string; selected: boolean; correct?: boolean; onPress: () => void }) {
  const value = useRef(new Animated.Value(1)).current; const reduced = useReducedMotion();
  useEffect(() => { if (!selected || reduced) return; const a = Animated.sequence([Animated.timing(value, { toValue: 1.02, duration: 100, useNativeDriver: true }), Animated.spring(value, { toValue: 1, friction: 5, useNativeDriver: true })]); a.start(); return () => a.stop(); }, [selected, correct, reduced]);
  return <Animated.View style={{ transform: [{ scale: value }] }}><Pressable accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} onPress={onPress} style={[d.choice, selected && d.chosen]}><Icon name={selected ? correct ? 'checkmark-circle' : 'radio-button-on' : 'ellipse-outline'} /><Text style={d.choiceText}>{text}</Text></Pressable></Animated.View>;
}
export function Progress({ value }: { value: number }) {
  const animated = useRef(new Animated.Value(Math.max(0, value - .04))).current; const reduced = useReducedMotion();
  useEffect(() => { const a = Animated.timing(animated, { toValue: Math.min(1, Math.max(0, value)), duration: reduced ? 0 : 240, useNativeDriver: false }); a.start(); return () => a.stop(); }, [value, reduced]);
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={d.track}><Animated.View style={[d.fill, { width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>;
}
export function Waveform({ level }: { level: number }) {
  const strength = Math.max(.12, Math.min(1, (level + 60) / 60));
  return <View accessibilityLabel="Уровень записи голоса" style={{ height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>{Array.from({ length: 15 }, (_, i) => <View key={i} style={{ width: 4, borderRadius: 4, height: 6 + 30 * strength * (.35 + .65 * Math.abs(Math.sin(i * 1.7))), backgroundColor: colors.accentCoral }} />)}</View>;
}
export function AudioButton({ text, speak, compact = false, slow = false }: { text: string; speak: (text: string, rate?: number) => void; compact?: boolean; slow?: boolean }) {
  const { playing } = useContext(UIContext); const active = playing === text;
  return <View style={[d.audioRow, !compact && { flexWrap: 'wrap', justifyContent: 'center' }]}><Pressable accessibilityRole="button" accessibilityLabel={`Послушать: ${text}`} accessibilityState={{ busy: active }} onPress={() => speak(text)} style={[d.audioTarget, compact && { justifyContent: 'space-between' }]}><Text style={[d.audioText, compact && { fontSize: 18, textAlign: 'left', flex: 1 }]}>{text}</Text><Pulse active={active}><View style={d.speaker}><Icon name={active ? 'volume-high' : 'volume-medium-outline'} /></View></Pulse></Pressable>{slow && <Pressable accessibilityRole="button" accessibilityLabel={`Послушать медленно: ${text}`} onPress={() => speak(text, .65)} style={d.slow}><Text style={d.slowText}>0.75×</Text></Pressable>}</View>;
}
export async function preloadMascots() { const sources = [...new Set(Object.values(assets))]; await Promise.allSettled(sources.map(async source => { const asset = Asset.fromModule(source); await asset.downloadAsync(); await Image.prefetch(asset.localUri || asset.uri); })); }
function Silhouette() { return <View accessibilityLabel="Капи готовится появиться" style={d.silhouette}><View style={d.earLeft} /><View style={d.earRight} /><View style={d.head}><View style={d.nose} /><Text style={d.bow}>✿</Text></View><Text style={d.loading}>Капи рядом ♡</Text></View>; }
export function Capi({ mood, small = false, height, badge = false }: { mood: Mood; small?: boolean; height?: number; badge?: boolean }) {
  const float = useRef(new Animated.Value(0)).current; const reduced = useReducedMotion(); const [loaded, setLoaded] = useState<Mood | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [mood]);
  useEffect(() => {
    float.setValue(0); if (reduced) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }), Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true })]));
    if (AppState.currentState === 'active') loop.start();
    const sub = AppState.addEventListener('change', v => { if (v === 'active') loop.start(); else { loop.stop(); float.setValue(0); } });
    return () => { loop.stop(); sub.remove(); };
  }, [reduced]);
  return <View style={{ height: height ?? (small ? 132 : 240), alignItems: 'center', justifyContent: 'center' }}><View style={[d.halo, small && { width: 120, height: 96 }]} />{(loaded !== mood || failed) && <Silhouette />}<Animated.View style={{ width: '100%', height: '100%', transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-.5deg', '.5deg'] }) }] }}><Image source={assets[mood]} accessibilityLabel="Капи — твоя спутница в изучении турецкого" style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" transition={reduced ? 0 : 180} onLoad={() => { setLoaded(mood); setFailed(false); }} onError={() => { setFailed(true); console.warn('Mascot asset unavailable:', mood); }} /></Animated.View>{badge && <Text style={d.heroNote}>Küçük adımlar ♡</Text>}</View>;
}
export function Confetti() {
  const reduced = useReducedMotion(); const value = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (reduced) return; const a = Animated.timing(value, { toValue: 1, duration: 2200, useNativeDriver: true }); a.start(); return () => a.stop(); }, [reduced]);
  if (reduced) return null;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{Array.from({ length: 14 }, (_, i) => <Animated.View key={i} style={{ position: 'absolute', left: `${(i * 19) % 97}%`, top: 0, width: 5, height: 8, borderRadius: 2, backgroundColor: i % 2 ? colors.accentPeach : colors.accentCoral, opacity: value.interpolate({ inputRange: [0, .7, 1], outputRange: [0, .7, 0] }), transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [20 + i * 3, 250 + i * 7] }) }, { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i * 33}deg`] }) }] }} />)}</View>;
}
const d = StyleSheet.create({
  button: { minHeight: 56, borderRadius: radius.capsule, backgroundColor: colors.accentCoral, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20 }, soft: { backgroundColor: colors.accentPeach }, disabled: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.dividerSoft }, buttonText: { fontSize: 16, fontWeight: '600', color: colors.white },
  choice: { minHeight: 56, padding: 16, gap: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.dividerSoft, backgroundColor: colors.surfaceGlass, borderRadius: radius.medium }, chosen: { backgroundColor: colors.successSoft, borderColor: colors.accentCoral }, choiceText: { fontSize: 17, color: colors.textPrimary, flex: 1 }, track: { height: 4, backgroundColor: colors.dividerSoft, borderRadius: 4, flex: 1, overflow: 'hidden' }, fill: { height: 4, backgroundColor: colors.accentCoral, borderRadius: 4 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, audioTarget: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, flexShrink: 1 }, audioText: { fontSize: 28, color: colors.textPrimary, fontWeight: '500', textAlign: 'center', flexShrink: 1 }, speaker: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }, slow: { padding: 12, minHeight: 44, justifyContent: 'center' }, slowText: { fontSize: 12, color: colors.accentCoral, fontWeight: '600' },
  halo: { position: 'absolute', width: 210, height: 170, borderRadius: 100, backgroundColor: '#F7D8C82A', bottom: 4 }, silhouette: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 110, height: 120 }, head: { width: 88, height: 70, backgroundColor: '#EAC6AE', borderRadius: 38, alignItems: 'center', justifyContent: 'center' }, earLeft: { width: 26, height: 26, backgroundColor: '#EAC6AE', borderRadius: 13, position: 'absolute', top: 12, left: 8 }, earRight: { width: 26, height: 26, backgroundColor: '#EAC6AE', borderRadius: 13, position: 'absolute', top: 12, right: 8 }, nose: { width: 28, height: 18, borderRadius: 12, backgroundColor: '#C09A80' }, bow: { position: 'absolute', color: colors.accentCoral, left: 3, top: -8, fontSize: 22 }, loading: { fontSize: 10, color: colors.textSecondary, marginTop: 8 }, heroNote: { position: 'absolute', right: 0, top: 24, fontSize: 12, color: colors.accentCoral, fontStyle: 'italic', transform: [{ rotate: '8deg' }] },
});
