import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { Note, FirebaseConfig } from '../types';

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let activeUnsubscribe: Unsubscribe | null = null;

const FIREBASE_CONFIG_KEY = 'notebook_smart_firebase_config_v1';
const SYNC_ROOM_KEY = 'notebook_smart_sync_room_v1';

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config: FirebaseConfig): void {
  try {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

export function getSyncRoomCode(): string {
  let room = localStorage.getItem(SYNC_ROOM_KEY);
  if (!room) {
    room = `room_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    localStorage.setItem(SYNC_ROOM_KEY, room);
  }
  return room;
}

export function setSyncRoomCode(code: string): void {
  localStorage.setItem(SYNC_ROOM_KEY, code.trim().toUpperCase());
}

/**
 * Initializes Firebase instance if config exists
 */
export function initFirebase(config?: FirebaseConfig): Firestore | null {
  try {
    const activeConfig = config || getSavedFirebaseConfig();
    if (!activeConfig || !activeConfig.projectId) {
      return null;
    }

    if (!appInstance) {
      const existing = getApps();
      if (existing.length > 0) {
        appInstance = existing[0];
      } else {
        appInstance = initializeApp(activeConfig);
      }
    }

    firestoreInstance = getFirestore(appInstance);
    return firestoreInstance;
  } catch (error) {
    console.warn('Firebase initialization notice:', error);
    return null;
  }
}

/**
 * Subscribes to real-time note updates from Firestore for the given sync room
 */
export function subscribeToRemoteNotes(
  roomCode: string,
  onNotesReceived: (notes: Note[]) => void,
  onError: (err: Error) => void
): () => void {
  const db = initFirebase();
  if (!db) {
    return () => {};
  }

  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  const roomCol = collection(db, 'rooms', roomCode, 'notes');

  activeUnsubscribe = onSnapshot(
    roomCol,
    (snapshot) => {
      const remoteNotes: Note[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        remoteNotes.push({
          id: d.id,
          title: data.title || '',
          content: data.content || '',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          category: data.category || 'general',
          color: data.color,
          isPinned: data.isPinned || false,
          isArchived: data.isArchived || false,
          tags: data.tags || [],
        });
      });
      // Sort by pinned then updatedAt
      remoteNotes.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
      onNotesReceived(remoteNotes);
    },
    (error) => {
      console.warn('Firestore subscription notice:', error);
      onError(error);
    }
  );

  return () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
  };
}

/**
 * Sync a single note to Firestore
 */
export async function syncNoteToRemote(roomCode: string, note: Note): Promise<boolean> {
  const db = initFirebase();
  if (!db) return false;

  try {
    const noteRef = doc(db, 'rooms', roomCode, 'notes', note.id);
    await setDoc(
      noteRef,
      {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        category: note.category,
        color: note.color || '#3b82f6',
        isPinned: note.isPinned || false,
        isArchived: note.isArchived || false,
        tags: note.tags || [],
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Failed to sync note to remote Firestore:', err);
    return false;
  }
}

/**
 * Delete a note from Firestore
 */
export async function deleteNoteFromRemote(roomCode: string, noteId: string): Promise<boolean> {
  const db = initFirebase();
  if (!db) return false;

  try {
    const noteRef = doc(db, 'rooms', roomCode, 'notes', noteId);
    await deleteDoc(noteRef);
    return true;
  } catch (err) {
    console.warn('Failed to delete note from remote Firestore:', err);
    return false;
  }
}
