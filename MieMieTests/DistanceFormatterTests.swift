import XCTest
@testable import MieMie

final class DistanceFormatterTests: XCTestCase {
    func testFormatsMissingDistanceAsWaitingForLocation() {
        XCTAssertEqual(DistanceFormatter.familyDistanceText(meters: nil), "等待定位")
    }

    func testFormatsShortDistancesInMeters() {
        XCTAssertEqual(DistanceFormatter.familyDistanceText(meters: 420), "420 m")
    }

    func testFormatsLongDistancesInKilometers() {
        XCTAssertEqual(DistanceFormatter.familyDistanceText(meters: 2_420), "2.4 km")
    }
}

