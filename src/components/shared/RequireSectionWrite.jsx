/**
 * RequireSectionWrite — router-level guard for a "new"/"edit" route whose
 * module is Section-Access write-gated. Same shape as RequireSectionRead
 * (see that file's own doc comment) but checks `user.sectionAccessWrite`
 * instead of `user.sectionAccess` — a read-only grantee can reach the
 * corresponding list/view page just fine, but has no business on a route
 * whose entire purpose is a live create/edit form. Added 2026-09-14 (a real
 * gap found by hand-auditing every module after the Company Settings
 * read-only-viewer-gets-a-live-form bug): these routes previously had no
 * guard at all, reachable by direct URL/bookmark even though the button
 * that normally leads here was already correctly canWrite-gated — the
 * server was the only real backstop. One shared component, not a duplicated
 * check in every new/edit page.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Button from '../ui/Button.jsx';

export default function RequireSectionWrite({ sectionKey, officeSecretaryBypass, children }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const keys = Array.isArray(sectionKey) ? sectionKey : [sectionKey];
  const allowed =
    user.role === 'Admin' ||
    (officeSecretaryBypass && user.role === 'Office Secretary') ||
    keys.some((key) => user.sectionAccessWrite?.includes(key));

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
