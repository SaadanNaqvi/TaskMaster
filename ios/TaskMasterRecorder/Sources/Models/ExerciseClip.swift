import Foundation

struct ExerciseClip: Identifiable, Codable, Equatable {
    let id: UUID
    let exercise: Exercise
    let fileName: String
    let dateRecorded: Date
    let durationSeconds: Double
}
