/**
 * EssLayout — the Worker self-service shell (P2-M2). Deliberately NOT
 * DashboardLayout with items filtered out: a Worker's whole world is three
 * screens, so a separate, smaller shell is honest about that rather than
 * reusing an admin-sized sidebar with almost everything hidden.
 *
 * P3-G: this shell (plus AuthLayout) is where the language switcher lives —
 * see i18n/index.js's doc comment for why it's scoped to the ESS portal
 * rather than also appearing on DashboardLayout.
 */
import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import ChangePasswordModal from '../../features/auth/components/ChangePasswordModal.jsx';
import AvatarUploadModal from '../../features/auth/components/AvatarUploadModal.jsx';
import NotificationBell from '../../components/shared/NotificationBell.jsx';
import LanguageSwitcher from '../../components/shared/LanguageSwitcher.jsx';
import ThemeToggle from '../../components/shared/ThemeToggle.jsx';
import BrandLogo, { useBranding } from '../../components/shared/BrandLogo.jsx';
import { cn } from '../../lib/utils.js';

const NAV_ITEMS = [
  {
    to: '/me',
    labelKey: 'nav.myProfile',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  },
  {
    to: '/me/documents',
    labelKey: 'nav.myDocuments',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  {
    to: '/me/attendance',
    labelKey: 'nav.myAttendance',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008z',
  },
  {
    to: '/me/leave',
    labelKey: 'nav.myLeave',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
  {
    to: '/me/requests',
    labelKey: 'nav.myRequests',
    icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  },
  {
    to: '/me/exit-documents',
    labelKey: 'nav.visasAndDocuments',
    icon: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z',
  },
  {
    to: '/me/payslips',
    labelKey: 'nav.myPayslips',
    icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

function NavIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Sidebar({ onNavigate }) {
  const { t } = useTranslation();
  const { name: brandName } = useBranding();
  return (
    <div className="flex h-full flex-col border-r border-border/50 bg-surface/60 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-2.5 border-b border-border/50 bg-transparent px-5">
        <BrandLogo className="h-9 w-9 shrink-0" />
        <span className="font-semibold tracking-tight">{t('nav.workspaceTitle')}</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/me'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ease-out-expo',
                isActive
                  ? 'bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-inset ring-primary/10'
                  : 'font-medium text-muted hover:bg-border/40 hover:text-text'
              )
            }
          >
            <NavIcon d={item.icon} />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <p className="truncate text-[11px] leading-relaxed text-muted/70" title={brandName}>
          {brandName}
        </p>
        <p className="text-[11px] leading-relaxed text-muted/70">{t('nav.footerLine2')}</p>
      </div>
    </div>
  );
}

export default function EssLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  useEffect(() => {
    if (!avatarMenuOpen) return undefined;
    function onClickOutside(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [avatarMenuOpen]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-overlay-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl animate-slide-in-left">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/50 bg-surface/60 px-4 backdrop-blur-2xl sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-muted hover:bg-border/40 hover:text-text lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted">{t('header.employee')}</p>
            </div>
            <LanguageSwitcher className="hidden w-auto sm:flex" />
            <ThemeToggle />
            <NotificationBell />
            <div className="relative" ref={avatarMenuRef}>
              <button
                onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                title={t('header.openUserMenu')}
                aria-label={t('header.openUserMenu')}
                className="rounded-full outline-none ring-offset-2 ring-offset-surface focus:ring-2 focus:ring-primary/20"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-inset ring-primary/20"
                  />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {avatarMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-surface py-1 shadow-lg animate-rise-in">
                  <button
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      setAvatarModalOpen(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-text hover:bg-border/40"
                  >
                    {t('header.updateProfilePhoto')}
                  </button>
                  <button
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      setChangePasswordOpen(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-text hover:bg-border/40"
                  >
                    {t('header.changePassword')}
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      handleLogout();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/10"
                  >
                    {t('header.logOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <AvatarUploadModal open={avatarModalOpen} onClose={() => setAvatarModalOpen(false)} />
    </div>
  );
}
