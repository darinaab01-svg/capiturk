import SwiftUI

struct DictionaryView: View {
    @EnvironmentObject private var store: AppStore
    @StateObject private var voice = Voice()
    @State private var search = ""
    @State private var filter = 0
    private var words: [Word] {
        Curriculum.lessons.filter { filter != 1 || store.state.completed.contains($0.id) }.flatMap(\.allWords).filter {
            (filter != 2 || store.state.favorites.contains($0.turkish)) &&
            (search.isEmpty || $0.turkish.localizedCaseInsensitiveContains(search) || $0.russian.localizedCaseInsensitiveContains(search))
        }
    }
    var body: some View {
        Page {
            Text("Твои маленькие\nоткрытия").font(.largeTitle.bold())
            CapiArt(state: voice.speaking ? .listening : .learning, height: 130)
            Picker("Слова", selection: $filter) { Text("Все").tag(0); Text("Изучены").tag(1); Text("Избранное").tag(2) }.pickerStyle(.segmented)
            if words.isEmpty { ContentUnavailableView("Пока пусто", systemImage: "book", description: Text("Пройди урок или добавь слово в избранное. Если используешь поиск, попробуй другой запрос.")) }
            ForEach(words) { word in
                HStack(spacing: 12) {
                    Image(systemName: word.symbol).font(.title2).foregroundStyle(Palette.coral).frame(width: 34)
                    VStack(alignment: .leading, spacing: 5) { Text(word.turkish).fontWeight(.medium); Text(word.russian).font(.caption).foregroundStyle(Palette.muted) }
                    Spacer(minLength: 0)
                    Button { voice.speak(word.turkish) } label: { Image(systemName: "speaker.wave.2").frame(width: 44, height: 44) }.accessibilityLabel("Послушать \(word.turkish)")
                    Button {
                        if store.state.favorites.contains(word.turkish) { store.state.favorites.remove(word.turkish) } else { store.state.favorites.insert(word.turkish) }
                    } label: { Image(systemName: store.state.favorites.contains(word.turkish) ? "heart.fill" : "heart").frame(width: 44, height: 44) }.accessibilityLabel(store.state.favorites.contains(word.turkish) ? "Убрать из избранного" : "В избранное")
                }.softCard()
            }
        }.navigationTitle("Словарь").navigationBarTitleDisplayMode(.inline).searchable(text: $search, prompt: "Слово или перевод")
            .onDisappear { voice.stop() }
            .alert("Озвучка", isPresented: Binding(get: { voice.message != nil }, set: { if !$0 { voice.message = nil } })) { Button("Понятно") { voice.message = nil } } message: { Text(voice.message ?? "") }
    }
}

struct ProgressScreen: View {
    @EnvironmentObject private var store: AppStore
    private var days: [Date] { (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0 - 6, to: Date()) } }
    var body: some View {
        Page {
            Text("Твой прогресс").font(.largeTitle.bold())
            Text("Каждое слово — уже шаг вперёд.").foregroundStyle(Palette.muted)
            HStack {
                Image(systemName: "flame.fill").font(.largeTitle).foregroundStyle(Palette.coral)
                VStack(alignment: .leading, spacing: 5) { Text("Дней подряд: \(store.streak)").font(.title3.bold()); Text(store.streak > 0 ? "Так держать!" : "Твоя история начинается сегодня").font(.caption).foregroundStyle(Palette.muted) }
                Spacer()
            }.softCard()
            Text("Последние 7 дней").font(.headline)
            HStack {
                ForEach(days, id: \.self) { day in
                    let active = store.state.activity[AppStore.dayKey(day)] != nil
                    VStack(spacing: 9) {
                        Text(day, format: .dateTime.weekday(.narrow)).font(.caption).foregroundStyle(Palette.muted)
                        Text(active ? "✓" : day.formatted(.dateTime.day())).font(.caption).frame(width: 30, height: 30).background(active ? Palette.peach : .white.opacity(0.6), in: Circle())
                    }.frame(maxWidth: .infinity).accessibilityLabel("\(day.formatted(date: .abbreviated, time: .omitted)): \(active ? "урок пройден" : "без занятий")")
                }
            }
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text("Первый модуль"); Spacer(); Text("\(store.state.completed.count + (store.state.finalCompleted ? 1 : 0)) / 6") }
                ProgressView(value: Double(store.state.completed.count + (store.state.finalCompleted ? 1 : 0)), total: 6)
                Text("Активных слов изучено: \(store.learnedCount) из \(Curriculum.wordCount)").font(.subheadline).foregroundStyle(Palette.muted)
                Text(store.moduleCompleted ? "Первый разговор пройден ♡" : "Финал модуля — отдельный разговор после 5 уроков").font(.caption).foregroundStyle(Palette.muted)
            }.softCard()
            Text("Мои достижения").font(.headline)
            HStack(alignment: .top, spacing: 10) {
                badge("Первые слова", "star", store.learnedCount >= 7)
                badge("Три дня", "flame", store.streak >= 3)
                badge("Первый разговор", "crown", store.moduleCompleted)
            }
            CapiArt(state: store.moduleCompleted ? .celebration : .learning, height: 230)
        }.navigationBarTitleDisplayMode(.inline)
    }
    private func badge(_ title: String, _ symbol: String, _ earned: Bool) -> some View {
        VStack(spacing: 12) {
            Image(systemName: earned ? symbol + ".fill" : "lock").font(.title).frame(width: 66, height: 66).background(earned ? Palette.peach : Color.gray.opacity(0.1), in: Circle()).foregroundStyle(earned ? Palette.coral : Palette.muted)
            Text(title).font(.caption).multilineTextAlignment(.center)
        }.frame(maxWidth: .infinity).accessibilityLabel("\(title): \(earned ? "получено" : "ещё не получено")")
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var resetConfirmation = false
    var body: some View {
        Page {
            Brand()
            Text("В твоём темпе").font(.largeTitle.bold())
            Text("Маленькие привычки, большие истории.").foregroundStyle(Palette.muted)
            CapiArt(state: .profile, height: 200)
            VStack(alignment: .leading, spacing: 18) {
                Text("Твой профиль").font(.headline)
                TextField("Твоё имя", text: $store.state.name).textContentType(.givenName).padding(12).background(Palette.cream, in: RoundedRectangle(cornerRadius: 12))
                Text(store.state.goal).font(.subheadline).foregroundStyle(Palette.muted)
                Text(store.state.level).font(.subheadline).foregroundStyle(Palette.muted)
            }.softCard()
            LearningProfileEditor()
            VStack(alignment: .leading, spacing: 18) {
                Text("Ежедневная цель").font(.headline)
                Picker("Минут в день", selection: $store.state.minutes) { ForEach([5, 10, 15, 20], id: \.self) { Text("\($0) мин").tag($0) } }.pickerStyle(.segmented)
                Toggle("Звуки ответов", isOn: $store.state.sound)
                Toggle("Тактильный отклик", isOn: $store.state.haptics)
            }.softCard()
            VStack(alignment: .leading, spacing: 10) {
                Label("Русский → Türkçe", systemImage: "globe").font(.headline)
                Text("Уроки и прогресс доступны без аккаунта. Данные сохраняются только на этом устройстве. Для офлайн-озвучки нужен загруженный турецкий голос iOS.").font(.footnote).foregroundStyle(Palette.muted)
                Text("Распознавание использует сервис Apple, если турецкая модель недоступна на устройстве. В этом случае запись отправляется Apple с твоего разрешения. Запись удаляется при выходе из задания. Совпадение текста не является оценкой акцента.").font(.footnote).foregroundStyle(Palette.muted)
                Text("Capitürk · модуль 1 · 5 уроков и итоговый разговор").font(.caption).foregroundStyle(Palette.muted)
            }.softCard()
            Button("Сбросить прогресс и профиль", role: .destructive) { resetConfirmation = true }.font(.footnote).frame(maxWidth: .infinity).padding()
        }.navigationBarTitleDisplayMode(.inline)
            .confirmationDialog("Удалить профиль, избранное и весь прогресс с этого устройства?", isPresented: $resetConfirmation, titleVisibility: .visible) {
                Button("Удалить данные", role: .destructive) { store.state = SavedState() }
                Button("Отмена", role: .cancel) {}
            }
    }
}
