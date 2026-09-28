import SwiftUI

struct LessonAudioLibrary: View {
    let lesson: Lesson
    @EnvironmentObject private var store: AppStore
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var voice = Voice()
    var body: some View {
        Page {
            Text("Послушай и повтори").font(.largeTitle.bold())
            CapiArt(state: voice.speaking ? .listening : .context(lessonID: lesson.id), height: 180)
            Text("Слова").font(.title2.bold())
            ForEach(lesson.allWords) { word in
                VStack(alignment: .leading, spacing: 14) {
                    row(word.turkish, translation: word.russian)
                    row(word.example, translation: word.exampleTranslation)
                }.softCard()
            }
            Text("Фразы").font(.title2.bold())
            ForEach(Array(lesson.phrases.enumerated()), id: \.offset) { _, phrase in
                row(phrase.turkish, translation: phrase.russian).softCard()
            }
            Text("Диалог").font(.title2.bold())
            ForEach(Array(lesson.miniDialogue.enumerated()), id: \.offset) { _, line in
                VStack(alignment: .leading, spacing: 8) {
                    Text(line.role).font(.caption).foregroundStyle(Palette.coral)
                    row(line.turkish, translation: line.russian)
                }.softCard()
            }
        }.navigationTitle(lesson.title).navigationBarTitleDisplayMode(.inline)
            .onDisappear { voice.stop() }
            .onChange(of: scenePhase) { _, phase in if phase != .active { voice.stop() } }
            .alert("Озвучка", isPresented: Binding(get: { voice.message != nil }, set: { if !$0 { voice.message = nil } })) {
                Button("Понятно") { voice.message = nil }
            } message: { Text(voice.message ?? "") }
    }
    private func row(_ turkish: String, translation: String) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(store.profile.resolve(turkish)).font(.headline)
                Text(store.profile.resolve(translation)).font(.subheadline).foregroundStyle(Palette.muted)
            }
            Spacer(minLength: 0)
            Button { voice.speak(store.profile.resolve(turkish)) } label: {
                Image(systemName: "speaker.wave.2").frame(width: 48, height: 48).background(Palette.peach, in: Circle())
            }.accessibilityLabel("Послушать: " + store.profile.resolve(turkish))
        }
    }
}
