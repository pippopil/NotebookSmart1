import { describe, it, expect } from 'vitest';
import { Note } from '../types';
import {
  buildMarkdownExportBundle,
  exportEventsToICS,
  parseICSContent,
  parseOpenExportManifest,
} from './exportFormats';

const sampleNotes: Note[] = [
  {
    id: 'n-finance',
    title: 'Бюджет октября',
    content: '+ Зарплата: 100000 руб\n- Аренда: 35000 руб',
    createdAt: 1760000000000,
    updatedAt: 1760000500000,
    category: 'payment',
    tags: ['#finances', '#personal'],
    cachedTotal: 65000,
    cachedIncome: 100000,
    cachedExpenses: 35000,
    currency: '₽',
  },
  {
    id: 'n-event',
    title: 'Созвон с дизайнером',
    content: 'Обсудить макеты главной страницы',
    createdAt: 1760001000000,
    updatedAt: 1760001000000,
    category: 'event',
    eventDate: '2026-11-25',
    eventTime: '14:30',
    eventCategory: 'meeting',
    tags: ['#work'],
  },
];

describe('exportFormats — Markdown + JSON Manifest (DS R-PRIV-02)', () => {
  it('builds structured export/YYYY-MM-DD/notes/*.md and restores 1:1 from manifest', () => {
    const bundle = buildMarkdownExportBundle(sampleNotes, new Date('2026-11-23T12:00:00Z'));

    expect(bundle.dateFolder).toBe('2026-11-23');
    expect(bundle.noteFiles).toHaveLength(2);
    expect(bundle.noteFiles[0].path).toMatch(/^export\/2026-11-23\/notes\/01_.*\.md$/);
    expect(bundle.markdownDocument).toContain('# Бюджет октября');
    expect(bundle.manifest.format).toBe('notebooksmart-open-export');
    expect(bundle.manifest.notesCount).toBe(2);

    const restored = parseOpenExportManifest(JSON.stringify(bundle.manifest));
    expect(restored).not.toBeNull();
    expect(restored).toHaveLength(2);
    expect(restored?.[0].id).toBe('n-finance');
    expect(restored?.[0].tags).toEqual(['#finances', '#personal']);
    expect(restored?.[0].cachedTotal).toBe(65000);
    expect(restored?.[1].eventDate).toBe('2026-11-25');
  });
});

describe('exportFormats — iCalendar (.ics) export & read-only import (DS R-INT-01)', () => {
  it('exports NotebookSmart events to valid RFC 5545 ICS and imports them back cleanly', () => {
    const ics = exportEventsToICS(sampleNotes, new Date('2026-11-23T12:00:00Z'));

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20261125T143000');
    expect(ics).toContain('SUMMARY:Созвон с дизайнером');
    expect(ics).toContain('END:VCALENDAR');

    const imported = parseICSContent(ics);
    expect(imported).toHaveLength(1);
    expect(imported[0].category).toBe('event');
    expect(imported[0].title).toBe('Созвон с дизайнером');
    expect(imported[0].content).toBe('Обсудить макеты главной страницы');
    expect(imported[0].eventDate).toBe('2026-11-25');
    expect(imported[0].eventTime).toBe('14:30');
    expect(imported[0].tags).toContain('#imported');
  });
});
