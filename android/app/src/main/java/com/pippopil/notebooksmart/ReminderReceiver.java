package com.pippopil.notebooksmart;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class ReminderReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "notebook_reminders_alarm_channel_v2";
    public static final String EXTRA_ID = "reminder_id";
    public static final String EXTRA_TITLE = "reminder_title";
    public static final String EXTRA_BODY = "reminder_body";
    public static final String EXTRA_CATEGORY = "reminder_category";

    public static Uri getAlarmSoundUri() {
        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        return alarmSound;
    }

    public static AudioAttributes getAlarmAudioAttributes() {
        return new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build();
    }

    public static void ensureAlarmChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            Uri alarmSound = getAlarmSoundUri();
            AudioAttributes audioAttributes = getAlarmAudioAttributes();

            CharSequence name = "Будильник и события NotebookSmart";
            String description = "Громкие звуковые уведомления на заблокированном экране и в спящем режиме";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 700});
            channel.setSound(alarmSound, audioAttributes);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.setBypassDnd(true);
            notificationManager.createNotificationChannel(channel);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra(EXTRA_ID);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        String category = intent.getStringExtra(EXTRA_CATEGORY);

        if (title == null || title.isEmpty()) {
            title = "Напоминание в тетради 📓";
        }

        // 1. Wake up device CPU and screen if locked or in Doze mode
        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "notebooksmart:alarm_receiver_wakelock"
                );
                wakeLock.acquire(8000L);
            }
        } catch (Exception ignored) {}

        NotificationManager notificationManager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager == null) return;

        Uri alarmSound = getAlarmSoundUri();
        AudioAttributes audioAttributes = getAlarmAudioAttributes();
        ensureAlarmChannel(context);

        // 2. Intent to open the note/events in MainActivity
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if ("event".equalsIgnoreCase(category)) {
            launchIntent.setAction(Intent.ACTION_VIEW);
            launchIntent.setData(Uri.parse("notebooksmart://events"));
        } else if (id != null) {
            launchIntent.putExtra("note_id", id);
        }

        int requestCode = id != null ? Math.abs(id.hashCode()) : (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body != null && !body.isEmpty() ? body : "Пора заглянуть в тетрадь")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null && !body.isEmpty() ? body : "Пора заглянуть в тетрадь"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(alarmSound)
            .setVibrate(new long[]{0, 500, 200, 500, 200, 700})
            .setFullScreenIntent(pendingIntent, true)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        if ("shopping".equalsIgnoreCase(category)) {
            builder.setSubText("🛒 Список покупок");
        } else if ("event".equalsIgnoreCase(category)) {
            builder.setSubText("📅 Событие • Напоминание");
        } else {
            builder.setSubText("📓 Заметка");
        }

        notificationManager.notify(requestCode, builder.build());

        // 3. Play ringtone directly as an alarm chime so it rings reliably
        try {
            Ringtone ringtone = RingtoneManager.getRingtone(context, alarmSound);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    ringtone.setAudioAttributes(audioAttributes);
                }
                ringtone.play();
            }
        } catch (Exception ignored) {}
    }
}
