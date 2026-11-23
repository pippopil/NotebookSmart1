import { EventCategory, Note } from '../types';

/**
 * Open-Format Exporters & Importers:
 * - Markdown + JSON Manifest bundle (DS R-PRIV-02)
 * - RFC 5545 iCalendar (.ics) export & read-only import (DS R-INT-01)
 */

export interface OpenExportManifest {
  format: 'notebooksmart-open-export';
  schemaVersion: number;
  exportedAt: string;
  notesCount: number;
  files: Array<{
    id: string;
    fileName: string;
    title: string;
    category: Note['category'];
    tags: string[];
    createdAt: number;
    updatedAt: number;
    cachedTotal?: number;
    cachedIncome?: number;
    cachedExpenses?: number;
    currency?: string;
    eventDate?: string;
    eventTime?: string;
    eventCategory?: EventCategory;
    isEventDone?: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
    paperStyle?: Note['paperStyle'];
    reminderDateTime?: string;
    reminderEnabled?: boolean;
  }>;
  /**
   * Full note records embedded for lossless 1:1 round-trip import into a clean install.
   */
  notes: Note[];
}

export interface MarkdownBundleResult {
  dateFolder: string;
  markdownDocument: string;
  manifest: OpenExportManifest;
  noteFiles: Array<{ path: string; content: string }>;
}

/**
 * Converts a note title into a safe, human-readable filename slug.
 *
 * @param title - Raw note title
 * @param fallbackId - Fallback note ID when title has no alphanumeric characters
 * @returns Sanitized filename without extension
 */
function slugifyFileName(title: string, fallbackId: string): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s_-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 48);
  return cleaned || fallbackId.replace(/[^a-z0-9_-]/gi, '');
}

/**
 * Renders a single note as a clean Markdown document with YAML frontmatter.
 *
 * @param note - Note to serialize
 * @returns Markdown string with metadata frontmatter
 */
export function noteToMarkdown(note: Note): string {
  const frontmatterLines = [
    '---',
    `id: "${note.id}"`,
    `title: "${(note.title || '').replace(/"/g, '\\"')}"`,
    `category: "${note.category}"`,
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
  ];

  if (note.tags && note.tags.length > 0) {
    frontmatterLines.push(`tags: [${note.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }
  if (note.eventDate) {
    frontmatterLines.push(`eventDate: "${note.eventDate}"`);
  }
  if (note.eventTime) {
    frontmatterLines.push(`eventTime: "${note.eventTime}"`);
  }
  if (typeof note.cachedTotal === 'number' && note.cachedTotal !== 0) {
    frontmatterLines.push(`total: ${note.cachedTotal}`);
  }
  if (note.currency) {
    frontmatterLines.push(`currency: "${note.currency}"`);
  }
  frontmatterLines.push('---', '');

  const heading = `# ${note.title || 'Без названия'}\n\n`;
  return `${frontmatterLines.join('\n')}${heading}${note.content || ''}\n`;
}

/**
 * Generates an open-format Markdown + JSON manifest bundle (export/YYYY-MM-DD/notes/*.md + manifest.json).
 *
 * @param notes - Notes to export
 * @param exportedAtDate - Optional Date override for deterministic testing
 * @returns Combined Markdown export, individual note paths, and 1:1 restorable JSON manifest
 */
export function buildMarkdownExportBundle(
  notes: Note[],
  exportedAtDate: Date = new Date()
): MarkdownBundleResult {
  const dateFolder = exportedAtDate.toISOString().slice(0, 10);
  const noteFiles: Array<{ path: string; content: string }> = [];
  const manifestFiles: OpenExportManifest['files'] = [];

  notes.forEach((note, idx) => {
    const slug = slugifyFileName(note.title || '', note.id || `note_${idx + 1}`);
    const fileName = `${String(idx + 1).padStart(2, '0')}_${slug}.md`;
    const path = `export/${dateFolder}/notes/${fileName}`;
    const mdContent = noteToMarkdown(note);

    noteFiles.push({ path, content: mdContent });
    manifestFiles.push({
      id: note.id,
      fileName: `notes/${fileName}`,
      title: note.title,
      category: note.category,
      tags: Array.isArray(note.tags) ? [...note.tags] : [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      cachedTotal: note.cachedTotal,
      cachedIncome: note.cachedIncome,
      cachedExpenses: note.cachedExpenses,
      currency: note.currency,
      eventDate: note.eventDate,
      eventTime: note.eventTime,
      eventCategory: note.eventCategory,
      isEventDone: note.isEventDone,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      paperStyle: note.paperStyle,
      reminderDateTime: note.reminderDateTime,
      reminderEnabled: note.reminderEnabled,
    });
  });

  const manifest: OpenExportManifest = {
    format: 'notebooksmart-open-export',
    schemaVersion: 2,
    exportedAt: exportedAtDate.toISOString(),
    notesCount: notes.length,
    files: manifestFiles,
    notes: notes.map((n) => ({
      ...n,
      tags: Array.isArray(n.tags) ? [...n.tags] : [],
    })),
  };

  const markdownDocument = [
    `# NotebookSmart Export (${dateFolder})`,
    '',
    `Всего заметок: **${notes.length}**`,
    '',
    '---',
    '',
    ...noteFiles.map((f) => `<!-- ${f.path} -->\n${f.content}`),
  ].join('\n');

  return {
    dateFolder,
    markdownDocument,
    manifest,
    noteFiles,
  };
}

/**
 * Parses an exported JSON manifest (or legacy JSON backup) back into Note[] for 1:1 recovery.
 *
 * @param rawJson - Raw JSON text from manifest.json or backup JSON
 * @returns Validated array of notes or null if invalid
 */
export function parseOpenExportManifest(rawJson: string): Note[] | null {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      return parsed.filter(isNoteLike);
    }
    if (parsed && typeof parsed === 'object' && 'notes' in parsed) {
      const candidate = (parsed as { notes: unknown }).notes;
      if (Array.isArray(candidate)) {
        return candidate.filter(isNoteLike);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function isNoteLike(item: unknown): item is Note {
  if (!item || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return typeof rec.id === 'string' && typeof rec.content === 'string';
}

/* ==================== RFC 5545 iCalendar (.ics) ==================== */

/**
 * Escapes text values according to RFC 5545 Section 3.3.11.
 *
 * @param value - Plain string
 * @returns Escaped ICS text
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Unescapes RFC 5545 escaped sequences back into plain text.
 *
 * @param value - Raw ICS property value
 * @returns Unescaped string
 */
function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Formats a YYYY-MM-DD date and optional HH:mm time as an iCal DTSTART value.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Optional time in HH:mm format
 * @returns Tuple of ICS property prefix and formatted value
 */
function formatIcsDateTime(dateStr: string, timeStr?: string): { dtStart: string; dtEnd: string } {
  const compactDate = dateStr.replace(/-/g, '');
  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(Number);
    const startH = String(hh).padStart(2, '0');
    const startM = String(mm).padStart(2, '0');
    const endHour = Math.min(23, hh + 1);
    const endH = String(endHour).padStart(2, '0');
    return {
      dtStart: `DTSTART:${compactDate}T${startH}${startM}00`,
      dtEnd: `DTEND:${compactDate}T${endH}${startM}00`,
    };
  }
  return {
    dtStart: `DTSTART;VALUE=DATE:${compactDate}`,
    dtEnd: `DTEND;VALUE=DATE:${compactDate}`,
  };
}

/**
 * Exports all non-archived NotebookSmart events (and dated reminders) to RFC 5545 `.ics` format.
 *
 * @param notes - Full list of notes
 * @param nowDate - Optional timestamp override for DTSTAMP
 * @returns Valid iCalendar `.ics` file contents
 */
export function exportEventsToICS(notes: Note[], nowDate: Date = new Date()): string {
  const dtStamp = nowDate
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  const eventNotes = notes.filter(
    (n) => !n.isArchived && (n.eventDate || (n.reminderEnabled && n.reminderDateTime))
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NotebookSmart//Events Calendar//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const note of eventNotes) {
    const dateStr = note.eventDate || (note.reminderDateTime ? note.reminderDateTime.slice(0, 10) : '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const timeStr =
      note.eventTime ||
      (note.reminderDateTime && note.reminderDateTime.length >= 16
        ? note.reminderDateTime.slice(11, 16)
        : undefined);

    const { dtStart, dtEnd } = formatIcsDateTime(dateStr, timeStr);
    const summary = escapeIcsText((note.title || 'Событие NotebookSmart').trim());
    const description = escapeIcsText((note.content || '').trim());
    const categories = note.eventCategory ? note.eventCategory.toUpperCase() : 'EVENT';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${note.id}@notebooksmart.local`,
      `DTSTAMP:${dtStamp}`,
      dtStart,
      dtEnd,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `CATEGORIES:${categories}`,
      `STATUS:${note.isEventDone ? 'COMPLETED' : 'CONFIRMED'}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Imports events from a standard `.ics` calendar string (read-only import into NotebookSmart event notes).
 *
 * @param icsText - Raw text content of an `.ics` file
 * @returns Array of new Note objects with `category: 'event'`
 */
export function parseICSContent(icsText: string): Note[] {
  if (!icsText || !icsText.includes('BEGIN:VEVENT')) {
    return [];
  }

  // Unfold folded ICS lines (CRLF + single space/tab)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const eventBlocks = unfolded.split('BEGIN:VEVENT').slice(1);
  const imported: Note[] = [];
  const now = Date.now();

  eventBlocks.forEach((block, index) => {
    const endIdx = block.indexOf('END:VEVENT');
    const body = endIdx !== -1 ? block.slice(0, endIdx) : block;
    const rawLines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);

    let summary = '';
    let description = '';
    let eventDate = '';
    let eventTime: string | undefined;
    let uid = '';
    let isDone = false;

    for (const line of rawLines) {
      const colonPos = line.indexOf(':');
      if (colonPos === -1) continue;
      const keyPart = line.slice(0, colonPos).toUpperCase();
      const valPart = line.slice(colonPos + 1).trim();

      if (keyPart === 'SUMMARY' || keyPart.startsWith('SUMMARY;')) {
        summary = unescapeIcsText(valPart);
      } else if (keyPart === 'DESCRIPTION' || keyPart.startsWith('DESCRIPTION;')) {
        description = unescapeIcsText(valPart);
      } else if (keyPart === 'UID') {
        uid = valPart;
      } else if (keyPart === 'STATUS') {
        isDone = valPart.toUpperCase() === 'COMPLETED';
      } else if (keyPart === 'DTSTART' || keyPart.startsWith('DTSTART;')) {
        // Matches YYYYMMDD or YYYYMMDDTHHMMSS(Z)
        const match = valPart.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        if (match) {
          eventDate = `${match[1]}-${match[2]}-${match[3]}`;
          if (match[4] && match[5]) {
            eventTime = `${match[4]}:${match[5]}`;
          }
        }
      }
    }

    if (!summary && !description) return;
    if (!eventDate) {
      eventDate = new Date(now).toISOString().slice(0, 10);
    }

    imported.push({
      id: `ics-${now}-${index}-${uid.replace(/[^a-z0-9]/gi, '').slice(0, 8) || index}`,
      title: summary || 'Импортированное событие',
      content: description || summary,
      createdAt: now + index,
      updatedAt: now + index,
      category: 'event',
      eventDate,
      eventTime,
      eventCategory: 'meeting',
      isEventDone: isDone,
      paperStyle: 'grid',
      tags: ['#calendar', '#imported'],
    });
  });

  return imported;
}

/**
 * Triggers a client-side file download for exported Markdown, JSON manifest, or `.ics` files.
 *
 * @param content - Text content of file
 * @param fileName - Download filename with extension
 * @param mimeType - MIME type string
 */
export function triggerTextFileDownload(
  content: string,
  fileName: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
