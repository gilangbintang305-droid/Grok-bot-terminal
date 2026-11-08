package com.grokbot

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private lateinit var web: WebView

    private fun call(url: String, body: String): String = try {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000
        c.readTimeout = 20000
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

    private fun cb(id: Int, out: String) {
        runOnUiThread { web.evaluateJavascript("window.__cb($id,${JSONObject.quote(out)})", null) }
    }

    inner class Bridge {
        @JavascriptInterface
        fun http(id: Int, url: String, body: String) {
            thread { cb(id, call(url, body)) }
        }

        @JavascriptInterface
        fun wallet(): String {
            val s = Wallet.load(this@MainActivity) ?: return ""
            return Wallet.pub(s)
        }

        @JavascriptInterface
        fun setKey(k: String): String = try {
            Wallet.importKey(this@MainActivity, k)
        } catch (e: Exception) { "ERR" }

        @JavascriptInterface
        fun clearKey() { Wallet.clear(this@MainActivity) }

        @JavascriptInterface
        fun signSend(id: Int, rpc: String, tx: String) {
            thread {
                val out = try {
                    val seed = Wallet.load(this@MainActivity)!!
                    val signed = Wallet.signTx(seed, tx)
                    val opts = JSONObject().put("encoding", "base64").put("maxRetries", 3)
                    val req = JSONObject().put("jsonrpc", "2.0").put("id", 1)
                        .put("method", "sendTransaction")
                        .put("params", JSONArray().put(signed).put(opts))
                    call(rpc, req.toString())
                } catch (e: Exception) {
                    """{"error":{"message":"sign gagal"}}"""
                }
                cb(id, out)
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
        web.webChromeClient = android.webkit.WebChromeClient()
    }
}

