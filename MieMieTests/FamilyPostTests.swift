import XCTest
@testable import MieMie

final class FamilyPostTests: XCTestCase {
    func testPrimaryComposerKindsAreTodoResourceAndMessage() {
        XCTAssertEqual(
            FamilyPostKind.primaryComposerKinds.map(\.title),
            ["待办", "资料", "留言"]
        )
    }

    func testSampleFeedIsNewestFirst() {
        let feed = FamilyPost.sampleFeed

        XCTAssertEqual(feed.map(\.title), [
            "下班带一盒草莓和牛奶",
            "宝宝今天的手工作品",
            "宝宝疫苗本照片"
        ])
    }

    func testQuickDraftUsesSelectedKindAndTrimsWhitespace() {
        let draft = FamilyPost.quickDraft(kind: .resource, title: "  疫苗本照片  ", body: "  方便下次体检查找  ")

        XCTAssertEqual(draft.kind, .resource)
        XCTAssertEqual(draft.title, "疫苗本照片")
        XCTAssertEqual(draft.body, "方便下次体检查找")
    }

    func testTodoDraftStartsIncomplete() {
        let draft = FamilyPost.quickDraft(kind: .todo, title: "买牛奶", body: "")

        XCTAssertEqual(draft.todoStatus, .incomplete)
    }

    func testResourceDraftHasNoTodoStatus() {
        let draft = FamilyPost.quickDraft(kind: .resource, title: "户口本照片", body: "")

        XCTAssertNil(draft.todoStatus)
    }
}
