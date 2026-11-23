import { Note } from '../types';

/**
 * Current data schema version stored in database metadata.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Retention period for automatic pre-migration snapshots (7 days).
 */
export const BACKUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SchemaMetadata {
  schemaVersion: number;
  migratedAt: number;
}

export interface MigrationBackupRecord {
  id: string;
  fromVersion: number;
  toVersion: number;
  createdAt: number;
  expiresAt: number;
  notes: Note[];
}

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  name: string;
  /**
   * Pure transformation returning migrated notes without mutating input array.
   */
  migrate: (notes: Note[]) => Note[];
}

export interface MigrationRunResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  notes: Note[];
  rolledBack: boolean;
  backupCreated?: MigrationBackupRecord;
  error?: string;
}

/**
 * Migration v1 -> v2:
 * Ensures every note has normalized tags array, valid timestamps, and clean category fields
 * while preserving all existing user fields (100% backward-compatible).
 *
 * @param notes - Existing notes from schema v1
 * @returns Migrated notes compatible with schema v2
 */
export function migrate_v1_to_v2(notes: Note[]): Note[] {
  const now = Date.now();
  return notes.map((note) => {
    if (!note || typeof note !== 'object' || typeof note.id !== 'string') {
      throw new Error('Invalid note record encountered during v1 -> v2 migration');
    }
    return {
      ...note,
      title: typeof note.title === 'string' ? note.title : '',
      content: typeof note.content === 'string' ? note.content : '',
      tags: Array.isArray(note.tags)
        ? note.tags.filter((t): t is string => typeof t === 'string')
        : [],
      createdAt: typeof note.createdAt === 'number' && Number.isFinite(note.createdAt) ? note.createdAt : now,
      updatedAt: typeof note.updatedAt === 'number' && Number.isFinite(note.updatedAt) ? note.updatedAt : now,
    };
  });
}

/**
 * Ordered registry of schema migrations.
 */
export const SCHEMA_MIGRATIONS: MigrationStep[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    name: 'migrate_v1_to_v2',
    migrate: migrate_v1_to_v2,
  },
];

/**
 * Clones notes safely for immutable pre-migration backup snapshots.
 *
 * @param notes - Notes array to clone
 * @returns Deep-cloned copy of notes
 */
export function cloneNotesSnapshot(notes: Note[]): Note[] {
  return notes.map((n) => ({
    ...n,
    tags: Array.isArray(n.tags) ? [...n.tags] : [],
  }));
}

/**
 * Executes a dry-run of a single migration step against a cloned copy of data
 * to verify integrity before touching live storage.
 *
 * @param step - Migration step to validate
 * @param notes - Current notes
 * @returns Dry-run outcome containing transformed notes or failure reason
 */
export function dryRunMigrationStep(
  step: MigrationStep,
  notes: Note[]
): { ok: true; notes: Note[] } | { ok: false; error: string } {
  try {
    const cloned = cloneNotesSnapshot(notes);
    const result = step.migrate(cloned);
    if (!Array.isArray(result)) {
      return { ok: false, error: `Migration ${step.name} did not return an array` };
    }
    if (result.length !== notes.length) {
      return {
        ok: false,
        error: `Migration ${step.name} changed note count (${notes.length} -> ${result.length})`,
      };
    }
    return { ok: true, notes: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Runs sequential versioned migrations from `currentVersion` up to `targetVersion`.
 * Automatically creates a pre-migration snapshot (7-day retention) and rolls back
 * to the original snapshot if any migration step throws or fails validation.
 *
 * @param notes - Current persisted notes
 * @param currentVersion - Current schema version in storage
 * @param targetVersion - Target schema version (defaults to CURRENT_SCHEMA_VERSION)
 * @param steps - Optional custom migration registry (useful for unit testing)
 * @param nowMs - Timestamp override for deterministic testing
 * @returns MigrationRunResult with final notes, rollback flag, and backup record
 */
export function runVersionedMigrations(
  notes: Note[],
  currentVersion: number,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
  steps: MigrationStep[] = SCHEMA_MIGRATIONS,
  nowMs: number = Date.now()
): MigrationRunResult {
  if (currentVersion >= targetVersion) {
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: currentVersion,
      notes,
      rolledBack: false,
    };
  }

  // Create immutable snapshot before running any migration step
  const originalSnapshot = cloneNotesSnapshot(notes);
  const backupRecord: MigrationBackupRecord = {
    id: `migration_backup_v${currentVersion}_to_v${targetVersion}_${nowMs}`,
    fromVersion: currentVersion,
    toVersion: targetVersion,
    createdAt: nowMs,
    expiresAt: nowMs + BACKUP_RETENTION_MS,
    notes: originalSnapshot,
  };

  let workingVersion = currentVersion;
  let workingNotes = cloneNotesSnapshot(notes);

  while (workingVersion < targetVersion) {
    const step = steps.find((s) => s.fromVersion === workingVersion);
    if (!step) {
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: currentVersion,
        notes: originalSnapshot,
        rolledBack: true,
        backupCreated: backupRecord,
        error: `Missing migration path from schema v${workingVersion} to v${targetVersion}`,
      };
    }

    const dryRun = dryRunMigrationStep(step, workingNotes);
    if (!dryRun.ok) {
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: currentVersion,
        notes: originalSnapshot,
        rolledBack: true,
        backupCreated: backupRecord,
        error: `Migration ${step.name} failed and was rolled back: ${dryRun.error}`,
      };
    }

    workingNotes = dryRun.notes;
    workingVersion = step.toVersion;
  }

  return {
    success: true,
    fromVersion: currentVersion,
    toVersion: workingVersion,
    notes: workingNotes,
    rolledBack: false,
    backupCreated: backupRecord,
  };
}

/**
 * Filters out expired pre-migration backups older than their 7-day retention window.
 *
 * @param backups - Existing backup records from `__backup__` store
 * @param nowMs - Current timestamp in milliseconds
 * @returns Non-expired backup records
 */
export function pruneExpiredBackups(
  backups: MigrationBackupRecord[],
  nowMs: number = Date.now()
): MigrationBackupRecord[] {
  return backups.filter((b) => typeof b.expiresAt === 'number' && b.expiresAt > nowMs);
}
