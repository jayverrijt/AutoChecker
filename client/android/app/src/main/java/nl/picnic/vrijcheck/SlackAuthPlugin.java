package nl.picnic.vrijcheck;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "SlackAuth")
public class SlackAuthPlugin extends Plugin {

    private static final String DESKTOP_USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    private Dialog loginDialog;
    private WebView webView;
    private Handler pollHandler;
    private Runnable pollRunnable;
    private boolean isResolved = false;

    @PluginMethod
    public void login(PluginCall call) {
        String targetUrl = call.getString("workspaceUrl", "https://picnic.enterprise.slack.com");

        getActivity().runOnUiThread(() -> {
            try {
                showLoginDialog(targetUrl, call);
            } catch (Exception e) {
                call.reject("Fout bij openen van login scherm: " + e.getMessage());
            }
        });
    }

    private void showLoginDialog(String startUrl, PluginCall call) {
        Context context = getActivity();
        isResolved = false;

        loginDialog = new Dialog(context, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        loginDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout rootLayout = new LinearLayout(context);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setBackgroundColor(Color.parseColor("#121316"));
        rootLayout.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // Header bar
        LinearLayout header = new LinearLayout(context);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setBackgroundColor(Color.parseColor("#1a1b20"));
        header.setGravity(Gravity.CENTER_VERTICAL);
        int p12 = dpToPx(context, 12);
        int p16 = dpToPx(context, 16);
        header.setPadding(p16, p12, p16, p12);
        header.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        // Title container
        LinearLayout titleCol = new LinearLayout(context);
        titleCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams titleColParams = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f
        );
        titleCol.setLayoutParams(titleColParams);

        TextView title = new TextView(context);
        title.setText("Picnic Slack Inloggen");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        title.getPaint().setFakeBoldText(true);

        TextView subtitle = new TextView(context);
        subtitle.setText("Log in; sessie wordt automatisch gekoppeld");
        subtitle.setTextColor(Color.parseColor("#9ca3af"));
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);

        titleCol.addView(title);
        titleCol.addView(subtitle);

        // Close button
        TextView closeBtn = new TextView(context);
        closeBtn.setText("✕ Sluiten");
        closeBtn.setTextColor(Color.parseColor("#60a5fa"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        closeBtn.setPadding(p12, p12 / 2, p12, p12 / 2);
        closeBtn.setOnClickListener(v -> {
            if (!isResolved) {
                isResolved = true;
                stopPolling();
                loginDialog.dismiss();
                call.reject("Login geannuleerd");
            }
        });

        header.addView(titleCol);
        header.addView(closeBtn);
        rootLayout.addView(header);

        // Progress bar
        ProgressBar progressBar = new ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(context, 3)
        ));
        rootLayout.addView(progressBar);

        // WebView setup
        webView = new WebView(context);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1.0f
        ));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // Spoof Desktop User Agent so Slack doesn't show "Get the Slack app"
        settings.setUserAgentString(DESKTOP_USER_AGENT);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress >= 100) {
                    progressBar.setVisibility(View.GONE);
                } else {
                    progressBar.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                checkTokensAndCookies(url, call);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                checkTokensAndCookies(url, call);
            }
        });

        rootLayout.addView(webView);
        loginDialog.setContentView(rootLayout);
        loginDialog.setOnCancelListener(dialog -> {
            if (!isResolved) {
                isResolved = true;
                stopPolling();
                call.reject("Login geannuleerd");
            }
        });

        loginDialog.show();
        webView.loadUrl(startUrl);

        // Start periodic token sniffer
        startPolling(call);
    }

    private void startPolling(PluginCall call) {
        stopPolling();
        pollHandler = new Handler(Looper.getMainLooper());
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                if (isResolved || webView == null) return;
                String currentUrl = webView.getUrl();
                if (currentUrl != null) {
                    checkTokensAndCookies(currentUrl, call);
                }
                pollHandler.postDelayed(this, 1500);
            }
        };
        pollHandler.postDelayed(pollRunnable, 2000);
    }

    private void stopPolling() {
        if (pollHandler != null && pollRunnable != null) {
            pollHandler.removeCallbacks(pollRunnable);
            pollHandler = null;
            pollRunnable = null;
        }
    }

    private void checkTokensAndCookies(String currentUrl, PluginCall call) {
        if (isResolved || currentUrl == null) return;

        // 1. Extract d cookie from CookieManager
        CookieManager cookieManager = CookieManager.getInstance();
        String cookieStr = cookieManager.getCookie(currentUrl);
        if (cookieStr == null) {
            cookieStr = cookieManager.getCookie("https://teampicnic.slack.com");
        }
        if (cookieStr == null) {
            cookieStr = cookieManager.getCookie("https://picnic.enterprise.slack.com");
        }

        String dCookie = null;
        if (cookieStr != null) {
            Matcher m = Pattern.compile("(?:^|;\\s*)d=([xoxd-]*[A-Za-z0-9%_-]+)").matcher(cookieStr);
            if (m.find()) {
                dCookie = m.group(1);
            }
        }

        final String extractedCookie = dCookie;

        // 2. Extract token from localStorage / TS.boot_data via JS evaluation
        String js = "(function() {" +
                "  var token = null;" +
                "  try {" +
                "    var cfg = JSON.parse(localStorage.getItem('localConfig_v2') || '{}');" +
                "    if (cfg.teams) {" +
                "      var tId = Object.keys(cfg.teams)[0];" +
                "      token = cfg.teams[tId]?.token;" +
                "    }" +
                "  } catch(e) {}" +
                "  if (!token) {" +
                "    for (var i = 0; i < localStorage.length; i++) {" +
                "      var val = localStorage.getItem(localStorage.key(i));" +
                "      var m = val && typeof val === 'string' && val.match(/xoxc-[A-Za-z0-9-]+/);" +
                "      if (m) { token = m[0]; break; }" +
                "    }" +
                "  }" +
                "  if (!token && window.TS && window.TS.boot_data && window.TS.boot_data.api_token) {" +
                "    token = window.TS.boot_data.api_token;" +
                "  }" +
                "  return token || '';" +
                "})()";

        webView.evaluateJavascript(js, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String rawToken) {
                if (isResolved) return;

                String token = null;
                if (rawToken != null && !rawToken.equals("null") && !rawToken.equals("\"\"")) {
                    String clean = rawToken.replace("\"", "").trim();
                    if (clean.startsWith("xoxc-")) {
                        token = clean;
                    }
                }

                if (token != null && extractedCookie != null) {
                    // SUCCESS! Both token and cookie captured!
                    isResolved = true;
                    stopPolling();

                    Toast.makeText(getActivity(), "Picnic Slack sessie succesvol gekoppeld!", Toast.LENGTH_LONG).show();

                    if (loginDialog != null && loginDialog.isShowing()) {
                        loginDialog.dismiss();
                    }

                    JSObject ret = new JSObject();
                    ret.put("token", token);
                    ret.put("cookie", extractedCookie);
                    ret.put("workspaceUrl", "https://picnic.enterprise.slack.com");
                    call.resolve(ret);
                }
            }
        });
    }

    private int dpToPx(Context context, int dp) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                dp,
                context.getResources().getDisplayMetrics()
        );
    }
}
