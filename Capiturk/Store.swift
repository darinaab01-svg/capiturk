import SwiftUI
import AVFoundation
import AudioToolbox

struct SavedState: Codable {
    var name = ""
    var goal = "Для путешествий"
    var level = "Начинаю с нуля"
    var minutes = 10
    var onboarded = false
    var sound = true
    var haptics = true
    var completed: Set<Int> = []
    var favorites: Set<String> = []
    var activity: [String: Int] = [:]
    var contentVersion = 3
    var legacyCompleted: Set<Int> = []
    var sessions: [String: LessonSession] = [:]
    var finalCompleted = false
    var learningName = ""
    var city = StudyCity.antalya
    var favorite = "Kahve"

    static func decodeMigrating(_ data: Data) throws -> SavedState {
        // Merge new defaults rather than discarding a v1 profile on missing keys.
        let old = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let baseline = try JSONEncoder().encode(SavedState())
        var merged = try JSONSerialization.jsonObject(with: baseline) as! [String: Any]
        merged.merge(old) { _, existing in existing }
        var decoded = try JSONDecoder().decode(SavedState.self, from: JSONSerialization.data(withJSONObject: merged))
        if (old["contentVersion"] as? Int ?? 1) < 3 {
            decoded.legacyCompleted.formUnion(decoded.completed)
            decoded.completed = []
            decoded.sessions = [:]
            decoded.finalCompleted = false
            decoded.contentVersion = 3
        }
        return decoded
    }
}

@MainActor final class AppStore: ObservableObject {
    @Published var state: SavedState { didSet { save() } }
    private let defaults: UserDefaults
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: "capiturk.v1"), let value = try? SavedState.decodeMigrating(data) {
            state = value
        } else { state = SavedState() }
    }
    func save() {
        if let data = try? JSONEncoder().encode(state) { defaults.set(data, forKey: "capiturk.v1") }
    }
    static func dayKey(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }
    @discardableResult func complete(_ lesson: Lesson, at date: Date = Date()) -> Bool {
        guard isUnlocked(lesson), lesson.satisfied(by: session(for: lesson)) else { return false }
        if lesson.isFinal { state.finalCompleted = true }
        else { state.completed.insert(lesson.id) }
        state.activity[Self.dayKey(date), default: 0] += 1
        return true
    }
    func session(for lesson: Lesson) -> LessonSession { state.sessions[String(lesson.id)] ?? LessonSession() }
    func saveSession(_ session: LessonSession, for lesson: Lesson) { state.sessions[String(lesson.id)] = session }
    func restart(_ lesson: Lesson) { state.sessions[String(lesson.id)] = LessonSession() }
    func isUnlocked(_ lesson: Lesson) -> Bool {
        (0..<lesson.id).allSatisfy { state.completed.contains($0) }
    }
    var moduleCompleted: Bool { (0..<5).allSatisfy { state.completed.contains($0) } && state.finalCompleted }
    var profile: LearningProfile {
        let nameOverride = state.learningName.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = nameOverride.isEmpty ? state.name : nameOverride
        let hasCyrillic = source.unicodeScalars.contains { (0x0400...0x052F).contains($0.value) }
        let name = hasCyrillic ? (source.applyingTransform(.toLatin, reverse: false)?.applyingTransform(.stripDiacritics, reverse: false) ?? source) : source
        return LearningProfile(name: name, city: state.city, favorite: state.favorite)
    }
    var streak: Int {
        let calendar = Calendar.current
        var day = calendar.startOfDay(for: Date())
        if state.activity[Self.dayKey(day)] == nil { day = calendar.date(byAdding: .day, value: -1, to: day)! }
        var count = 0
        while state.activity[Self.dayKey(day)] != nil {
            count += 1; day = calendar.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }
    var learnedCount: Int { Curriculum.lessons.filter { state.completed.contains($0.id) }.flatMap(\.words).count }
    var nextLesson: Lesson? { Curriculum.lessons.first { !state.completed.contains($0.id) } ?? Curriculum.finalConversation }
    func interaction() { if state.haptics { UISelectionFeedbackGenerator().selectionChanged() } }
    func cue(_ cue: FeedbackSound.Cue) { if state.sound { FeedbackSound.shared.play(cue) }; interaction() }
    func feedback(success: Bool = true) {
        if state.haptics { UINotificationFeedbackGenerator().notificationOccurred(success ? .success : .warning) }
        if state.sound { FeedbackSound.shared.play(success ? .correct : .retry) }
    }
}

