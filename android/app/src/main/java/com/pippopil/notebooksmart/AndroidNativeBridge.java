package com.pippopil.notebooksmart;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.os.Bundle;
import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.concurrent.Executor;
import org.json.JSONArray;
import org.json.JSONObject;

public class AndroidNativeBridge {
    private final Activity activity;
    private SpeechRecognizer speechRecognizer = null;
    private boolean isSpeechListening = false;

    public AndroidNativeBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNativeAndroid() {
        return true;
    }

    @JavascriptInterface
    public String getNativeVersion() {
        return "Enhanced-Hybrid v2.0.4";
    }

    /**
     * Native tactile haptic feedback with multiple intensity patterns
     * 1 = light, 2 = medium, 3 = heavy, 4 = success, 5 = warning
     */
    @JavascriptInterface
    public void triggerHaptic(int type) {
        try {
            Vibrator vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                switch (type) {
                    case 1: // light tick
                        vibrator.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
                        break;
                    case 2: // medium tap
                        vibrator.vibrate(VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE));
                        break;
                    case 3: // heavy tap
                        vibrator.vibrate(VibrationEffect.createOneShot(65, 200));
                        break;
                    case 4: // success pattern
                        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 20, 50, 35}, -1));
                        break;
                    case 5: // warning / error
                        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 45, 60, 45}, -1));
                        break;
                    default:
                        vibrator.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE));
                }
            } else {
                vibrator.vibrate(type == 3 ? 60 : 25);
            }
        } catch (Exception ignored) {}
    }

    /**
     * Updates Home Screen Calendar + Event/Reminder/Task Widget data from React state
     */
    @JavascriptInterface
    public boolean updateWidgetData(String jsonString) {
        try {
            JSONObject obj = new JSONObject(jsonString);
            SharedPreferences prefs = activity.getSharedPreferences(
                NotebookWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            );
            SharedPreferences.Editor editor = prefs.edit();

            if (obj.has("badge")) editor.putString(NotebookWidgetProvider.KEY_BADGE, obj.getString("badge"));
            if (obj.has("summary")) editor.putString(NotebookWidgetProvider.KEY_SUMMARY, obj.getString("summary"));

            JSONArray items = obj.optJSONArray("items");
            if (items != null) {
                editor.putString(NotebookWidgetProvider.KEY_ITEM1, items.length() > 0 ? "• " + items.getString(0) : "");
                editor.putString(NotebookWidgetProvider.KEY_ITEM2, items.length() > 1 ? "• " + items.getString(1) : "");
                editor.putString(NotebookWidgetProvider.KEY_ITEM3, items.length() > 2 ? "• " + items.getString(2) : "");
            } else {
                editor.putString(NotebookWidgetProvider.KEY_ITEM1, "");
                editor.putString(NotebookWidgetProvider.KEY_ITEM2, "");
                editor.putString(NotebookWidgetProvider.KEY_ITEM3, "");
            }

            if (obj.has("remaining")) {
                editor.putString(NotebookWidgetProvider.KEY_REMAINING, obj.getString("remaining"));
            } else {
                editor.putString(NotebookWidgetProvider.KEY_REMAINING, "");
            }

            JSONObject eventsByDate = obj.optJSONObject("eventsByDate");
            editor.putString(
                NotebookWidgetProvider.KEY_EVENTS_BY_DATE,
                eventsByDate != null ? eventsByDate.toString() : "{}"
            );

            JSONObject nearestEvent = obj.optJSONObject("nearestEvent");
            if (nearestEvent != null) {
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_EVENT_TITLE, nearestEvent.optString("title", "Событие"));
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_EVENT_SUB, nearestEvent.optString("subtitle", ""));
            } else {
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_EVENT_TITLE, "Нет ближайших");
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_EVENT_SUB, "Нажмите + чтобы добавить");
            }

            JSONObject nearestReminder = obj.optJSONObject("nearestReminder");
            if (nearestReminder != null) {
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_REMINDER_TITLE, nearestReminder.optString("title", "Напоминание"));
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_REMINDER_SUB, nearestReminder.optString("subtitle", ""));
            } else {
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_REMINDER_TITLE, "Не назначено");
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_REMINDER_SUB, "—");
            }

            JSONObject nearestTask = obj.optJSONObject("nearestTask");
            if (nearestTask != null) {
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_TASK_TITLE, nearestTask.optString("title", "Задание"));
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_TASK_SUB, nearestTask.optString("subtitle", ""));
            } else {
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_TASK_TITLE, "Все выполнены");
                editor.putString(NotebookWidgetProvider.KEY_NEAREST_TASK_SUB, "—");
            }

            editor.apply();

            // Refresh all widgets on the home screen
            activity.runOnUiThread(() -> NotebookWidgetProvider.updateAllWidgets(activity));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Schedules exact alarm using setAlarmClock so it wakes locked phones & Doze mode reliably
     */
    @JavascriptInterface
    public boolean scheduleReminder(String id, String title, String body, long triggerAtMillis, String category) {
        try {
            AlarmManager alarmManager = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return false;

            Intent intent = new Intent(activity, ReminderReceiver.class);
            intent.putExtra(ReminderReceiver.EXTRA_ID, id);
            intent.putExtra(ReminderReceiver.EXTRA_TITLE, title);
            intent.putExtra(ReminderReceiver.EXTRA_BODY, body);
            intent.putExtra(ReminderReceiver.EXTRA_CATEGORY, category);

            int requestCode = id != null ? Math.abs(id.hashCode()) : 100;
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                activity,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent showIntent = new Intent(activity, MainActivity.class);
            showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                activity,
                requestCode + 1,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AlarmManager.AlarmClockInfo alarmClockInfo =
                        new AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent);
                    alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } catch (SecurityException se) {
                // Fallback if user declined exact alarm permission on Android 12+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean cancelReminder(String id) {
        try {
            AlarmManager alarmManager = (AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null || id == null) return false;

            Intent intent = new Intent(activity, ReminderReceiver.class);
            int requestCode = Math.abs(id.hashCode());
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                activity,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            alarmManager.cancel(pendingIntent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void shareText(String title, String text) {
        try {
            activity.runOnUiThread(() -> {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.putExtra(Intent.EXTRA_TEXT, text);
                sendIntent.setType("text/plain");
                Intent shareIntent = Intent.createChooser(sendIntent, title);
                activity.startActivity(shareIntent);
            });
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public boolean isNotificationsEnabled() {
        return NotificationManagerCompat.from(activity).areNotificationsEnabled();
    }

    @JavascriptInterface
    public String getSystemNotificationStatus() {
        if (activity instanceof MainActivity) {
            return ((MainActivity) activity).getSystemNotificationStatusJson();
        }
        return "{\"notificationsEnabled\":" + isNotificationsEnabled() + ",\"exactAlarmAllowed\":true,\"batteryOptimizationIgnored\":false,\"androidSdk\":" + Build.VERSION.SDK_INT + "}";
    }

    @JavascriptInterface
    public void requestSystemNotificationPermissions() {
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).requestSystemNotificationPermissions();
        }
    }

    @JavascriptInterface
    public void requestIgnoreBatteryOptimization() {
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).requestIgnoreBatteryOptimization();
        }
    }

    @JavascriptInterface
    public boolean sendTestNativeAlarm(String title, String body) {
        try {
            Intent intent = new Intent(activity, ReminderReceiver.class);
            intent.putExtra(ReminderReceiver.EXTRA_ID, "test_alarm_now");
            intent.putExtra(ReminderReceiver.EXTRA_TITLE, title != null && !title.isEmpty() ? title : "🔔 Тест будильника NotebookSmart");
            intent.putExtra(ReminderReceiver.EXTRA_BODY, body != null && !body.isEmpty() ? body : "Системные уведомления и звук будильника работают!");
            intent.putExtra(ReminderReceiver.EXTRA_CATEGORY, "event");
            new ReminderReceiver().onReceive(activity, intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /* =========================================================================
     * STEP 3: Receive Share Content & App Shortcuts
     * ========================================================================= */

    @JavascriptInterface
    public String getPendingSharedContent() {
        if (activity instanceof MainActivity) {
            return ((MainActivity) activity).getAndClearPendingSharedContent();
        }
        return null;
    }

    @JavascriptInterface
    public String getPendingAction() {
        if (activity instanceof MainActivity) {
            return ((MainActivity) activity).getAndClearPendingAction();
        }
        return null;
    }

    /* =========================================================================
     * STEP 4: Native Android Biometrics (BiometricPrompt)
     * ========================================================================= */

    @JavascriptInterface
    public boolean isBiometricAvailable() {
        try {
            BiometricManager biometricManager = BiometricManager.from(activity);
            int canAuth = biometricManager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            );
            return canAuth == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void promptBiometric(final String title, final String subtitle) {
        activity.runOnUiThread(() -> {
            try {
                if (!(activity instanceof FragmentActivity)) {
                    notifyBiometricResult(false, "Activity does not support FragmentActivity");
                    return;
                }
                FragmentActivity fragmentActivity = (FragmentActivity) activity;
                Executor executor = ContextCompat.getMainExecutor(activity);

                BiometricPrompt biometricPrompt = new BiometricPrompt(
                    fragmentActivity,
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            notifyBiometricResult(false, errString != null ? errString.toString() : "Ошибка биометрии");
                        }

                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            notifyBiometricResult(true, "");
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                        }
                    }
                );

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title != null && !title.isEmpty() ? title : "Вход в NotebookSmart")
                    .setSubtitle(subtitle != null && !subtitle.isEmpty() ? subtitle : "Подтвердите личность (отпечаток или Face ID)")
                    .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG |
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    )
                    .build();

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                notifyBiometricResult(false, e.getMessage());
            }
        });
    }

    private void notifyBiometricResult(final boolean success, final String error) {
        activity.runOnUiThread(() -> {
            try {
                if (activity instanceof MainActivity) {
                    MainActivity ma = (MainActivity) activity;
                    if (ma.getBridge() != null && ma.getBridge().getWebView() != null) {
                        WebView wv = ma.getBridge().getWebView();
                        String safeError = error != null ? error.replace("'", "\\'") : "";
                        wv.evaluateJavascript(
                            "if (window.onNativeBiometricResult) { window.onNativeBiometricResult(" + success + ", '" + safeError + "'); }",
                            null
                        );
                    }
                }
            } catch (Exception ignored) {}
        });
    }

    /* =========================================================================
     * STEP 5: Native Storage & Documents Backup
     * ========================================================================= */

    @JavascriptInterface
    public String saveNativeBackupFile(String jsonContent, String customFileName) {
        try {
            File dir = new File(activity.getExternalFilesDir(null), "Backups");
            if (!dir.exists()) {
                dir.mkdirs();
            }

            String fileName = (customFileName != null && !customFileName.isEmpty()) 
                ? customFileName 
                : "notebook_backup_" + System.currentTimeMillis() + ".json";

            File targetFile = new File(dir, fileName);
            try (FileWriter writer = new FileWriter(targetFile)) {
                writer.write(jsonContent);
            }

            // Also attempt to mirror into public Documents/NotebookSmart
            try {
                File publicDir = new File(
                    android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOCUMENTS),
                    "NotebookSmart"
                );
                if (publicDir.exists() || publicDir.mkdirs()) {
                    File publicFile = new File(publicDir, fileName);
                    try (FileWriter writer = new FileWriter(publicFile)) {
                        writer.write(jsonContent);
                    }
                }
            } catch (Exception ignored) {}

            return targetFile.getAbsolutePath();
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    @JavascriptInterface
    public String listNativeBackupFiles() {
        try {
            File dir = new File(activity.getExternalFilesDir(null), "Backups");
            JSONArray arr = new JSONArray();
            if (dir.exists()) {
                File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
                if (files != null) {
                    java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                    for (File f : files) {
                        JSONObject item = new JSONObject();
                        item.put("fileName", f.getName());
                        item.put("size", f.length());
                        item.put("lastModified", f.lastModified());
                        item.put("path", f.getAbsolutePath());
                        arr.put(item);
                    }
                }
            }
            return arr.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    @JavascriptInterface
    public String readNativeBackupFile(String fileName) {
        try {
            File dir = new File(activity.getExternalFilesDir(null), "Backups");
            File file = new File(dir, fileName);
            if (!file.exists()) return null;
            byte[] bytes = java.nio.file.Files.readAllBytes(file.toPath());
            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    @JavascriptInterface
    public boolean deleteNativeBackupFile(String fileName) {
        try {
            File dir = new File(activity.getExternalFilesDir(null), "Backups");
            File file = new File(dir, fileName);
            return file.exists() && file.delete();
        } catch (Exception e) {
            return false;
        }
    }

    /* =========================================================================
     * STEP 6: Native Android SpeechRecognizer (Google Voice Typing Engine)
     * ========================================================================= */

    @JavascriptInterface
    public boolean isNativeSpeechAvailable() {
        try {
            return SpeechRecognizer.isRecognitionAvailable(activity);
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean isSpeechActive() {
        return isSpeechListening;
    }

    @JavascriptInterface
    public void startNativeSpeechRecognition(final String lang) {
        activity.runOnUiThread(() -> {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
                    notifySpeechError("Голосовой ввод недоступен на этом устройстве");
                    return;
                }

                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.destroy();
                    } catch (Exception ignored) {}
                    speechRecognizer = null;
                }

                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        isSpeechListening = true;
                        notifySpeechState("ready");
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        notifySpeechState("start");
                    }

                    @Override
                    public void onRmsChanged(float rmsdB) {}

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        isSpeechListening = false;
                        notifySpeechState("end");
                    }

                    @Override
                    public void onError(int error) {
                        isSpeechListening = false;
                        String errorMsg = "Ошибка микрофона (" + error + ")";
                        switch (error) {
                            case SpeechRecognizer.ERROR_AUDIO:
                                errorMsg = "Ошибка записи аудио";
                                break;
                            case SpeechRecognizer.ERROR_CLIENT:
                                errorMsg = "Клиентская ошибка распознавания";
                                break;
                            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                                errorMsg = "Нет разрешения на микрофон";
                                break;
                            case SpeechRecognizer.ERROR_NETWORK:
                            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                                errorMsg = "Сетевая ошибка голосового сервиса";
                                break;
                            case SpeechRecognizer.ERROR_NO_MATCH:
                                errorMsg = "Речь не распознана";
                                break;
                            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                                errorMsg = "Служба распознавания занята";
                                break;
                            case SpeechRecognizer.ERROR_SERVER:
                                errorMsg = "Ошибка сервера распознавания речи";
                                break;
                            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                                errorMsg = "Не услышан голос";
                                break;
                        }
                        notifySpeechError(errorMsg);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        isSpeechListening = false;
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String text = matches.get(0);
                            notifySpeechResult(text, true);
                        } else {
                            notifySpeechState("end");
                        }
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String text = matches.get(0);
                            notifySpeechResult(text, false);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, (lang != null && !lang.isEmpty()) ? lang : "ru-RU");
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ru-RU");
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                speechRecognizer.startListening(intent);
            } catch (Exception e) {
                notifySpeechError("Сбой микрофона: " + e.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void stopNativeSpeechRecognition() {
        activity.runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                }
            } catch (Exception ignored) {}
            isSpeechListening = false;
            notifySpeechState("end");
        });
    }

    private void notifySpeechResult(final String text, final boolean isFinal) {
        activity.runOnUiThread(() -> {
            try {
                if (activity instanceof MainActivity) {
                    MainActivity ma = (MainActivity) activity;
                    if (ma.getBridge() != null && ma.getBridge().getWebView() != null) {
                        WebView wv = ma.getBridge().getWebView();
                        String safeText = text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                        wv.evaluateJavascript(
                            "if (window.onNativeSpeechResult) { window.onNativeSpeechResult('" + safeText + "', " + isFinal + "); }",
                            null
                        );
                    }
                }
            } catch (Exception ignored) {}
        });
    }

    private void notifySpeechError(final String errorMsg) {
        activity.runOnUiThread(() -> {
            try {
                if (activity instanceof MainActivity) {
                    MainActivity ma = (MainActivity) activity;
                    if (ma.getBridge() != null && ma.getBridge().getWebView() != null) {
                        WebView wv = ma.getBridge().getWebView();
                        String safeError = errorMsg.replace("'", "\\'");
                        wv.evaluateJavascript(
                            "if (window.onNativeSpeechError) { window.onNativeSpeechError('" + safeError + "'); }",
                            null
                        );
                    }
                }
            } catch (Exception ignored) {}
        });
    }

    private void notifySpeechState(final String state) {
        activity.runOnUiThread(() -> {
            try {
                if (activity instanceof MainActivity) {
                    MainActivity ma = (MainActivity) activity;
                    if (ma.getBridge() != null && ma.getBridge().getWebView() != null) {
                        WebView wv = ma.getBridge().getWebView();
                        wv.evaluateJavascript(
                            "if (window.onNativeSpeechState) { window.onNativeSpeechState('" + state + "'); }",
                            null
                        );
                    }
                }
            } catch (Exception ignored) {}
        });
    }
}
