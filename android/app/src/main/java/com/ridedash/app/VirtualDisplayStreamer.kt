package com.ridedash.app

import android.annotation.SuppressLint
import android.app.Presentation
import android.content.Context
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import android.view.Surface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Level-1 Ready-to-Extend VirtualDisplay + Hardware H.264 Encoder Pipeline.
 *
 * Renders `display.html` onto an off-screen Android VirtualDisplay and encodes it
 * into Annex-B H.264 NAL units via MediaCodec.
 *
 * To add Level-2 MotoPlay / EasyConn Wi-Fi streaming, implement [FrameOutputSink]
 * and forward each encoded H.264 frame to the bike's TCP/UDP socket.
 */
class VirtualDisplayStreamer(
    private val context: Context,
    private val assetLoader: WebViewAssetLoader,
    private val sink: FrameOutputSink? = null
) {
    interface FrameOutputSink {
        fun onH264Frame(nalBytes: ByteArray, isKeyFrame: Boolean, ptsUs: Long)
        fun onEncoderStats(fps: Int, bitrateMbps: Double)
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val running = AtomicBoolean(false)

    private var encoder: MediaCodec? = null
    private var inputSurface: Surface? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var presentation: DashPresentation? = null
    private var drainThread: Thread? = null

    var width: Int = 800
        private set
    var height: Int = 480
        private set
    var fps: Int = 30
        private set
    var bitrateBps: Int = 2_800_000
        private set

    fun isRunning(): Boolean = running.get()

    fun configure(resolution: String, targetFps: Int = 30) {
        val parts = resolution.split("×", "x")
        val w = parts.getOrNull(0)?.trim()?.toIntOrNull()
        val h = parts.getOrNull(1)?.trim()?.toIntOrNull()
        if (w != null && h != null && w >= 320 && h >= 240) {
            // H.264 encoders require even dimensions (multiple of 16 preferred)
            width = (w / 16) * 16
            height = (h / 16) * 16
        }
        fps = targetFps.coerceIn(15, 60)
        bitrateBps = ((width.toLong() * height.toLong() * fps * 0.08).toInt()).coerceIn(1_200_000, 6_000_000)
    }

    fun start(): Boolean {
        if (running.get()) return true
        return try {
            val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
                setInteger(MediaFormat.KEY_BIT_RATE, bitrateBps)
                setInteger(MediaFormat.KEY_FRAME_RATE, fps)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
            }

            val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            val surface = codec.createInputSurface()
            codec.start()

            val dm = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
            val flags = DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY or
                DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION
            val vd = dm.createVirtualDisplay("RideDashDisplay", width, height, 160, surface, flags)

            encoder = codec
            inputSurface = surface
            virtualDisplay = vd
            running.set(true)

            mainHandler.post {
                val pres = DashPresentation(context, vd.display, assetLoader)
                pres.show()
                presentation = pres
            }

            startDrainLoop(codec)
            true
        } catch (err: Exception) {
            Log.e(TAG, "Failed to start VirtualDisplay H.264 encoder", err)
            stop()
            false
        }
    }

    fun stop() {
        running.set(false)
        drainThread?.interrupt()
        drainThread = null

        mainHandler.post {
            runCatching { presentation?.dismiss() }
            presentation = null
        }
        runCatching { virtualDisplay?.release() }
        virtualDisplay = null

        runCatching { encoder?.stop() }
        runCatching { encoder?.release() }
        encoder = null

        runCatching { inputSurface?.release() }
        inputSurface = null
    }

    private fun startDrainLoop(codec: MediaCodec) {
        drainThread = Thread {
            val info = MediaCodec.BufferInfo()
            var framesInWindow = 0
            var bytesInWindow = 0L
            var windowStart = System.currentTimeMillis()

            while (running.get()) {
                try {
                    val outIdx = codec.dequeueOutputBuffer(info, 25_000)
                    if (outIdx >= 0) {
                        val buf = codec.getOutputBuffer(outIdx)
                        if (buf != null && info.size > 0) {
                            val bytes = ByteArray(info.size)
                            buf.position(info.offset)
                            buf.limit(info.offset + info.size)
                            buf.get(bytes)

                            val isKey = (info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0
                            sink?.onH264Frame(bytes, isKey, info.presentationTimeUs)

                            framesInWindow++
                            bytesInWindow += info.size
                        }
                        codec.releaseOutputBuffer(outIdx, false)
                    }

                    val now = System.currentTimeMillis()
                    if (now - windowStart >= 1000L) {
                        val mbps = (bytesInWindow * 8.0) / 1_000_000.0
                        sink?.onEncoderStats(framesInWindow, mbps)
                        framesInWindow = 0
                        bytesInWindow = 0L
                        windowStart = now
                    }
                } catch (_: InterruptedException) {
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "Encoder drain loop warning: ${e.message}")
                    if (!running.get()) break
                }
            }
        }.apply {
            name = "RideDash-H264-Drain"
            start()
        }
    }

    private class DashPresentation(
        outerContext: Context,
        display: Display,
        private val assetLoader: WebViewAssetLoader
    ) : Presentation(outerContext, display) {

        private var dashWebView: WebView? = null

        @SuppressLint("SetJavaScriptEnabled")
        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            val wv = WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
                }
            }
            setContentView(wv)
            wv.loadUrl(DISPLAY_URL)
            dashWebView = wv
        }

        override fun onStop() {
            super.onStop()
            runCatching { dashWebView?.destroy() }
            dashWebView = null
        }
    }

    companion object {
        private const val TAG = "VirtualDisplayStreamer"
        const val DISPLAY_URL = "https://appassets.androidplatform.net/assets/www/display.html"
    }
}
