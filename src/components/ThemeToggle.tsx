import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative inline-flex items-center gap-1.5 p-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer border ${
        isDark
          ? 'bg-stone-800/90 hover:bg-stone-700/90 text-amber-400 border-stone-700 shadow-inner'
          : 'bg-amber-50 hover:bg-amber-100/90 text-amber-800 border-amber-200/80 shadow-xs'
      } ${className}`}
      title={isDark ? 'Переключить на дневной светлый режим' : 'Переключить на ночной режим'}
      aria-label="Переключение режима день / ночь"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Moon className="w-4 h-4 transition-transform duration-300 text-amber-300 fill-amber-300/20" />
        ) : (
          <Sun className="w-4 h-4 transition-transform duration-300 text-amber-600 fill-amber-400/30" />
        )}
      </div>

      {!compact && (
        <span className="text-xs font-semibold select-none hidden sm:inline">
          {isDark ? 'Ночь' : 'День'}
        </span>
      )}
    </button>
  );
};
