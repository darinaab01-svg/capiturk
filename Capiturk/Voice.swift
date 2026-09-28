import SwiftUI
import AVFoundation
import Speech

@MainActor final class Voice: NSObject, ObservableObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    private let synth = AVSpeechSynthesizer()
    private var activeUtterance: AVSpeechUtterance?
    private var recorder: AVAudioRecorder?
    private var player: AVAudioPlayer?
    private var meterTimer: Timer?
    private var recognitionTimer: Timer?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "tr-TR"))
    private var permissionToken = UUID()
    private var recognitionToken = UUID()
    private var expectedPhrase = ""
    private var observerTokens: [NSObjectProtocol] = []
    private let url = FileManager.default.temporaryDirectory.appendingPathComponent("capiturk-\(UUID().uuidString).m4a")
    @Published private(set) var recording = false
    @Published private(set) var hasRecording = false
    @Published private(set) var speaking = false
    @Published private(set) var playingRecording = false
    @Published private(set) var requestingPermission = false
    @Published private(set) var recognizing = false
    @Published private(set) var level: Double = 0
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var comparison: SpeechComparison?
    @Published private(set) var recognitionNote: String?
    @Published private(set) var lastFinishedText: String?
    @Published var message: String?

    override init() {
        super.init(); synth.delegate = self
        for name in [AVAudioSession.interruptionNotification, UIApplication.didEnterBackgroundNotification] {
            observerTokens.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.stop() }
            })
        }
    }
    deinit {
        observerTokens.forEach(NotificationCenter.default.removeObserver)
        try? FileManager.default.removeItem(at: url)
    }
    func speak(_ text: String) {
        guard !recording && !requestingPermission && !recognizing else { return }
        stopPlayback(); lastFinishedText = nil
        guard let voice = AVSpeechSynthesisVoice(language: "tr-TR") else {
            message = "Турецкий голос недоступен. Добавь турецкий голос в настройках универсального доступа iPhone."; return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: .duckOthers)
            try session.setActive(true)
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = voice; utterance.rate = 0.42
            activeUtterance = utterance; speaking = true; synth.speak(utterance)
        } catch { message = "Не удалось включить звук: \(error.localizedDescription)"; deactivate() }
    }
    func toggleRecord(expected: String) {
        if recording { stopRecording(); return }
        guard !requestingPermission && !recognizing else { return }
        stopPlayback(); comparison = nil; recognitionNote = nil
        expectedPhrase = expected; requestingPermission = true
        let token = UUID(); permissionToken = token
        Task { [weak self] in
            let microphone = await AVAudioApplication.requestRecordPermission()
            guard let self, self.permissionToken == token else { return }
            guard microphone else {
                self.requestingPermission = false
                self.message = "Разреши микрофон: Настройки → Capitürk → Микрофон. Без записи речевое задание не засчитывается."; return
            }
            let speech = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { status in continuation.resume(returning: status) }
            }
            guard self.permissionToken == token else { return }
            self.requestingPermission = false
            guard speech == .authorized else {
                self.message = "Разреши распознавание речи: Настройки → Конфиденциальность и безопасность → Распознавание речи. Без распознавания фраза не проверяется."; return
            }
            self.startRecording()
        }
    }
    private func startRecording() {
        cancelRecognition(); hasRecording = false; comparison = nil; elapsed = 0
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
            let recordingDevice = try AVAudioRecorder(url: url, settings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 1, AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue])
            recordingDevice.isMeteringEnabled = true
            guard recordingDevice.record() else { throw CocoaError(.fileWriteUnknown) }
            recorder = recordingDevice; recording = true
            meterTimer = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, self.recording else { return }
                    self.recorder?.updateMeters()
                    self.level = pow(10, Double(self.recorder?.averagePower(forChannel: 0) ?? -80) / 35)
                    self.elapsed = self.recorder?.currentTime ?? 0
                    if self.elapsed >= 45 { self.stopRecording() }
                }
            }
        } catch { message = "Не удалось начать запись: \(error.localizedDescription)"; deactivate() }
    }
    func stopRecording(evaluate: Bool = true) {
        meterTimer?.invalidate(); meterTimer = nil
        guard recording else { return }
        let duration = recorder?.currentTime ?? 0
        recorder?.stop(); recorder = nil; recording = false; level = 0
        hasRecording = duration >= 0.5
        deactivate()
        if hasRecording && evaluate { recognizeRecording() }
        else if evaluate { recognitionNote = "Запись слишком короткая. Нажми на микрофон и произнеси фразу." }
    }
    func recognizeRecording() {
        guard hasRecording && !recording && !requestingPermission else { return }
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            recognitionNote = "Доступ к распознаванию речи не разрешён. Включи его в настройках iPhone."; return
        }
        stopPlayback(); cancelRecognition(); comparison = nil
        guard let recognizer, recognizer.isAvailable else {
            recognitionNote = "Распознавание турецкой речи сейчас недоступно. Проверь интернет и повтори проверку."; return
        }
        let token = UUID(); recognitionToken = token
        let expected = expectedPhrase
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false
        request.taskHint = .confirmation
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        recognitionNote = request.requiresOnDeviceRecognition ? "Распознаём на iPhone…" : "Распознаём через сервис Apple. Нужен интернет…"
        recognizing = true
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let finalText = result?.isFinal == true ? result?.bestTranscription.formattedString : nil
            let failed = error != nil
            Task { @MainActor in
                guard let self, self.recognitionToken == token else { return }
                if let finalText {
                    self.recognitionTimer?.invalidate(); self.recognitionTimer = nil
                    self.recognizing = false; self.recognitionTask = nil
                    self.recognitionToken = UUID()
                    self.comparison = SpeechComparison.compare(finalText, expected: expected)
                    self.recognitionNote = nil
                } else if failed {
                    self.cancelRecognition()
                    self.recognitionNote = "Не удалось распознать фразу. Запись сохранена: послушай её или повтори проверку."
                }
            }
        }
        recognitionTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.recognitionToken == token else { return }
                self.cancelRecognition(); self.recognitionNote = "Распознавание заняло слишком долго. Проверь сеть и повтори проверку."
            }
        }
    }
    func playRecording() {
        guard hasRecording && !recording && !recognizing else { return }
        if playingRecording { stopPlayback(); deactivate(); return }
        stopPlayback()
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio); try session.setActive(true)
            player = try AVAudioPlayer(contentsOf: url); player?.delegate = self
            playingRecording = player?.play() == true
            if !playingRecording { throw CocoaError(.fileReadUnknown) }
        } catch { message = "Не удалось воспроизвести запись."; deactivate() }
    }
    private func stopPlayback() {
        activeUtterance = nil; synth.stopSpeaking(at: .immediate); speaking = false
        player?.stop(); player = nil; playingRecording = false
    }
    private func cancelRecognition() {
        recognitionToken = UUID(); recognitionTask?.cancel(); recognitionTask = nil
        recognitionTimer?.invalidate(); recognitionTimer = nil; recognizing = false
    }
    private func deactivate() { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
    func stop() {
        permissionToken = UUID(); requestingPermission = false
        stopRecording(evaluate: false); cancelRecognition(); stopPlayback(); deactivate()
    }
    func resetPractice() {
        stop(); hasRecording = false; comparison = nil; recognitionNote = nil; lastFinishedText = nil; elapsed = 0
        try? FileManager.default.removeItem(at: url)
    }
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            guard self.activeUtterance === utterance else { return }
            self.lastFinishedText = utterance.speechString; self.activeUtterance = nil; self.speaking = false; self.deactivate()
        }
    }
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in guard self.player === player else { return }; self.playingRecording = false; self.deactivate() }
    }
}
