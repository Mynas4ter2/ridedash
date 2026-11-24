# Keep RideDash JavaScript interface methods intact
-keepclassmembers class com.ridedash.app.RideDashBridge {
    @android.webkit.JavascriptInterface <methods>;
}
