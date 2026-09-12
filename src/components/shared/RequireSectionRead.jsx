/**
 * RequireSectionRead — router-level guard for a page whose module is now
 * Section-Access read-gated (see sectionAccess.model.js's Read/Write
 * split). Renders the wrapped page only if the user can at least read the
 * given section; otherwise a clear "you don't have access" EmptyState
 * with a way back, instead of the page trying and failing every request.
 * Admin always passes (server-side canAccessSection does too, but this
 * check runs first so an ungranted Admin edge case never appears mid-page).
 *
 * One component, reused across the route table, rather than a duplicated
 * guard in every page file.
 *
 * `officeSecretaryBypass` (added 2026-09-13): Office Secretary can never
 * appear in `user.sectionAccess` at all — canAccessSection's own floor
 * excludes her role outright, regardless of any Approval Role grant (see
 * sectionAccess.service.js). That's the right behavior for Section Access
 * itself, but a couple of modules ALSO give her a narrow, hardcoded
 * server-side exception outside that system entirely (deployment.routes.js's
 * `canReadDeployments` — "she needs to find the deployment she's about to
 * enter hours against"). Without this prop those two facts disagree: the
 * server would happily serve her the page, but this guard, only knowing
 * about the generic Section Access array, blocked her from ever reaching
 * it by direct navigation — found via a real user report. Pass this true
 * only at a route that has that exact same server-side hardcoded bypass;
 * it does not grant her anything this guard wouldn't otherwise — it just
 * stops the client from pre-emptively hiding a page the server already lets
 * her open. */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Button from '../ui/Button.jsx';

export default function RequireSectionRead({ sectionKey, officeSecretaryBypass, children }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const allowed =
    user.role === 'Admin' ||
    (officeSecretaryBypass && user.role === 'Office Secretary') ||
    Boolean(user.sectionAccess?.includes(sectionKey));

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <EmptyState
          title={t('common.noSectionAccessTitle')}
          description={t('common.noSectionAccessDescription')}
          action={
            <Link to="/">
              <Button variant="secondary">{t('common.backToDashboard')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return children;
}
