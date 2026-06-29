import SwiftUI

struct HomeView: View {
    let distanceText: String
    let posts: [FamilyPost]
    let onCompose: (FamilyPostKind) -> Void
    let onToggleTodo: (FamilyPost.ID) -> Void
    @State private var selectedFilter: FamilyPostFilter = .all

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HeaderView()
                    DistanceStatusCard(distanceText: distanceText)
                    QuickActionsView(onCompose: onCompose)
                    FeedFilterPicker(selectedFilter: $selectedFilter)
                    FeedSection(
                        selectedFilter: selectedFilter,
                        posts: visiblePosts,
                        onToggleTodo: onToggleTodo
                    )
                }
                .padding(.horizontal, 18)
                .padding(.top, 10)
                .padding(.bottom, 28)
            }
        }
        .navigationBarHidden(true)
    }

    private var visiblePosts: [FamilyPost] {
        posts.filter(selectedFilter.includes)
    }
}

private struct HeaderView: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("miemie")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(AppTheme.ink)
                Text("今天也要好好照顾我们的小家")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.muted)
            }

            Spacer()

            HStack(spacing: -6) {
                FamilyBadge(text: "妈", color: AppTheme.paper)
                FamilyBadge(text: "爸", color: AppTheme.mint)
                FamilyBadge(text: "宝", color: AppTheme.lemon)
            }
        }
    }
}

private struct FamilyBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(AppTheme.ink)
            .frame(width: 34, height: 34)
            .background(color)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppTheme.line, lineWidth: 1)
            )
    }
}

private struct DistanceStatusCard: View {
    let distanceText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("现在的距离")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.muted)

            HStack(alignment: .bottom, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(distanceText)
                        .font(.system(size: 44, weight: .heavy, design: .rounded))
                        .foregroundStyle(AppTheme.ink)
                        .minimumScaleFactor(0.75)
                        .lineLimit(1)

                    Text("爸爸正在回家路上")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.muted)
                }

                Spacer(minLength: 8)

                RouteSticker()
            }

            HStack(spacing: 8) {
                StatusChip(text: "18 分钟")
                StatusChip(text: "刚刚同步")
            }
        }
        .padding(18)
        .background(
            LinearGradient(
                colors: [AppTheme.mint, AppTheme.background, AppTheme.lemon.opacity(0.75)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .shadow(color: AppTheme.mintStrong.opacity(0.16), radius: 24, x: 0, y: 12)
    }
}

private struct RouteSticker: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(AppTheme.paper.opacity(0.72))

            Path { path in
                path.move(to: CGPoint(x: 20, y: 44))
                path.addCurve(to: CGPoint(x: 70, y: 18), control1: CGPoint(x: 28, y: 18), control2: CGPoint(x: 56, y: 46))
            }
            .stroke(AppTheme.ink.opacity(0.32), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [6, 6]))

            Circle()
                .fill(AppTheme.coral)
                .frame(width: 13, height: 13)
                .position(x: 20, y: 44)

            Circle()
                .fill(AppTheme.mintStrong)
                .frame(width: 13, height: 13)
                .position(x: 70, y: 18)
        }
        .frame(width: 92, height: 64)
    }
}

private struct StatusChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .foregroundStyle(AppTheme.ink)
            .padding(.horizontal, 11)
            .padding(.vertical, 8)
            .background(AppTheme.paper.opacity(0.78))
            .clipShape(Capsule())
    }
}

private struct QuickActionsView: View {
    let onCompose: (FamilyPostKind) -> Void

    var body: some View {
        HStack(spacing: 10) {
            QuickActionButton(kind: .todo, symbol: "checkmark", color: AppTheme.lemon, onCompose: onCompose)
            QuickActionButton(kind: .resource, symbol: "folder", color: AppTheme.coral.opacity(0.72), onCompose: onCompose)
            QuickActionButton(kind: .message, symbol: "text.bubble", color: AppTheme.sky, onCompose: onCompose)
        }
    }
}

private struct QuickActionButton: View {
    let kind: FamilyPostKind
    let symbol: String
    let color: Color
    let onCompose: (FamilyPostKind) -> Void

    var body: some View {
        Button {
            onCompose(kind)
        } label: {
            VStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(AppTheme.ink)
                    .frame(width: 34, height: 34)
                    .background(color)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Text(kind.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(AppTheme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 84)
            .background(AppTheme.paper)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(AppTheme.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("发布\(kind.title)")
    }
}

private struct FeedFilterPicker: View {
    @Binding var selectedFilter: FamilyPostFilter

    var body: some View {
        Picker("查看分类", selection: $selectedFilter) {
            ForEach(FamilyPostFilter.allCases) { filter in
                Text(filter.title).tag(filter)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityLabel("查看分类")
    }
}

private struct FeedSection: View {
    let selectedFilter: FamilyPostFilter
    let posts: [FamilyPost]
    let onToggleTodo: (FamilyPost.ID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(sectionTitle)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.ink)
                Spacer()
            }

            if posts.isEmpty {
                Text("这里还没有\(selectedFilter.title)内容")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(AppTheme.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(AppTheme.line, lineWidth: 1)
                    )
            } else {
                ForEach(posts) { post in
                    FamilyPostCard(post: post, onToggleTodo: onToggleTodo)
                }
            }
        }
    }

    private var sectionTitle: String {
        selectedFilter == .all ? "今天的小纸条" : "全部\(selectedFilter.title)"
    }
}

private struct FamilyPostCard: View {
    let post: FamilyPost
    let onToggleTodo: (FamilyPost.ID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(post.kind.title, systemImage: iconName)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.muted)

                Text("· \(post.authorName)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.muted)

                Spacer()

                Text(post.createdAt, style: .time)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.muted)
            }

            HStack(alignment: .top, spacing: 10) {
                Text(post.title)
                    .font(.system(.body, design: .rounded, weight: .bold))
                    .foregroundStyle(AppTheme.ink)
                    .strikethrough(post.todoStatus == .completed, color: AppTheme.muted)

                Spacer(minLength: 8)

                if let todoStatus = post.todoStatus {
                    Button {
                        onToggleTodo(post.id)
                    } label: {
                        Label(todoStatus.title, systemImage: todoStatus == .completed ? "checkmark.circle.fill" : "circle")
                            .font(.caption.weight(.bold))
                            .labelStyle(.titleAndIcon)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .background(todoStatus == .completed ? AppTheme.mint : AppTheme.lemon)
                            .foregroundStyle(AppTheme.ink)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("切换待办状态，当前\(todoStatus.title)")
                }
            }

            Text(post.body)
                .font(.subheadline)
                .foregroundStyle(AppTheme.muted)

            if post.hasPhoto {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [AppTheme.coral.opacity(0.42), AppTheme.mint],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 78)
                    .overlay {
                        Label("家庭照片", systemImage: "photo")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(AppTheme.ink.opacity(0.68))
                    }
            }
        }
        .padding(14)
        .background(AppTheme.paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppTheme.line, lineWidth: 1)
        )
    }

    private var iconName: String {
        switch post.kind {
        case .todo:
            return "checkmark.circle"
        case .resource:
            return "folder"
        case .message:
            return "text.bubble"
        case .photo:
            return "photo"
        }
    }
}

#if DEBUG && targetEnvironment(simulator)
#Preview {
    HomeView(
        distanceText: DistanceFormatter.familyDistanceText(meters: 2_420),
        posts: FamilyPost.sampleFeed,
        onCompose: { _ in },
        onToggleTodo: { _ in }
    )
}
#endif
