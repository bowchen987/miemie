import XCTest
@testable import MieMie

final class NotificationPermissionServiceTests: XCTestCase {
    func testNotificationMessageForAddedResourceUsesMiemieName() {
        let post = FamilyPost.quickDraft(kind: .resource, title: "疫苗本照片", body: "")

        let message = NotificationPermissionService.message(for: .postAdded(post))

        XCTAssertEqual(message.title, "miemie 有新资料")
        XCTAssertEqual(message.body, "疫苗本照片")
    }

    func testNotificationMessageForTodoStatusUpdateIncludesStatus() {
        let post = FamilyPost(
            id: UUID(uuidString: "20000000-0000-0000-0000-000000000001")!,
            kind: .todo,
            todoStatus: .completed,
            title: "买牛奶",
            body: "",
            authorName: "我",
            createdAt: Date(timeIntervalSince1970: 1_780_000_400),
            hasPhoto: false
        )

        let message = NotificationPermissionService.message(for: .todoStatusUpdated(post))

        XCTAssertEqual(message.title, "miemie 待办状态更新")
        XCTAssertEqual(message.body, "买牛奶：已完成")
    }
}
