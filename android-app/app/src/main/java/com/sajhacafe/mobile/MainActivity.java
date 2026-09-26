package com.sajhacafe.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends ComponentActivity {
    private WebView webView;
    private BluetoothPrinter printer;
    private final ExecutorService printExecutor = Executors.newSingleThreadExecutor();
    private ActivityResultLauncher<String> permissionRequest;
    private Uri appOrigin;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        printer = new BluetoothPrinter(this);
        appOrigin = Uri.parse(BuildConfig.PWA_URL);
        permissionRequest = registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> { });
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            permissionRequest.launch(Manifest.permission.BLUETOOTH_CONNECT);
        }

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (sameOrigin(uri)) return false;
                if ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return true;
            }
        });

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            android.widget.TextView unsupported = new android.widget.TextView(this);
            unsupported.setText("Update Android System WebView to use Sajha Cafe printing.");
            unsupported.setPadding(32, 32, 32, 32);
            setContentView(unsupported);
            return;
        }
        WebViewCompat.addWebMessageListener(webView, "SajhaNative", Collections.singleton(originRule()), (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
            if (!isMainFrame || !sameOrigin(sourceOrigin)) return;
            handleMessage(message, replyProxy);
        });
        setContentView(webView);
        webView.loadUrl(BuildConfig.PWA_URL);
    }

    private void handleMessage(WebMessageCompat message, JavaScriptReplyProxy replyProxy) {
        final JSONObject request;
        try {
            String raw = message.getData();
            if (raw == null || raw.length() > 1_500_000) throw new Exception("Invalid or oversized print request.");
            request = new JSONObject(raw);
        } catch (Exception error) {
            reply(replyProxy, "", null, error);
            return;
        }
        final String requestId = request.optString("requestId", "");
        printExecutor.execute(() -> {
            try {
                JSONObject result = dispatch(request);
                reply(replyProxy, requestId, result, null);
            } catch (Exception error) {
                reply(replyProxy, requestId, null, error);
            }
        });
    }

    private JSONObject dispatch(JSONObject request) throws Exception {
        String action = request.optString("action", "");
        switch (action) {
            case "status": return printer.status();
            case "listPrinters": return new JSONObject().put("printers", printer.pairedPrinters());
            case "selectPrinter": return printer.select(request.getString("printerId"));
            case "connect": return printer.connect(request.getString("printerId"));
            case "disconnect": return printer.disconnect();
            case "print": {
                String base64 = request.getString("dataBase64");
                if (base64.length() > 1_400_000) throw new Exception("Receipt print data is too large.");
                byte[] data = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                return printer.print(request.getString("printerId"), data, request.optInt("copies", 1));
            }
            default: throw new Exception("Unsupported Android printer action.");
        }
    }

    private void reply(JavaScriptReplyProxy proxy, String requestId, JSONObject result, Exception error) {
        try {
            JSONObject response = new JSONObject().put("requestId", requestId);
            if (error == null) response.put("ok", true).put("result", result);
            else response.put("ok", false).put("error", error.getMessage() == null ? "Android print bridge failed." : error.getMessage());
            String serialized = response.toString();
            runOnUiThread(() -> proxy.postMessage(serialized));
        } catch (Exception ignored) { }
    }

    private boolean sameOrigin(Uri uri) {
        return appOrigin.getScheme().equals(uri.getScheme()) && appOrigin.getHost().equalsIgnoreCase(uri.getHost()) && effectivePort(appOrigin) == effectivePort(uri);
    }

    private int effectivePort(Uri uri) {
        if (uri.getPort() != -1) return uri.getPort();
        return "https".equals(uri.getScheme()) ? 443 : 80;
    }

    private String originRule() {
        String scheme = appOrigin.getScheme();
        String host = appOrigin.getHost();
        int port = effectivePort(appOrigin);
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) return scheme + "://" + host;
        return scheme + "://" + host + ":" + port;
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        printExecutor.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
