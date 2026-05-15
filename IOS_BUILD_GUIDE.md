# Evident iOS App Build Guide

This guide explains how to build and submit Evident to the Apple App Store.

## Prerequisites

1. **Apple Developer Account** - Sign up at https://developer.apple.com ($99/year)
2. **Mac computer** with Xcode 15+ installed (or use MacInCloud)
3. **Node.js** 18+ installed on your Mac

## Step 1: Download the Project

Download or clone this project to your Mac.

## Step 2: Install Dependencies

```bash
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
```

This creates the `ios/` folder with the Xcode project.

## Step 5: Sync Changes

After any web build, sync the changes:

```bash
npx cap sync ios
```

## Step 6: Open in Xcode

```bash
npx cap open ios
```

## Step 7: Configure in Xcode

1. **Team & Signing**: Select your Apple Developer team in Signing & Capabilities
2. **Bundle Identifier**: Set to `com.yourcompany.evident` (must be unique)
3. **App Icons**: Add your 1024x1024 icon in Assets.xcassets
4. **Display Name**: Set to "Evident"

## Step 8: Add Required Capabilities

In Xcode, go to Signing & Capabilities and add:
- **Push Notifications** (for alerts)
- **Background Modes** > Background fetch (for sync)

## Step 9: Test on Simulator/Device

1. Select a simulator (iPhone 15, etc.) or connect your device
2. Click the Play button to build and run
3. Test all features thoroughly

## Step 10: Archive for App Store

1. Select "Any iOS Device" as the build target
2. Go to Product > Archive
3. Once archived, click "Distribute App"
4. Choose "App Store Connect"
5. Follow the prompts to upload

## Step 11: Submit in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Create a new app with your bundle ID
3. Fill out app information:
   - **Name**: Evident
   - **Description**: AI-powered document assistant with evidence-based answers
   - **Category**: Productivity or Business
   - **Keywords**: documents, AI, assistant, evidence, search
4. Upload screenshots (required sizes: iPhone 6.7", 6.5", 5.5")
5. Add your privacy policy URL
6. Submit for review

## App Store Review Tips

Apple requires apps to have "native functionality" beyond a website wrapper. Evident includes:

- **Push Notifications** - For document processing alerts
- **Splash Screen** - Native loading experience
- **Status Bar** - Styled to match the app
- **Offline Handling** - Error states when disconnected
- **Native Navigation** - App-like interface

## Updating the App

When you make changes:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Then archive and submit a new version.

## Troubleshooting

### "No signing certificate" error
- Ensure you're signed into Xcode with your Apple ID
- Go to Xcode > Settings > Accounts and add your Apple Developer account

### "Provisioning profile" issues
- In Signing & Capabilities, enable "Automatically manage signing"
- Select your Team

### Build fails
- Clean the build: Product > Clean Build Folder
- Close Xcode and run `npx cap sync ios` again

## Need Help?

Refer to:
- Capacitor iOS docs: https://capacitorjs.com/docs/ios
- Apple Developer docs: https://developer.apple.com/documentation/
- App Store Connect Help: https://developer.apple.com/help/app-store-connect/
