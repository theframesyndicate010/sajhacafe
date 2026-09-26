plugins { id("com.android.application") }

val pwaUrl = providers.gradleProperty("pwaUrl").orElse("http://10.0.2.2:3001").get()

android {
    namespace = "com.sajhacafe.mobile"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sajhacafe.mobile"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "PWA_URL", "\"$pwaUrl\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes {
        debug { manifestPlaceholders["allowCleartext"] = "true" }
        release {
            isMinifyEnabled = true
            manifestPlaceholders["allowCleartext"] = "false"
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("androidx.activity:activity:1.13.0")
}
