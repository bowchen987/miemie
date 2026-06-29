import UIKit
import UserNotifications

struct FamilyNotificationMessage: Equatable {
    let title: String
    let body: String
}

final class NotificationPermissionService {
    static func message(for event: FamilyChangeEvent) -> FamilyNotificationMessage {
        switch event {
        case .postAdded(let post):
            return FamilyNotificationMessage(
                title: "miemie 有新\(displayTitle(for: post.kind))",
                body: post.title
            )
        case .todoStatusUpdated(let post):
            return FamilyNotificationMessage(
                title: "miemie 待办状态更新",
                body: "\(post.title)：\(post.todoStatus?.title ?? TodoStatus.incomplete.title)"
            )
        }
    }

    func requestAuthorization() async throws -> Bool {
        try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
    }

    @MainActor
    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    func scheduleLocalPreview(for event: FamilyChangeEvent) async throws {
        let message = Self.message(for: event)
        let content = UNMutableNotificationContent()
        content.title = message.title
        content.body = message.body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: event.post.id.uuidString,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )

        try await UNUserNotificationCenter.current().add(request)
    }

    func scheduleLocalPreview(for post: FamilyPost) async throws {
        try await scheduleLocalPreview(for: .postAdded(post))
    }

    private static func displayTitle(for kind: FamilyPostKind) -> String {
        kind == .photo ? FamilyPostKind.resource.title : kind.title
    }
}
