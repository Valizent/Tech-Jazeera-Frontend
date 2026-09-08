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
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Button from '../ui/Button.jsx';

export default function RequireSectionRead({ sectionKey, children }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const allowed = user.role === 'Admin' || Boolean(user.sectionAccess?.includes(sectionKey));

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
