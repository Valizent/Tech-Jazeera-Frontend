/**
 * AuthLayout — full-screen glassmorphic chrome for unauthenticated screens.
 * Left panel: animated gradient orbs + brand identity + feature showcase.
 * Right panel: frosted-glass login card.
 *
 * All colours go through design tokens (text-text, text-muted, text-primary,
 * bg-surface, border-border, etc.) so both light and dark mode are respected
 * automatically — no hardcoded colour values.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../../components/shared/ThemeToggle.jsx';
import LanguageSwitcher from '../../components/shared/LanguageSwitcher.jsx';
import BrandLogo, { useBranding } from '../../components/shared/BrandLogo.jsx';
import ErrorBoundary from '../../components/shared/ErrorBoundary.jsx';
import RouteFallback from '../../components/shared/RouteFallback.jsx';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { name: brandName } = useBranding();

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] w-full overflow-x-hidden bg-bg">

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33%       { transform: translate(40px, -60px) scale(1.08); }
          66%       { transform: translate(-30px, 40px) scale(0.95); }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          40%       { transform: translate(-50px, 30px) scale(1.1); }
          70%       { transform: translate(30px, -40px) scale(0.92); }
        }
        @keyframes orb-float-3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50%       { transform: translate(20px, 50px) scale(1.05); }
        }
        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auth-brand-in {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .orb-1 { animation: orb-float-1 14s ease-in-out infinite; }
        .orb-2 { animation: orb-float-2 18s ease-in-out infinite; }
        .orb-3 { animation: orb-float-3 11s ease-in-out infinite; }
        .auth-card-in  { animation: auth-card-in  0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .auth-brand-in { animation: auth-brand-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
      `}</style>

      {/* ── Full-page ambient orbs (responsive sizes for mobile GPU performance) ── */}
      <div className="orb-1 pointer-events-none fixed -top-24 -left-24 h-64 w-64 rounded-full bg-primary/20 blur-2xl sm:-top-32 sm:-left-32 sm:h-[500px] sm:w-[500px] sm:blur-3xl" />
      <div className="orb-2 pointer-events-none fixed -bottom-32 -right-32 h-72 w-72 rounded-full bg-purple-500/15 blur-2xl sm:-bottom-40 sm:-right-40 sm:h-[600px] sm:w-[600px] sm:blur-3xl" />
      <div className="orb-3 pointer-events-none fixed bottom-1/4 left-1/3 h-44 w-44 rounded-full bg-success/10 blur-2xl sm:h-[300px] sm:w-[300px] sm:blur-3xl" />

      {/* ── Top controls (RTL & mobile safe-inset friendly) ── */}
      <div className="fixed end-3 top-3 z-50 flex items-center gap-2 sm:end-6 sm:top-6">
        <LanguageSwitcher className="w-auto" />
        <ThemeToggle />
      </div>

      {/* ═══════════════════════════════════════════════
          LEFT BRAND PANEL  (hidden on < lg)
      ═══════════════════════════════════════════════ */}
      <div className="auth-brand-in relative hidden w-1/2 flex-col justify-between p-12 lg:flex">
        {/* Subtle panel tint */}
        <div className="absolute inset-0 border-r border-white/10 bg-gradient-to-br from-primary/10 via-purple-500/5 to-success/10 backdrop-blur-sm" />

        {/* Logo + brand name */}
        <div className="relative flex items-center gap-3">
          <BrandLogo className="h-12 w-12 drop-shadow-lg" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Al Jazeera</p>
            <p className="text-xl font-bold tracking-tight text-text">{brandName}</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Internal ERP Platform
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-text lg:text-5xl">
            Manage your<br />
            <span className="bg-gradient-to-r from-primary via-purple-400 to-success bg-clip-text text-transparent">
              entire workforce
            </span>
            <br />in one place.
          </h1>

          <p className="max-w-sm text-base leading-relaxed text-muted">
            Mobilisations, payroll, deployments, leave, documents — all connected, all in real time.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Mobilisations', 'Finance', 'Attendance', 'Documents', 'HR'].map((item) => (
              <span
                key={item}
                className="rounded-full border border-border/50 bg-surface/40 px-3 py-1 text-xs font-medium text-muted backdrop-blur-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom stat cards */}
        <div className="relative grid grid-cols-3 gap-4">
          {[
            { label: 'Active Workers', value: '500+' },
            { label: 'Clients Served', value: '80+' },
            { label: 'Uptime', value: '99.9%' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-surface/30 p-4 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
            >
              <p className="text-2xl font-extrabold text-text">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT LOGIN PANEL (Scrollable and centered)
      ═══════════════════════════════════════════════ */}
      <div className="relative flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-12 lg:w-1/2 lg:py-8">

        {/* Mobile-only brand badge (shown above card when left panel is hidden) */}
        <div className="mb-6 flex flex-col items-center text-center lg:hidden">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-9 drop-shadow-md" />
            <div className="text-start">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary leading-none">Al Jazeera</p>
              <p className="text-lg font-bold tracking-tight text-text leading-tight">{brandName}</p>
            </div>
          </div>
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-[11px] font-semibold text-primary backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Internal ERP Platform
          </div>
        </div>

        {/* Glass card */}
        <div className="auth-card-in relative w-full max-w-md">
          {/* Outer colour-glow ring */}
          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/30 via-purple-500/20 to-success/20 blur-sm sm:rounded-3xl" />

          <div className="relative rounded-2xl border border-white/25 bg-surface/65 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-surface/50 sm:rounded-3xl sm:p-8">
            {/* Top rainbow accent bar */}
            <div className="mb-5 h-1 w-full rounded-full bg-gradient-to-r from-primary via-purple-400 to-success opacity-80 sm:mb-7" />

            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>

            {/* Footer */}
            <p className="mt-5 text-center text-xs text-muted/60 sm:mt-6">{t('auth.footerNotice')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
