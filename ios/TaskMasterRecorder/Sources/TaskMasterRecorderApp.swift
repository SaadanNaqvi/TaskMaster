import SwiftUI

@main
struct TaskMasterRecorderApp: App {
    @StateObject private var library = ClipLibrary()

    var body: some Scene {
        WindowGroup {
            ExerciseListView()
                .environmentObject(library)
        }
    }
}
