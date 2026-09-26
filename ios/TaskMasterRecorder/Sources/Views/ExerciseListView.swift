import SwiftUI

struct ExerciseListView: View {
    @EnvironmentObject var library: ClipLibrary

    var body: some View {
        NavigationStack {
            List(Exercise.allCases) { exercise in
                NavigationLink(value: exercise) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(exercise.rawValue).font(.headline)
                            Text("\(library.clips(for: exercise).count) clip(s)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Reference Library")
            .navigationDestination(for: Exercise.self) { exercise in
                RecordView(exercise: exercise)
            }
        }
    }
}
