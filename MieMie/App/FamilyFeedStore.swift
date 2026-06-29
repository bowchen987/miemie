import Combine
import Foundation

@MainActor
final class FamilyFeedStore: ObservableObject {
    @Published private(set) var posts: [FamilyPost]
    @Published private(set) var lastChangeEvent: FamilyChangeEvent?

    init(initialPosts: [FamilyPost] = FamilyPost.sampleFeed) {
        self.posts = initialPosts
    }

    func submit(kind: FamilyPostKind, title: String, body: String, hasPhoto: Bool) {
        let draft = FamilyPost.quickDraft(
            kind: kind,
            title: title,
            body: body,
            authorName: "我",
            hasPhoto: hasPhoto
        )

        guard !draft.title.isEmpty else {
            return
        }

        posts.insert(draft, at: 0)
        lastChangeEvent = .postAdded(draft)
    }

    func toggleTodoStatus(for id: UUID) {
        guard let index = posts.firstIndex(where: { $0.id == id }),
              posts[index].kind == .todo,
              let currentStatus = posts[index].todoStatus
        else {
            return
        }

        let post = posts[index]
        let updatedPost = FamilyPost(
            id: post.id,
            kind: post.kind,
            todoStatus: currentStatus.toggled,
            title: post.title,
            body: post.body,
            authorName: post.authorName,
            createdAt: post.createdAt,
            hasPhoto: post.hasPhoto
        )
        posts[index] = updatedPost
        lastChangeEvent = .todoStatusUpdated(updatedPost)
    }

    func filteredPosts(for filter: FamilyPostFilter) -> [FamilyPost] {
        posts.filter(filter.includes)
    }
}
