/**
 * MyEosbCard - the person's own OFFICIAL end-of-service settlement, once the
 * company has calculated it (2026-10-13: Staff, Worker, Coordinators, Accounts and
 * Office Secretary see it; nobody sees a running estimate). Shared by the
 * portal profile and the staff panel's "my details", each passing its own fetcher.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoney } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums text-text">{value}</span>
    </div>
  );
}

export default function MyEosbCard({ queryKey, fetcher, embedded = false }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({ queryKey, queryFn: fetcher });

  const body = isPending ? (
    <Skeleton className="h-24 w-full" />
  ) : isError ? (
    <p className="text-sm text-muted">{t('profile.eosb.loadError')}</p>
  ) : !data ? (
    <p className="text-sm text-muted">{t('profile.eosb.notCalculated')}</p>
  ) : (
    <div>
      <Row label={t('profile.eosb.exitDate')} value={formatDate(data.exitDate)} />
      <Row label={t('profile.eosb.exitReason')} value={t(`staffEosb.exitReasonLabels.${data.exitReason}`, data.exitReason)} />
      <Row label={t('profile.eosb.serviceYears')} value={Number(data.serviceYears).toFixed(2)} />
      <Row label={t('profile.eosb.monthlyWage')} value={formatMoney(data.monthlyWage)} />
      <Row label={t('profile.eosb.eosbNet')} value={formatMoney(data.eosbNet)} />
      <Row label={t('profile.eosb.leaveDays')} value={Number(data.unusedLeaveDays).toFixed(1)} />
      <Row label={t('profile.eosb.leaveEncashment')} value={formatMoney(data.leaveEncashment)} />
      <Row label={t('profile.eosb.total')} value={formatMoney(data.totalSettlement)} />
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('profile.eosb.title')}</h3>
        {body}
      </div>
    );
  }
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('profile.eosb.title')}</h2>
      {body}
    </Card>
  );
}
