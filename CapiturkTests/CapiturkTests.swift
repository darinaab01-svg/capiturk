import XCTest
import UIKit
@testable import Capiturk

final class CapiturkTests: XCTestCase {
    func testTurkishSpeechComparison() {
        XCTAssertTrue(SpeechComparison.compare("İYİYİM teşekkürler!", expected: "İyiyim, teşekkürler.").accepted)
        XCTAssertTrue(SpeechComparison.compare("Antalya’da yaşıyorum", expected: "Antalya'da yaşıyorum.").accepted)
        XCTAssertFalse(SpeechComparison.compare("", expected: "Merhaba").accepted)
        XCTAssertFalse(SpeechComparison.compare("Bir çay lütfen", expected: "Bir kahve lütfen").accepted)
        XCTAssertFalse(SpeechComparison.compare("Hayir", expected: "Hayır").accepted)
        XCTAssertFalse(SpeechComparison.compare("istiyorum kahve ben", expected: "Ben kahve istiyorum").accepted)
        XCTAssertFalse(SpeechComparison.compare("Ben kahve", expected: "Ben kahve istiyorum").accepted)
        XCTAssertEqual(SpeechComparison.compare("Ben kahve", expected: "Ben kahve istiyorum").missingWords, ["istiyorum"])
    }
    func testMascotPrecedenceAndDistinctAssets() {
        XCTAssertEqual(Set(MascotState.allCases.map(\.asset)).count, 12)
        for state in MascotState.allCases { XCTAssertNotNil(UIImage(named: state.asset), state.asset) }
        XCTAssertEqual(MascotState.activity(kind: .speak, lessonID: 1, playing: false, recording: true, processing: false, result: false, selected: false), .speaking)
        XCTAssertEqual(MascotState.activity(kind: .word, lessonID: 1, playing: true, recording: false, processing: false, result: true, selected: false), .listening)
        XCTAssertEqual(MascotState.activity(kind: .choice, lessonID: 1, playing: false, recording: false, processing: false, result: false, selected: true), .retry)
        XCTAssertEqual(MascotState.activity(kind: .scene, lessonID: 2, playing: false, recording: false, processing: false, result: nil, selected: false), .travel)
    }
    func testV2SpeechEvidenceIsNotTreatedAsRecognition() throws {
        let old: [String: Any] = ["contentVersion": 2, "name": "Darina", "completed": [0], "sessions": [:]]
        let migrated = try SavedState.decodeMigrating(JSONSerialization.data(withJSONObject: old))
        XCTAssertTrue(migrated.completed.isEmpty)
        XCTAssertEqual(migrated.legacyCompleted, [0])
        XCTAssertEqual(migrated.name, "Darina")
    }
    private func finishedSession(_ lesson: Lesson) -> LessonSession {
        var session = LessonSession()
        session.position = lesson.exercises.count - 1
        for exercise in lesson.exercises {
            session.visited.insert(exercise.id)
            if exercise.graded { session.correct.insert(exercise.id) }
            if exercise.requiresListening { session.listened.insert(exercise.id) }
            if exercise.kind == .speak { session.spoken.insert(exercise.id) }
        }
        return session
    }

    func testBundledCurriculumLoadsAndCountsRealContent() throws {
        let module = try Curriculum.loaded.get()
        XCTAssertEqual(module.lessons.count, 5)
        XCTAssertEqual(Curriculum.wordCount, 32)
        XCTAssertEqual(Curriculum.phraseCount, 15)
        XCTAssertTrue(module.finalConversation.newWords.isEmpty)
        XCTAssertEqual(module.finalConversation.id, 5)
        XCTAssertEqual(Set(Curriculum.allLessons.flatMap(\.exercises).map(\.id)).count, 130)
    }

    func testSentenceOrderAndTurkishCharacters() {
        XCTAssertTrue(ExerciseRules.matches(["İyiyim", ",", "teşekkürler"], phrase: "İyiyim, teşekkürler."))
        XCTAssertTrue(ExerciseRules.matches(["taksi", "nerede", "?"], phrase: "Taksi nerede?"))
        XCTAssertTrue(ExerciseRules.matches(["Antalya’da", "yaşıyorum"], phrase: "Antalya'da yaşıyorum."))
        XCTAssertFalse(ExerciseRules.matches(["nerede", "taksi"], phrase: "Taksi nerede?"))
        XCTAssertFalse(ExerciseRules.matches(["hayir"], phrase: "hayır"))
        XCTAssertEqual(ExerciseRules.display(["Taksi", "nerede", "?"]), "Taksi nerede?")
    }

    func testPersonalizationHandlesNameCityAndPreference() {
        let profile = LearningProfile(name: "Darina", city: .izmir, favorite: "Çay")
        XCTAssertEqual(profile.resolve("Benim adım {name}. {cityLocative} yaşıyorum. {favorite} seviyorum."), "Benim adım Darina. İzmir'de yaşıyorum. Çay seviyorum.")
        XCTAssertEqual(profile.resolve("Я живу {cityRussian}. Я люблю {favoriteRussian}."), "Я живу в Измире. Я люблю чай.")
        XCTAssertEqual(LearningProfile(name: "  ", city: .antalya, favorite: "Kahve").spokenName, "Deniz")
        for city in StudyCity.allCases { XCTAssertFalse(city.locative.contains("{")) }
    }

    func testEveryLessonRequiresActualExerciseEvidence() throws {
        let lessons = try Curriculum.loaded.get().lessons
        for lesson in lessons {
            XCTAssertFalse(lesson.satisfied(by: LessonSession()))
            let valid = finishedSession(lesson)
            XCTAssertTrue(lesson.satisfied(by: valid))
            var noSpeech = valid; noSpeech.spoken = []
            XCTAssertFalse(lesson.satisfied(by: noSpeech))
            var noAudio = valid; noAudio.listened = []
            XCTAssertFalse(lesson.satisfied(by: noAudio))
            var noAnswers = valid; noAnswers.correct = []
            XCTAssertFalse(lesson.satisfied(by: noAnswers))
        }
    }

    @MainActor func testResumeSurvivesRelaunch() throws {
        let suite = "CapiturkTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let lesson = try XCTUnwrap(Curriculum.lessons.first)
        let store = AppStore(defaults: defaults)
        var session = LessonSession(); session.position = 4
        session.correct.insert(lesson.exercises[2].id)
        session.attempts[lesson.exercises[2].id] = 2
        store.saveSession(session, for: lesson)
        let restored = AppStore(defaults: defaults)
        XCTAssertEqual(restored.session(for: lesson).position, 4)
        XCTAssertEqual(restored.session(for: lesson).correct, session.correct)
        XCTAssertEqual(restored.session(for: lesson).attempts, session.attempts)
        XCTAssertTrue(restored.state.completed.isEmpty)
    }

    @MainActor func testIncompleteLessonCannotBeMarkedComplete() throws {
        let suite = "CapiturkTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = AppStore(defaults: defaults)
        let lesson = try XCTUnwrap(Curriculum.lessons.first)
        XCTAssertFalse(store.complete(lesson))
        XCTAssertTrue(store.state.activity.isEmpty)
        XCTAssertTrue(store.state.completed.isEmpty)
    }

    @MainActor func testProfileKeepsTurkishSpellingAndTransliteratesCyrillic() {
        let suite = "CapiturkTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = AppStore(defaults: defaults)
        store.state.name = "Özge"
        XCTAssertEqual(store.profile.spokenName, "Özge")
        store.state.name = "Алина"
        XCTAssertEqual(store.profile.spokenName, "Alina")
        store.state.learningName = "Ayşe"
        XCTAssertEqual(store.profile.spokenName, "Ayşe")
    }

    @MainActor func testFinalRequiresFiveLessonsAndItsOwnCompletion() throws {
        let suite = "CapiturkTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = AppStore(defaults: defaults)
        let final = try XCTUnwrap(Curriculum.finalConversation)
        store.saveSession(finishedSession(final), for: final)
        XCTAssertFalse(store.complete(final))
        for lesson in Curriculum.lessons {
            XCTAssertTrue(store.isUnlocked(lesson))
            store.saveSession(finishedSession(lesson), for: lesson)
            XCTAssertTrue(store.complete(lesson))
        }
        XCTAssertEqual(store.learnedCount, 32)
        XCTAssertFalse(store.moduleCompleted)
        XCTAssertTrue(store.isUnlocked(final))
        XCTAssertTrue(store.complete(final))
        XCTAssertTrue(store.moduleCompleted)
        XCTAssertTrue(AppStore(defaults: defaults).moduleCompleted)
    }

    @MainActor func testRepeatedLessonDoesNotDuplicateWords() throws {
        let suite = "CapiturkTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = AppStore(defaults: defaults)
        let lesson = try XCTUnwrap(Curriculum.lessons.first)
        store.saveSession(finishedSession(lesson), for: lesson)
        XCTAssertTrue(store.complete(lesson))
        store.restart(lesson)
        XCTAssertFalse(store.complete(lesson))
        store.saveSession(finishedSession(lesson), for: lesson)
        XCTAssertTrue(store.complete(lesson))
        XCTAssertEqual(store.learnedCount, 7)
        XCTAssertEqual(store.state.completed.count, 1)
        XCTAssertEqual(store.state.activity[AppStore.dayKey(Date())], 2)
    }

    func testV1MigrationPreservesProfileAndKeepsNewCourseUncompleted() throws {
        let old: [String: Any] = ["name": "Алина", "goal": "Для общения", "level": "Начинаю с нуля", "minutes": 15,
            "onboarded": true, "sound": false, "haptics": true, "completed": [0, 1], "favorites": ["kahve"], "activity": ["2026-09-26": 2]]
        let migrated = try SavedState.decodeMigrating(JSONSerialization.data(withJSONObject: old))
        XCTAssertEqual(migrated.name, "Алина")
        XCTAssertEqual(migrated.minutes, 15)
        XCTAssertFalse(migrated.sound)
        XCTAssertTrue(migrated.onboarded)
        XCTAssertEqual(migrated.favorites, ["kahve"])
        XCTAssertEqual(migrated.activity["2026-09-26"], 2)
        XCTAssertEqual(migrated.legacyCompleted, [0, 1])
        XCTAssertTrue(migrated.completed.isEmpty)
        XCTAssertEqual(migrated.contentVersion, 3)
        XCTAssertFalse(migrated.finalCompleted)
        let roundTrip = try SavedState.decodeMigrating(JSONEncoder().encode(migrated))
        XCTAssertEqual(roundTrip.legacyCompleted, [0, 1])
    }

    @MainActor func testStreakUsesDaysRatherThanLessonCount() throws {
        let suite = "CapiturkTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = AppStore(defaults: defaults)
        let lesson = try XCTUnwrap(Curriculum.lessons.first)
        store.saveSession(finishedSession(lesson), for: lesson)
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        store.complete(lesson, at: yesterday); store.complete(lesson); store.complete(lesson)
        XCTAssertEqual(store.streak, 2)
    }
}
