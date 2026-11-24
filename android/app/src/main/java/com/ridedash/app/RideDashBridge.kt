package com.ridedash.app

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class RideDashBridge(
    private val webView: WebView,
    private val listener: NativeActionListener
) {
    interface NativeActionListener {
        fun onScanQrRequested()
        fun onConnectBike(qrPayload: String)
        fun onDisconnectBike()
        fun onStreamConfigUpdated(config: JSONObject)
        fun onLaunchApp(appId: String, packageName: String)
        fun onHandlebarMapUpdated(map: JSONObject)
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    // ===== Called from JS via window.RideDashNative =====

    @JavascriptInterface
    fun scanQr() {
        mainHandler.post { listener.onScanQrRequested() }
    }

    @JavascriptInterface
    fun connectBike(qrPayload: String) {
        mainHandler.post { listener.onConnectBike(qrPayload) }
    }

    @JavascriptInterface
    fun disconnectBike() {
        mainHandler.post { listener.onDisconnectBike() }
    }

    @JavascriptInterface
    fun updateStreamConfig(configJson: String) {
        val obj = runCatching { JSONObject(configJson) }.getOrDefault(JSONObject())
        mainHandler.post { listener.onStreamConfigUpdated(obj) }
    }

    @JavascriptInterface
    fun launchApp(appId: String, packageName: String) {
        mainHandler.post { listener.onLaunchApp(appId, packageName) }
    }

    @JavascriptInterface
    fun setHandlebarMap(mapJson: String) {
        val obj = runCatching { JSONObject(mapJson) }.getOrDefault(JSONObject())
        mainHandler.post { listener.onHandlebarMapUpdated(obj) }
    }

    // ===== Push Native Events into JS via window.RideDashBridge =====

    fun pushConnectionState(
        state: String,
        bikeName: String = "Zontes 368K",
        ip: String = "",
        message: String = "",
        reconnects: Int = 0
    ) {
        val json = JSONObject().apply {
            put("state", state)
            put("bikeName", bikeName)
            put("ip", ip)
            put("message", message)
            put("reconnects", reconnects)
        }
        evalJs("window.RideDashBridge && window.RideDashBridge.onConnectionState($json)")
    }

    fun pushTelemetry(
        fps: Int,
        latencyMs: Int,
        tempC: Int,
        bitrateMbps: Double,
        reconnects: Int = 0
    ) {
        val json = JSONObject().apply {
            put("fps", fps)
            put("latencyMs", latencyMs)
            put("tempC", tempC)
            put("bitrateMbps", bitrateMbps)
            put("reconnects", reconnects)
        }
        evalJs("window.RideDashBridge && window.RideDashBridge.onTelemetry($json)")
    }

    fun pushGps(
        lat: Double,
        lng: Double,
        speedKmh: Float,
        heading: Float,
        accuracy: Float
    ) {
        val json = JSONObject().apply {
            put("lat", lat)
            put("lng", lng)
            put("speedKmh", speedKmh.toDouble())
            put("heading", heading.toDouble())
            put("accuracy", accuracy.toDouble())
        }
        evalJs("window.RideDashBridge && window.RideDashBridge.onGps($json)")
    }

    fun pushHandlebarKey(key: String, pressType: String = "short") {
        val k = JSONObject.quote(key)
        val p = JSONObject.quote(pressType)
        evalJs("window.RideDashBridge && window.RideDashBridge.onHandlebarKey($k, $p)")
    }

    fun pushQrResult(rawText: String) {
        val quoted = JSONObject.quote(rawText)
        evalJs("window.RideDashBridge && window.RideDashBridge.onQrResult($quoted)")
    }

    private fun evalJs(script: String) {
        mainHandler.post {
            runCatching { webView.evaluateJavascript(script, null) }
        }
    }
}
