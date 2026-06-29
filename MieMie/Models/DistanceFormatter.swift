import Foundation

enum DistanceFormatter {
    static func familyDistanceText(meters: Double?) -> String {
        guard let meters else {
            return "等待定位"
        }

        if meters < 1_000 {
            return "\(Int(meters.rounded())) m"
        }

        let kilometers = meters / 1_000
        return String(format: "%.1f km", kilometers)
    }
}

