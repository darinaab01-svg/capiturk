import SwiftUI

struct LessonPlayer: View {
    let lesson: Lesson
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var voice = Voice()
    @State private var session = LessonSession()
    @State private var selected: String?
    @State private var answerIndices: [Int] = []
    @State private var tokenOrder: [Int] = []
    @State private var checked = false
    @State private var correct = false
    @State private var showTranslation = false
    @State private var completed = false
    @State private var exitConfirmation = false
    @State private var finishError = false

    private var exercise: Exercise { lesson.exercises[min(session.position, lesson.exercises.count - 1)] }
    private var tokens: [String] { (exercise.tokens ?? []).map(resolve) }
    private var answerTokens: [String] { answerIndices.map { tokens[$0] } }
    private func resolve(_ text: String) -> String { store.profile.resolve(text) }
    private var listened: Bool { session.listened.contains(exercise.id) }
    private var spoken: Bool { session.spoken.contains(exercise.id) }
    private var mayContinue: Bool {
        (!exercise.requiresListening || listened)
        && (exercise.kind != .speak || spoken)
        && (!exercise.graded || correct)
        && !voice.recording && !voice.recognizing && !voice.requestingPermission
    }

    private var mascot: MascotState {
        MascotState.activity(kind: exercise.kind, lessonID: lesson.id,
            playing: voice.speaking || voice.playingRecording, recording: voice.recording,
            processing: voice.recognizing || voice.requestingPermission,
            result: exercise.kind == .speak ? voice.comparison?.accepted : checked ? correct : nil,
            selected: selected != nil || !answerIndices.isEmpty)
    }

    var body: some View {
        Page {
            header
            if completed { completion }
            else {
                VStack(alignment: .leading, spacing: 20) {
                    if exercise.isFinal { Text(lesson.isFinal ? "МОЙ ПЕРВЫЙ РАЗГОВОР" : "ПРИМЕНЯЕМ В ЖИЗНИ").font(.caption).tracking(2).foregroundStyle(Palette.coral) }
                    Text(exercise.title).font(.title.bold())
                    if !exercise.prompt.isEmpty { Text(resolve(exercise.prompt)).foregroundStyle(Palette.muted) }
                    CapiArt(state: mascot, height: 170, level: voice.level)
                    exerciseContent
                }.id(exercise.id).transition(.opacity)
                if checked { feedback }
                footer
            }
        }.fontDesign(.rounded).tint(Palette.coral)
            .onAppear {
                session = store.session(for: lesson)
                session.position = max(0, min(session.position, lesson.exercises.count - 1))
                prepareStep()
            }
            .onDisappear { voice.resetPractice() }
            .onChange(of: scenePhase) { _, phase in if phase == .background { voice.stop(); persist() } }
            .onChange(of: voice.lastFinishedText) { _, text in
                if let text, text == exercise.text.map(resolve) {
                    session.listened.insert(exercise.id); persist()
                }
            }
            .onChange(of: voice.comparison) { _, result in
                guard exercise.kind == .speak, let result else { return }
                session.attempts[exercise.id, default: 0] += 1
                if result.accepted { session.spoken.insert(exercise.id) }
                else { session.spoken.remove(exercise.id) }
                persist(); store.feedback(success: result.accepted)
            }
            .onChange(of: voice.recording) { _, active in
                if active { session.spoken.remove(exercise.id); persist(); store.interaction() }
                else { store.cue(.recording) }
            }
            .confirmationDialog("Сделаем паузу?", isPresented: $exitConfirmation, titleVisibility: .visible) {
                Button("Сохранить и выйти") { persist(); dismiss() }
                Button("Остаться", role: .cancel) {}
            } message: { Text("Продолжишь с этого задания. Запись голоса будет удалена.") }
            .alert("Звук и микрофон", isPresented: Binding(get: { voice.message != nil }, set: { if !$0 { voice.message = nil } })) {
                Button("Понятно") { voice.message = nil }
            } message: { Text(voice.message ?? "") }
            .alert("Осталось немного практики", isPresented: $finishError) {
                Button("Вернуться к заданию") { returnToMissingExercise() }
            } message: { Text("Чтобы закончить, нужно пройти задания, послушать фразы и попробовать произнести их вслух.") }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button { if completed { dismiss() } else { exitConfirmation = true } } label: {
                Image(systemName: "xmark").frame(width: 44, height: 44)
            }.accessibilityLabel("Сохранить и закрыть урок")
            ProgressView(value: completed ? Double(lesson.exercises.count) : Double(session.position), total: Double(lesson.exercises.count)).tint(Palette.coral).animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: session.position)
            Text("\(completed ? lesson.exercises.count : session.position + 1)/\(lesson.exercises.count)").font(.caption).monospacedDigit()
        }
    }

    @ViewBuilder private var exerciseContent: some View {
        switch exercise.kind {
        case .scene:
            if let symbol = exercise.symbol { Image(systemName: symbol).font(.largeTitle).foregroundStyle(Palette.coral).frame(maxWidth: .infinity) }
            phraseCard
        case .word:
            if let word = lesson.allWords.first(where: { $0.id == exercise.word }) { wordCard(word) }
        case .phrase:
            phraseCard
        case .choice:
            if let symbol = exercise.symbol {
                Image(systemName: symbol).font(.system(size: 80, weight: .light)).foregroundStyle(Palette.coral).frame(maxWidth: .infinity).frame(height: 150).softCard()
                    .accessibilityLabel(symbol == "drop.fill" ? "Стакан воды" : "Иллюстрация задания")
            }
            choices
        case .listen:
            audioButton(exercise.text ?? "").frame(maxWidth: .infinity)
            Text(listened ? "Теперь выбери ответ" : "Сначала послушай фразу до конца").font(.footnote).foregroundStyle(Palette.muted)
            choices.disabled(!listened)
        case .build:
            sentenceBuilder
        case .gap:
            Text(resolve(exercise.text ?? "")).font(.title.bold()).frame(maxWidth: .infinity, minHeight: 100).softCard()
            choices
        case .speak:
            speakingPractice
        case .dialogue:
            if let text = exercise.text {
                VStack(alignment: .leading, spacing: 14) {
                    Label("Капи", systemImage: "bubble.left").font(.caption).foregroundStyle(Palette.coral)
                    Text(resolve(text)).font(.title2.bold())
                    if !exercise.hideTranslation, let translation = exercise.translation {
                        if showTranslation { Text(resolve(translation)).foregroundStyle(Palette.muted) }
                        else { Button("Показать перевод") { showTranslation = true }.font(.caption) }
                    }
                    audioButton(text)
                }.frame(maxWidth: .infinity, alignment: .leading).softCard()
            }
            choices
        case .map:
            CityMap(direction: exercise.direction ?? "right", target: exercise.mapTarget ?? "Eczane")
            choices
        case .profile:
            LearningProfileEditor()
            Text("Для упражнения можно выбрать один из четырёх городов. Форму названия города приложение подставит само.").font(.footnote).foregroundStyle(Palette.muted)
        }
    }

    private func wordCard(_ word: Word) -> some View {
        VStack(spacing: 20) {
            Image(systemName: word.symbol).font(.system(size: 62, weight: .light)).foregroundStyle(Palette.coral).frame(height: 85)
            Text(word.turkish).font(.system(size: 33, weight: .medium, design: .rounded)).multilineTextAlignment(.center)
            if let pronunciation = word.pronunciation { Text(pronunciation).foregroundStyle(Palette.muted); Text("Приблизительное произношение").font(.caption2).foregroundStyle(Palette.muted) }
            Text(word.russian).font(.title3).multilineTextAlignment(.center)
            audioButton(word.turkish)
            Divider()
            Text(resolve(word.example)).font(.title3).multilineTextAlignment(.center)
            Text(resolve(word.exampleTranslation)).font(.subheadline).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            Button { voice.speak(resolve(word.example)) } label: { Label("Послушать в контексте", systemImage: "speaker.wave.2") }
        }.frame(maxWidth: .infinity).softCard()
    }

    private var phraseCard: some View {
        VStack(spacing: 20) {
            Text(resolve(exercise.text ?? "")).font(.title.bold()).multilineTextAlignment(.center)
            if let translation = exercise.translation { Text(resolve(translation)).foregroundStyle(Palette.muted).multilineTextAlignment(.center) }
            audioButton(exercise.text ?? "")
        }.frame(maxWidth: .infinity).softCard()
    }

    private var choices: some View {
        VStack(spacing: 12) {
            ForEach(exercise.options ?? []) { option in
                HStack {
                ChoiceRow(title: resolve(option.text), symbol: option.symbol ?? "bubble.left", selected: selected == option.id) {
                    selected = option.id; checked = false
                }.disabled(correct)
                if !resolve(option.text).unicodeScalars.contains(where: { (0x0400...0x052F).contains($0.value) }) {
                    Button { voice.speak(resolve(option.text)) } label: { Image(systemName: "speaker.wave.2").frame(width: 44, height: 44) }.accessibilityLabel("Послушать: " + resolve(option.text))
                }
                }
            }
        }
    }

    private var sentenceBuilder: some View {
        VStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 14) {
                Text(correct ? resolve(exercise.text ?? "") : answerTokens.isEmpty ? "Твоя фраза появится здесь…" : ExerciseRules.display(answerTokens)).font(.title3)
                    .frame(maxWidth: .infinity, minHeight: 85, alignment: .leading)
                if !answerIndices.isEmpty && !correct {
                    Button { answerIndices.removeLast(); checked = false } label: { Label("Убрать последнее", systemImage: "delete.left") }.font(.footnote)
                    Button("Начать заново") { answerIndices = []; checked = false }.font(.footnote)
                }
            }.softCard()
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 125))], spacing: 12) {
                ForEach(tokenOrder, id: \.self) { index in
                    Button { answerIndices.append(index); checked = false } label: {
                        Text(tokens[index]).fontWeight(.medium).multilineTextAlignment(.center).padding(12).frame(maxWidth: .infinity, minHeight: 58)
                            .background(.white.opacity(0.9), in: RoundedRectangle(cornerRadius: 18))
                    }.disabled(answerIndices.contains(index) || correct).opacity(answerIndices.contains(index) ? 0.3 : 1)
                }
            }
        }
    }

    private var speakingPractice: some View {
        VStack(spacing: 18) {
            phraseCard
            Text("Разреши микрофон и распознавание речи. Если турецкая модель недоступна на iPhone, Apple распознает запись через интернет.")
                .font(.footnote).foregroundStyle(Palette.muted)
            Button { voice.toggleRecord(expected: resolve(exercise.text ?? "")) } label: {
                Label(voice.recording ? "Остановить и проверить" : voice.requestingPermission ? "Запрашиваем разрешение…" : "Записать свой голос",
                      systemImage: voice.recording ? "stop.circle.fill" : "mic.fill")
                    .padding(18).frame(maxWidth: .infinity).background(Palette.peach, in: Capsule())
            }.disabled(voice.recognizing || voice.requestingPermission)
            if voice.recording {
                Text("Запись: \(Int(voice.elapsed)) / 45 секунд").monospacedDigit().foregroundStyle(Palette.coral)
                ProgressView(value: voice.level).tint(Palette.coral).accessibilityLabel("Уровень микрофона")
            }
            if voice.recognizing { ProgressView("Слушаем твою фразу…") }
            if voice.hasRecording {
                Button { voice.playRecording() } label: { Label(voice.playingRecording ? "Остановить воспроизведение" : "Послушать себя", systemImage: voice.playingRecording ? "stop.circle" : "play.circle") }
                    .disabled(voice.recognizing)
                Button("Проверить запись ещё раз") { voice.recognizeRecording() }.disabled(voice.recognizing)
            }
            if let result = voice.comparison {
                VStack(alignment: .leading, spacing: 10) {
                    Label(result.accepted ? "Harika! Фраза совпала" : "Попробуем ещё раз", systemImage: result.accepted ? "checkmark.circle.fill" : "arrow.counterclockwise")
                    Text("Распознано: \(result.transcript)")
                    Text("Совпадение слов: \(Int(result.similarity * 100))%").font(.caption)
                    if !result.missingWords.isEmpty { Text("Обрати внимание: " + result.missingWords.joined(separator: ", ")).font(.footnote) }
                    Text("Распознавание может ошибаться. Это проверка слов, а не оценка акцента.").font(.caption).foregroundStyle(Palette.muted)
                }.frame(maxWidth: .infinity, alignment: .leading).softCard()
            }
            if let note = voice.recognitionNote { Text(note).font(.footnote).foregroundStyle(Palette.muted) }
            if spoken && voice.comparison == nil { Text("Эта фраза уже проверена ✓").font(.footnote) }
        }
    }

    private var feedback: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(correct ? "Harika! Всё верно ♡" : "Давай попробуем ещё раз, не спеша.", systemImage: correct ? "checkmark.circle" : "arrow.counterclockwise")
                .foregroundStyle(correct ? Color(red: 0.23, green: 0.45, blue: 0.34) : Palette.coral)
            if correct && exercise.kind == .build, let phrase = exercise.text {
                Button { voice.speak(resolve(phrase)) } label: { Label("Послушать собранную фразу", systemImage: "speaker.wave.2") }
            }
            if correct && exercise.kind == .gap, let value = exercise.options?.first(where: { $0.id == exercise.answer }) {
                let full = resolve(exercise.text ?? "").replacingOccurrences(of: "___", with: resolve(value.text))
                Button { voice.speak(full) } label: { Label(full, systemImage: "speaker.wave.2") }
            }
        }.font(.subheadline).softCard().accessibilityAddTraits(.updatesFrequently)
    }

    @ViewBuilder private var footer: some View {
        if exercise.graded && !correct {
            let ready = exercise.kind == .build ? answerIndices.count == tokens.count : selected != nil
            PrimaryButton(title: "Проверить", symbol: "checkmark") { check() }
                .disabled(!ready || (exercise.requiresListening && !listened)).opacity(ready ? 1 : 0.45)
        } else {
            if exercise.requiresListening && !listened { Text("Послушай фразу до конца, чтобы продолжить.").font(.footnote).foregroundStyle(Palette.muted) }
            PrimaryButton(title: session.position == lesson.exercises.count - 1 ? "Завершить" : "Продолжить") { advance() }
                .disabled(!mayContinue).opacity(mayContinue ? 1 : 0.45)
        }
    }

    private var completion: some View {
        VStack(spacing: 23) {
            Text("✦  ·  ✧  ·  ✦").font(.largeTitle).foregroundStyle(Palette.coral)
            Text(lesson.isFinal ? "Sen Türkçe konuşuyorsun! ♡" : "Урок пройден!").font(.largeTitle.bold()).multilineTextAlignment(.center)
            Text(lesson.result).multilineTextAlignment(.center).foregroundStyle(Palette.muted)
            CapiArt(state: .celebration, height: 235)
            if lesson.isFinal {
                Text("\(Curriculum.wordCount) активных слова · \(Curriculum.phraseCount) основных фраз\n5 мини-диалогов · 5 уроков\n1 итоговый разговор").multilineTextAlignment(.center).softCard()
            } else {
                HStack(alignment: .top) {
                    stat(lesson.newWords.count, "новых слов")
                    stat(lesson.phrases.count, "основных фраз")
                    stat(1, "мини-диалог")
                }.softCard()
            }
            PrimaryButton(title: "Отлично!") { dismiss() }
        }.frame(maxWidth: .infinity)
    }
    private func stat(_ value: Int, _ title: String) -> some View {
        VStack { Text("\(value)").font(.title.bold()); Text(title).font(.caption).multilineTextAlignment(.center) }.frame(maxWidth: .infinity)
    }
    private func audioButton(_ text: String) -> some View {
        Button { voice.speak(resolve(text)) } label: {
            Image(systemName: voice.speaking ? "speaker.wave.3.fill" : "speaker.wave.2").font(.title2)
                .symbolEffect(.variableColor, options: .repeating, isActive: voice.speaking && !reduceMotion)
                .frame(width: 64, height: 64).background(Palette.peach, in: Circle())
        }.disabled(voice.recording || voice.recognizing || voice.requestingPermission).accessibilityLabel("Послушать турецкую фразу")
    }
    private func persist() { store.saveSession(session, for: lesson) }
    private func prepareStep() {
        voice.resetPractice(); answerIndices = []; showTranslation = false
        correct = session.correct.contains(exercise.id)
        checked = correct; selected = correct ? exercise.answer : nil
        tokenOrder = Array(tokens.indices).shuffled()
    }
    private func check() {
        guard !correct else { return }
        if exercise.kind == .build { correct = ExerciseRules.matches(answerTokens, phrase: resolve(exercise.text ?? "")) }
        else { correct = selected == exercise.answer }
        checked = true
        session.attempts[exercise.id, default: 0] += 1
        if correct { session.correct.insert(exercise.id) }
        persist(); store.feedback(success: correct)
    }
    private func advance() {
        guard mayContinue else { return }
        session.visited.insert(exercise.id); persist(); voice.stop()
        if session.position == lesson.exercises.count - 1 {
            if store.complete(lesson) {
                store.cue(.complete)
                withAnimation(reduceMotion ? nil : .spring(duration: 0.5)) { completed = true }
            } else { finishError = true }
        } else {
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) { session.position += 1 }
            store.cue(.progress); persist(); prepareStep()
        }
    }
    private func returnToMissingExercise() {
        session.position = lesson.exercises.firstIndex { e in
            !session.visited.contains(e.id) || (e.graded && !session.correct.contains(e.id)) ||
            (e.kind == .speak && !session.spoken.contains(e.id)) || (e.requiresListening && !session.listened.contains(e.id))
        } ?? 0
        persist(); prepareStep()
    }
}

struct CityMap: View {
    let direction: String
    let target: String
    var body: some View {
        VStack(spacing: 18) {
            Text("Карта квартала").font(.caption).foregroundStyle(Palette.muted)
            HStack(spacing: 14) {
                building(direction == "left" ? target : "Market", direction == "left" ? "cross.case.fill" : "basket")
                Rectangle().fill(Palette.peach).frame(width: 20, height: 110)
                building(direction == "right" ? target : "Market", direction == "right" ? "cross.case.fill" : "basket")
            }
            HStack(spacing: 8) {
                Image(systemName: "arrow.left"); Rectangle().fill(Palette.peach).frame(height: 12)
                Image(systemName: "arrow.up").font(.title2)
                Rectangle().fill(Palette.peach).frame(height: 12); Image(systemName: "arrow.right")
            }.foregroundStyle(Palette.coral)
            Label("Ты здесь · смотришь вперёд", systemImage: "figure.stand").font(.caption)
        }.softCard().accessibilityElement(children: .ignore)
            .accessibilityLabel("Карта. Ты смотришь вперёд. Аптека \(direction == "right" ? "справа" : "слева"), магазин с другой стороны.")
    }
    private func building(_ name: String, _ symbol: String) -> some View {
        VStack(spacing: 12) { Image(systemName: symbol).font(.largeTitle).foregroundStyle(Palette.coral); Text(name).font(.subheadline.bold()) }
            .frame(maxWidth: .infinity).padding(.vertical, 22).background(Palette.cream, in: RoundedRectangle(cornerRadius: 18))
    }
}

struct LearningProfileEditor: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Имя в турецких фразах").font(.headline)
            TextField(store.profile.spokenName, text: $store.state.learningName).textInputAutocapitalization(.words).autocorrectionDisabled()
                .padding(12).background(Palette.cream, in: RoundedRectangle(cornerRadius: 12))
            Text("Лучше латиницей. Если поле пустое, используем имя профиля; без имени — Deniz.").font(.caption).foregroundStyle(Palette.muted)
            Picker("Город для рассказа", selection: $store.state.city) {
                ForEach(StudyCity.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Мне нравится", selection: $store.state.favorite) {
                Text("Кофе").tag("Kahve"); Text("Чай").tag("Çay"); Text("Турция").tag("Türkiye")
            }
        }.softCard()
    }
}
