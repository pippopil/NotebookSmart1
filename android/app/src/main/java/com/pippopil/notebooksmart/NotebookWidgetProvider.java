package com.pippopil.notebooksmart;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONObject;

public class NotebookWidgetProvider extends AppWidgetProvider {
    public static final String PREFS_NAME = "NotebookSmartWidgetPrefs";
    public static final String KEY_TITLE = "widget_title";
    public static final String KEY_BADGE = "widget_badge";
    public static final String KEY_SUMMARY = "widget_summary";
    public static final String KEY_ITEM1 = "widget_item_1";
    public static final String KEY_ITEM2 = "widget_item_2";
    public static final String KEY_ITEM3 = "widget_item_3";
    public static final String KEY_REMAINING = "widget_remaining";

    public static final String KEY_EVENTS_BY_DATE = "events_by_date";
    public static final String KEY_NEAREST_EVENT_TITLE = "nearest_event_title";
    public static final String KEY_NEAREST_EVENT_SUB = "nearest_event_sub";
    public static final String KEY_NEAREST_REMINDER_TITLE = "nearest_reminder_title";
    public static final String KEY_NEAREST_REMINDER_SUB = "nearest_reminder_sub";
    public static final String KEY_NEAREST_TASK_TITLE = "nearest_task_title";
    public static final String KEY_NEAREST_TASK_SUB = "nearest_task_sub";

    private static final String[] MONTH_NAMES_RU = {
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    };

    private static final String[] WEEKDAYS_RU = {
        "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String eventsJson = prefs.getString(KEY_EVENTS_BY_DATE, "{}");
        String nearestEventTitle = prefs.getString(KEY_NEAREST_EVENT_TITLE, "Нет событий");
        String nearestEventSub = prefs.getString(KEY_NEAREST_EVENT_SUB, "Нажмите для перехода");
        String nearestReminderTitle = prefs.getString(KEY_NEAREST_REMINDER_TITLE, "Не назначено");
        String nearestReminderSub = prefs.getString(KEY_NEAREST_REMINDER_SUB, "—");
        String nearestTaskTitle = prefs.getString(KEY_NEAREST_TASK_TITLE, "Все выполнены");
        String nearestTaskSub = prefs.getString(KEY_NEAREST_TASK_SUB, "—");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_notebook);

        views.setTextViewText(R.id.widget_nearest_event, nearestEventTitle);
        views.setTextViewText(R.id.widget_nearest_event_sub, nearestEventSub);
        views.setTextViewText(R.id.widget_nearest_reminder, nearestReminderTitle);
        views.setTextViewText(R.id.widget_nearest_reminder_sub, nearestReminderSub);
        views.setTextViewText(R.id.widget_nearest_task, nearestTaskTitle);
        views.setTextViewText(R.id.widget_nearest_task_sub, nearestTaskSub);

        // Render high-contrast calendar bitmap (480x360 stays cleanly within RemoteViews IPC limit)
        Bitmap calendarBitmap = renderMonthCalendarBitmap(eventsJson);
        views.setImageViewBitmap(R.id.widget_calendar_image, calendarBitmap);

        // Launch Events/Calendar screen directly on tap
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("notebooksmart://events"), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            10,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap renderMonthCalendarBitmap(String eventsJsonStr) {
        int width = 480;
        int height = 360;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.TRANSPARENT);

        JSONObject eventsMap;
        try {
            eventsMap = new JSONObject(eventsJsonStr != null ? eventsJsonStr : "{}");
        } catch (Exception e) {
            eventsMap = new JSONObject();
        }

        Calendar cal = Calendar.getInstance();
        int year = cal.get(Calendar.YEAR);
        int month = cal.get(Calendar.MONTH); // 0-indexed
        int todayDay = cal.get(Calendar.DAY_OF_MONTH);
        int daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH);

        // Find weekday offset of 1st day of month (Monday = 0 .. Sunday = 6)
        Calendar firstDayCal = Calendar.getInstance();
        firstDayCal.set(year, month, 1);
        int dow = firstDayCal.get(Calendar.DAY_OF_WEEK); // Sun=1, Mon=2..Sat=7
        int startOffset = (dow == Calendar.SUNDAY) ? 6 : (dow - Calendar.MONDAY);

        // Header: Month Year
        Paint headerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setColor(Color.parseColor("#1C1917"));
        headerPaint.setTextSize(26f);
        headerPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        String monthTitle = MONTH_NAMES_RU[month] + " " + year;
        canvas.drawText(monthTitle, 10f, 30f, headerPaint);

        // Small legend dots in top-right of calendar
        Paint legendDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        legendDotPaint.setColor(Color.parseColor("#16A34A"));
        canvas.drawCircle(width - 74f, 21f, 6f, legendDotPaint);
        legendDotPaint.setColor(Color.parseColor("#D97706"));
        canvas.drawCircle(width - 52f, 21f, 6f, legendDotPaint);
        legendDotPaint.setColor(Color.parseColor("#E11D48"));
        canvas.drawCircle(width - 30f, 21f, 6f, legendDotPaint);

        // Weekday headers
        float gridTop = 48f;
        float colWidth = width / 7f;
        Paint weekdayPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        weekdayPaint.setTextSize(17f);
        weekdayPaint.setTextAlign(Paint.Align.CENTER);
        weekdayPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        for (int c = 0; c < 7; c++) {
            weekdayPaint.setColor(c >= 5 ? Color.parseColor("#E11D48") : Color.parseColor("#78716C"));
            canvas.drawText(WEEKDAYS_RU[c], c * colWidth + colWidth / 2f, gridTop + 16f, weekdayPaint);
        }

        // Day grid (6 rows x 7 cols)
        float cellsTop = gridTop + 28f;
        float cellsHeight = height - cellsTop - 4f;
        float rowHeight = cellsHeight / 6f;

        Paint cellFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint cellBorderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        cellBorderPaint.setStyle(Paint.Style.STROKE);
        cellBorderPaint.setStrokeWidth(3f);

        Paint dayTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dayTextPaint.setTextSize(20f);
        dayTextPaint.setTextAlign(Paint.Align.CENTER);

        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        for (int day = 1; day <= daysInMonth; day++) {
            int cellIndex = startOffset + (day - 1);
            int row = cellIndex / 7;
            int col = cellIndex % 7;
            if (row >= 6) break;

            float left = col * colWidth + 3f;
            float top = cellsTop + row * rowHeight + 2f;
            float right = (col + 1) * colWidth - 3f;
            float bottom = cellsTop + (row + 1) * rowHeight - 2f;
            RectF rect = new RectF(left, top, right, bottom);

            String key = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day);
            int load = eventsMap.optInt(key, 0);
            boolean isToday = (day == todayDay);
            boolean isWeekend = (col >= 5);

            // Background color by workload
            if (load >= 4) {
                cellFillPaint.setColor(Color.parseColor("#FFE4E6"));
                canvas.drawRoundRect(rect, 10f, 10f, cellFillPaint);
            } else if (load >= 2) {
                cellFillPaint.setColor(Color.parseColor("#FEF3C7"));
                canvas.drawRoundRect(rect, 10f, 10f, cellFillPaint);
            } else if (load == 1) {
                cellFillPaint.setColor(Color.parseColor("#DCFCE7"));
                canvas.drawRoundRect(rect, 10f, 10f, cellFillPaint);
            } else if (isToday) {
                cellFillPaint.setColor(Color.parseColor("#FEF9C3"));
                canvas.drawRoundRect(rect, 10f, 10f, cellFillPaint);
            }

            // Today outline highlight
            if (isToday) {
                cellBorderPaint.setColor(Color.parseColor("#D97706"));
                canvas.drawRoundRect(rect, 10f, 10f, cellBorderPaint);
            }

            // Day number color
            if (load >= 4) {
                dayTextPaint.setColor(Color.parseColor("#BE123C"));
                dayTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            } else if (load >= 2) {
                dayTextPaint.setColor(Color.parseColor("#B45309"));
                dayTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            } else if (load == 1) {
                dayTextPaint.setColor(Color.parseColor("#15803D"));
                dayTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            } else if (isToday) {
                dayTextPaint.setColor(Color.parseColor("#92400E"));
                dayTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            } else {
                dayTextPaint.setColor(isWeekend ? Color.parseColor("#E11D48") : Color.parseColor("#292524"));
                dayTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
            }

            float centerX = rect.centerX();
            float textY = rect.centerY() + (load > 0 ? 4f : 7f);
            canvas.drawText(String.valueOf(day), centerX, textY, dayTextPaint);

            // Workload indicator dots at bottom of cell
            if (load > 0) {
                int dotCount = Math.min(load, 3);
                if (load >= 4) {
                    dotPaint.setColor(Color.parseColor("#E11D48"));
                } else if (load >= 2) {
                    dotPaint.setColor(Color.parseColor("#D97706"));
                } else {
                    dotPaint.setColor(Color.parseColor("#16A34A"));
                }
                float spacing = 7f;
                float startX = centerX - ((dotCount - 1) * spacing) / 2f;
                float dotY = bottom - 6f;
                for (int d = 0; d < dotCount; d++) {
                    canvas.drawCircle(startX + d * spacing, dotY, 2.5f, dotPaint);
                }
            }
        }

        return bitmap;
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, NotebookWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(widget);
        if (ids != null && ids.length > 0) {
            for (int id : ids) {
                updateAppWidget(context, manager, id);
            }
        }
    }
}
