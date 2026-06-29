import Foundation

enum FamilyPostKind: String, CaseIterable, Identifiable, Equatable {
    case todo
    case resource
    case message
    case photo

    var id: String { rawValue }

    static let primaryComposerKinds: [FamilyPostKind] = [.todo, .resource, .message]

    var title: String {
        switch self {
        case .todo:
            return "待办"
        case .resource:
            return "资料"
        case .message:
            return "留言"
        case .photo:
            return "照片"
        }
    }
}

enum TodoStatus: String, Equatable {
    case incomplete
    case completed

    var title: String {
        switch self {
        case .incomplete:
            return "未完成"
        case .completed:
            return "已完成"
        }
    }

    var toggled: TodoStatus {
        switch self {
        case .incomplete:
            return .completed
        case .completed:
            return .incomplete
        }
    }
}

enum FamilyPostFilter: String, CaseIterable, Identifiable, Equatable {
    case all
    case todo
    case resource
    case message

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all:
            return "全部"
        case .todo:
            return "待办"
        case .resource:
            return "资料"
        case .message:
            return "留言"
        }
    }

    func includes(_ post: FamilyPost) -> Bool {
        switch self {
        case .all:
            return true
        case .todo:
            return post.kind == .todo
        case .resource:
            return post.kind == .resource || post.kind == .photo
        case .message:
            return post.kind == .message
        }
    }
}

struct FamilyPost: Identifiable, Equatable {
    let id: UUID
    let kind: FamilyPostKind
    let todoStatus: TodoStatus?
    let title: String
    let body: String
    let authorName: String
    let createdAt: Date
    let hasPhoto: Bool

    static func quickDraft(
        kind: FamilyPostKind,
        title: String,
        body: String,
        authorName: String = "我",
        createdAt: Date = Date(),
        hasPhoto: Bool = false
    ) -> FamilyPost {
        FamilyPost(
            id: UUID(),
            kind: kind,
            todoStatus: kind == .todo ? .incomplete : nil,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            authorName: authorName,
            createdAt: createdAt,
            hasPhoto: hasPhoto
        )
    }

    static let sampleFeed: [FamilyPost] = [
        FamilyPost(
            id: UUID(uuidString: "10000000-0000-0000-0000-000000000003")!,
            kind: .todo,
            todoStatus: .incomplete,
            title: "下班带一盒草莓和牛奶",
            body: "顺路的话再拿一下快递。",
            authorName: "妈妈",
            createdAt: Date(timeIntervalSince1970: 1_780_000_300),
            hasPhoto: false
        ),
        FamilyPost(
            id: UUID(uuidString: "10000000-0000-0000-0000-000000000002")!,
            kind: .photo,
            todoStatus: nil,
            title: "宝宝今天的手工作品",
            body: "幼儿园老师说她很认真。",
            authorName: "爸爸",
            createdAt: Date(timeIntervalSince1970: 1_780_000_200),
            hasPhoto: true
        ),
        FamilyPost(
            id: UUID(uuidString: "10000000-0000-0000-0000-000000000001")!,
            kind: .resource,
            todoStatus: nil,
            title: "宝宝疫苗本照片",
            body: "方便下次体检和入园资料查找。",
            authorName: "妈妈",
            createdAt: Date(timeIntervalSince1970: 1_780_000_100),
            hasPhoto: true
        )
    ].sorted { $0.createdAt > $1.createdAt }
}

enum FamilyChangeEvent: Equatable {
    case postAdded(FamilyPost)
    case todoStatusUpdated(FamilyPost)

    var post: FamilyPost {
        switch self {
        case .postAdded(let post), .todoStatusUpdated(let post):
            return post
        }
    }
}
