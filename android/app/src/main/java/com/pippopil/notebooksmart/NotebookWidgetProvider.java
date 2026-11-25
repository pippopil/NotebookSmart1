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
import android.os.Bundle;
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

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        Bundle newOptions
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        updateAppWidget(context, appWidgetManager, appWidgetId);
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

        // Compute adaptive bitmap size matching the left calendar pane's exact aspect ratio
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        int widgetWidthDp = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320) : 320;
        int widgetHeightDp = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180) : 180;
        if (widgetWidthDp <= 0) widgetWidthDp = 320;
        if (widgetHeightDp <= 0) widgetHeightDp = 180;

        float paneWidthDp = Math.max(150f, (widgetWidthDp - 27f) * (1.45f / 2.45f));
        float paneHeightDp = Math.max(104f, widgetHeightDp - 14f);

        // Render at high sharpness (~2.8px/dp) while staying comfortably inside RemoteViews IPC limits
        float scale = 2.8f;
        int bmpWidth = Math.round(paneWidthDp * scale);
        int bmpHeight = Math.round(paneHeightDp * scale);
        int maxPixels = 360000; // ~1.4MB raw, well below IPC cap
        if ((long) bmpWidth * bmpHeight > maxPixels) {
            double ratio = Math.sqrt((double) maxPixels / ((double) bmpWidth * bmpHeight));
            bmpWidth = Math.max(360, (int) Math.round(bmpWidth * ratio));
            bmpHeight = Math.max(240, (int) Math.round(bmpHeight * ratio));
        } else {
            bmpWidth = Math.max(420, Math.min(680, bmpWidth));
            bmpHeight = Math.max(280, Math.min(560, bmpHeight));
        }

        Bitmap calendarBitmap = renderMonthCalendarBitmap(eventsJson, bmpWidth, bmpHeight);
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

    private static Bitmap renderMonthCalendarBitmap(String eventsJsonStr, int width, int height) {
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

        // Use exact required rows (5 for most months, 6 only when needed) so cells are ~20% taller
        int totalRows = Math.max(5, Math.min(6, (startOffset + daysInMonth + 6) / 7));

        float colWidth = width / 7f;
        float headerHeight = Math.max(34f, height * 0.145f);
        float weekdayHeight = Math.max(26f, height * 0.11f);

        // Header: Bold Month & Year
        Paint headerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setColor(Color.parseColor("#111827"));
        headerPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        float headerFontSize = Math.min(headerHeight * 0.78f, width * 0.072f);
        headerPaint.setTextSize(headerFontSize);
        Paint.FontMetrics headerFm = headerPaint.getFontMetrics();
        float headerBaseline = (headerHeight / 2f) - (headerFm.ascent + headerFm.descent) / 2f;
        String monthTitle = MONTH_NAMES_RU[month] + " " + year;
        canvas.drawText(monthTitle, 4f, headerBaseline, headerPaint);

        // Compact workload legend dots in top-right of calendar header
        float legendDotR = Math.max(4.5f, Math.min(7.5f, headerHeight * 0.16f));
        float legendY = headerHeight * 0.5f;
        float legendGap = legendDotR * 3.0f;
        Paint legendDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        legendDotPaint.setColor(Color.parseColor("#16A34A"));
        canvas.drawCircle(width - legendGap * 2.5f, legendY, legendDotR, legendDotPaint);
        legendDotPaint.setColor(Color.parseColor("#D97706"));
        canvas.drawCircle(width - legendGap * 1.5f, legendY, legendDotR, legendDotPaint);
        legendDotPaint.setColor(Color.parseColor("#E11D48"));
        canvas.drawCircle(width - legendGap * 0.5f, legendY, legendDotR, legendDotPaint);

        // Weekday headers (crisp, bold, high-contrast)
        float weekdayTop = headerHeight;
        Paint weekdayPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float weekdayFontSize = Math.min(weekdayHeight * 0.78f, colWidth * 0.40f);
        weekdayPaint.setTextSize(weekdayFontSize);
        weekdayPaint.setTextAlign(Paint.Align.CENTER);
        weekdayPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        Paint.FontMetrics weekdayFm = weekdayPaint.getFontMetrics();
        float weekdayBaseline = weekdayTop + (weekdayHeight / 2f) - (weekdayFm.ascent + weekdayFm.descent) / 2f;

        for (int c = 0; c < 7; c++) {
            weekdayPaint.setColor(c >= 5 ? Color.parseColor("#DC2626") : Color.parseColor("#57534E"));
            canvas.drawText(WEEKDAYS_RU[c], c * colWidth + colWidth / 2f, weekdayBaseline, weekdayPaint);
        }

        // Day grid (5 or 6 rows x 7 cols)
        float cellsTop = weekdayTop + weekdayHeight + 2f;
        float cellsHeight = height - cellsTop - 2f;
        float rowHeight = cellsHeight / (float) totalRows;

        Paint cellFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint cellBorderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        cellBorderPaint.setStyle(Paint.Style.STROKE);
        cellBorderPaint.setStrokeWidth(Math.max(3f, rowHeight * 0.065f));

        Paint dayTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float dayFontSize = Math.min(rowHeight * 0.62f, colWidth * 0.56f);
        dayTextPaint.setTextSize(dayFontSize);
        dayTextPaint.setTextAlign(Paint.Align.CENTER);
        dayTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        Paint.FontMetrics dayFm = dayTextPaint.getFontMetrics();

        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float cellMarginX = Math.max(1.5f, colWidth * 0.03f);
        float cellMarginY = Math.max(1.5f, rowHeight * 0.04f);
        float cornerRadius = Math.max(8f, Math.min(14f, rowHeight * 0.22f));
        float dotRadius = Math.max(2.5f, Math.min(4.2f, rowHeight * 0.07f));

        for (int day = 1; day <= daysInMonth; day++) {
            int cellIndex = startOffset + (day - 1);
            int row = cellIndex / 7;
            int col = cellIndex % 7;
            if (row >= totalRows) break;

            float left = col * colWidth + cellMarginX;
            float top = cellsTop + row * rowHeight + cellMarginY;
            float right = (col + 1) * colWidth - cellMarginX;
            float bottom = cellsTop + (row + 1) * rowHeight - cellMarginY;
            RectF rect = new RectF(left, top, right, bottom);

            String key = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day);
            int load = eventsMap.optInt(key, 0);
            boolean isToday = (day == todayDay);
            boolean isWeekend = (col >= 5);

            // High-contrast background color by workload
            if (load >= 4) {
                cellFillPaint.setColor(Color.parseColor("#FECDD3"));
                canvas.drawRoundRect(rect, cornerRadius, cornerRadius, cellFillPaint);
            } else if (load >= 2) {
                cellFillPaint.setColor(Color.parseColor("#FDE68A"));
                canvas.drawRoundRect(rect, cornerRadius, cornerRadius, cellFillPaint);
            } else if (load == 1) {
                cellFillPaint.setColor(Color.parseColor("#BBF7D0"));
                canvas.drawRoundRect(rect, cornerRadius, cornerRadius, cellFillPaint);
            } else if (isToday) {
                cellFillPaint.setColor(Color.parseColor("#FEF08A"));
                canvas.drawRoundRect(rect, cornerRadius, cornerRadius, cellFillPaint);
            }

            // Strong Today outline highlight
            if (isToday) {
                cellBorderPaint.setColor(Color.parseColor("#B45309"));
                canvas.drawRoundRect(rect, cornerRadius, cornerRadius, cellBorderPaint);
            }

            // High-contrast bold day number color
            if (load >= 4) {
                dayTextPaint.setColor(Color.parseColor("#9F1239"));
            } else if (load >= 2) {
                dayTextPaint.setColor(Color.parseColor("#78350F"));
            } else if (load == 1) {
                dayTextPaint.setColor(Color.parseColor("#14532D"));
            } else if (isToday) {
                dayTextPaint.setColor(Color.parseColor("#78350F"));
            } else {
                dayTextPaint.setColor(isWeekend ? Color.parseColor("#DC2626") : Color.parseColor("#1C1917"));
            }

            float centerX = rect.centerX();
            float verticalOffset = load > 0 ? -(rowHeight * 0.07f) : 0f;
            float textY = rect.centerY() + verticalOffset - (dayFm.ascent + dayFm.descent) / 2f;
            canvas.drawText(String.valueOf(day), centerX, textY, dayTextPaint);

            // Workload indicator dots cleanly placed at bottom of cell
            if (load > 0) {
                int dotCount = Math.min(load, 3);
                if (load >= 4) {
                    dotPaint.setColor(Color.parseColor("#E11D48"));
                } else if (load >= 2) {
                    dotPaint.setColor(Color.parseColor("#D97706"));
                } else {
                    dotPaint.setColor(Color.parseColor("#16A34A"));
                }
                float spacing = dotRadius * 2.8f;
                float startX = centerX - ((dotCount - 1) * spacing) / 2f;
                float dotY = bottom - dotRadius - Math.max(2f, rowHeight * 0.05f);
                for (int d = 0; d < dotCount; d++) {
                    canvas.drawCircle(startX + d * spacing, dotY, dotRadius, dotPaint);
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
