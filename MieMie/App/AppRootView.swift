import SwiftUI

struct AppRootView: View {
    @StateObject private var feedStore = FamilyFeedStore()
    @State private var selectedComposerKind: FamilyPostKind?
    private let notificationService = NotificationPermissionService()
    private let cloudService = CloudKitFamilyService()

    var body: some View {
        NavigationStack {
            HomeView(
                distanceText: DistanceFormatter.familyDistanceText(meters: 2_420),
                posts: feedStore.posts,
                onCompose: { selectedComposerKind = $0 },
                onToggleTodo: { feedStore.toggleTodoStatus(for: $0) }
            )
        }
        .sheet(item: $selectedComposerKind) { kind in
            ComposerView(kind: kind) { title, body, hasPhoto in
                feedStore.submit(kind: kind, title: title, body: body, hasPhoto: hasPhoto)
            }
            .presentationDetents([.medium, .large])
        }
        .task {
            await prepareNotifications()
        }
        .onChange(of: feedStore.lastChangeEvent) { _, event in
            guard let event else {
                return
            }

            Task {
                await handleChangeEvent(event)
            }
        }
    }

    private func prepareNotifications() async {
        do {
            let isAuthorized = try await notificationService.requestAuthorization()
            if isAuthorized {
                await MainActor.run {
                    notificationService.registerForRemoteNotifications()
                }
                try await cloudService.ensurePostChangeSubscription()
            }
        } catch {
            // Notification and CloudKit setup can be retried on the next launch.
        }
    }

    private func handleChangeEvent(_ event: FamilyChangeEvent) async {
        do {
            try await cloudService.save(event.post)
        } catch {
            // Keep the local feed responsive even if the network is unavailable.
        }
    }
}

#if DEBUG && targetEnvironment(simulator)
#Preview {
    AppRootView()
}
#endif
