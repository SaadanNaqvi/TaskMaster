import Foundation
import AVFoundation

/// Owns every recorded reference clip: moves finished recordings into
/// Documents/ReferenceClips, and keeps an index.json alongside them
/// (mirrors the `library/index.json` contract in the backend tech-stack doc).
final class ClipLibrary: ObservableObject {
    @Published private(set) var clips: [ExerciseClip] = []

    private let clipsDirectory: URL
    private let indexURL: URL

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        clipsDirectory = docs.appendingPathComponent("ReferenceClips", isDirectory: true)
        indexURL = clipsDirectory.appendingPathComponent("index.json")
        try? FileManager.default.createDirectory(at: clipsDirectory, withIntermediateDirectories: true)
        load()
    }

    func clips(for exercise: Exercise) -> [ExerciseClip] {
        clips.filter { $0.exercise == exercise }.sorted { $0.dateRecorded > $1.dateRecorded }
    }

    func fileURL(for clip: ExerciseClip) -> URL {
        clipsDirectory.appendingPathComponent(clip.fileName)
    }

    /// Moves a just-recorded temp file into the library and appends it to the index.
    func addClip(from tempURL: URL, exercise: Exercise, completion: @escaping (Result<ExerciseClip, Error>) -> Void) {
        let safeName = exercise.rawValue.replacingOccurrences(of: " ", with: "_")
        let fileName = "\(safeName)_\(Int(Date().timeIntervalSince1970)).mov"
        let destination = clipsDirectory.appendingPathComponent(fileName)

        do {
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: tempURL, to: destination)

            let duration = AVURLAsset(url: destination).duration.seconds
            let clip = ExerciseClip(
                id: UUID(),
                exercise: exercise,
                fileName: fileName,
                dateRecorded: Date(),
                durationSeconds: duration.isFinite ? duration : 0
            )
            clips.append(clip)
            save()
            completion(.success(clip))
        } catch {
            completion(.failure(error))
        }
    }

    func delete(_ clip: ExerciseClip) {
        try? FileManager.default.removeItem(at: fileURL(for: clip))
        clips.removeAll { $0.id == clip.id }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: indexURL),
              let decoded = try? JSONDecoder.taskMaster.decode([ExerciseClip].self, from: data) else { return }
        clips = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder.taskMaster.encode(clips) else { return }
        try? data.write(to: indexURL, options: .atomic)
    }
}

extension JSONEncoder {
    static var taskMaster: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

extension JSONDecoder {
    static var taskMaster: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
