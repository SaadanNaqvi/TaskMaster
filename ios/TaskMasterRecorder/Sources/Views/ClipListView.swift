import SwiftUI
import AVKit

struct ClipListView: View {
    let exercise: Exercise

    @EnvironmentObject var library: ClipLibrary
    @State private var playingClip: PlayableClip?

    var body: some View {
        List {
            ForEach(library.clips(for: exercise)) { clip in
                Button {
                    playingClip = PlayableClip(url: library.fileURL(for: clip))
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(clip.dateRecorded.formatted(date: .abbreviated, time: .shortened))
                            Text(String(format: "%.1fs", clip.durationSeconds))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "play.circle").font(.title2)
                    }
                }
                .buttonStyle(.plain)
            }
            .onDelete { offsets in
                let items = library.clips(for: exercise)
                for index in offsets { library.delete(items[index]) }
            }
        }
        .navigationTitle("\(exercise.rawValue) Clips")
        .overlay {
            if library.clips(for: exercise).isEmpty {
                ContentUnavailableView(
                    "No clips yet",
                    systemImage: "video.slash",
                    description: Text("Record one from the \(exercise.rawValue) screen.")
                )
            }
        }
        .sheet(item: $playingClip) { clip in
            VideoPlayer(player: AVPlayer(url: clip.url))
                .ignoresSafeArea()
        }
    }
}

private struct PlayableClip: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
