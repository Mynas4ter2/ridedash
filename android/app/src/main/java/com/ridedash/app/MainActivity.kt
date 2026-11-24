package com.ridedash.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject

class MainActivity : AppCompatActivity(), RideDashBridge.NativeActionListener {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var bridge: RideDashBridge
    private lateinit var streamer: VirtualDisplayStreamer

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var lastTempC: Int = 36
    private var lastEncoderFps: Int = 0
    private var lastEncoderMbps: Double = 0.0

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val locGranted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (locGranted) startBackgroundService()
    }

    private val qrScannerLauncher = registerForActivityResult(ScanContract()) { result ->
        val raw = result.contents
        if (!raw.isNullOrBlank()) {
            bridge.pushQrResult(raw)
        } else {
            bridge.pushConnectionState("disconnected", message = "ยกเลิกการสแกน QR")
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { res ->
        val callback = fileUploadCallback
        fileUploadCallback = null
        if (callback == null) return@registerForActivityResult

        val data = res.data
        val uris = mutableListOf<Uri>()
        if (res.resultCode == RESULT_OK && data != null) {
            data.clipData?.let { clip ->
                for (i in 0 until clip.itemCount) {
                    clip.getItemAt(i)?.uri?.let { uris.add(it) }
                }
            } ?: data.data?.let { uris.add(it) }
        }
        callback.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        streamer = VirtualDisplayStreamer(
            context = this,
            assetLoader = assetLoader,
            sink = object : VirtualDisplayStreamer.FrameOutputSink {
                override fun onH264Frame(nalBytes: ByteArray, isKeyFrame: Boolean, ptsUs: Long) {
                    // Level-2 hook: forward Annex-B H.264 frame to MotoPlay / EasyConn Wi-Fi socket here
                }

                override fun onEncoderStats(fps: Int, bitrateMbps: Double) {
                    lastEncoderFps = fps
                    lastEncoderMbps = bitrateMbps
                    bridge.pushTelemetry(
                        fps = fps,
                        latencyMs = 32,
                        tempC = lastTempC,
                        bitrateMbps = bitrateMbps
                    )
                }
            }
        )

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.setGeolocationEnabled(true)
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val uri = request.url
                    val scheme = uri.scheme?.lowercase() ?: return false
                    if (scheme == "tel" || scheme == "mailto") {
                        runCatching { startActivity(Intent(Intent.ACTION_DIAL, uri)) }
                        return true
                    }
                    if (uri.host != "appassets.androidplatform.net") {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                        return true
                    }
                    return false
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String,
                    callback: GeolocationPermissions.Callback
                ) {
                    callback.invoke(origin, true, false)
                }

                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = filePathCallback
                    return try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (e: Exception) {
                        fileUploadCallback = null
                        false
                    }
                }
            }
        }

        bridge = RideDashBridge(webView, this)
        webView.addJavascriptInterface(bridge, "RideDashNative")
        setContentView(webView)

        setupTelemetryListeners()
        setupBackNavigation()
        requestRuntimePermissions()

        webView.loadUrl(INDEX_URL)
    }

    override fun onDestroy() {
        super.onDestroy()
        RideDashForegroundService.TelemetryBus.onGps = null
        RideDashForegroundService.TelemetryBus.onTemp = null
        streamer.stop()
    }

    private fun setupTelemetryListeners() {
        RideDashForegroundService.TelemetryBus.onGps = { lat, lng, speedKmh, heading, accuracy ->
            bridge.pushGps(lat, lng, speedKmh, heading, accuracy)
        }
        RideDashForegroundService.TelemetryBus.onTemp = { tempC ->
            lastTempC = tempC
            if (!streamer.isRunning()) {
                bridge.pushTelemetry(
                    fps = 30,
                    latencyMs = 0,
                    tempC = tempC,
                    bitrateMbps = 0.0
                )
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            startBackgroundService()
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun startBackgroundService() {
        val intent = Intent(this, RideDashForegroundService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }

    // ===== RideDashBridge.NativeActionListener =====

    override fun onScanQrRequested() {
        val opts = ScanOptions().apply {
            setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            setPrompt("ส่องไปที่ QR Code บนจอรถ Zontes 368K")
            setBeepEnabled(true)
            setOrientationLocked(false)
        }
        qrScannerLauncher.launch(opts)
    }

    override fun onConnectBike(qrPayload: String) {
        bridge.pushConnectionState("connecting", message = "เริ่ม VirtualDisplay H.264...")
        val started = streamer.start()
        if (started) {
            bridge.pushConnectionState(
                state = "streaming",
                bikeName = "Zontes 368K",
                message = "VirtualDisplay H.264 พร้อม (รอต่อ MotoPlay Transport)"
            )
            Toast.makeText(this, "เริ่ม VirtualDisplay H.264 (${streamer.width}×${streamer.height}) แล้ว", Toast.LENGTH_SHORT).show()
        } else {
            bridge.pushConnectionState("disconnected", message = "เปิด VirtualDisplay H.264 ไม่สำเร็จ")
        }
    }

    override fun onDisconnectBike() {
        streamer.stop()
        bridge.pushConnectionState("disconnected", message = "หยุด VirtualDisplay แล้ว")
    }

    override fun onStreamConfigUpdated(config: JSONObject) {
        val res = config.optString("resolution", "800×480")
        streamer.configure(res)
    }

    override fun onLaunchApp(appId: String, packageName: String) {
        if (appId == "phone") {
            runCatching { startActivity(Intent(Intent.ACTION_DIAL)) }
            return
        }
        if (packageName.isNotBlank()) {
            val launch = packageManager.getLaunchIntentForPackage(packageName)
            if (launch != null) {
                startActivity(launch)
                return
            }
        }
        Toast.makeText(this, "ไม่พบแอป $appId ในเครื่อง", Toast.LENGTH_SHORT).show()
    }

    override fun onHandlebarMapUpdated(map: JSONObject) {
        // Stored for future hardware BLE/CAN handlebar key forwarding
    }

    companion object {
        const val INDEX_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }
}
