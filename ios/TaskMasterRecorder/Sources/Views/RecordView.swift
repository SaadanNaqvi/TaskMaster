import SwiftUI

struct RecordView: View {
    let exercise: Exercise

    @EnvironmentObject var library: ClipLibrary
    @StateObject private var camera = CameraController()
    @State private var showSavedBanner = false
    @State private var errorText: String?

    var body: some View {
        ZStack {
            if camera.permissionGranted {
                CameraPreviewView(session: camera.session)
                    .ignoresSafeArea()
                FramingGuideOverlay()
            } else {
                Color.black.ignoresSafeArea()
                VStack(spacing: 12) {
                    Image(systemName: "camera.fill")
                        .font(.largeTitle)
                        .foregroundStyle(.white)
                    Text("Camera access needed to record")
                        .foregroundStyle(.white)
                }
            }

            VStack {
                Text(exercise.framingHint)
                    .font(.footnote)
                    .foregroundStyle(.white)
                    .padding(8)
                    .background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
                    .padding(.top, 8)

                Spacer()

                HStack {
                    NavigationLink {
                        ClipListView(exercise: exercise)
                    } label: {
                        Label("Clips (\(library.clips(for: exercise).count))", systemImage: "list.bullet")
                            .padding(10)
                            .background(.black.opacity(0.5), in: Capsule())
                            .foregroundStyle(.white)
                    }
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.bottom, 12)

                RecordButton(isRecording: camera.isRecording, action: toggleRecording)
                    .padding(.bottom, 30)
            }
        }
        .navigationTitle(exercise.rawValue)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { camera.requestAccessAndConfigure() }
        .onDisappear { camera.stopSession() }
        .alert("Clip saved", isPresented: $showSavedBanner) {
            Button("OK", role: .cancel) {}
        }
        .alert("Error", isPresented: Binding(
            get: { errorText != nil },
            set: { if !$0 { errorText = nil } }
        )) {
            Button("OK", role: .cancel) { errorText = nil }
        } message: {
            Text(errorText ?? "")
        }
    }

    private func toggleRecording() {
        if camera.isRecording {
            camera.stopRecording()
            return
        }
        camera.startRecording { tempURL in
            library.addClip(from: tempURL, exercise: exercise) { result in
                switch result {
                case .success:
                    showSavedBanner = true
                case .failure(let error):
                    errorText = error.localizedDescription
                }
            }
        }
    }
}

private struct RecordButton: View {
    let isRecording: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .stroke(.white, lineWidth: 4)
                    .frame(width: 76, height: 76)
                if isRecording {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.red)
                        .frame(width: 32, height: 32)
                } else {
                    Circle()
                        .fill(.red)
                        .frame(width: 64, height: 64)
                }
            }
        }
        .accessibilityLabel(isRecording ? "Stop recording" : "Start recording")
    }
}
