import Foundation

enum Exercise: String, CaseIterable, Identifiable, Codable, Hashable {
    case benchPress = "Bench Press"
    case squat = "Squat"
    case latPulldown = "Lat Pulldown"
    case deadlift = "Deadlift"

    var id: String { rawValue }

    /// Reminder shown on the record screen so every clip for this exercise is framed the same way.
    var framingHint: String {
        switch self {
        case .benchPress:
            return "Side-on · bench parallel to camera · full bar path visible"
        case .squat:
            return "Side-on · fixed distance · full body + bar in frame"
        case .latPulldown:
            return "Side-on · seat and bar stack visible"
        case .deadlift:
            return "Side-on · floor to lockout fully in frame"
        }
    }
}
