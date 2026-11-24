plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ridedash.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ridedash.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// Automatically sync shared Web Frontend from repo root into Android assets/www before every build
val syncWebAssets by tasks.registering(Sync::class) {
    from(rootProject.projectDir.parentFile) {
        include("index.html", "display.html", "manifest.json", "sw.js")
        include("css/**")
        include("js/**")
        include("icons/**")
    }
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
