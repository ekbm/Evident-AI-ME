# Evident iOS App - Swift Installation Guide

## Overview
Native iOS app that wraps the evident-ai.net website in a WKWebView with full StoreKit 2 in-app purchase support. Designed for simpler App Store approval.

## Project Details
- **Bundle ID**: `com.evident.assistant`
- **Version**: 1.6 (Build 25)
- **Deployment Target**: iOS 15.0+
- **Devices**: iPhone and iPad

## Quick Start - Terminal Commands (macOS)

Copy and paste each block into Terminal on your Mac:

---

### Step 0: Clean up old folder (if exists)
```bash
rm -rf ~/Desktop/EvidentAI
```

---

### Step 1: Create folder structure
```bash
cd ~/Desktop
mkdir -p EvidentAI/EvidentAI/Assets.xcassets/AppIcon.appiconset
mkdir -p EvidentAI/EvidentAI/Assets.xcassets/AccentColor.colorset
mkdir -p EvidentAI/EvidentAI/Base.lproj
mkdir -p EvidentAI/EvidentAI.xcodeproj
```

---

### Step 2: Create AppDelegate.swift
```bash
cat > ~/Desktop/EvidentAI/EvidentAI/AppDelegate.swift << 'EOF'
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = WebViewController()
        window?.makeKeyAndVisible()
        return true
    }
}
EOF
```

---

### Step 3: Create WebViewController.swift (Full StoreKit 2 + iOS Detection)
```bash
cat > ~/Desktop/EvidentAI/EvidentAI/WebViewController.swift << 'EOF'
import UIKit
import WebKit
import AVFoundation
import StoreKit

class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    
    private var webView: WKWebView!
    private var loadingView: UIView!
    private var spinner: UIActivityIndicatorView!
    
    private let productIDs: Set<String> = [
        "com.evident.assistant.sub.core.lite.monthly",
        "com.evident.assistant.sub.core.scholar.monthly",
        "com.evident.assistant.sub.core.advanced.monthly",
        "com.evident.assistant.sub.core.max.monthly",
        "com.evident.assistant.sub.storage.5gb.monthly",
        "com.evident.assistant.sub.storage.10gb.monthly",
        "com.evident.assistant.sub.storage.25gb.monthly"
    ]
    private var products: [Product] = []
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupLoadingView()
        setupWebView()
        loadWebsite()
        loadProducts()
    }
    
    private func loadProducts() {
        Task { await loadProductsAsync() }
    }
    
    private func loadProductsAsync() async {
        for attempt in 1...3 {
            do {
                products = try await Product.products(for: productIDs)
                print("[StoreKit] Attempt \(attempt): Loaded \(products.count) products")
                if !products.isEmpty { return }
                if attempt < 3 { try? await Task.sleep(nanoseconds: 2_000_000_000) }
            } catch {
                print("[StoreKit] Attempt \(attempt) failed: \(error)")
                if attempt < 3 { try? await Task.sleep(nanoseconds: 2_000_000_000) }
            }
        }
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "subscribe", let productId = message.body as? String {
            print("[StoreKit] Subscribe requested for: \(productId)")
            purchaseProduct(productId: productId)
        }
    }
    
    private func purchaseProduct(productId: String) {
        if products.isEmpty {
            Task {
                do {
                    products = try await Product.products(for: productIDs)
                    await attemptPurchase(productId: productId)
                } catch {
                    DispatchQueue.main.async { self.showPurchaseError("Unable to load products.") }
                }
            }
            return
        }
        Task { await attemptPurchase(productId: productId) }
    }
    
    private func attemptPurchase(productId: String) async {
        guard let product = products.first(where: { $0.id == productId }) else {
            DispatchQueue.main.async { self.showPurchaseError("Product not available.") }
            return
        }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    await transaction.finish()
                    DispatchQueue.main.async {
                        self.webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('iospurchase', { detail: { success: true, productId: '\(transaction.productID)' } }));", completionHandler: nil)
                    }
                    showPurchaseSuccess()
                case .unverified(_, _):
                    showPurchaseError("Purchase could not be verified.")
                }
            case .userCancelled: break
            case .pending: showPurchasePending()
            @unknown default: break
            }
        } catch {
            showPurchaseError("Purchase failed: \(error.localizedDescription)")
        }
    }
    
    private func showPurchaseSuccess() {
        DispatchQueue.main.async {
            let alert = UIAlertController(title: "Success!", message: "Your subscription is now active.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in self.webView.reload() })
            self.present(alert, animated: true)
        }
    }
    
    private func showPurchaseError(_ message: String) {
        DispatchQueue.main.async {
            let alert = UIAlertController(title: "Purchase Error", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alert, animated: true)
        }
    }
    
    private func showPurchasePending() {
        DispatchQueue.main.async {
            let alert = UIAlertController(title: "Purchase Pending", message: "Your purchase is awaiting approval.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alert, animated: true)
        }
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView.frame = view.bounds
        loadingView.frame = view.bounds
    }
    
    private func setupLoadingView() {
        loadingView = UIView(frame: view.bounds)
        loadingView.backgroundColor = UIColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1)
        loadingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        let titleLabel = UILabel()
        titleLabel.text = "Evident"
        titleLabel.font = UIFont.systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = UIColor(red: 59/255, green: 130/255, blue: 246/255, alpha: 1)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        loadingView.addSubview(titleLabel)
        
        spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        loadingView.addSubview(spinner)
        
        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor, constant: -20),
            spinner.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 24)
        ])
        
        view.addSubview(loadingView)
    }
    
    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        let contentController = WKUserContentController()
        contentController.add(self, name: "subscribe")
        contentController.addUserScript(WKUserScript(source: "window.__EVIDENT_IOS_APP__ = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = contentController
        
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        config.defaultWebpagePreferences = preferences
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.backgroundColor = UIColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1)
        webView.isOpaque = false
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        
        view.insertSubview(webView, belowSubview: loadingView)
    }
    
    private func loadWebsite() {
        guard let url = URL(string: "https://evident-ai.net/?ios=1") else { return }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("window.__EVIDENT_IOS_APP__ = true;", completionHandler: nil)
        UIView.animate(withDuration: 0.3) { self.loadingView.alpha = 0 } completion: { _ in self.loadingView.isHidden = true }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showError() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showError() }
    
    private func showError() {
        let alert = UIAlertController(title: "Connection Error", message: "Unable to load Evident. Please check your internet connection.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in self.loadWebsite() })
        present(alert, animated: true)
    }
    
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        if let scheme = url.scheme, !["http", "https", "about", "blob", "data"].contains(scheme.lowercased()) {
            if UIApplication.shared.canOpenURL(url) { UIApplication.shared.open(url, options: [:], completionHandler: nil) }
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
    
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle { return .darkContent }
}
EOF
```

---

### Step 4: Create Info.plist
```bash
cat > ~/Desktop/EvidentAI/EvidentAI/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>Evident</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.6</string>
    <key>CFBundleVersion</key>
    <string>25</string>
    <key>ITSAppUsesNonExemptEncryption</key>
    <false/>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>NSCameraUsageDescription</key>
    <string>Evident needs camera access to scan and upload documents</string>
    <key>NSMicrophoneUsageDescription</key>
    <string>Evident needs microphone access for audio recording</string>
    <key>NSPhotoLibraryUsageDescription</key>
    <string>Evident needs photo library access to upload documents and images</string>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>armv7</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
</dict>
</plist>
EOF
```

---

### Step 5: Create LaunchScreen.storyboard
```bash
cat > ~/Desktop/EvidentAI/EvidentAI/Base.lproj/LaunchScreen.storyboard << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="21701" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <scenes>
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" horizontalHuggingPriority="251" verticalHuggingPriority="251" text="Evident" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="title-label">
                                <rect key="frame" x="146.66666666666666" y="416" width="100" height="21"/>
                                <fontDescription key="fontDescription" type="boldSystem" pointSize="28"/>
                                <color key="textColor" red="0.23137254901960785" green="0.50980392156862742" blue="0.96470588235294119" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                            </label>
                        </subviews>
                        <color key="backgroundColor" red="0.97254901960784312" green="0.98039215686274506" blue="0.9882352941176471" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            <constraint firstItem="title-label" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="centerX"/>
                            <constraint firstItem="title-label" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" id="centerY"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
</document>
EOF
```

---

### Step 6: Create Assets catalog
```bash
cat > ~/Desktop/EvidentAI/EvidentAI/Assets.xcassets/Contents.json << 'EOF'
{"info":{"author":"xcode","version":1}}
EOF

cat > ~/Desktop/EvidentAI/EvidentAI/Assets.xcassets/AppIcon.appiconset/Contents.json << 'EOF'
{"images":[{"idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
EOF

cat > ~/Desktop/EvidentAI/EvidentAI/Assets.xcassets/AccentColor.colorset/Contents.json << 'EOF'
{"colors":[{"color":{"color-space":"srgb","components":{"alpha":"1.000","blue":"0.965","green":"0.510","red":"0.231"}},"idiom":"universal"}],"info":{"author":"xcode","version":1}}
EOF
```

---

### Step 7: Create project.pbxproj (Xcode Project File)
```bash
cat > ~/Desktop/EvidentAI/EvidentAI.xcodeproj/project.pbxproj << 'EOF'
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
		1A0000000000000000000001 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1A0000000000000000000011; };
		1A0000000000000000000002 /* WebViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1A0000000000000000000012; };
		1A0000000000000000000003 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 1A0000000000000000000013; };
		1A0000000000000000000004 /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = 1A0000000000000000000014; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		1A0000000000000000000010 /* EvidentAI.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = EvidentAI.app; sourceTree = BUILT_PRODUCTS_DIR; };
		1A0000000000000000000011 /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
		1A0000000000000000000012 /* WebViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WebViewController.swift; sourceTree = "<group>"; };
		1A0000000000000000000013 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
		1A0000000000000000000015 /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
		1A0000000000000000000016 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		1A000000000000000000000D /* Frameworks */ = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		1A0000000000000000000007 = {
			isa = PBXGroup;
			children = (
				1A0000000000000000000020 /* EvidentAI */,
				1A000000000000000000001F /* Products */,
			);
			sourceTree = "<group>";
		};
		1A000000000000000000001F /* Products */ = {
			isa = PBXGroup;
			children = (
				1A0000000000000000000010 /* EvidentAI.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
		1A0000000000000000000020 /* EvidentAI */ = {
			isa = PBXGroup;
			children = (
				1A0000000000000000000011 /* AppDelegate.swift */,
				1A0000000000000000000012 /* WebViewController.swift */,
				1A0000000000000000000013 /* Assets.xcassets */,
				1A0000000000000000000014 /* LaunchScreen.storyboard */,
				1A0000000000000000000016 /* Info.plist */,
			);
			path = EvidentAI;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		1A000000000000000000000F /* EvidentAI */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 1A0000000000000000000024 /* Build configuration list for PBXNativeTarget "EvidentAI" */;
			buildPhases = (
				1A000000000000000000000C /* Sources */,
				1A000000000000000000000D /* Frameworks */,
				1A000000000000000000000E /* Resources */,
			);
			buildRules = ();
			dependencies = ();
			name = EvidentAI;
			productName = EvidentAI;
			productReference = 1A0000000000000000000010 /* EvidentAI.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		1A0000000000000000000008 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1500;
				LastUpgradeCheck = 1500;
				TargetAttributes = {
					1A000000000000000000000F = {
						CreatedOnToolsVersion = 15.0;
					};
				};
			};
			buildConfigurationList = 1A000000000000000000000B /* Build configuration list for PBXProject "EvidentAI" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = 1A0000000000000000000007;
			productRefGroup = 1A000000000000000000001F /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				1A000000000000000000000F /* EvidentAI */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		1A000000000000000000000E /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				1A0000000000000000000003 /* Assets.xcassets in Resources */,
				1A0000000000000000000004 /* LaunchScreen.storyboard in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		1A000000000000000000000C /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				1A0000000000000000000001 /* AppDelegate.swift in Sources */,
				1A0000000000000000000002 /* WebViewController.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin PBXVariantGroup section */
		1A0000000000000000000014 /* LaunchScreen.storyboard */ = {
			isa = PBXVariantGroup;
			children = (
				1A0000000000000000000015 /* Base */,
			);
			name = LaunchScreen.storyboard;
			sourceTree = "<group>";
		};
/* End PBXVariantGroup section */

/* Begin XCBuildConfiguration section */
		1A0000000000000000000021 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_ENABLE_OBJC_WEAK = YES;
				CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_COMMA = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
				CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
				CLANG_WARN_DOCUMENTATION_COMMENTS = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
				CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
				CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
				CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
				CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
				CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
				CLANG_WARN_STRICT_PROTOTYPES = YES;
				CLANG_WARN_SUSPICIOUS_MOVE = YES;
				CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_TESTABILITY = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_DYNAMIC_NO_PIC = NO;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_OPTIMIZATION_LEVEL = 0;
				GCC_PREPROCESSOR_DEFINITIONS = (
					"DEBUG=1",
					"$(inherited)",
				);
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				MTL_FAST_MATH = YES;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
			};
			name = Debug;
		};
		1A0000000000000000000022 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_ENABLE_OBJC_WEAK = YES;
				CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_COMMA = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
				CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
				CLANG_WARN_DOCUMENTATION_COMMENTS = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
				CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
				CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
				CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
				CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
				CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
				CLANG_WARN_STRICT_PROTOTYPES = YES;
				CLANG_WARN_SUSPICIOUS_MOVE = YES;
				CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
				MTL_ENABLE_DEBUG_INFO = NO;
				MTL_FAST_MATH = YES;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		1A0000000000000000000025 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 25;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = EvidentAI/Info.plist;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchStoryboardName = LaunchScreen;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.6;
				PRODUCT_BUNDLE_IDENTIFIER = "com.evident.assistant";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		1A0000000000000000000026 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 25;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = EvidentAI/Info.plist;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchStoryboardName = LaunchScreen;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.6;
				PRODUCT_BUNDLE_IDENTIFIER = "com.evident.assistant";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		1A000000000000000000000B /* Build configuration list for PBXProject "EvidentAI" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				1A0000000000000000000021 /* Debug */,
				1A0000000000000000000022 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		1A0000000000000000000024 /* Build configuration list for PBXNativeTarget "EvidentAI" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				1A0000000000000000000025 /* Debug */,
				1A0000000000000000000026 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = 1A0000000000000000000008 /* Project object */;
}
EOF
```

---

### Step 8: Open project in Xcode
```bash
open ~/Desktop/EvidentAI/EvidentAI.xcodeproj
```

---

### Step 9: Configure in Xcode

In Xcode:
1. Select the **EvidentAI** target in the left sidebar
2. Go to **Signing & Capabilities** tab
3. Set your **Team** (your Apple Developer account)
4. Verify **Bundle Identifier** is: `com.evident.assistant`
5. Click **+ Capability** button → Add **In-App Purchase**

---

### Step 10: Add App Icon and Build

1. Drag your 1024x1024 app icon PNG into `Assets.xcassets/AppIcon.appiconset`
2. Connect your iPhone/iPad or select a Simulator
3. Press **⌘R** to Build and Run

---

## StoreKit Product IDs (App Store Connect)

Configure these in App Store Connect → In-App Purchases:

| Product ID | Plan Name | Price |
|------------|-----------|-------|
| `com.evident.assistant.sub.core.lite.monthly` | Evident Lite | $5/mo |
| `com.evident.assistant.sub.core.scholar.monthly` | Evident Scholar | $29/mo |
| `com.evident.assistant.sub.core.advanced.monthly` | Evident Advanced | $39/mo |
| `com.evident.assistant.sub.core.max.monthly` | Evident Max | $99/mo |
| `com.evident.assistant.sub.storage.5gb.monthly` | Lite Pack (+5GB) | $2/mo |
| `com.evident.assistant.sub.storage.10gb.monthly` | Standard Pack (+10GB) | $4/mo |
| `com.evident.assistant.sub.storage.25gb.monthly` | Pro Pack (+25GB) | $8/mo |

---

## iOS Detection

The web app detects it's running in the iOS app via:
1. URL parameter `?ios=1` (most reliable)
2. `window.__EVIDENT_IOS_APP__` flag (injected at document start)
3. `window.webkit.messageHandlers.subscribe` presence

---

## Debugging

Watch Xcode console for logs:
- `[StoreKit] Attempt 1: Loaded X products...` - Product loading status
- `[StoreKit] Subscribe requested for: ...` - Purchase requests

---

## Troubleshooting

### Products not loading
- Ensure products are configured in App Store Connect with status "Ready to Submit"
- Ensure In-App Purchase capability is added in Xcode
- Check that Bundle ID matches App Store Connect

### Purchase button not working
- Verify `webkit.messageHandlers.subscribe` is registered
- Check web app sends correct product ID format
- Check Xcode console for StoreKit errors
