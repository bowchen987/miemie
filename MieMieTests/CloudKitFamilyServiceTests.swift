import CloudKit
import XCTest
@testable import MieMie

final class CloudKitFamilyServiceTests: XCTestCase {
    func testPostChangeSubscriptionSendsPushForCreatedAndUpdatedPosts() {
        let subscription = CloudKitFamilyService.postChangeSubscription()

        XCTAssertEqual(subscription.subscriptionID, "miemie-family-post-changes")
        XCTAssertEqual(subscription.recordType, "FamilyPost")
        XCTAssertTrue(subscription.querySubscriptionOptions.contains(.firesOnRecordCreation))
        XCTAssertTrue(subscription.querySubscriptionOptions.contains(.firesOnRecordUpdate))
        XCTAssertEqual(subscription.notificationInfo?.alertBody, "miemie 有家庭更新")
        XCTAssertEqual(subscription.notificationInfo?.soundName, "default")
        XCTAssertEqual(subscription.notificationInfo?.shouldSendContentAvailable, true)
    }
}
