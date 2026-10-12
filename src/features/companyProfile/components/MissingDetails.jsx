/**
 * MissingDetailsBanner / MissingDetailsBadge - how a client or subcontractor
 * saved without everything is flagged (2026-10-12). `missing` is the
 * server-computed `missingDetails` list of keys; an empty list renders nothing.
 */
import { useTranslation } from 'react-i18next';
import Badge from '../../../components/ui/Badge.jsx';
import Card from '../../../components/ui/Card.jsx';

export function MissingDetailsBanner({ missing }) {
  const { t } = useTranslation();
  if (!missing?.length) return null;
  return (
    <Card className="border-warning/30 bg-warning/5">
      <p className="text-sm font-medium">{t('companyProfile.missing.title', { count: missing.length })}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {missing.map((key) => (
          <li key={key}>
            <Badge variant="warning">{t(`companyProfile.missing.items.${key}`)}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function MissingDetailsBadge({ missing }) {
  const { t } = useTranslation();
  if (!missing?.length) return null;
  return <Badge variant="warning">{t('companyProfile.missing.badge', { count: missing.length })}</Badge>;
}
