package com.grokbot

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private lateinit var web: WebView

    inner class Bridge {
        // HTTP lewat native supaya tidak kena CORS
        @JavascriptInterface
        fun http(id: Int, url: String, body: String) {
            thread {
                val out = try {
                    val c = URL(url).openConnection() as HttpURLConnection
                    c.connectTimeout = 15000
                    c.readTimeout = 15000
                    c.setRequestProperty("Accept", "application/json")
                    if (body.isNotEmpty()) {
                        c.requestMethod = "POST"
                        c.doOutput = true
                        c.setRequestProperty("Content-Type", "application/json")
                        c.outputStream.use { it.write(body.toByteArray()) }
                    }
                    val s = if (c.responseCode < 400) c.inputStream else c.errorStream
                    s.bufferedReader().readText()
                } catch (e: Exception) { "" }
                runOnUiThread { web.evaluateJavascript("window.__cb($id,${JSONObject.quote(out)})", null) }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl("file:///android_asset/index.html")
        setContentView(web)
    }
}
