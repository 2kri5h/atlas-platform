# ATLAS Android Application — Release & Deployment Guide

## 1. Quick Start: Automated Cloud Builds (Free with GitHub Actions)

We have configured a complete, automated GitHub Actions workflow in [`.github/workflows/android-build.yml`](file:///.github/workflows/android-build.yml) that builds your Android app for **free** on GitHub's cloud runners without requiring Android Studio or Java installed locally.

### How to generate an APK / AAB automatically:
1. Push your commits to the `main` branch, OR
2. Go to your GitHub repository -> **Actions** tab -> **Build Android App** -> Click **Run workflow**.
3. Once completed (takes ~3-4 minutes), download the artifacts:
   - `atlas-debug-apk`: Ready to install directly on your Android phone for testing.
   - `atlas-release-bundle`: Production Android App Bundle (`.aab`) ready for Google Play Console submission.

---

## 2. Local Development & Building (Optional)

If you have or choose to install Android Studio on your development machine:

### Prerequisites
- **Android Studio Hedgehog or newer** (includes Android SDK & Java 17)
- **Node.js 20+**

### Local Build Commands
```bash
# 1. Build and sync web assets to Android
cd frontend
npm run cap:build

# 2. Open the project in Android Studio
npm run cap:open
```

In Android Studio:
- Select **Build > Build Bundle(s) / APK(s) > Build APK(s)** for a debug APK.
- Select **Build > Generate Signed Bundle / APK** for a production Play Store release.

---

## 3. Play Store Release Signing (Production)

To sign the release Android App Bundle (`.aab`) for Google Play Store upload:

### Step 1: Generate a Keystore
```bash
keytool -genkey -v -keystore atlas-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias atlas
```

### Step 2: Configure Gradle Signing
In `frontend/android/app/build.gradle`:
```groovy
android {
    signingConfigs {
        release {
            storeFile file("path/to/atlas-release-key.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "atlas"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 3: Build Signed Bundle
```bash
cd frontend/android
./gradlew bundleRelease
```
The output `.aab` will be located at:
`frontend/android/app/build/outputs/bundle/release/app-release.aab`
Upload this bundle to the **Google Play Console** under **Internal Testing**, **Closed Testing**, or **Production**.
