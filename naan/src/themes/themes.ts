import type {ThemeMode, ThemePresetId} from '../types/chat';

export interface NaanThemePreset {
  id: ThemePresetId;
  mode: ThemeMode;
  name: string;
  swatchGradient: string;
  canvasBg: string;
  orbOne: string;
  orbTwo: string;
  orbThree: string;
  sidebarGlass: string;
  mainGlass: string;
  headerGlass: string;
  ownBubbleGradient: string;
  peerBubbleGlass: string;
  accentGradient: string;
  accentSolid: string;
  accentRing: string;
}

export const NAAN_THEMES: Record<ThemePresetId, NaanThemePreset> = {
  aurora: {
    id: 'aurora',
    mode: 'light',
    name: 'Aurora Cobalt',
    swatchGradient: 'linear-gradient(135deg, #2563EB 0%, #6366F1 55%, #06B6D4 100%)',
    canvasBg: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 45%, #F5F3FF 100%)',
    orbOne: 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)',
    orbTwo: 'radial-gradient(circle, rgba(139,92,246,0.24) 0%, transparent 70%)',
    orbThree: 'radial-gradient(circle, rgba(6,182,212,0.20) 0%, transparent 70%)',
    sidebarGlass: 'bg-white/65 backdrop-blur-2xl',
    mainGlass: 'bg-white/55 backdrop-blur-2xl',
    headerGlass: 'bg-white/75 backdrop-blur-2xl',
    ownBubbleGradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
    peerBubbleGlass: 'bg-white/80 backdrop-blur-md border border-white/70 shadow-xs',
    accentGradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #06B6D4 100%)',
    accentSolid: '#2563EB',
    accentRing: 'ring-blue-500/40',
  },
  sunset: {
    id: 'sunset',
    mode: 'light',
    name: 'Capvespre Coral',
    swatchGradient: 'linear-gradient(135deg, #F97316 0%, #EC4899 55%, #8B5CF6 100%)',
    canvasBg: 'linear-gradient(135deg, #FFF7ED 0%, #FDF2F8 50%, #F5F3FF 100%)',
    orbOne: 'radial-gradient(circle, rgba(249,115,22,0.26) 0%, transparent 70%)',
    orbTwo: 'radial-gradient(circle, rgba(236,72,153,0.22) 0%, transparent 70%)',
    orbThree: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)',
    sidebarGlass: 'bg-white/65 backdrop-blur-2xl',
    mainGlass: 'bg-white/55 backdrop-blur-2xl',
    headerGlass: 'bg-white/75 backdrop-blur-2xl',
    ownBubbleGradient: 'linear-gradient(135deg, #EA580C 0%, #DB2777 100%)',
    peerBubbleGlass: 'bg-white/85 backdrop-blur-md border border-rose-100/80 shadow-xs',
    accentGradient: 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
    accentSolid: '#EA580C',
    accentRing: 'ring-orange-500/40',
  },
  emerald: {
    id: 'emerald',
    mode: 'light',
    name: 'Brisa Jade',
    swatchGradient: 'linear-gradient(135deg, #059669 0%, #0D9488 55%, #0284C7 100%)',
    canvasBg: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 50%, #EFF6FF 100%)',
    orbOne: 'radial-gradient(circle, rgba(16,185,129,0.26) 0%, transparent 70%)',
    orbTwo: 'radial-gradient(circle, rgba(20,184,166,0.22) 0%, transparent 70%)',
    orbThree: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)',
    sidebarGlass: 'bg-white/68 backdrop-blur-2xl',
    mainGlass: 'bg-white/55 backdrop-blur-2xl',
    headerGlass: 'bg-white/75 backdrop-blur-2xl',
    ownBubbleGradient: 'linear-gradient(135deg, #059669 0%, #0D9488 100%)',
    peerBubbleGlass: 'bg-white/85 backdrop-blur-md border border-teal-100/80 shadow-xs',
    accentGradient: 'linear-gradient(135deg, #059669 0%, #0D9488 50%, #0284C7 100%)',
    accentSolid: '#059669',
    accentRing: 'ring-emerald-500/40',
  },
  obsidian: {
    id: 'obsidian',
    mode: 'dark',
    name: 'Nit Safir',
    swatchGradient: 'linear-gradient(135deg, #1E293B 0%, #2563EB 55%, #06B6D4 100%)',
    canvasBg: 'linear-gradient(135deg, #060913 0%, #0B1120 50%, #0F172A 100%)',
    orbOne: 'radial-gradient(circle, rgba(37,99,235,0.30) 0%, transparent 70%)',
    orbTwo: 'radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)',
    orbThree: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)',
    sidebarGlass: 'bg-slate-900/65 backdrop-blur-2xl',
    mainGlass: 'bg-slate-950/55 backdrop-blur-2xl',
    headerGlass: 'bg-slate-950/70 backdrop-blur-2xl',
    ownBubbleGradient: 'linear-gradient(135deg, #2563EB 0%, #0284C7 100%)',
    peerBubbleGlass: 'bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-xs',
    accentGradient: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
    accentSolid: '#3B82F6',
    accentRing: 'ring-blue-400/40',
  },
  berry: {
    id: 'berry',
    mode: 'dark',
    name: 'Cosmos Amatista',
    swatchGradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 60%, #4F46E5 100%)',
    canvasBg: 'linear-gradient(135deg, #0D0716 0%, #160C28 50%, #0F1024 100%)',
    orbOne: 'radial-gradient(circle, rgba(139,92,246,0.32) 0%, transparent 70%)',
    orbTwo: 'radial-gradient(circle, rgba(219,39,119,0.24) 0%, transparent 70%)',
    orbThree: 'radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 70%)',
    sidebarGlass: 'bg-slate-950/65 backdrop-blur-2xl',
    mainGlass: 'bg-slate-950/55 backdrop-blur-2xl',
    headerGlass: 'bg-slate-950/70 backdrop-blur-2xl',
    ownBubbleGradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)',
    peerBubbleGlass: 'bg-slate-900/80 backdrop-blur-md border border-purple-500/20 shadow-xs',
    accentGradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    accentSolid: '#8B5CF6',
    accentRing: 'ring-purple-400/40',
  },
  minimal: {
    id: 'minimal',
    mode: 'light',
    name: 'Vidre Pissarra',
    swatchGradient: 'linear-gradient(135deg, #0F172A 0%, #334155 60%, #475569 100%)',
    canvasBg: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)',
    orbOne: 'radial-gradient(circle, rgba(100,116,139,0.16) 0%, transparent 70%)',
    orbTwo: 'radial-gradient(circle, rgba(51,65,85,0.12) 0%, transparent 70%)',
    orbThree: 'radial-gradient(circle, rgba(148,163,184,0.18) 0%, transparent 70%)',
    sidebarGlass: 'bg-white/75 backdrop-blur-2xl',
    mainGlass: 'bg-white/65 backdrop-blur-2xl',
    headerGlass: 'bg-white/85 backdrop-blur-2xl',
    ownBubbleGradient: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
    peerBubbleGlass: 'bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-xs',
    accentGradient: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
    accentSolid: '#0F172A',
    accentRing: 'ring-slate-500/40',
  },
};

export const THEME_LIST = Object.values(NAAN_THEMES);
