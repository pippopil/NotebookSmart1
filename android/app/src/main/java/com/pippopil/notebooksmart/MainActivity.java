package com.pippopil.notebooksmart;

import android.Manifest;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1002;
    private static final String PREFS_SYS = "NotebookSmartSysPrefs";
    private static final String KEY_ASKED_NOTIFICATIONS = "asked_notifications";

    private String pendingSharedText = null;
    private String pendingSharedSubject = null;
    private String pendingAction = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ReminderReceiver.ensureAlarmChannel(this);
        handleIncomingIntent(getIntent());
        requestPermissionsIfNeeded();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
        notifyWebOfPendingEvents();
    }

    @Override
    public void onResume() {
        super.onResume();
        notifyPermissionStatusToWeb();
        try {
            NotebookWidgetProvider.updateAllWidgets(this);
        } catch (Exception ignored) {}
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(intent.getType())) {
            this.pendingSharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            this.pendingSharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            if (data != null && "notebooksmart".equalsIgnoreCase(data.getScheme())) {
                String path = data.getPath(); // e.g. /shopping, /new-note, /calc, /event, /events
                if (path != null && path.length() > 1) {
                    this.pendingAction = path.substring(1);
                } else if (data.getHost() != null) {
                    this.pendingAction = data.getHost();
                }
            }
        }
    }

    public synchronized String getAndClearPendingSharedContent() {
        if (pendingSharedText == null) return null;
        try {
            JSONObject obj = new JSONObject();
            obj.put("text", pendingSharedText);
            obj.put("title", pendingSharedSubject != null ? pendingSharedSubject : "");
            pendingSharedText = null;
            pendingSharedSubject = null;
            return obj.toString();
        } catch (Exception e) {
            return null;
        }
    }

    public synchronized String getAndClearPendingAction() {
        String act = pendingAction;
        pendingAction = null;
        return act;
    }

    public void notifyWebOfPendingEvents() {
        try {
            if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                WebView webView = this.getBridge().getWebView();
                webView.post(() -> {
                    if (pendingSharedText != null) {
                        try {
                            String text = pendingSharedText.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                            String title = (pendingSharedSubject != null ? pendingSharedSubject : "").replace("'", "\\'");
                            webView.evaluateJavascript(
                                "if (window.onNativeSharedContent) { window.onNativeSharedContent('" + title + "', '" + text + "'); }",
                                null
                            );
                            pendingSharedText = null;
                            pendingSharedSubject = null;
                        } catch (Exception ignored) {}
                    }
                    if (pendingAction != null) {
                        try {
                            String act = pendingAction.replace("'", "\\'");
                            webView.evaluateJavascript(
                                "if (window.onNativeAction) { window.onNativeAction('" + act + "'); }",
                                null
                            );
                            pendingAction = null;
                        } catch (Exception ignored) {}
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    public String getSystemNotificationStatusJson() {
        boolean notificationsEnabled = NotificationManagerCompat.from(this).areNotificationsEnabled();
        boolean exactAlarmAllowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            exactAlarmAllowed = am == null || am.canScheduleExactAlarms();
        }
        boolean batteryOptimizationIgnored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            batteryOptimizationIgnored = pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
        }

        try {
            JSONObject obj = new JSONObject();
            obj.put("notificationsEnabled", notificationsEnabled);
            obj.put("exactAlarmAllowed", exactAlarmAllowed);
            obj.put("batteryOptimizationIgnored", batteryOptimizationIgnored);
            obj.put("androidSdk", Build.VERSION.SDK_INT);
            return obj.toString();
        } catch (Exception e) {
            return "{\"notificationsEnabled\":" + notificationsEnabled + ",\"exactAlarmAllowed\":true,\"batteryOptimizationIgnored\":false,\"androidSdk\":" + Build.VERSION.SDK_INT + "}";
        }
    }

    public void notifyPermissionStatusToWeb() {
        try {
            if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                WebView webView = this.getBridge().getWebView();
                String statusJson = getSystemNotificationStatusJson().replace("\\", "\\\\").replace("'", "\\'");
                webView.post(() -> webView.evaluateJavascript(
                    "if (window.onNativePermissionResult) { window.onNativePermissionResult('" + statusJson + "'); }",
                    null
                ));
            }
        } catch (Exception ignored) {}
    }

    public void requestSystemNotificationPermissions() {
        runOnUiThread(() -> {
            try {
                // 1. Android 13+ runtime POST_NOTIFICATIONS permission
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        SharedPreferences prefs = getSharedPreferences(PREFS_SYS, Context.MODE_PRIVATE);
                        boolean alreadyAsked = prefs.getBoolean(KEY_ASKED_NOTIFICATIONS, false);
                        boolean canShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.POST_NOTIFICATIONS);

                        if (!alreadyAsked || canShowRationale) {
                            prefs.edit().putBoolean(KEY_ASKED_NOTIFICATIONS, true).apply();
                            ActivityCompat.requestPermissions(
                                this,
                                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                NOTIFICATION_PERMISSION_REQUEST_CODE
                            );
                            return;
                        } else {
                            // Permanently denied previously -> open Android system notification settings for app
                            openAppNotificationSettings();
                            return;
                        }
                    }
                } else if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
                    openAppNotificationSettings();
                    return;
                }

                // 2. Android 12+ Exact alarm special permission if revoked
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                    if (am != null && !am.canScheduleExactAlarms()) {
                        Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                        return;
                    }
                }

                // Already granted -> update web status
                notifyPermissionStatusToWeb();
            } catch (Exception e) {
                openAppNotificationSettings();
            }
        });
    }

    private void openAppNotificationSettings() {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
            }
            startActivity(intent);
        } catch (Exception ignored) {}
    }

    public void requestIgnoreBatteryOptimization() {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                        return;
                    }
                    // Already ignored or fallback to settings list
                    notifyPermissionStatusToWeb();
                } catch (Exception e) {
                    try {
                        Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        startActivity(fallback);
                    } catch (Exception ignored) {}
                }
            }
        });
    }

    private void requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissionsToRequest = new ArrayList<>();

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
            }

            // Android 13+ Notification permission
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS);
                    getSharedPreferences(PREFS_SYS, Context.MODE_PRIVATE)
                        .edit()
                        .putBoolean(KEY_ASKED_NOTIFICATIONS, true)
                        .apply();
                }
            }

            if (!permissionsToRequest.isEmpty()) {
                ActivityCompat.requestPermissions(
                    this,
                    permissionsToRequest.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE
                );
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        notifyPermissionStatusToWeb();
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                if (am != null && !am.canScheduleExactAlarms()) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                WebView webView = this.getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setGeolocationEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setDomStorageEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Register Enhanced Hybrid JavaScript Bridge
                webView.addJavascriptInterface(new AndroidNativeBridge(this), "AndroidNative");

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                        requestPermissionsIfNeeded();
                        callback.invoke(origin, true, false);
                    }

                    @Override
                    public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                        runOnUiThread(() -> {
                            try {
                                request.grant(request.getResources());
                            } catch (Exception ignored) {}
                        });
                    }
                });

                notifyWebOfPendingEvents();
                notifyPermissionStatusToWeb();
            }

            // Refresh home screen widget
            NotebookWidgetProvider.updateAllWidgets(this);
        } catch (Exception ignored) {}
    }
}
