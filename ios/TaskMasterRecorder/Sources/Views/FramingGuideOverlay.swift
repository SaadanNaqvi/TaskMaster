import SwiftUI

/// Center line + rule-of-thirds grid so every reference clip is framed the same way (side-on, fixed distance).
struct FramingGuideOverlay: View {
    var body: some View {
        GeometryReader { geo in
            Path { path in
                let w = geo.size.width
                let h = geo.size.height

                path.move(to: CGPoint(x: w / 2, y: 0))
                path.addLine(to: CGPoint(x: w / 2, y: h))

                for i in 1...2 {
                    let x = w * CGFloat(i) / 3
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: h))

                    let y = h * CGFloat(i) / 3
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: w, y: y))
                }
            }
            .stroke(Color.white.opacity(0.35), lineWidth: 1)
        }
        .allowsHitTesting(false)
    }
}
