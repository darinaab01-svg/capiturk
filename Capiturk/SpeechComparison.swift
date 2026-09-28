import Foundation

struct SpeechComparison: Equatable {
    let transcript: String
    let expected: String
    let similarity: Double
    let accepted: Bool
    let missingWords: [String]

    static func tokens(_ text: String) -> [String] {
        let clean = text.precomposedStringWithCanonicalMapping
            .lowercased(with: Locale(identifier: "tr_TR"))
            .replacingOccurrences(of: "’", with: "")
            .replacingOccurrences(of: "'", with: "")
        return clean.components(separatedBy: CharacterSet.letters.union(.decimalDigits).inverted).filter { !$0.isEmpty }
    }
    static func compare(_ transcript: String, expected: String) -> SpeechComparison {
        let heard = tokens(transcript), wanted = tokens(expected)
        var previous = Array(0...heard.count)
        for (i, token) in wanted.enumerated() {
            var row = [i + 1]
            for (j, other) in heard.enumerated() {
                row.append(min(row[j] + 1, previous[j + 1] + 1, previous[j] + (token == other ? 0 : 1)))
            }
            previous = row
        }
        let denominator = max(wanted.count, heard.count, 1)
        let score = max(0, 1 - Double(previous.last ?? 0) / Double(denominator))
        // Short phrases must match all words; no fuzzy letter matching that erases Turkish distinctions.
        let accepted = !wanted.isEmpty && !heard.isEmpty && (wanted.count < 5 ? wanted == heard : score >= 0.85)
        return SpeechComparison(transcript: transcript, expected: expected, similarity: score, accepted: accepted,
                                missingWords: wanted.filter { !heard.contains($0) })
    }
}
