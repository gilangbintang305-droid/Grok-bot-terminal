package com.grokbot

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.math.BigInteger
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object Wallet {
    private const val ALIAS = "grokbot_wallet"
    private const val ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

    fun b58decode(s: String): ByteArray {
        var n = BigInteger.ZERO
        val m = BigInteger.valueOf(58)
        for (c in s) {
            val i = ALPHA.indexOf(c)
            require(i >= 0)
            n = n.multiply(m).add(BigInteger.valueOf(i.toLong()))
        }
        var b = n.toByteArray()
        if (b.isNotEmpty() && b[0] == 0.toByte()) b = b.copyOfRange(1, b.size)
        val zeros = s.takeWhile { it == '1' }.length
        return ByteArray(zeros) + b
    }

    fun b58encode(b: ByteArray): String {
        var n = BigInteger(1, b)
        val m = BigInteger.valueOf(58)
        val sb = StringBuilder()
        while (n.signum() > 0) {
            val dr = n.divideAndRemainder(m)
            sb.append(ALPHA[dr[1].toInt()])
            n = dr[0]
        }
        for (x in b) { if (x.toInt() == 0) sb.append('1') else break }
        return sb.reverse().toString()
    }

    private fun aesKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return g.generateKey()
    }

    private fun save(ctx: Context, seed: ByteArray) {
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, aesKey())
        val ct = c.doFinal(seed)
        val packed = c.iv + ct
        ctx.getSharedPreferences("w", 0).edit()
            .putString("k", Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
    }

    fun load(ctx: Context): ByteArray? {
        val s = ctx.getSharedPreferences("w", 0).getString("k", null) ?: return null
        return try {
            val raw = Base64.decode(s, Base64.NO_WRAP)
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, aesKey(), GCMParameterSpec(128, raw, 0, 12))
            c.doFinal(raw, 12, raw.size - 12)
        } catch (e: Exception) { null }
    }

    fun clear(ctx: Context) {
        ctx.getSharedPreferences("w", 0).edit().remove("k").apply()
    }

    fun pub(seed: ByteArray): String =
        b58encode(Ed25519PrivateKeyParameters(seed, 0).generatePublicKey().encoded)

    fun importKey(ctx: Context, b58: String): String {
        val b = b58decode(b58.trim())
        require(b.size == 64 || b.size == 32)
        val seed = b.copyOfRange(0, 32)
        val p = pub(seed)
        if (b.size == 64) require(b58encode(b.copyOfRange(32, 64)) == p)
        save(ctx, seed)
        return p
    }

    // Tanda tangan transaksi Jupiter (legacy / v0). Fee payer harus wallet ini.
    fun signTx(seed: ByteArray, txB64: String): String {
        val tx = Base64.decode(txB64, Base64.DEFAULT)
        val n = tx[0].toInt() and 0xFF
        require(n in 1..8)
        val msg = tx.copyOfRange(1 + 64 * n, tx.size)
        var o = if ((msg[0].toInt() and 0x80) != 0) 1 else 0
        o += 3
        o += if ((msg[o].toInt() and 0x80) != 0) 2 else 1
        require(b58encode(msg.copyOfRange(o, o + 32)) == pub(seed))
        val signer = Ed25519Signer()
        signer.init(true, Ed25519PrivateKeyParameters(seed, 0))
        signer.update(msg, 0, msg.size)
        System.arraycopy(signer.generateSignature(), 0, tx, 1, 64)
        return Base64.encodeToString(tx, Base64.NO_WRAP)
    }
}
