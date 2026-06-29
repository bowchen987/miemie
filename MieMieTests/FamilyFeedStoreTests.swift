import XCTest
@testable import MieMie

@MainActor
final class FamilyFeedStoreTests: XCTestCase {
    func testAddsSubmittedPostToTopOfFeed() {
        let store = FamilyFeedStore(initialPosts: FamilyPost.sampleFeed)

        store.submit(kind: .message, title: "  早点回家  ", body: "  今天一起吃饭  ", hasPhoto: false)

        XCTAssertEqual(store.posts.first?.kind, .message)
        XCTAssertEqual(store.posts.first?.title, "早点回家")
        XCTAssertEqual(store.posts.first?.body, "今天一起吃饭")
    }

    func testDoesNotAddPostWithBlankTitle() {
        let store = FamilyFeedStore(initialPosts: FamilyPost.sampleFeed)
        let originalCount = store.posts.count

        store.submit(kind: .todo, title: "   ", body: "买牛奶", hasPhoto: false)

        XCTAssertEqual(store.posts.count, originalCount)
        XCTAssertNil(store.lastChangeEvent)
    }

    func testSubmittedPostRecordsChangeEventForNotifications() {
        let store = FamilyFeedStore(initialPosts: [])

        store.submit(kind: .resource, title: "疫苗本照片", body: "方便体检", hasPhoto: true)

        XCTAssertEqual(store.lastChangeEvent, .postAdded(store.posts[0]))
    }

    func testTogglesTodoBetweenIncompleteAndCompleted() {
        let todo = FamilyPost.quickDraft(kind: .todo, title: "买牛奶", body: "")
        let store = FamilyFeedStore(initialPosts: [todo])

        store.toggleTodoStatus(for: todo.id)

        XCTAssertEqual(store.posts.first?.todoStatus, .completed)

        store.toggleTodoStatus(for: todo.id)

        XCTAssertEqual(store.posts.first?.todoStatus, .incomplete)
    }

    func testTodoToggleRecordsChangeEventForNotifications() {
        let todo = FamilyPost.quickDraft(kind: .todo, title: "买牛奶", body: "")
        let store = FamilyFeedStore(initialPosts: [todo])

        store.toggleTodoStatus(for: todo.id)

        XCTAssertEqual(store.lastChangeEvent, .todoStatusUpdated(store.posts[0]))
    }

    func testToggleIgnoresNonTodoPosts() {
        let resource = FamilyPost.quickDraft(kind: .resource, title: "户口本照片", body: "")
        let store = FamilyFeedStore(initialPosts: [resource])

        store.toggleTodoStatus(for: resource.id)

        XCTAssertNil(store.posts.first?.todoStatus)
        XCTAssertNil(store.lastChangeEvent)
    }

    func testFiltersPostsByHomeCategory() {
        let todo = FamilyPost.quickDraft(kind: .todo, title: "买牛奶", body: "")
        let resource = FamilyPost.quickDraft(kind: .resource, title: "户口本照片", body: "")
        let photo = FamilyPost.quickDraft(kind: .photo, title: "宝宝照片", body: "", hasPhoto: true)
        let message = FamilyPost.quickDraft(kind: .message, title: "早点回家", body: "")
        let store = FamilyFeedStore(initialPosts: [todo, resource, photo, message])

        XCTAssertEqual(store.filteredPosts(for: .todo).map(\.title), ["买牛奶"])
        XCTAssertEqual(store.filteredPosts(for: .resource).map(\.title), ["户口本照片", "宝宝照片"])
        XCTAssertEqual(store.filteredPosts(for: .message).map(\.title), ["早点回家"])
        XCTAssertEqual(store.filteredPosts(for: .all).count, 4)
    }
}
