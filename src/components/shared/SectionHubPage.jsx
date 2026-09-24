/**
 * SectionHubPage — the landing page a sidebar group link goes to: a grid of
 * cards, one per real page in that group. Role-filters `items` the same way
 * the old flat sidebar did, so a card never links somewhere the user can't
 * actually use.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import PageHeader from './PageHeader.jsx';
import Icon from '../ui/Icon.jsx';

/** `titleKey`/`descriptionKey` and each item's `labelKey`/`descriptionKey`
 *  are optional translation keys (see navConfig.js) — `t(key, fallback)`
 *  renders the literal English `title`/`description`/`item.label`/
 *  `item.description` unchanged wherever a key isn't set yet, so this page
 *  works identically for a not-yet-translated group. */
export default function SectionHubPage({ title, titleKey, description, descriptionKey, items }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const visible = items.filter((item) => {
    if (item.roles && !item.roles.includes(user.role)) return false;
    // sectionKey may be an array (e.g. Attendance's split Records/Sign
    // In-Out/Office Location keys) — visible if ANY one is readable, same
    // "any of" semantics as RequireSectionRead's own route guard.
    if (item.sectionKey) {
      const keys = Array.isArray(item.sectionKey) ? item.sectionKey : [item.sectionKey];
      if (!keys.some((key) => user.sectionAccess?.includes(key))) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={titleKey ? t(titleKey, title) : title} description={descriptionKey ? t(descriptionKey, description) : description} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 ease-out-expo hover:border-primary/40 hover:shadow-md"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon d={item.icon} size="md" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold text-text group-hover:text-primary">
                {item.labelKey ? t(item.labelKey, item.label) : item.label}
                {/* Optional, filled in by the calling hub page (e.g.
                    FinancialHubPage's overdue-invoice count) — this
                    component stays generic and knows nothing about what a
                    badge count actually means for any given item. */}
                {item.badgeCount > 0 && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{item.badgeCount}</span>
                )}
              </p>
              {item.description && (
                <p className="mt-1 text-sm text-muted">
                  {item.descriptionKey ? t(item.descriptionKey, item.description) : item.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
