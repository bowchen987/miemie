import CloudKit
import Foundation

enum CloudAccountState: Equatable {
    case available
    case noAccount
    case restricted
    case temporarilyUnavailable
    case couldNotDetermine
}

protocol FamilySyncing {
    func accountState() async -> CloudAccountState
    func fetchRecentPosts(limit: Int) async throws -> [FamilyPost]
    func save(_ post: FamilyPost) async throws
}

final class CloudKitFamilyService: FamilySyncing {
    static let postChangeSubscriptionID = "miemie-family-post-changes"

    private let container: CKContainer
    private let database: CKDatabase
    private let recordType = "FamilyPost"

    init(container: CKContainer = .default()) {
        self.container = container
        self.database = container.privateCloudDatabase
    }

    static func postChangeSubscription() -> CKQuerySubscription {
        let subscription = CKQuerySubscription(
            recordType: "FamilyPost",
            predicate: NSPredicate(value: true),
            subscriptionID: postChangeSubscriptionID,
            options: [.firesOnRecordCreation, .firesOnRecordUpdate]
        )
        let notificationInfo = CKSubscription.NotificationInfo()
        notificationInfo.alertBody = "miemie 有家庭更新"
        notificationInfo.soundName = "default"
        notificationInfo.shouldSendContentAvailable = true
        subscription.notificationInfo = notificationInfo
        return subscription
    }

    func accountState() async -> CloudAccountState {
        await withCheckedContinuation { continuation in
            container.accountStatus { status, _ in
                switch status {
                case .available:
                    continuation.resume(returning: .available)
                case .noAccount:
                    continuation.resume(returning: .noAccount)
                case .restricted:
                    continuation.resume(returning: .restricted)
                case .temporarilyUnavailable:
                    continuation.resume(returning: .temporarilyUnavailable)
                case .couldNotDetermine:
                    continuation.resume(returning: .couldNotDetermine)
                @unknown default:
                    continuation.resume(returning: .couldNotDetermine)
                }
            }
        }
    }

    func ensurePostChangeSubscription() async throws {
        _ = try await database.save(Self.postChangeSubscription())
    }

    func fetchRecentPosts(limit: Int = 50) async throws -> [FamilyPost] {
        let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        query.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: false)]

        return try await withCheckedThrowingContinuation { continuation in
            let operation = CKQueryOperation(query: query)
            operation.resultsLimit = limit

            var posts: [FamilyPost] = []
            operation.recordMatchedBlock = { _, result in
                if case let .success(record) = result, let post = Self.post(from: record) {
                    posts.append(post)
                }
            }
            operation.queryResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume(returning: posts.sorted { $0.createdAt > $1.createdAt })
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }

            database.add(operation)
        }
    }

    func save(_ post: FamilyPost) async throws {
        let record = CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: post.id.uuidString))
        record["kind"] = post.kind.rawValue as NSString
        if let todoStatus = post.todoStatus {
            record["todoStatus"] = todoStatus.rawValue as NSString
        }
        record["title"] = post.title as NSString
        record["body"] = post.body as NSString
        record["authorName"] = post.authorName as NSString
        record["createdAt"] = post.createdAt as NSDate
        record["hasPhoto"] = post.hasPhoto as NSNumber

        _ = try await database.save(record)
    }

    private static func post(from record: CKRecord) -> FamilyPost? {
        guard
            let rawKind = record["kind"] as? String,
            let kind = FamilyPostKind(rawValue: rawKind),
            let title = record["title"] as? String,
            let body = record["body"] as? String,
            let authorName = record["authorName"] as? String,
            let createdAt = record["createdAt"] as? Date,
            let id = UUID(uuidString: record.recordID.recordName)
        else {
            return nil
        }

        let todoStatus = (record["todoStatus"] as? String)
            .flatMap(TodoStatus.init(rawValue:)) ?? (kind == .todo ? .incomplete : nil)

        return FamilyPost(
            id: id,
            kind: kind,
            todoStatus: todoStatus,
            title: title,
            body: body,
            authorName: authorName,
            createdAt: createdAt,
            hasPhoto: (record["hasPhoto"] as? NSNumber)?.boolValue ?? false
        )
    }
}
