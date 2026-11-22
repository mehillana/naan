import {Bookmark, Hash} from 'lucide-react';
import type {ConversationType} from '../types/chat';
import {getInitials} from '../utils/chatLogic';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  kind?: ConversationType | 'user';
  activePresence?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[11px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function Avatar({
  name,
  color,
  size = 'md',
  kind = 'user',
  activePresence = false,
}: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${sizeClass} flex items-center justify-center rounded-xl font-semibold text-white select-none`}
        style={{backgroundColor: color}}
        aria-hidden="true"
      >
        {kind === 'channel' ? (
          <Hash className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
        ) : kind === 'notes' ? (
          <Bookmark className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      {activePresence && (
        <span
          title="Actiu en una altra pestanya"
          className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"
        />
      )}
    </div>
  );
}
