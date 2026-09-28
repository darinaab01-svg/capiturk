import SwiftUI

@main struct CapiturkApp: App {
    @StateObject private var store = AppStore()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).buttonStyle(PressStyle()).preferredColorScheme(.light)
        }
    }
}

enum Palette {
    static let ink = Color(red: 0.08, green: 0.16, blue: 0.25)
    static let coral = Color(red: 0.88, green: 0.40, blue: 0.31)
    static let peach = Color(red: 1, green: 0.83, blue: 0.76)
    static let cream = Color(red: 0.99, green: 0.95, blue: 0.92)
    static let muted = Color(red: 0.44, green: 0.43, blue: 0.44)
}

struct Page<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        ZStack {
            LinearGradient(colors: [.white, Palette.cream, Palette.peach.opacity(0.30)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView { VStack(alignment: .leading, spacing: 23) { content }.padding(24).frame(maxWidth: 540) }.scrollIndicators(.hidden)
        }.foregroundStyle(Palette.ink)
    }
}

struct Brand: View {
    var body: some View {
        (Text("Capi").foregroundStyle(Palette.ink) + Text("türk").foregroundStyle(Palette.coral))
            .font(.system(size: 28, weight: .medium, design: .rounded)).accessibilityLabel("Капитюрк")
    }
}

struct PrimaryButton: View {
    let title: String
    var symbol = "arrow.right"
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack { Spacer(); Text(title).fontWeight(.semibold); Image(systemName: symbol); Spacer() }
                .padding(.vertical, 18).padding(.horizontal, 12)
                .background(LinearGradient(colors: [Palette.coral, Color(red: 0.95, green: 0.55, blue: 0.43)], startPoint: .leading, endPoint: .trailing), in: Capsule())
                .foregroundStyle(.white)
        }.buttonStyle(PressStyle())
    }
}

struct PressStyle: ButtonStyle {
    @EnvironmentObject private var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, pressed in if pressed { store.interaction() } }
    }
}

extension View {
    func softCard() -> some View {
        self.padding(18).background(.white.opacity(0.73), in: RoundedRectangle(cornerRadius: 24))
    }
}

struct ChoiceRow: View {
    let title: String
    var subtitle: String? = nil
    var symbol = "circle"
    var selected = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 15) {
                Image(systemName: symbol).font(.title3).frame(width: 27).foregroundStyle(Palette.coral)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).foregroundStyle(Palette.ink)
                    if let subtitle { Text(subtitle).font(.caption).foregroundStyle(Palette.muted) }
                }
                Spacer(minLength: 0)
                if selected { Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.coral) }
            }.padding(17).frame(minHeight: 62)
                .background(selected ? Palette.peach.opacity(0.66) : .white.opacity(0.72), in: RoundedRectangle(cornerRadius: 21))
                .overlay(RoundedRectangle(cornerRadius: 21).stroke(selected ? Palette.coral.opacity(0.35) : .clear))
        }.buttonStyle(PressStyle()).accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

struct RootView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        Group {
            if Curriculum.module == nil {
                ContentUnavailableView("Не удалось открыть курс", systemImage: "book.closed", description: Text("Проверь, что Module1.json включён в ресурсы проекта Xcode."))
            } else if store.state.onboarded { MainTabs() } else { OnboardingView() }
        }.fontDesign(.rounded).tint(Palette.coral)
    }
}

struct OnboardingView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = 0
    var body: some View {
        Page {
            HStack {
                if step > 0 { Button { move(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("Назад") }
                Spacer(); Brand(); Spacer()
            }
            if step > 0 { ProgressView(value: Double(step), total: 4).tint(Palette.coral).accessibilityLabel("Настройка обучения, шаг \(step) из 4") }
            Group {
                switch step {
                case 0:
                    VStack(spacing: 8) {
                        Text("Маленькие шаги\nк большим историям").font(.title3).multilineTextAlignment(.center).foregroundStyle(Palette.muted)
                        CapiArt(state: .welcome, height: 330)
                        Text("Merhaba!").font(.largeTitle.bold())
                        Text("Будем учить турецкий вместе?").font(.title3).multilineTextAlignment(.center)
                    }
                case 1:
                    Text("Как тебя зовут?").font(.largeTitle.bold())
                    Text("Капи будет рядом на твоём пути к турецкому.").foregroundStyle(Palette.muted)
                    TextField("Твоё имя", text: $store.state.name).textContentType(.givenName).submitLabel(.done).softCard()
                    CapiArt(state: .profile, height: 270)
                case 2:
                    Text("Для чего тебе\nтурецкий сейчас?").font(.title.bold())
                    Text("Выбери главную причину.").foregroundStyle(Palette.muted)
                    ForEach(Array(zip(["Для путешествий", "Для жизни в Турции", "Для общения", "Для себя"], ["airplane", "building.2", "heart", "sparkles"])), id: \.0) { title, icon in
                        ChoiceRow(title: title, symbol: icon, selected: store.state.goal == title) { store.state.goal = title }
                    }
                case 3:
                    Text("Что ты уже умеешь?").font(.title.bold())
                    Text("Начальный курс можно проходить с нуля или использовать для повторения.").foregroundStyle(Palette.muted)
                    ForEach(["Начинаю с нуля", "Знаю отдельные слова", "Понимаю простые фразы"], id: \.self) { value in
                        ChoiceRow(title: value, symbol: "leaf", selected: store.state.level == value) { store.state.level = value }
                    }
                    CapiArt(state: step == 1 ? .profile : step == 2 ? .travel : .learning, height: 200)
                default:
                    Text("Сколько времени\nудобно заниматься?").font(.title.bold())
                    Text("Лучше понемногу, но регулярно.").foregroundStyle(Palette.muted)
                    ForEach([5, 10, 15, 20], id: \.self) { minutes in
                        ChoiceRow(title: "\(minutes) минут", subtitle: minutes == 10 ? "Комфортный ежедневный темп" : "Твой личный ритм", symbol: "clock", selected: store.state.minutes == minutes) { store.state.minutes = minutes }
                    }
                    Text("Начнём с первого модуля: 5 уроков, \(Curriculum.wordCount) активных слова и твой первый разговор. Цель и уровень сохранятся в профиле.").font(.footnote).foregroundStyle(Palette.muted)
                }
            }.id(step).transition(.opacity)
            PrimaryButton(title: step == 4 ? "Начать обучение" : step == 0 ? "Давай начнём" : "Продолжить") {
                if step == 4 { store.state.onboarded = true; store.feedback() } else { move(1) }
            }
        }
    }
    private func move(_ delta: Int) { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { step += delta } }
}

struct MainTabs: View {
    var body: some View {
        TabView {
            NavigationStack { HomeView() }.tabItem { Label("Главная", systemImage: "house.fill") }
            NavigationStack { CourseView() }.tabItem { Label("Курс", systemImage: "map") }
            NavigationStack { DictionaryView() }.tabItem { Label("Слова", systemImage: "book.closed") }
            NavigationStack { ProgressScreen() }.tabItem { Label("Прогресс", systemImage: "chart.bar") }
            NavigationStack { SettingsView() }.tabItem { Label("Настройки", systemImage: "gearshape") }
        }.tint(Palette.coral)
    }
}

struct HomeView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        Page {
            HStack { Brand(); Spacer(); Label("\(store.streak)", systemImage: "flame.fill").foregroundStyle(Palette.coral).padding(10).background(.white, in: Capsule()).accessibilityLabel("Дней подряд: \(store.streak)") }
            VStack(alignment: .leading, spacing: 8) {
                Text(store.state.name.trimmingCharacters(in: .whitespaces).isEmpty ? "Merhaba, друг!" : "Привет,\n\(store.state.name)!").font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Сегодня отличный день\nдля турецкого ♡").foregroundStyle(Palette.muted)
            }
            CapiArt(state: .welcome, height: 280)
            if let next = store.nextLesson {
            NavigationLink { LessonIntro(lesson: next) } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Твой план на сегодня").fontWeight(.semibold)
                        Text("Короткий урок · цель \(store.state.minutes) минут").font(.caption).foregroundStyle(Palette.muted)
                    }; Spacer(); Image(systemName: "arrow.right").padding(13).background(Palette.peach, in: Circle())
                }.foregroundStyle(Palette.ink).softCard()
            }
            Text(store.moduleCompleted ? "Повторим твой первый разговор" : "Следующая маленькая история").font(.headline)
            NavigationLink { LessonIntro(lesson: next) } label: {
                HStack(spacing: 14) {
                    Image(systemName: next.symbol).font(.title2).foregroundStyle(Palette.coral)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(next.title).fontWeight(.medium)
                        Text(next.isFinal ? "Знакомые фразы · без новых слов" : "\(next.newWords.count) новых слов · диалог · практика").font(.caption).foregroundStyle(Palette.muted)
                    }; Spacer(); Image(systemName: "play.circle.fill").font(.title)
                }.foregroundStyle(Palette.ink).softCard()
            }
            }
            Text("Küçük adımlar, büyük hikâyeler.").font(.footnote).italic().foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
        }.toolbar(.hidden, for: .navigationBar)
    }
}

struct CourseView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        Page {
            Brand()
            Text("Твой путь").font(.largeTitle.bold())
            Text("Пять маленьких историй — и твой первый разговор.").foregroundStyle(Palette.muted)
            if !store.state.legacyCompleted.isEmpty && store.state.completed.isEmpty {
                Text("Мы обновили первый модуль. Твой профиль и история занятий сохранены; новые задания начинаются с первого урока.").font(.footnote).foregroundStyle(Palette.muted).softCard()
            }
            ForEach(Curriculum.allLessons) { lesson in
                NavigationLink { LessonIntro(lesson: lesson) } label: {
                    HStack(spacing: 18) {
                        Image(systemName: lesson.symbol).font(.system(size: 29)).frame(width: 72, height: 78).background(Palette.peach.opacity(0.65), in: RoundedRectangle(cornerRadius: 25)).foregroundStyle(Palette.coral)
                        VStack(alignment: .leading, spacing: 6) {
                            Text(lesson.isFinal ? "ФИНАЛ МОДУЛЯ" : "ИСТОРИЯ 0\(lesson.id + 1)").font(.caption2).tracking(2).foregroundStyle(Palette.muted)
                            Text(lesson.title).font(.headline)
                            Text(lesson.subtitle).font(.caption).foregroundStyle(Palette.muted)
                        }; Spacer(minLength: 0)
                        Image(systemName: !store.isUnlocked(lesson) ? "lock" : (lesson.isFinal ? store.moduleCompleted : store.state.completed.contains(lesson.id)) ? "checkmark.seal.fill" : "chevron.right").foregroundStyle(Palette.coral)
                    }.foregroundStyle(Palette.ink).softCard()
                }.disabled(!store.isUnlocked(lesson)).opacity(store.isUnlocked(lesson) ? 1 : 0.55)
                if !store.isUnlocked(lesson) { Text(lesson.isFinal ? "Откроется после пяти уроков" : "Откроется после предыдущего урока").font(.caption).foregroundStyle(Palette.muted) }
            }
            Text("Sen yaparsın! — У тебя получится ♡").font(.footnote).italic().foregroundStyle(Palette.muted)
        }.navigationTitle("Курс").navigationBarTitleDisplayMode(.inline)
    }
}

struct LessonIntro: View {
    let lesson: Lesson
    @EnvironmentObject private var store: AppStore
    @State private var learning = false
    private var alreadyCompleted: Bool { lesson.isFinal ? store.moduleCompleted : store.state.completed.contains(lesson.id) }
    var body: some View {
        Page {
            Text(lesson.isFinal ? "ФИНАЛ ПЕРВОГО МОДУЛЯ" : "ИСТОРИЯ 0\(lesson.id + 1)").font(.caption).tracking(3).foregroundStyle(Palette.coral)
            Text(lesson.title).font(.largeTitle.bold())
            Text(lesson.subtitle).foregroundStyle(Palette.muted)
            CapiArt(state: .context(lessonID: lesson.id), height: 230)
            VStack(spacing: 20) {
                summary("Новые слова", lesson.isFinal ? "Без новых слов" : "\(lesson.newWords.count)", "book")
                summary("Практика", "\(lesson.exercises.filter(\.graded).count) заданий", "hand.tap")
                summary(lesson.isFinal ? "Итоговый разговор" : "Мини-диалог", "1", "bubble.left.and.bubble.right")
            }.softCard()
            NavigationLink { LessonAudioLibrary(lesson: lesson) } label: { Label("Слова, фразы и диалог · послушать", systemImage: "speaker.wave.2") }
            if !lesson.reviewWords.isEmpty {
                Text("Вспомним: " + lesson.reviewWords.joined(separator: " · ")).font(.footnote).foregroundStyle(Palette.muted)
            }
            if lesson.id == 4 || lesson.isFinal { LearningProfileEditor() }
            PrimaryButton(title: alreadyCompleted ? "Пройти ещё раз" : store.session(for: lesson).position > 0 ? "Продолжить" : "Начать") {
                if alreadyCompleted { store.restart(lesson) }
                learning = true
            }.disabled(!store.isUnlocked(lesson))
        }.navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $learning) { LessonPlayer(lesson: lesson) }
    }
    private func summary(_ title: String, _ detail: String, _ icon: String) -> some View {
        HStack { Image(systemName: icon).foregroundStyle(Palette.coral).frame(width: 25); Text(title); Spacer(); Text(detail).foregroundStyle(Palette.muted).font(.subheadline) }
    }
}
