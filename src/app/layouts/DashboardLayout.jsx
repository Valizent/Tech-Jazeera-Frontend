/**
 * DashboardLayout — the app shell every authenticated screen lives inside.
 *
 * Responsive strategy:
 *   - ≥1024px (lg): fixed 256px sidebar, content beside it.
 *   - <1024px: sidebar becomes an overlay drawer opened by the topbar
 *     hamburger; a backdrop click or any navigation closes it.
 *
 * The sidebar itself just renders Dashboard + one link per NAV_GROUPS entry
 * (navConfig.js) — each group link goes to a hub page listing that group's
 * real pages. This used to be a flat list of all 22 routes directly; grouped
 * because that had grown too long for the sidebar's fixed-height column,
 * which had no scroll of its own (items past the fold were unreachable, not
 * just visually cluttered — a real bug, independent of the regrouping).
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import ChangePasswordModal from '../../features/auth/components/ChangePasswordModal.jsx';
import AvatarUploadModal from '../../features/auth/components/AvatarUploadModal.jsx';
import MyDetailsModal from '../../features/profile/components/MyDetailsModal.jsx';
import ThemeToggle from '../../components/shared/ThemeToggle.jsx';
import NotificationBell from '../../components/shared/NotificationBell.jsx';
import LanguageSwitcher from '../../components/shared/LanguageSwitcher.jsx';
import { cn } from '../../lib/utils.js';
import { DASHBOARD_ITEM, NAV_GROUPS, EXECUTIVE_NAV_ITEMS, OFFICE_SECRETARY_NAV_ITEMS } from '../navConfig.js';

function NavIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  // Executive and Office Secretary each get their own short, explicit nav —
  // see EXECUTIVE_NAV_ITEMS's doc comment for why this can't just be
  // another `roles`-filtered slice of the grouped nav below (every
  // unguarded group item, which is most of them, would otherwise show up
  // for free).
  let items;
  if (user.role === 'Executive') {
    items = [
      DASHBOARD_ITEM,
      ...EXECUTIVE_NAV_ITEMS.filter((item) => !item.sectionKey || user.sectionAccess?.includes(item.sectionKey)),
    ];
  } else if (user.role === 'Office Secretary') {
    // No DASHBOARD_ITEM here — router.jsx's RoleRouter redirects this role
    // away from `/` entirely (it 403s on GET /api/dashboard), so a link to
    // it would just bounce.
    items = OFFICE_SECRETARY_NAV_ITEMS;
  } else {
    // A group is shown if the user can reach at least one item inside it —
    // otherwise it'd be a link to an empty hub page. Individual role-gating
    // (e.g. the Admin-only Timesheet Processor) still applies on the hub page
    // itself, same check as before, just applied at two levels now.
    const groups = NAV_GROUPS.filter((group) =>
      group.items.some((item) => {
        if (item.roles && !item.roles.includes(user.role)) return false;
        if (item.sectionKey && !user.sectionAccess?.includes(item.sectionKey)) return false;
        return true;
      })
    );
    items = [DASHBOARD_ITEM, ...groups];
  }

  return (
    <div className="flex h-full flex-col border-r border-border/50 bg-surface/60 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-2.5 border-b border-border/50 bg-transparent px-5">
        <img src="/logo.png" alt="Al Jazeera" className="h-9 w-9 rounded-xl shadow-glow" />
        <span className="font-semibold tracking-tight">{t('common.appName')}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
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
            {item.labelKey ? t(item.labelKey, item.label) : item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <p className="text-[11px] leading-relaxed text-muted/70">
          Manpower supply &amp; trading
          <br />
          Operating system
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [myDetailsOpen, setMyDetailsOpen] = useState(false);
  // Admin has no linked Employee record to edit — every other staff role
  // does (see server/src/modules/me/profile.routes.js).
  const canUpdateDetails = user.role !== 'Admin';
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
      {/* Static sidebar — desktop only */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Drawer sidebar — mobile only */}
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
            aria-label={t('header.openMenu')}
            className="rounded-lg p-2 text-muted hover:bg-border/40 hover:text-text lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted">{user.role}</p>
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
                  {canUpdateDetails && (
                    <button
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setMyDetailsOpen(true);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-text hover:bg-border/40"
                    >
                      {t('header.updateMyDetails')}
                    </button>
                  )}
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
      {canUpdateDetails && <MyDetailsModal open={myDetailsOpen} onClose={() => setMyDetailsOpen(false)} />}
    </div>
  );
}
