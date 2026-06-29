import CoreLocation
import Foundation

final class LocationSharingService: NSObject, ObservableObject {
    @Published private(set) var currentSnapshot: LocationSnapshot?
    @Published private(set) var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 100
        authorizationStatus = manager.authorizationStatus
    }

    func requestForegroundAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func requestBackgroundAuthorization() {
        manager.requestAlwaysAuthorization()
    }

    func startForegroundUpdates() {
        manager.startUpdatingLocation()
    }

    func startLowPowerBackgroundUpdates() {
        manager.startMonitoringSignificantLocationChanges()
    }

    func stopUpdates() {
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
    }
}

extension LocationSharingService: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else {
            return
        }

        currentSnapshot = LocationSnapshot(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            updatedAt: Date()
        )
    }
}

