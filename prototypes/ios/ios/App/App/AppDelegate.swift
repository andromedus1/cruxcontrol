import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }
}

// One storyboard-backed scene keeps the prototype's existing bridge and storage
// origin. UIKit still posts aggregate UIApplication notifications used by App's
// pause/resume listeners; do not post duplicates from these scene callbacks.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        forwardURLs(connectionOptions.urlContexts)
        for activity in connectionOptions.userActivities {
            forwardActivity(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        forwardURLs(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forwardActivity(userActivity)
    }

    private func forwardURLs(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace
            ]
            if let source = context.options.sourceApplication {
                options[.sourceApplication] = source
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: options
            )
        }
    }

    private func forwardActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: activity, restorationHandler: { _ in }
        )
    }
}
