import SwiftUI
import AVFoundation

@MainActor final class FeedbackSound {
    enum Cue { case correct, retry, progress, recording, complete }
    static let shared = FeedbackSound()
    private var player: AVAudioPlayer?
    func play(_ cue: Cue) {
        let notes: [Double]
        switch cue {
        case .correct: notes = [660, 880]
        case .retry: notes = [330, 294]
        case .progress: notes = [520]
        case .recording: notes = [440]
        case .complete: notes = [523.25, 659.25, 783.99, 1046.5]
        }
        let rate = 22050, samplesPerNote = 2646
        var pcm = Data()
        for frequency in notes {
            for n in 0..<samplesPerNote {
                let envelope = sin(Double.pi * Double(n) / Double(samplesPerNote))
                let sample = Int16(sin(2 * Double.pi * frequency * Double(n) / Double(rate)) * envelope * 2400)
                var little = sample.littleEndian
                withUnsafeBytes(of: &little) { pcm.append(contentsOf: $0) }
            }
        }
        var wav = Data()
        func text(_ s: String) { wav.append(contentsOf: s.utf8) }
        func u32(_ value: UInt32) { var v = value.littleEndian; withUnsafeBytes(of: &v) { wav.append(contentsOf: $0) } }
        func u16(_ value: UInt16) { var v = value.littleEndian; withUnsafeBytes(of: &v) { wav.append(contentsOf: $0) } }
        text("RIFF"); u32(UInt32(36 + pcm.count)); text("WAVEfmt "); u32(16); u16(1); u16(1)
        u32(UInt32(rate)); u32(UInt32(rate * 2)); u16(2); u16(16); text("data"); u32(UInt32(pcm.count)); wav.append(pcm)
        player = try? AVAudioPlayer(data: wav); player?.play()
    }
}

enum MascotState: String, CaseIterable {
    case welcome, learning, listening, speaking, thinking, correct, retry, cafe, travel, city, profile, celebration
    var asset: String { "Capi-" + rawValue }
    var caption: String {
        switch self {
        case .welcome: return "Капи рада знакомству"
        case .learning: return "Капи учится вместе с тобой"
        case .listening: return "Капи внимательно слушает"
        case .speaking: return "Капи помогает говорить"
        case .thinking: return "Капи думает над ответом"
        case .correct: return "Капи радуется твоему ответу"
        case .retry: return "Капи поддерживает: попробуем ещё раз"
        case .cafe: return "Капи заказывает кофе"
        case .travel: return "Капи готова к путешествию"
        case .city: return "Капи изучает карту города"
        case .profile: return "Капи знакомится с тобой"
        case .celebration: return "Капи празднует твой успех"
        }
    }
    static func context(lessonID: Int) -> MascotState {
        switch lessonID { case 1: return .cafe; case 2: return .travel; case 3: return .city; case 4: return .profile; default: return .learning }
    }
    static func activity(kind: ExerciseKind, lessonID: Int, playing: Bool, recording: Bool, processing: Bool, result: Bool?, selected: Bool) -> MascotState {
        if recording { return .speaking }
        if playing { return .listening }
        if processing { return .thinking }
        if let result { return result ? .correct : .retry }
        if selected { return .thinking }
        switch kind {
        case .listen: return .listening
        case .speak: return .speaking
        case .build, .gap, .choice: return .thinking
        case .map: return .city
        case .profile: return .profile
        default: return context(lessonID: lessonID)
        }
    }
}

struct CapiArt: View {
    var state: MascotState = .learning
    var height: CGFloat = 250
    var level: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24, paused: reduceMotion || scenePhase != .active)) { timeline in
            let phase = reduceMotion ? 0 : sin(timeline.date.timeIntervalSinceReferenceDate * 1.7)
            ZStack(alignment: .bottom) {
                Palette.cream
                Image(state.asset).resizable().scaledToFit()
                    .scaleEffect(1 + phase * 0.009)
                    .offset(y: phase * 2)
                    .id(state).transition(.opacity.combined(with: .scale(scale: reduceMotion ? 1 : 0.97)))
                if state == .celebration && !reduceMotion {
                    ForEach(0..<12, id: \.self) { i in
                        Image(systemName: i.isMultiple(of: 2) ? "sparkle" : "heart.fill")
                            .font(.system(size: CGFloat(8 + i % 4 * 3))).foregroundStyle(Palette.coral.opacity(0.6))
                            .offset(x: CGFloat(i % 6 - 3) * 39, y: -height * 0.6 + CGFloat(i / 6) * 80 + phase * 8)
                    }
                }
                if state == .listening || state == .speaking {
                    HStack(spacing: 4) {
                        ForEach(0..<9, id: \.self) { i in
                            Capsule().fill(Palette.coral).frame(width: 4, height: 5 + CGFloat(state == .speaking ? min(1, max(0, level)) : abs(sin(phase + Double(i)))) * 18)
                        }
                    }.padding(10).background(.ultraThinMaterial, in: Capsule()).padding(.bottom, 10).accessibilityHidden(true)
                }
            }
        }.frame(height: height).clipShape(RoundedRectangle(cornerRadius: 28))
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.28), value: state)
            .accessibilityElement(children: .ignore).accessibilityLabel(state.caption)
    }
}
