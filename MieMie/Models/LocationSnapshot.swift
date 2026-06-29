import CoreLocation
import Foundation

struct LocationSnapshot: Equatable {
    let latitude: Double
    let longitude: Double
    let updatedAt: Date

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    func distanceInMeters(to other: LocationSnapshot) -> Double {
        let current = CLLocation(latitude: latitude, longitude: longitude)
        let remote = CLLocation(latitude: other.latitude, longitude: other.longitude)
        return current.distance(from: remote)
    }
}

