import PhotosUI
import SwiftUI

struct ComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var bodyText = ""
    @State private var selectedPhoto: PhotosPickerItem?

    let kind: FamilyPostKind
    let onSubmit: (String, String, Bool) -> Void

    init(kind: FamilyPostKind, onSubmit: @escaping (String, String, Bool) -> Void = { _, _, _ in }) {
        self.kind = kind
        self.onSubmit = onSubmit
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(titlePlaceholder, text: $title)
                    TextField("补充一点细节", text: $bodyText, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Label(selectedPhoto == nil ? "添加照片" : "已选择照片", systemImage: "photo")
                    }
                } footer: {
                    Text("第一版先把图片选择入口放好，后续会通过 CloudKit Assets 同步给另一方。")
                }

                Section {
                    Button {
                        submitAndDismiss()
                    } label: {
                        Text("发布到 miemie")
                            .font(.headline.weight(.bold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(AppTheme.mintStrong)
                    .disabled(isSubmitDisabled)
                }
            }
            .scrollContentBackground(.hidden)
            .background(AppTheme.background)
            .navigationTitle("发布\(kind.title)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("发布") {
                        submitAndDismiss()
                    }
                    .disabled(isSubmitDisabled)
                }
            }
        }
    }

    private var isSubmitDisabled: Bool {
        title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submitAndDismiss() {
        onSubmit(title, bodyText, selectedPhoto != nil)
        dismiss()
    }

    private var titlePlaceholder: String {
        switch kind {
        case .todo:
            return "要记得做什么？"
        case .resource:
            return "要归档什么资料？"
        case .message:
            return "想留一句什么？"
        case .photo:
            return "给这张照片起个名字"
        }
    }
}

#if DEBUG && targetEnvironment(simulator)
#Preview {
    ComposerView(kind: .message)
}
#endif
