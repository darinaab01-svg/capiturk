import Foundation

struct Word: Identifiable, Codable, Hashable {
    var id: String { turkish }
    let turkish: String
    let russian: String
    let symbol: String
    let example: String
    let exampleTranslation: String
    let pronunciation: String?
}
struct Phrase: Codable {
    let turkish: String
    let russian: String
}
struct AnswerOption: Identifiable, Codable {
    let id: String
    let text: String
    let symbol: String?
}
enum ExerciseKind: String, Codable {
    case scene, word, phrase, choice, listen, build, gap, speak, dialogue, map, profile
}
struct Exercise: Identifiable, Codable {
    let id: String
    let kind: ExerciseKind
    let title: String
    let prompt: String
    let text: String?
    let translation: String?
    let symbol: String?
    let word: String?
    let options: [AnswerOption]?
    let answer: String?
    let tokens: [String]?
    let direction: String?
    let mapTarget: String?
    let isFinal: Bool
    let hideTranslation: Bool
    var graded: Bool { [.choice, .listen, .build, .gap, .dialogue, .map].contains(kind) }
    var requiresListening: Bool { kind == .listen || kind == .scene }
}
struct DialogueLine: Codable {
    let role: String
    let turkish: String
    let russian: String
}
struct Lesson: Identifiable, Codable {
    let id: Int
    let title: String
    let goal: String
    let symbol: String
    let newWords: [Word]
    let extraWords: [Word]
    let phrases: [Phrase]
    let reviewWords: [String]
    let exercises: [Exercise]
    let miniDialogue: [DialogueLine]
    let result: String
    var words: [Word] { newWords }
    var subtitle: String { goal }
    var isFinal: Bool { id == 5 }
    var allWords: [Word] { newWords + extraWords }
    func satisfied(by session: LessonSession) -> Bool {
        !exercises.isEmpty && exercises.allSatisfy { exercise in
            session.visited.contains(exercise.id)
            && (!exercise.graded || session.correct.contains(exercise.id))
            && (exercise.kind != .speak || session.spoken.contains(exercise.id))
            && (!exercise.requiresListening || session.listened.contains(exercise.id))
        }
    }
}
struct ModuleContent: Codable {
    let version: Int
    let lessons: [Lesson]
    let finalConversation: Lesson
}
enum Curriculum {
    static let loaded: Result<ModuleContent, Error> = Result {
        guard let url = Bundle.main.url(forResource: "Module1", withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
        return try JSONDecoder().decode(ModuleContent.self, from: Data(contentsOf: url))
    }
    static var module: ModuleContent? { try? loaded.get() }
    static var lessons: [Lesson] { module?.lessons ?? [] }
    static var finalConversation: Lesson? { module?.finalConversation }
    static var allLessons: [Lesson] { lessons + (finalConversation.map { [$0] } ?? []) }
    static var wordCount: Int { Set(lessons.flatMap(\.newWords).map(\.id)).count }
    static var phraseCount: Int { Set(lessons.flatMap(\.phrases).map(\.turkish)).count }
}
struct LessonSession: Codable {
    var position = 0
    var visited: Set<String> = []
    var correct: Set<String> = []
    var spoken: Set<String> = []
    var listened: Set<String> = []
    var attempts: [String: Int] = [:]
}
enum StudyCity: String, CaseIterable, Codable {
    case antalya = "Antalya", istanbul = "İstanbul", ankara = "Ankara", izmir = "İzmir"
    var locative: String {
        switch self {
        case .antalya: return "Antalya'da"
        case .istanbul: return "İstanbul'da"
        case .ankara: return "Ankara'da"
        case .izmir: return "İzmir'de"
        }
    }
    var russian: String {
        switch self {
        case .antalya: return "в Анталье"
        case .istanbul: return "в Стамбуле"
        case .ankara: return "в Анкаре"
        case .izmir: return "в Измире"
        }
    }
}
struct LearningProfile {
    let name: String
    let city: StudyCity
    let favorite: String
    var spokenName: String {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? "Deniz" : clean
    }
    func resolve(_ template: String) -> String {
        let preference = ["Kahve": "кофе", "Çay": "чай", "Türkiye": "Турцию"][favorite] ?? "кофе"
        return template.replacingOccurrences(of: "{name}", with: spokenName)
            .replacingOccurrences(of: "{city}", with: city.rawValue)
            .replacingOccurrences(of: "{cityLocative}", with: city.locative)
            .replacingOccurrences(of: "{cityRussian}", with: city.russian)
            .replacingOccurrences(of: "{favorite}", with: favorite)
            .replacingOccurrences(of: "{favoriteRussian}", with: preference)
    }
}
enum ExerciseRules {
    static func normalized(_ text: String) -> String {
        text.replacingOccurrences(of: "’", with: "'")
            .lowercased(with: Locale(identifier: "tr_TR"))
            .components(separatedBy: .punctuationCharacters.union(.whitespacesAndNewlines))
            .filter { !$0.isEmpty }.joined(separator: " ")
    }
    static func matches(_ tokens: [String], phrase: String) -> Bool { normalized(tokens.joined(separator: " ")) == normalized(phrase) }
    static func display(_ tokens: [String]) -> String {
        var text = tokens.joined(separator: " ")
        for mark in [",", ".", "?", "!"] { text = text.replacingOccurrences(of: " " + mark, with: mark) }
        return text
    }
}
