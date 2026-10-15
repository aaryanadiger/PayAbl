import AppIntents
import UIKit

struct PayablVoicePaymentIntent: AppIntent {
  static var title: LocalizedStringResource = "Voice payment"
  static var description = IntentDescription("Open Payabl and choose a recipient using your voice.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    let url = URL(string: "payabl:///?screen=contacts&voice=1")!
    let opened = await UIApplication.shared.open(url)
    if !opened { throw PayablShortcutError.cannotOpen }
    return .result()
  }
}

struct PayablScanQRIntent: AppIntent {
  static var title: LocalizedStringResource = "Scan payment QR"
  static var description = IntentDescription("Open Payabl’s guided QR scanner.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    let url = URL(string: "payabl:///?screen=scan")!
    let opened = await UIApplication.shared.open(url)
    if !opened { throw PayablShortcutError.cannotOpen }
    return .result()
  }
}

enum PayablShortcutError: Error { case cannotOpen }

struct PayablShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PayablVoicePaymentIntent(),
      phrases: ["Start a voice payment in \(.applicationName)", "Pay family with \(.applicationName)"],
      shortTitle: "Voice payment",
      systemImageName: "mic"
    )
    AppShortcut(
      intent: PayablScanQRIntent(),
      phrases: ["Scan a QR with \(.applicationName)"],
      shortTitle: "Scan payment QR",
      systemImageName: "qrcode.viewfinder"
    )
  }
}
