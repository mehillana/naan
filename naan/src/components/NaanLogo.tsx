import {motion} from 'motion/react';
import type {ThemePresetId} from '../types/chat';

interface NaanLogoProps {
  themePreset?: ThemePresetId;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const LOGO_GRADIENTS: Record<ThemePresetId, [string, string, string]> = {
  aurora: ['#2563EB', '#6366F1', '#06B6D4'],
  sunset: ['#F97316', '#EC4899', '#8B5CF6'],
  emerald: ['#059669', '#0D9488', '#0284C7'],
  obsidian: ['#3B82F6', '#06B6D4', '#818CF8'],
  berry: ['#8B5CF6', '#EC4899', '#6366F1'],
  minimal: ['#0F172A', '#334155', '#64748B'],
};

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

export function NaanLogo({
  themePreset = 'aurora',
  size = 'sm',
  animated = true,
}: NaanLogoProps) {
  const [c1, c2, c3] = LOGO_GRADIENTS[themePreset];
  const gradId = `naan-grad-${themePreset}-${size}`;

  return (
    <motion.div
      whileHover={animated ? {scale: 1.08, rotate: -3} : undefined}
      whileTap={animated ? {scale: 0.94} : undefined}
      transition={{type: 'spring', stiffness: 420, damping: 22}}
      className={`${SIZES[size]} relative inline-flex shrink-0 items-center justify-center`}
      aria-hidden="true"
    >
      {animated && (
        <span
          className="animate-pulse-ring pointer-events-none absolute -inset-1 rounded-[18px] opacity-40 blur-md"
          style={{background: `linear-gradient(135deg, ${c1}, ${c2}, ${c3})`}}
        />
      )}
      <svg viewBox="0 0 48 48" fill="none" className="relative h-full w-full drop-shadow-sm">
        <defs>
          <linearGradient id={gradId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={c1} />
            <stop offset="55%" stopColor={c2} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="14" fill={`url(#${gradId})`} />
        <rect
          x="2.75"
          y="2.75"
          width="42.5"
          height="42.5"
          rx="13.25"
          stroke="white"
          strokeOpacity="0.34"
          strokeWidth="1.5"
        />
        <path
          d="M14.5 32V16.5C14.5 15.67 15.17 15 16 15H17.6C18.14 15 18.64 15.28 18.92 15.74L28.5 28.6V16.5C28.5 15.67 29.17 15 30 15H32C32.83 15 33.5 15.67 33.5 16.5V31.5C33.5 32.33 32.83 33 32 33H30.35C29.8 33 29.3 32.72 29.02 32.26L19.5 19.4V32C19.5 32.83 18.83 33.5 18 33.5H16C15.17 33.5 14.5 32.83 14.5 32Z"
          fill="white"
        />
        <motion.circle
          cx="34.5"
          cy="13.5"
          r="2.4"
          fill="white"
          animate={animated ? {scale: [1, 1.28, 1], opacity: [0.8, 1, 0.8]} : undefined}
          transition={{duration: 2.4, repeat: Infinity, ease: 'easeInOut'}}
        />
      </svg>
    </motion.div>
  );
}
