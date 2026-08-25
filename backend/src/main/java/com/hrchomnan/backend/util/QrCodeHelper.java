package com.hrchomnan.backend.util;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;

@Component
public class QrCodeHelper {

    @Value("${jwt.secret:attendance_secret_hash_key_123}")
    private String secretKey;

    public String generateSecureToken(String staffId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(staffId.getBytes(StandardCharsets.UTF_8));
            String hexSignature = HexFormat.of().formatHex(hmacBytes);
            return staffId + "." + hexSignature;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate secure token", e);
        }
    }

    public String verifySecureToken(String token) {
        try {
            if (token == null) return null;
            String cleanToken = token.trim();
            String[] parts = cleanToken.split("\\.");
            if (parts.length != 2) return null;
            String staffId = parts[0];
            String signature = parts[1];
            if (staffId.isBlank() || signature.isBlank()) return null;

            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(staffId.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = HexFormat.of().formatHex(hmacBytes);

            if (MessageDigest.isEqual(signature.getBytes(StandardCharsets.UTF_8), expectedSignature.getBytes(StandardCharsets.UTF_8))) {
                return staffId;
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    public String generateQrCodeBase64(String content, int width, int height) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, width, height);
            ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
            byte[] pngData = pngOutputStream.toByteArray();
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngData);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate QR Code image", e);
        }
    }
}
