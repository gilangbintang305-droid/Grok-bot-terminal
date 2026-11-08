plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.grokbot"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.grokbot"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "2.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("org.bouncycastle:bcprov-jdk18on:1.78.1")
}
