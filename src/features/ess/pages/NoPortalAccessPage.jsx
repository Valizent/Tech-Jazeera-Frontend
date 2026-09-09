/**
 * NoPortalAccessPage — Milestone 4's client-side UX shortcut for a Worker/
 * Staff login whose linked Employee is no longer (or never was) 'Own' type.
 * Rendered by router.jsx's WorkerRouter BEFORE EssLayout ever mounts — the
 * server's own gate (me.routes.js) is the real enforcement, this just avoids
 * dropping such a login onto /me to watch every single request 403.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import BrandLogo, { useBranding } from '../../../components/shared/BrandLogo.jsx';

export default function NoPortalAccessPage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { name: brandName } = useBranding();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2.5">
        <BrandLogo className="h-10 w-10" />
        <span className="text-lg font-semibold tracking-tight">{brandName}</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-surface/70 p-6 text-center shadow-xl backdrop-blur-xl animate-rise-in dark:border-white/10">
        <h1 className="text-xl font-semibold">{t('noPortalAccess.title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('noPortalAccess.description')}</p>
        <Button variant="secondary" className="mt-6 w-full" onClick={handleLogout}>
          {t('header.logOut')}
        </Button>
      </div>
    </div>
  );
}
