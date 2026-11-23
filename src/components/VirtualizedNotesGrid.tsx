import React, { useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Note } from '../types';
import { NoteCard } from './NoteCard';

interface VirtualizedNotesGridProps {
  notes: Note[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isSectionLocked: (category: Note['category']) => boolean;
  globalAutoCalculate: boolean;
  onOpen: (note: Note) => void;
  onTogglePin: (id: string) => void;
  onOpenShopping: (note: Note) => void;
  onTagClick: (tag: string) => void;
  onShare: (note: Note) => void;
}

const VIRTUALIZATION_THRESHOLD = 24;

/**
 * Responsive 1-col / 2-col notes grid backed by `@tanstack/react-virtual` (`useVirtualizer`)
 * attached to the app's `flex-1 overflow-y-auto` scroll container when rendering > 24 notes
 * (QW 1.1 / DS R-INFRA-04).
 */
export const VirtualizedNotesGrid: React.FC<VirtualizedNotesGridProps> = ({
  notes,
  scrollContainerRef,
  isSectionLocked,
  globalAutoCalculate,
  onOpen,
  onTogglePin,
  onOpenShopping,
  onTagClick,
  onShare,
}) => {
  const [columns, setColumns] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 640 ? 2 : 1
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 640px)');
    const updateCols = () => setColumns(mq.matches ? 2 : 1);
    updateCols();
    mq.addEventListener('change', updateCols);
    return () => mq.removeEventListener('change', updateCols);
  }, []);

  const rowCount = Math.ceil(notes.length / columns);
  const shouldVirtualize = notes.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rowCount : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 210,
    overscan: 4,
  });

  if (!shouldVirtualize) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isLocked={isSectionLocked(note.category)}
            globalAutoCalculate={globalAutoCalculate}
            onOpen={onOpen}
            onTogglePin={onTogglePin}
            onOpenShopping={onOpenShopping}
            onTagClick={onTagClick}
            onShare={onShare}
          />
        ))}
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      className="relative w-full"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const startIdx = virtualRow.index * columns;
        const rowNotes = notes.slice(startIdx, startIdx + columns);
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full pb-3.5"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {rowNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isLocked={isSectionLocked(note.category)}
                  globalAutoCalculate={globalAutoCalculate}
                  onOpen={onOpen}
                  onTogglePin={onTogglePin}
                  onOpenShopping={onOpenShopping}
                  onTagClick={onTagClick}
                  onShare={onShare}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
