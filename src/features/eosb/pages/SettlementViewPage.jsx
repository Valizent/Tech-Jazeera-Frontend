/**
 * Settlement detail — the full Article 84/85 breakdown for one computed
 * settlement. Read-only: a settlement is corrected by deleting and
 * recomputing (see settlement.model.js), never edited in place.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
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

function DetailRow({ label, value, valueClass = '', hint }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted" title={hint || undefined}>
        {label}
      </span>
      <span className={`text-xs font-medium ${valueClass || 'text-text'}`}>{value}</span>
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
  const { user } = useAuth();
  // 'eosb' has a real Read/Write split (2026-09-14 fix, a real QA-audit-
  // found gap) — reaching this page only implies Read; Delete needs Write.
  const canWrite = Boolean(user.sectionAccessWrite?.includes('eosb'));

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
            {canWrite && (
              <Button variant="danger-ghost" onClick={() => setConfirmingDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="rounded-xl border border-border/60 bg-surface/70 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
          
          {/* Employment Detail */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Employment Detail</p>
            <div className="space-y-0">
              <DetailRow label="Joining Date" value={formatDate(s.joiningDate)} />
              <DetailRow label="Exit Date" value={formatDate(s.exitDate)} />
              <DetailRow label="Exit Reason" value={t(`staffEosb.exitReasonLabels.${s.exitReason}`, EXIT_REASON_LABELS[s.exitReason])} />
              <DetailRow label="Service Duration" value={t('staffEosb.view.serviceYears', { years: s.serviceYears })} />
              <DetailRow label="Monthly Wage" value={formatMoney(s.monthlyWage)} />
            </div>
          </div>

          {/* End of Service Award */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">EOSB Calculation</p>
            <div className="space-y-0">
              <DetailRow label="Gross Award" value={formatMoney(s.eosbGross)} hint={t('staffEosb.view.grossAwardNote')} />
              <DetailRow label="Reduction Factor" value={fractionLabel(s.reductionFactor, t)} hint={s.exitReason === 'Resignation' ? t('staffEosb.view.reductionNoteResignation') : t('staffEosb.view.reductionNoteOther')} />
              <DetailRow label="Net EOSB Award" value={formatMoney(s.eosbNet)} valueClass={s.eosbNet > 0 ? "text-success" : ""} />
            </div>
          </div>

          {/* Vacation Pay */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Vacation Settlement</p>
            <div className="space-y-0">
              <DetailRow label="Unused Leave Days" value={t('staffEosb.view.unusedLeaveDays', { count: s.unusedLeaveDays })} />
              <DetailRow label="Leave Encashment" value={formatMoney(s.leaveEncashment)} valueClass={s.leaveEncashment > 0 ? "text-success" : ""} />
            </div>
          </div>

          {/* Summary */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Summary</p>
            <div className="space-y-0">
              <DetailRow label="Net EOSB Award" value={formatMoney(s.eosbNet)} />
              <DetailRow label="Leave Encashment" value={formatMoney(s.leaveEncashment)} />
              <div className="mt-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">Total Settlement</span>
                  <span className="text-sm font-bold text-primary tabular-nums">{formatMoney(s.totalSettlement)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {s.notes && (
          <div className="mt-6 border-t border-border/40 pt-4">
            <p className="text-xs font-black uppercase tracking-wider text-muted mb-1">{t('staffEosb.view.notes')}</p>
            <p className="text-sm text-text">{s.notes}</p>
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
