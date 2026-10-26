import UIKit
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// Custom CAPBridgeViewController that registers native SlackAuthPlugin
public class AppBridgeViewController: CAPBridgeViewController {
    public override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SlackAuthPlugin())
    }
}

// Native iOS Slack SSO Authentication plugin
@objc(SlackAuthPlugin)
public class SlackAuthPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "SlackAuthPlugin"
    public let jsName = "SlackAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise)
    ]

    private var activeCall: CAPPluginCall?
    private var loginWebView: WKWebView?
    private var modalNavController: UINavigationController?
    private var pollTimer: Timer?
    private var isResolved = false
    private var hasRedirectedToApp = false

    private let desktopUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"

    @objc func login(_ call: CAPPluginCall) {
        self.activeCall = call
        self.isResolved = false
        self.hasRedirectedToApp = false

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let startUrl = call.getString("workspaceUrl") ?? "https://picnic.enterprise.slack.com"
            self.presentLoginModal(startUrl: startUrl)
        }
    }

    @objc func logout(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let cookies = HTTPCookieStorage.shared.cookies {
                for cookie in cookies {
                    HTTPCookieStorage.shared.deleteCookie(cookie)
                }
            }
            URLCache.shared.removeAllCachedResponses()

            let dataStore = WKWebsiteDataStore.default()
            dataStore.httpCookieStore.getAllCookies { cookies in
                for cookie in cookies {
                    dataStore.httpCookieStore.delete(cookie, completionHandler: nil)
                }
            }
            dataStore.removeData(
                ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                modifiedSince: Date(timeIntervalSince1970: 0)
            ) {
                call.resolve(["ok": true])
            }
        }
    }

    private func presentLoginModal(startUrl: String) {
        guard let parentVC = self.bridge?.viewController else {
            activeCall?.reject("Geen view controller gevonden")
            return
        }

        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.customUserAgent = desktopUserAgent
        wv.navigationDelegate = self
        self.loginWebView = wv

        let webVC = UIViewController()
        webVC.view.backgroundColor = UIColor(red: 18/255, green: 19/255, blue: 22/255, alpha: 1.0)
        webVC.title = "Picnic Slack Inloggen"

        wv.translatesAutoresizingMaskIntoConstraints = false
        webVC.view.addSubview(wv)
        NSLayoutConstraint.activate([
            wv.topAnchor.constraint(equalTo: webVC.view.safeAreaLayoutGuide.topAnchor),
            wv.leadingAnchor.constraint(equalTo: webVC.view.leadingAnchor),
            wv.trailingAnchor.constraint(equalTo: webVC.view.trailingAnchor),
            wv.bottomAnchor.constraint(equalTo: webVC.view.bottomAnchor)
        ])

        let closeBtn = UIBarButtonItem(title: "Sluiten", style: .plain, target: self, action: #selector(closeTapped))
        closeBtn.tintColor = UIColor(red: 96/255, green: 165/255, blue: 250/255, alpha: 1.0)
        webVC.navigationItem.leftBarButtonItem = closeBtn

        let nav = UINavigationController(rootViewController: webVC)
        nav.modalPresentationStyle = .fullScreen
        nav.navigationBar.barStyle = .black
        nav.navigationBar.isTranslucent = false
        nav.navigationBar.backgroundColor = UIColor(red: 26/255, green: 27/255, blue: 32/255, alpha: 1.0)
        nav.navigationBar.titleTextAttributes = [.foregroundColor: UIColor.white]

        self.modalNavController = nav
        parentVC.present(nav, animated: true) { [weak self] in
            if let url = URL(string: startUrl) {
                self?.loginWebView?.load(URLRequest(url: url))
                self?.startSniffing()
            }
        }
    }

    @objc private func closeTapped() {
        if !isResolved {
            isResolved = true
            stopSniffing()
            activeCall?.reject("Login geannuleerd")
        }
        modalNavController?.dismiss(animated: true, completion: nil)
    }

    private func startSniffing() {
        stopSniffing()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] _ in
            self?.checkTokensAndCookies()
        }
    }

    private func stopSniffing() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        checkTokensAndCookies()
    }

    private func checkTokensAndCookies() {
        guard !isResolved, let wv = self.loginWebView else { return }

        let currentUrl = wv.url?.absoluteString ?? ""

        // Extract cookie d
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { [weak self] cookies in
            guard let self = self, !self.isResolved else { return }

            var dCookie: String? = nil
            for cookie in cookies {
                if cookie.name == "d" && (cookie.value.starts(with: "xoxd-") || !cookie.value.isEmpty) {
                    dCookie = cookie.value
                    break
                }
            }

            if let _ = dCookie, !self.hasRedirectedToApp {
                if currentUrl.contains("/ssb/redirect") || currentUrl.contains("/launch") || currentUrl.contains("/messages") {
                    self.hasRedirectedToApp = true
                    if let appUrl = URL(string: "https://app.slack.com/client/E088RCNNJN8/CAM2MJTA9") {
                        self.loginWebView?.load(URLRequest(url: appUrl))
                    }
                }
            }

            let js = """
            (function() {
              var token = null;
              try {
                var cfg = JSON.parse(localStorage.getItem('localConfig_v2') || '{}');
                if (cfg.teams) {
                  var tId = Object.keys(cfg.teams)[0];
                  token = cfg.teams[tId]?.token;
                }
              } catch(e) {}
              if (!token) {
                for (var i = 0; i < localStorage.length; i++) {
                  var val = localStorage.getItem(localStorage.key(i));
                  var m = val && typeof val === 'string' && val.match(/xoxc-[A-Za-z0-9-]+/);
                  if (m) { token = m[0]; break; }
                }
              }
              if (!token && window.TS && window.TS.boot_data && window.TS.boot_data.api_token) {
                token = window.TS.boot_data.api_token;
              }
              return token || '';
            })()
            """

            wv.evaluateJavaScript(js) { [weak self] (result, error) in
                guard let self = self, !self.isResolved else { return }

                if let token = result as? String, token.starts(with: "xoxc-"), let dCookie = dCookie {
                    self.isResolved = true
                    self.stopSniffing()

                    DispatchQueue.main.async {
                        self.modalNavController?.dismiss(animated: true) {
                            self.activeCall?.resolve([
                                "token": token,
                                "cookie": dCookie,
                                "workspaceUrl": "https://picnic.enterprise.slack.com"
                            ])
                        }
                    }
                }
            }
        }
    }
}
