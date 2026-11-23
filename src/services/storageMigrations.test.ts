import { describe, it, expect, beforeEach } from 'vitest';
import { Note } from '../types';
import {
  BACKUP_RETENTION_MS,
  CURRENT_SCHEMA_VERSION,
  MigrationStep,
  pruneExpiredBackups,
  runVersionedMigrations,
} from './storageMigrations';
import {
  enrichNoteMetadata,
  forceRecalculateAllNotes,
  getIncrementalParseCount,
  resetIncrementalParseCount,
} from './storage';

function makeSampleNote(id: string, content: string): Note {
  return {
    id,
    title: `Заметка ${id}`,
    content,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    category: 'payment',
    tags: ['#finances'],
  };
}

describe('storageMigrations — versioned DB migrations & rollback (DS R-INFRA-01)', () => {
  it('migrates v1 notes cleanly to v2 and creates a 7-day backup snapshot', () => {
    const now = 1760000000000;
    const rawV1 = [
      {
        id: 'n1',
        title: 'Бюджет',
        content: '+ Зарплата: 50000 руб',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        category: 'payment',
        tags: undefined as unknown as string[],
      },
    ] as Note[];

    const result = runVersionedMigrations(rawV1, 1, CURRENT_SCHEMA_VERSION, undefined, now);
    expect(result.success).toBe(true);
    expect(result.rolledBack).toBe(false);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.notes[0].tags).toEqual([]);
    expect(result.backupCreated).toBeDefined();
    expect(result.backupCreated?.expiresAt).toBe(now + BACKUP_RETENTION_MS);
  });

  it('rolls back cleanly to original snapshot when a corrupted migration throws', () => {
    const original = [makeSampleNote('n1', '- Кофе: 300 руб'), makeSampleNote('n2', '+ Аванс: 20000 руб')];
    const brokenStep: MigrationStep = {
      fromVersion: 1,
      toVersion: 2,
      name: 'corrupted_migration',
      migrate: (notes) => {
        // Attempt destructive mutation before crashing
        notes[0].content = 'CORRUPTED';
        throw new Error('Simulated migration corruption');
      },
    };

    const result = runVersionedMigrations(original, 1, 2, [brokenStep], 1760000000000);
    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.toVersion).toBe(1);
    expect(result.error).toContain('Simulated migration corruption');
    // Original data must remain 100% intact after rollback
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].content).toBe('- Кофе: 300 руб');
    expect(result.notes[1].content).toBe('+ Аванс: 20000 руб');
  });

  it('prunes expired pre-migration backups older than 7 days', () => {
    const now = 1760000000000;
    const kept = pruneExpiredBackups(
      [
        {
          id: 'expired',
          fromVersion: 1,
          toVersion: 2,
          createdAt: now - BACKUP_RETENTION_MS - 1000,
          expiresAt: now - 1000,
          notes: [],
        },
        {
          id: 'active',
          fromVersion: 1,
          toVersion: 2,
          createdAt: now - 1000,
          expiresAt: now + BACKUP_RETENTION_MS - 1000,
          notes: [],
        },
      ],
      now
    );

    expect(kept.map((b) => b.id)).toEqual(['active']);
  });
});

describe('storage — incremental parsing with lastParsedAt (DS R-INFRA-03)', () => {
  beforeEach(() => {
    resetIncrementalParseCount();
  });

  it('parses only the modified note out of 1000 notes without re-parsing unchanged notes', () => {
    // 1. Initial enrichment of 1000 notes
    const notes: Note[] = Array.from({ length: 1000 }, (_, i) =>
      enrichNoteMetadata(makeSampleNote(`note-${i}`, `- Расход ${i}: ${(i + 1) * 10} руб`), true)
    );
    expect(getIncrementalParseCount()).toBe(1000);
    expect(notes[0].lastParsedAt).toBeTypeOf('number');
    expect(notes[0].lastParsedHash).toBeTruthy();

    // 2. Modify only 1 note and run enrichNoteMetadata across all 1000 notes
    resetIncrementalParseCount();
    const updatedList = notes.map((n, idx) =>
      idx === 42 ? { ...n, content: '- Расход 42: 9999 руб' } : n
    );
    const reEnriched = updatedList.map((n) => enrichNoteMetadata(n, true));

    // Only the single modified note should have invoked the parser!
    expect(getIncrementalParseCount()).toBe(1);
    expect(reEnriched[42].cachedExpenses).toBe(9999);

    // 3. Explicit full recalculation forces re-parsing of all notes
    resetIncrementalParseCount();
    forceRecalculateAllNotes(reEnriched, true);
    expect(getIncrementalParseCount()).toBe(1000);
  });
});
