/**
 * PagerBar — the "Showing 1–20 of 47 · Previous / Next" footer both Daily
 * Updates panels share. Renders nothing for an empty result.
 */
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button.jsx';

export default function PagerBar({ data, limit, onPage }) {
  const { t } = useTranslation();
  if (!data || data.total === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        {t('common.showingRange', {
          from: (data.page - 1) * limit + 1,
          to: Math.min(data.page * limit, data.total),
          total: data.total,
        })}
      </span>
      <span className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
          {t('common.previous')}
        </Button>
        <span className="tabular-nums">{t('common.pageOf', { page: data.page, pages: data.pages })}</span>
        <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>
          {t('common.next')}
        </Button>
      </span>
    </div>
  );
}
