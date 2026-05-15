# Evident iOS App Store Deployment Guide

This guide walks you through submitting Evident to the Apple App Store.

## Quick Checklist

Before submitting, ensure you have:
- [ ] Apple Developer Account ($99/year)
- [ ] Mac with Xcode 15+
- [ ] Firebase project configured with `GoogleService-Info.plist`
- [ ] App icons (1024x1024 master + all sizes)
- [ ] Screenshots for all required device sizes
- [ ] Privacy policy accessible at https://evident-ai.net/privacy
- [ ] App description and keywords prepared

## Prerequisites

1. **Apple Developer Account** - Enroll at [developer.apple.com](https://developer.apple.com) ($99/year)
2. **Mac with Xcode 15+** - Required for iOS builds
3. **Node.js 18+** on your Mac

## Step 1: Download Project Files

Download the entire Evident project from Replit to your Mac.

## Step 2: Install Dependencies

```bash
cd Evident
npm install
```

## Step 3: Build the Web App

```bash
npm run build
```

This creates the production build in `dist/public/`.

## Step 4: Add iOS Platform

```bash
npx cap add ios
npx cap sync ios
```

This creates the `ios/` folder with the Xcode project.

## Step 5: Open in Xcode

```bash
npx cap open ios
```

## Step 6: Configure Xcode Project

### App Identity
1. Select the **App** target in Xcode
2. Go to **Signing & Capabilities**
3. Select your **Team** (Apple Developer account)
4. Set **Bundle Identifier**: `com.evident.app`

### App Icons
Create app icons in these sizes and add to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`:
- 20x20, 29x29, 40x40, 60x60, 76x76, 83.5x83.5, 1024x1024 (various @2x, @3x)

Use a tool like [App Icon Generator](https://appicon.co/) to create all sizes from a single 1024x1024 image.

### Splash Screen
The splash screen is configured in `capacitor.config.ts`. To customize:
1. Replace images in `ios/App/App/Assets.xcassets/Splash.imageset/`
2. Or configure LaunchScreen.storyboard in Xcode

### Info.plist Settings
In `ios/App/App/Info.plist`, ensure these are set:
- `CFBundleDisplayName`: Evident
- `CFBundleShortVersionString`: 1.0.0
- `CFBundleVersion`: 1

Add privacy descriptions if using device features:
```xml
<key>NSCameraUsageDescription</key>
<string>Evident uses the camera to capture documents for analysis</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Evident accesses photos to upload documents for analysis</string>
<key>NSMicrophoneUsageDescription</key>
<string>Evident uses the microphone for voice input</string>
```

## Step 6.5: Configure Firebase Analytics & Crashlytics

Evident uses Firebase for analytics and crash reporting. Follow these steps to set up Firebase for your iOS app.

### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project** and name it "Evident"
3. Enable Google Analytics when prompted

### Add iOS App to Firebase
1. In Firebase Console, click **Add App** > **iOS**
2. Enter Bundle ID: `com.evident.app`
3. Download `GoogleService-Info.plist`
4. Place it in `ios/App/App/` directory
5. In Xcode, right-click the `App` folder > **Add Files to "App"**
6. Select `GoogleService-Info.plist` and ensure "Copy items if needed" is checked

### Enable Crashlytics
1. In Firebase Console, go to **Crashlytics**
2. Click **Enable Crashlytics**
3. Follow the prompts to complete setup

### Configure Environment Variables (Web)
For the web version, add these to your Replit Secrets or `.env` file:
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

You can find these values in Firebase Console > Project Settings > General > Your apps.

### Sync Capacitor After Firebase Setup
After adding `GoogleService-Info.plist`, sync Capacitor to ensure native plugins pick up the changes:
```bash
npx cap sync ios
```

### Verify Analytics Setup
After building and running the app:
1. In Firebase Console, go to **Analytics** > **DebugView**
2. Enable debug mode on your test device
3. Trigger some events (upload a file, ask a question)
4. Verify events appear in DebugView

## Step 7: Test on Device

1. Connect your iPhone via USB
2. Select your device in Xcode
3. Click **Run** (Play button)
4. Trust the developer certificate on your iPhone (Settings > General > Device Management)

## Step 8: Create App Store Connect Record

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - Platform: iOS
   - Name: Evident
   - Primary Language: English
   - Bundle ID: com.evident.app
   - SKU: evident-app-001

## Step 9: Prepare App Store Listing

Required assets:
- **App Screenshots**: 6.7" (1290x2796), 6.5" (1284x2778), 5.5" (1242x2208)
- **App Icon**: 1024x1024 (no transparency, no rounded corners)
- **Description**: Up to 4000 characters
- **Keywords**: Up to 100 characters
- **Support URL**: https://evident-ai.net
- **Privacy Policy URL**: https://evident-ai.net/privacy (create this page)
- **Marketing URL**: https://evident-ai.net

### Suggested Description
```
Evident is your AI-powered document assistant that provides answers backed by evidence from your own files.

FEATURES:
- Upload PDFs, Word docs, images, audio, and video files
- Ask questions and get AI-powered answers with citations
- Every answer references the exact source in your documents
- Extract obligations and checklists from contracts
- Generate detailed reports from your document library

YOUR DATA STAYS PRIVATE:
Evident works exclusively with your uploaded files. No external data, no guessing - just evidence-based answers you can trust.

Perfect for:
- Legal professionals reviewing contracts
- Researchers analyzing documents
- Business teams managing policies
- Anyone who needs trustworthy answers from their files
```

## Step 10: Archive and Upload

1. In Xcode, select **Product** > **Archive**
2. Once complete, click **Distribute App**
3. Select **App Store Connect** > **Upload**
4. Follow prompts to upload

## Step 11: App Privacy Details (App Store Connect)

Apple requires you to declare what data your app collects. In App Store Connect:

### Data Types to Declare

1. **Analytics** (Data Used to Track You: No, Data Linked to You: No)
   - Usage Data: App interactions, feature usage
   - Diagnostics: Crash logs, performance data

2. **Identifiers** (If using Replit Auth)
   - User ID: Account identifier

3. **Contact Info** (If collecting email)
   - Email Address: For account creation

### App Tracking Transparency

Evident does NOT track users across other apps, so you can declare:
- "This app does not track users"

## Step 12: Submit for Review

1. In App Store Connect, go to your app
2. Add all required metadata and screenshots
3. Complete App Privacy questionnaire
4. Click **Submit for Review**

Apple typically reviews apps within 24-48 hours.

### Review Notes

Include these notes for Apple reviewers:
```
Evident is a document analysis app. To test:
1. Create an account using Replit authentication
2. Upload a PDF or document
3. Ask a question about the document content

No special credentials required for testing.
```

## Capacitor Config Reference

Your current `capacitor.config.ts`:
```typescript
{
  appId: 'com.evident.app',
  appName: 'Evident',
  webDir: 'dist/public',
  server: {
    iosScheme: 'https',
    hostname: 'evident-ai.net'
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#1a1a2e'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1a1a2e",
      iosSpinnerStyle: "small"
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#1a1a2e"
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true
    }
  }
}
```

## Troubleshooting

### Build fails with signing error
- Ensure you've selected your Apple Developer Team in Xcode
- Check that your Bundle ID matches App Store Connect

### App crashes on launch
- Check `npx cap sync ios` was run after build
- Verify `dist/public/` contains the built files

### White screen on launch
- Run `npx cap sync ios` to ensure latest web files are copied
- Check browser console in Safari Web Inspector for errors

## Version Updates

For future updates:
1. Update version in `package.json`
2. Run `npm run build`
3. Run `npx cap sync ios`
4. Increment version in Xcode (CFBundleShortVersionString and CFBundleVersion)
5. Archive and upload
