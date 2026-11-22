import {
  ArrowRight,
  CheckCheck,
  Globe,
  Layers,
  Mic,
  Palette,
  PenTool,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import {motion} from 'motion/react';
import {LANGUAGES, t} from '../i18n/translations';
import {THEME_LIST, type NaanThemePreset} from '../themes/themes';
import type {LanguageCode, ThemePresetId} from '../types/chat';
import {NaanLogo} from './NaanLogo';

interface LandingViewProps {
  theme: NaanThemePreset;
  language: LanguageCode;
  onSelectTheme: (id: ThemePresetId) => void;
  onSelectLanguage: (lang: LanguageCode) => void;
  onEnterApp: () => void;
  onOpenContactsDirect: () => void;
}

export function LandingView({
  theme,
  language,
  onSelectTheme,
  onSelectLanguage,
  onEnterApp,
  onOpenContactsDirect,
}: LandingViewProps) {
  const features = [
    {
      icon: Zap,
      title: t(language, 'landingFeature1Title'),
      desc: t(language, 'landingFeature1Desc'),
    },
    {
      icon: Palette,
      title: t(language, 'landingFeature2Title'),
      desc: t(language, 'landingFeature2Desc'),
    },
    {
      icon: Users,
      title: t(language, 'landingFeature3Title'),
      desc: t(language, 'landingFeature3Desc'),
    },
    {
      icon: Share2,
      title: t(language, 'landingFeature4Title'),
      desc: t(language, 'landingFeature4Desc'),
    },
  ];

  return (
    <motion.div
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0, scale: 0.985}}
      transition={{duration: 0.35}}
      className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto text-slate-900 transition-colors duration-500 dark:text-slate-100"
      style={{background: theme.canvasBg}}
    >
      {/* Ambient Animated Mesh Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="animate-float-slow absolute -top-24 -left-24 h-[480px] w-[480px] rounded-full blur-3xl transition-colors duration-700"
          style={{background: theme.orbOne}}
        />
        <div
          className="animate-float-slow absolute top-1/3 -right-24 h-[460px] w-[460px] rounded-full blur-3xl transition-colors duration-700"
          style={{background: theme.orbTwo, animationDelay: '-4s'}}
        />
        <div
          className="animate-float-slow absolute -bottom-24 left-1/3 h-[420px] w-[420px] rounded-full blur-3xl transition-colors duration-700"
          style={{background: theme.orbThree, animationDelay: '-8s'}}
        />
      </div>

      {/* Top Navigation Bar */}
      <motion.header
        initial={{opacity: 0, y: -12}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.4, ease: [0.16, 1, 0.3, 1]}}
        className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8"
      >
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <NaanLogo themePreset={theme.id} size="md" />
          <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Naan
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="landing-lang-select" className="sr-only">
            {t(language, 'languageLabel')}
          </label>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/50 bg-white/60 px-2.5 py-1.5 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/60">
            <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <select
              id="landing-lang-select"
              value={language}
              onChange={(e) => onSelectLanguage(e.target.value as LanguageCode)}
              className="cursor-pointer bg-transparent text-xs font-semibold text-slate-800 focus:outline-none dark:text-slate-100"
            >
              {LANGUAGES.map((l) => (
                <option
                  key={l.code}
                  value={l.code}
                  className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                >
                  {l.nativeName}
                </option>
              ))}
            </select>
          </div>

          <motion.button
            type="button"
            whileHover={{scale: 1.03}}
            whileTap={{scale: 0.96}}
            onClick={onEnterApp}
            style={{background: theme.accentGradient}}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shadow-sm"
          >
            <span>{t(language, 'landingEnterCta')}</span>
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </motion.button>
        </div>
      </motion.header>

      {/* Hero Split */}
      <main className="relative z-10 mx-auto max-w-6xl px-5 pt-6 pb-14 sm:px-8 lg:pt-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column */}
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.48, ease: [0.16, 1, 0.3, 1]}}
            className="space-y-6 lg:col-span-6"
          >
            <motion.p
              initial={{opacity: 0, x: -10}}
              animate={{opacity: 1, x: 0}}
              transition={{delay: 0.1, duration: 0.35}}
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-600 dark:text-slate-300"
            >
              <Sparkles className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <span>Naan · {t(language, 'appTagline')}</span>
            </motion.p>

            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              {t(language, 'landingHeroTitle')}
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-700 dark:text-slate-300">
              {t(language, 'landingHeroSubtitle')}
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.button
                type="button"
                whileHover={{scale: 1.03, y: -1}}
                whileTap={{scale: 0.97}}
                onClick={onEnterApp}
                style={{background: theme.accentGradient}}
                className="inline-flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-lg"
              >
                <span>{t(language, 'landingEnterCta')}</span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{scale: 1.02, y: -1}}
                whileTap={{scale: 0.97}}
                onClick={onOpenContactsDirect}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-5 py-3.5 text-sm font-semibold text-slate-800 backdrop-blur-xl transition-colors hover:bg-white/90 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Users className="h-4 w-4" />
                <span>{t(language, 'landingContactsCta')}</span>
              </motion.button>
            </div>

            {/* Interactive Glassmorphism Theme Selector */}
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4 backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/55">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t(language, 'themes')}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {theme.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {THEME_LIST.map((preset) => {
                  const selected = preset.id === theme.id;
                  return (
                    <motion.button
                      key={preset.id}
                      type="button"
                      whileHover={{scale: 1.04}}
                      whileTap={{scale: 0.96}}
                      onClick={() => onSelectTheme(preset.id)}
                      aria-label={preset.name}
                      aria-pressed={selected}
                      title={preset.name}
                      className={`relative flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-transparent text-slate-900 dark:text-white'
                          : 'border-white/50 bg-white/40 text-slate-600 hover:bg-white/75 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300'
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="landing-theme-pill"
                          transition={{type: 'spring', stiffness: 380, damping: 28}}
                          className="absolute inset-0 rounded-xl border border-slate-900/20 bg-white/95 shadow-xs dark:border-white/30 dark:bg-slate-800"
                        />
                      )}
                      <span
                        className="relative z-10 h-4 w-4 rounded-full shadow-xs"
                        style={{background: preset.swatchGradient}}
                      />
                      <span className="relative z-10">{preset.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Animated Glassmorphism Interactive Preview */}
          <motion.div
            initial={{opacity: 0, y: 24, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            transition={{duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
            className="relative lg:col-span-6"
          >
            {/* Floating Mini Glass Capability Chips */}
            <motion.div
              animate={{y: [0, -6, 0]}}
              transition={{duration: 4.5, repeat: Infinity, ease: 'easeInOut'}}
              className="mb-3 flex flex-wrap items-center justify-end gap-2"
            >
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200">
                <Mic className="h-3.5 w-3.5 text-rose-500" />
                <span>{t(language, 'voiceNote')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200">
                <PenTool className="h-3.5 w-3.5 text-violet-500" />
                <span>{t(language, 'sketchpad')}</span>
              </span>
            </motion.div>

            <div className="relative rounded-3xl border border-white/65 bg-white/60 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/65">
              {/* Mock Window Top */}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3.5 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                  <NaanLogo themePreset={theme.id} size="sm" animated={false} />
                  <div>
                    <p dir="ltr" className="text-sm font-bold text-slate-900 dark:text-white">
                      #naan-workspace
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      BroadcastChannel · IndexedDB
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  100% Local
                </span>
              </div>

              {/* Animated Sample Conversation (No predefined contacts) */}
              <div className="mt-4 space-y-3">
                <motion.div
                  initial={{opacity: 0, x: -14}}
                  animate={{opacity: 1, x: 0}}
                  transition={{delay: 0.22, type: 'spring', stiffness: 280, damping: 24}}
                  className={`max-w-[85%] rounded-2xl rounded-ts-sm px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 ${theme.peerBubbleGlass}`}
                >
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Naan · 10:42
                  </p>
                  <p>Workspace net i llest: crea els teus propis grups, contactes, enquestes i dibuixos!</p>
                </motion.div>

                <motion.div
                  initial={{opacity: 0, x: 14}}
                  animate={{opacity: 1, x: 0}}
                  transition={{delay: 0.38, type: 'spring', stiffness: 280, damping: 24}}
                  className="flex justify-end"
                >
                  <div
                    style={{background: theme.ownBubbleGradient}}
                    className="max-w-[85%] rounded-2xl rounded-te-sm px-4 py-2.5 text-sm text-white shadow-md"
                  >
                    <p>I tot en un únic fitxer HTML amb 6 temes degradats, 7 idiomes, notes de veu i stickers!</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/80">
                      <span className="font-mono tabular-nums">10:43</span>
                      <CheckCheck className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{opacity: 0, y: 12}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: 0.54, type: 'spring', stiffness: 280, damping: 24}}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs ${theme.peerBubbleGlass}`}
                >
                  <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      <span>{t(language, 'checklistTitle')}</span>
                    </span>
                    {/* Animated live typing indicator dots */}
                    <span className="inline-flex items-center gap-1" aria-hidden="true">
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <motion.span
                          key={i}
                          animate={{y: [0, -3, 0], opacity: [0.4, 1, 0.4]}}
                          transition={{duration: 1.1, repeat: Infinity, delay}}
                          className="h-1.5 w-1.5 rounded-full bg-blue-500"
                        />
                      ))}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">
                    <p>☑ Zero contactes ni grups predefinits</p>
                    <p>☑ Notes de veu, pissarra, stickers i efectes</p>
                    <p>☑ 6 temes Glassmorphism + 7 idiomes</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 4 Feature Glass Cards */}
        <section
          aria-label="Característiques de Naan"
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{opacity: 0, y: 18}}
                animate={{opacity: 1, y: 0}}
                whileHover={{y: -4, scale: 1.015}}
                transition={{delay: 0.14 + idx * 0.06, duration: 0.36}}
                className="rounded-2xl border border-white/60 bg-white/55 p-5 shadow-xs backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/55"
              >
                <div
                  style={{background: theme.accentGradient}}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs"
                >
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="mt-3.5 text-sm font-bold text-slate-900 dark:text-white">
                  {feat.title}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {feat.desc}
                </p>
              </motion.div>
            );
          })}
        </section>
      </main>
    </motion.div>
  );
}
