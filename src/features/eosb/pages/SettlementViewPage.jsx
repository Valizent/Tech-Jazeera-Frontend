/**
 * Settlement detail — the full Article 84/85 breakdown for one computed
 * settlement. Read-only: a settlement is corrected by deleting and
 * recomputing (see settlement.model.js), never edited in place.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettlement, deleteSettlement } from '../eosb.api.js';
import SettlementPdfButton from '../components/SettlementPdfButton.jsx';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import { EXIT_REASON_LABELS } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

function fractionLabel(f, t) {
  if (f === 1) return t('staffEosb.view.fraction.full');
  if (f === 0) return t('staffEosb.view.fraction.forfeited');
  return t('staffEosb.view.fraction.percent', { percent: Math.round(f * 100) });
}

function Row({ label, value, note, bold }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className={bold ? 'font-semibold' : 'text-sm'}>{label}</p>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
      <p className={bold ? 'shrink-0 font-semibold tabular-nums' : 'shrink-0 text-sm tabular-nums'}>{value}</p>
    </div>
  );
}

export default function SettlementViewPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Reaching this page at all already implies the whole-module 'eosb'
  // Section Access grant (delete included) — no separate check needed.

  const { data: s, isPending, isError } = useQuery({
    queryKey: ['eosb', id],
    queryFn: () => getSettlement(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSettlement(id),
    onSuccess: () => {
      toast.success(t('staffEosb.view.deletedToast'));
      queryClient.invalidateQueries({ queryKey: ['eosb'] });
      navigate('/eosb', { replace: true });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingDelete(false);
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffEosb.view.notFoundTitle')}
        description={t('staffEosb.view.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/eosb')} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={s.employeeName}
        description={t('staffEosb.view.descriptionLine', { code: s.employeeCode, date: formatDate(s.exitDate) })}
        onBack={() => navigate(-1)}
        actions={
          <>
            <Badge variant={s.exitReason === 'Resignation' ? 'warning' : 'default'} className="mr-1">
              {t(`staffEosb.exitReasonLabels.${s.exitReason}`, EXIT_REASON_LABELS[s.exitReason])}
            </Badge>
            <SettlementPdfButton id={s._id} employeeCode={s.employeeCode} />
            <Button variant="danger-ghost" onClick={() => setConfirmingDelete(true)}>
              {t('common.delete')}
            </Button>
          </>
        }
      />

      <Card>
        <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffEosb.view.joiningDate')}</p>
            <p className="mt-0.5 font-medium">{formatDate(s.joiningDate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffEosb.view.service')}</p>
            <p className="mt-0.5 font-medium">{t('staffEosb.view.serviceYears', { years: s.serviceYears })}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffEosb.view.monthlyWage')}</p>
            <p className="mt-0.5 font-medium">{formatMoney(s.monthlyWage)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffEosb.view.computed')}</p>
            <p className="mt-0.5 font-medium">{formatDate(s.createdAt)}</p>
          </div>
        </div>

        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEosb.view.eosbSectionTitle')}</h2>
        <Row
          label={t('staffEosb.view.grossAward')}
          value={formatMoney(s.eosbGross)}
          note={t('staffEosb.view.grossAwardNote')}
        />
        <Row
          label={t('staffEosb.view.reductionApplied')}
          value={fractionLabel(s.reductionFactor, t)}
          note={s.exitReason === 'Resignation' ? t('staffEosb.view.reductionNoteResignation') : t('staffEosb.view.reductionNoteOther')}
        />
        <Row label={t('staffEosb.view.netAward')} value={formatMoney(s.eosbNet)} bold />

        <h2 className="mb-1 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEosb.view.vacationSectionTitle')}</h2>
        <Row label={t('staffEosb.view.unusedLeave')} value={t('staffEosb.view.unusedLeaveDays', { count: s.unusedLeaveDays })} />
        <Row label={t('staffEosb.view.leaveEncashment')} value={formatMoney(s.leaveEncashment)} />

        <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3">
          <p className="font-semibold">{t('staffEosb.view.totalSettlement')}</p>
          <p className="text-lg font-bold tabular-nums">{formatMoney(s.totalSettlement)}</p>
        </div>

        {s.notes && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffEosb.view.notes')}</p>
            <p className="mt-1 text-sm">{s.notes}</p>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffEosb.view.deleteConfirmTitle')}
        message={t('staffEosb.view.deleteConfirmMessage', { name: s.employeeName })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
