/**
 * AuthLayout — centered-card chrome for unauthenticated screens (login now;
 * e.g. a future "reset password" screen would drop in with zero layout work).
 *
 * The sign-in card is a deliberate use of glass: a frosted panel floating over
 * the app's indigo background wash. It's a first impression with no dense data
 * behind it, so the effect adds warmth without costing legibility.
 */
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../../components/shared/ThemeToggle.jsx';
import LanguageSwitcher from '../../components/shared/LanguageSwitcher.jsx';
import BrandLogo, { useBranding } from '../../components/shared/BrandLogo.jsx';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { name: brandName } = useBranding();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="fixed right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher className="w-auto" />
        <ThemeToggle />
      </div>
      <div className="flex items-center gap-2.5">
        <BrandLogo className="h-10 w-10" />
        <span className="text-lg font-semibold tracking-tight">{brandName}</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-surface/70 p-6 shadow-xl backdrop-blur-xl animate-rise-in dark:border-white/10">
        <Outlet />
      </div>
      <p className="text-xs text-muted">{t('auth.footerNotice')}</p>
    </div>
  );
}
