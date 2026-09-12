/**
 * DeploymentDetailPage — the workhorse: placement info, the monthly
 * client-hours/OT ledger (add + correct), and Demobilise. This is the ONLY
 * place a deployment is managed — there is no separate create/edit page,
 * a Deployment is born automatically once its source Mobilisation is
 * Approved (see the Mobilisations module).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDeployment, addMonthlyHours, updateMonthlyHours, decideMonthlyHours, demobiliseDeployment } from '../deployments.api.js';
import {
  monthlyHoursFormSchema,
  emptyMonthlyHoursForm,
  monthlyHoursEntryToForm,
  daysInMonth,
  parseDailyEntry,
  demobiliseFormSchema,
  emptyDemobiliseForm,
  resolveDemobiliseOutcome,
} from '../deployments.schema.js';
import { DEMOBILISATION_REASONS, EMPLOYEE_ONLY_DEMOBILISATION_REASONS } from '../../../lib/constants.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate, formatMoney, cn } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

function monthStrOf(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function addMonthsToStr(monthStr, n) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthStrOf(d);
}
function previousMonthStr() {
  return addMonthsToStr(monthStrOf(new Date()), -1);
}

/** Locale-aware weekday abbreviation for one calendar day of a 'YYYY-MM'
 *  month — shown above each day's input so a reviewer can see at a glance
 *  which days are weekends without cross-checking a calendar. Intl's 'short'
 *  form is a compact 3-letter word in English ("Mon") but the FULL word in
 *  Arabic ("الاثنين" — no shorter form exists in ICU's ar data), which would
 *  blow out this grid's narrow columns; 'narrow' is a single unambiguous
 *  letter in Arabic but collides in English (Tue/Thu both "T", Sat/Sun both
 *  "S") — so each language gets whichever form is actually compact AND
 *  unambiguous for it. */
function weekdayAbbrev(monthStr, dayNum, locale) {
  const [y, m] = monthStr.split('-').map(Number);
  const style = locale?.startsWith('ar') ? 'narrow' : 'short';
  return new Date(y, m - 1, dayNum).toLocaleDateString(locale, { weekday: style });
}

/** Deployment reason → EOSB exit reason, for the post-demobilise deep link
 *  (see resolveDemobiliseOutcome / SettlementNewPage.jsx's preset params). */
const EOSB_REASON_BY_DEMOB_REASON = {
  TerminatedByCompany: 'TerminationByEmployer',
  Resigned: 'Resignation',
  TransferredToAnotherCompany: 'SponsorshipTransfer',
};

/** The earliest eligible month not yet entered — a sensible default for the
 *  add-hours form, empty string when nothing is eligible yet (deployment
 *  started this calendar month). */
function nextEligibleMonth(deployment) {
  const start = monthStrOf(deployment.startDate);
  const maxEligible = previousMonthStr();
  if (start > maxEligible) return '';
  const entered = new Set(deployment.monthlyHours.map((m) => m.month));
  let candidate = start;
  while (candidate <= maxEligible) {
    if (!entered.has(candidate)) return candidate;
    candidate = addMonthsToStr(candidate, 1);
  }
  return '';
}

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{children || '—'}</span>
    </div>
  );
}

/** Day-by-day timesheet entry, replacing a single "actual hours" number —
 *  see docs/DEPLOYMENT-notes.md's 2026-09-12 follow-up. One input per
 *  calendar day of the selected month, each either a plain number (hours
 *  worked) or a single letter — F/S/A for Off/Sick/Absent, fully replacing
 *  the hours entry for that day rather than sitting alongside it (see
 *  deployments.schema.js's parseDailyEntry). The monthly total only sums
 *  worked days, shown live but never itself submitted — the server derives
 *  it the same way (never trust a client-submitted total when the real
 *  breakdown is right there). Pressing Enter in a day's cell moves focus
 *  (and scrolls) to the next one, so a full month can be typed through
 *  without reaching for the mouse — added 2026-09-13 per the user's own ask. */
function MonthlyHoursForm({ deployment, defaultValues, onSubmit, submitting, submitLabel, monthFixed, legacyActualHours }) {
  const { t, i18n } = useTranslation();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(monthlyHoursFormSchema), defaultValues });
  const start = monthStrOf(deployment.startDate);
  const max = previousMonthStr();
  const month = watch('month');
  const dailyHours = watch('dailyHours') ?? [];
  const dayInputRefs = useRef([]);

  // Resize the grid whenever the selected month changes — grows/shrinks to
  // that month's real day count, keeping already-typed values for the days
  // that still exist. Deliberately keyed on `month` alone (not `dailyHours`
  // itself, which changes on every keystroke) — see the module's own note
  // on why this doesn't loop.
  useEffect(() => {
    const count = daysInMonth(month);
    if (count === 0 || dailyHours.length === count) return;
    setValue(
      'dailyHours',
      Array.from({ length: count }, (_, i) => dailyHours[i] ?? ''),
      { shouldValidate: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const total = dailyHours.reduce((runningTotal, v) => runningTotal + (Number(v) || 0), 0);

  // Enter advances to the next day instead of submitting the form — and
  // scrolls it into view, since the grid can be wider than its container.
  // The last day intentionally does nothing further (no accidental submit).
  function handleDayKeyDown(e, i) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = dayInputRefs.current[i + 1];
    if (next) {
      next.focus();
      next.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('staffDeployments.detail.monthLabel')}
          type="month"
          min={start}
          max={max}
          disabled={monthFixed}
          error={errors.month?.message}
          {...register('month')}
        />
        <Input
          label={t('staffDeployments.detail.otAmountLabel')}
          type="number"
          step="0.01"
          min="0"
          placeholder={t('staffDeployments.detail.otAmountPlaceholder')}
          error={errors.otAmount?.message}
          {...register('otAmount')}
        />
      </div>

      {legacyActualHours != null && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          {t('staffDeployments.detail.legacyNoBreakdown', { hours: legacyActualHours })}
        </p>
      )}

      {dailyHours.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-text">{t('staffDeployments.detail.dailyHoursLabel')}</span>
            <span className="text-sm text-muted">{t('staffDeployments.detail.dailyHoursTotal', { total })}</span>
          </div>
          <p className="mb-1.5 text-xs text-muted">{t('staffDeployments.detail.dailyHoursHint')}</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  {dailyHours.map((_, i) => (
                    <th key={i} className="border-b border-border bg-bg/40 px-1 py-1 text-center font-medium text-muted">
                      <div className="text-xs leading-tight">{i + 1}</div>
                      <div className="text-[10px] font-normal leading-tight text-muted/70">
                        {weekdayAbbrev(month, i + 1, i18n.language)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {dailyHours.map((_, i) => {
                    const { ref: rhfRef, ...rest } = register(`dailyHours.${i}`);
                    const letter = (dailyHours[i] ?? '').trim().toUpperCase();
                    const isOff = letter === 'F';
                    const isSick = letter === 'S';
                    const isAbsent = letter === 'A';
                    return (
                      <td key={i} className="p-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          maxLength={5}
                          className={cn(
                            'h-9 w-14 rounded border text-center text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30',
                            isOff && 'border-border bg-border/30 font-semibold text-muted',
                            isSick && 'border-primary/40 bg-primary/10 font-semibold text-primary',
                            isAbsent && 'border-danger/40 bg-danger/10 font-semibold text-danger',
                            !isOff && !isSick && !isAbsent && 'border-border bg-surface text-text'
                          )}
                          {...rest}
                          ref={(el) => {
                            rhfRef(el);
                            dayInputRefs.current[i] = el;
                          }}
                          onKeyDown={(e) => handleDayKeyDown(e, i)}
                        />
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          {errors.dailyHours && <p className="mt-1.5 text-sm text-danger">{errors.dailyHours.message}</p>}
        </div>
      )}

      <Textarea label={t('staffDeployments.detail.notesLabel')} error={errors.notes?.message} {...register('notes')} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function DeploymentDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [demobilising, setDemobilising] = useState(false);
  const [eosbPrompt, setEosbPrompt] = useState(null); // { exitDate, exitReason } | null
  const [editingEntry, setEditingEntry] = useState(null);

  // Office Secretary is a hardcoded exception to the Section Access gate —
  // mirrors deployment.service.js's addMonthlyHours exactly (they aren't a
  // grantable Section Access role at all).
  const canEnterHours = user.role === 'Office Secretary' || Boolean(user.sectionAccessWrite?.includes('deploymentsHours'));
  // Section Access key name is unchanged ('deploymentsRelease') even though
  // the action itself is now called Demobilise — see deployment.routes.js.
  const canDemobilise = Boolean(user.sectionAccessWrite?.includes('deploymentsRelease'));
  // Deliberately a separate grant from canEnterHours — no Office Secretary
  // bypass here, since she's usually the one entering, not approving.
  const canDecideHours = Boolean(user.sectionAccessWrite?.includes('deploymentsHoursDecide'));
  const [decidingEntry, setDecidingEntry] = useState(null);
  const [decision, setDecision] = useState(null); // 'Approved' | 'Rejected'
  const [decisionNote, setDecisionNote] = useState('');

  const { data: deployment, isPending, isError } = useQuery({
    queryKey: ['deployment', id],
    queryFn: () => getDeployment(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['deployment', id] });
    queryClient.invalidateQueries({ queryKey: ['deployments'] });
  };

  const addMutation = useMutation({
    mutationFn: (values) => addMonthlyHours(id, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.addedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ entryId, values }) => updateMonthlyHours(id, entryId, values),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.updatedToast'));
      setEditingEntry(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const decideMutation = useMutation({
    mutationFn: ({ entryId, values }) => decideMonthlyHours(id, entryId, values),
    onSuccess: () => {
      toast.success(
        decision === 'Approved' ? t('staffDeployments.detail.approvedToast') : t('staffDeployments.detail.rejectedToast')
      );
      setDecidingEntry(null);
      setDecision(null);
      setDecisionNote('');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const demobiliseMutation = useMutation({
    mutationFn: (values) => demobiliseDeployment(id, values),
    onSuccess: (_data, values) => {
      toast.success(t('staffDeployments.detail.demobilisedToast', { name: deployment.workerName }));
      setDemobilising(false);
      const outcome = resolveDemobiliseOutcome(deployment.workerType, values.reason, values.exitOutcome);
      if (outcome === 'Exit') {
        setEosbPrompt({ exitDate: values.releaseDate, exitReason: EOSB_REASON_BY_DEMOB_REASON[values.reason] ?? '' });
      }
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const addDefaultValues = useMemo(() => {
    if (!deployment) return emptyMonthlyHoursForm;
    return { ...emptyMonthlyHoursForm, month: nextEligibleMonth(deployment) };
  }, [deployment]);

  const {
    register: registerDemobilise,
    handleSubmit: handleDemobiliseSubmit,
    watch: watchDemobilise,
    formState: { errors: demobiliseErrors },
  } = useForm({ resolver: zodResolver(demobiliseFormSchema), defaultValues: emptyDemobiliseForm });
  const demobiliseReason = watchDemobilise('reason');
  const demobiliseExitOutcome = watchDemobilise('exitOutcome');
  const availableDemobiliseReasons =
    deployment?.workerType === 'Employee'
      ? DEMOBILISATION_REASONS
      : DEMOBILISATION_REASONS.filter((r) => !EMPLOYEE_ONLY_DEMOBILISATION_REASONS.includes(r));
  const resolvedOutcome = deployment
    ? resolveDemobiliseOutcome(deployment.workerType, demobiliseReason, demobiliseExitOutcome)
    : 'Standby';

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !deployment) {
    return (
      <EmptyState
        title={t('staffDeployments.detail.notFoundTitle')}
        description={t('staffDeployments.detail.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/deployments')} />}
      />
    );
  }

  const isActive = deployment.status === 'Active';
  const canAddThisMonth = isActive && canEnterHours && Boolean(nextEligibleMonth(deployment));
  const sortedMonths = [...deployment.monthlyHours].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`${deployment.workerName} — ${deployment.clientName}`}
        description={deployment.site}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? 'success' : 'default'}>
              {t(`staffDeployments.status.${deployment.status}`, deployment.status)}
            </Badge>
            {isActive && canDemobilise && (
              <Button size="sm" variant="danger-ghost" onClick={() => setDemobilising(true)}>
                {t('staffDeployments.detail.demobilise')}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.sectionPlacement')}</h2>
        <DetailRow label={t('staffDeployments.detail.fields.worker')}>
          {deployment.worker?._id ? (
            <Link to={`/employees/${deployment.worker._id}`} className="text-primary hover:underline">
              {deployment.workerName}
            </Link>
          ) : (
            deployment.workerName
          )}
        </DetailRow>
        <DetailRow label={t('staffDeployments.detail.fields.workerType')}>
          {t(`staffMobilisations.form.workerType.${deployment.workerType}`, deployment.workerType)}
        </DetailRow>
        <DetailRow label={t('staffDeployments.detail.fields.client')}>
          <Link to={`/clients/${deployment.client}`} className="text-primary hover:underline">
            {deployment.clientName}
          </Link>
        </DetailRow>
        {deployment.site && <DetailRow label={t('staffDeployments.detail.fields.site')}>{deployment.site}</DetailRow>}
        {deployment.subcontractorName && (
          <DetailRow label={t('staffDeployments.detail.fields.subcontractor')}>{deployment.subcontractorName}</DetailRow>
        )}
        <DetailRow label={t('staffDeployments.detail.fields.contractHours')}>{deployment.requiredTimesheetHours ?? '—'}</DetailRow>
        <DetailRow label={t('staffDeployments.detail.fields.since')}>{formatDate(deployment.startDate)}</DetailRow>
        {!isActive && (
          <>
            <DetailRow label={t('staffDeployments.detail.fields.demobilisedOn')}>{formatDate(deployment.endDate)}</DetailRow>
            {deployment.endReason && (
              <DetailRow label={t('staffDeployments.detail.fields.reason')}>
                {t(`staffDeployments.reasons.${deployment.endReason}`, deployment.endReason)}
              </DetailRow>
            )}
          </>
        )}
        {deployment.releaseNote && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffDeployments.detail.notesLabel')}</p>
            <p className="text-sm">{deployment.releaseNote}</p>
          </div>
        )}
        {deployment.mobilisation && (
          <div className="mt-4">
            <Link to={`/mobilisations/${deployment.mobilisation._id}`} className="text-sm font-medium text-primary hover:underline">
              {t('staffDeployments.detail.viewMobilisation')} (#{deployment.mobilisation.serialNumber})
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.sectionMonthlyHours')}</h2>
          {/* Profit is commercial data, stripped server-side for anyone
              without deploymentsHoursDecide access — deployment.totalProfit
              simply won't exist on the response for them, so this naturally
              disappears rather than needing a separate client-side check. */}
          {deployment.totalProfit != null && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted">{t('staffDeployments.detail.totalProfit')}</p>
              <p className={cn('text-lg font-semibold tabular-nums', deployment.totalProfit >= 0 ? 'text-success' : 'text-danger')}>
                {formatMoney(deployment.totalProfit)}
              </p>
            </div>
          )}
        </div>
        <p className="mb-4 text-sm text-muted">{t('staffDeployments.detail.monthlyHoursHint')}</p>

        {sortedMonths.length === 0 ? (
          <p className="mb-4 text-sm text-muted">{t('staffDeployments.detail.noMonthlyHours')}</p>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/40 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.month')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.contractHours')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.actualHours')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.otHours')}</th>
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.otAmount')}</th>
                  {deployment.totalProfit != null && <th className="px-3 py-2">{t('staffDeployments.detail.columns.profit')}</th>}
                  <th className="px-3 py-2">{t('staffDeployments.detail.columns.status')}</th>
                  {(canEnterHours || canDecideHours) && isActive && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedMonths.map((entry) => {
                  const statusVariant = entry.status === 'Approved' ? 'success' : entry.status === 'Rejected' ? 'danger' : 'warning';
                  // The enterer can edit Pending/Rejected only; whoever can
                  // DECIDE may also correct an Approved entry directly (the
                  // server enforces this exactly the same way — see
                  // deployment.service.js's updateMonthlyHours doc comment).
                  const canEditThis =
                    isActive && ((canEnterHours && entry.status !== 'Approved') || (canDecideHours && entry.status === 'Approved'));
                  const canDecideThis = canDecideHours && isActive && entry.status === 'Pending';
                  return (
                    <tr key={entry._id}>
                      <td className="px-3 py-2 font-medium">{entry.month}</td>
                      <td className="px-3 py-2">{entry.contractHours}</td>
                      <td className="px-3 py-2">{entry.actualHours}</td>
                      <td className="px-3 py-2">{entry.otHours}</td>
                      <td className="px-3 py-2">{formatMoney(entry.otAmount)}</td>
                      {deployment.totalProfit != null && (
                        <td className={cn('px-3 py-2 font-medium tabular-nums', entry.profit >= 0 ? 'text-success' : 'text-danger')}>
                          {formatMoney(entry.profit)}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant}>{t(`staffDeployments.detail.hoursStatus.${entry.status}`, entry.status)}</Badge>
                        {entry.status === 'Rejected' && entry.decisionNote && (
                          <p className="mt-1 max-w-[16rem] text-xs text-muted">{entry.decisionNote}</p>
                        )}
                      </td>
                      {(canEnterHours || canDecideHours) && isActive && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            {canEditThis && (
                              <Button size="sm" variant="ghost" onClick={() => setEditingEntry(entry)}>
                                {t('staffDeployments.detail.editEntry')}
                              </Button>
                            )}
                            {canDecideThis && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setDecidingEntry(entry);
                                    setDecision('Approved');
                                    setDecisionNote('');
                                  }}
                                >
                                  {t('common.approve')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger-ghost"
                                  onClick={() => {
                                    setDecidingEntry(entry);
                                    setDecision('Rejected');
                                    setDecisionNote('');
                                  }}
                                >
                                  {t('common.reject')}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isActive ? (
          <p className="text-sm text-muted">{t('staffDeployments.detail.endedNote')}</p>
        ) : !canEnterHours ? null : canAddThisMonth ? (
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.detail.addMonthLabel')}</h3>
            <MonthlyHoursForm
              deployment={deployment}
              defaultValues={addDefaultValues}
              submitting={addMutation.isPending}
              submitLabel={t('staffDeployments.detail.save')}
              onSubmit={(values) =>
                addMutation.mutate({
                  month: values.month,
                  dailyHours: values.dailyHours.map(parseDailyEntry),
                  otAmount: values.otAmount ? Number(values.otAmount) : undefined,
                  notes: values.notes || undefined,
                })
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted">{t('staffDeployments.detail.noEligibleMonth')}</p>
        )}
      </Card>

      <Modal
        open={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        title={editingEntry ? t('staffDeployments.detail.editModalTitle', { month: editingEntry.month }) : ''}
      >
        {editingEntry && (
          <MonthlyHoursForm
            deployment={deployment}
            defaultValues={monthlyHoursEntryToForm(editingEntry)}
            submitting={updateMutation.isPending}
            submitLabel={t('staffDeployments.detail.save')}
            monthFixed
            legacyActualHours={editingEntry.dailyHours?.length ? null : editingEntry.actualHours}
            onSubmit={(values) =>
              updateMutation.mutate({
                entryId: editingEntry._id,
                values: {
                  dailyHours: values.dailyHours.map(parseDailyEntry),
                  otAmount: values.otAmount ? Number(values.otAmount) : undefined,
                  notes: values.notes || undefined,
                },
              })
            }
          />
        )}
      </Modal>

      <Modal
        open={Boolean(decidingEntry)}
        onClose={() => {
          if (decideMutation.isPending) return;
          setDecidingEntry(null);
          setDecision(null);
        }}
        title={
          decidingEntry
            ? t(
                decision === 'Approved' ? 'staffDeployments.detail.approveModalTitle' : 'staffDeployments.detail.rejectModalTitle',
                { month: decidingEntry.month }
              )
            : ''
        }
      >
        {decidingEntry && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('staffDeployments.detail.decideModalMessage', {
                month: decidingEntry.month,
                worker: deployment.workerName,
              })}
            </p>
            <Textarea
              label={
                decision === 'Rejected'
                  ? t('staffDeployments.detail.decisionNoteRequiredLabel')
                  : t('staffDeployments.detail.decisionNoteOptionalLabel')
              }
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDecidingEntry(null);
                  setDecision(null);
                }}
                disabled={decideMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={decision === 'Rejected' ? 'danger' : 'primary'}
                isLoading={decideMutation.isPending}
                disabled={decision === 'Rejected' && !decisionNote.trim()}
                onClick={() =>
                  decideMutation.mutate({
                    entryId: decidingEntry._id,
                    values: { decision, note: decisionNote.trim() || undefined },
                  })
                }
              >
                {decision === 'Approved' ? t('common.approve') : t('common.reject')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={demobilising}
        onClose={() => setDemobilising(false)}
        title={t('staffDeployments.detail.demobiliseModalTitle', { name: deployment.workerName })}
      >
        <form
          onSubmit={handleDemobiliseSubmit((values) => demobiliseMutation.mutate(values))}
          noValidate
          className="space-y-4"
        >
          <p className="text-sm text-muted">{t('staffDeployments.detail.demobiliseModalMessage', { name: deployment.workerName })}</p>
          <Input
            label={t('staffDeployments.detail.demobiliseDateLabel')}
            type="date"
            error={demobiliseErrors.releaseDate?.message}
            {...registerDemobilise('releaseDate')}
          />
          <Select label={t('staffDeployments.detail.reasonLabel')} error={demobiliseErrors.reason?.message} {...registerDemobilise('reason')}>
            <option value="">{t('staffDeployments.detail.chooseReason')}</option>
            {availableDemobiliseReasons.map((r) => (
              <option key={r} value={r}>
                {t(`staffDeployments.reasons.${r}`, r)}
              </option>
            ))}
          </Select>
          {demobiliseReason === 'Other' && deployment.workerType === 'Employee' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 rounded border-border" {...registerDemobilise('exitOutcome')} />
              {t('staffDeployments.detail.otherExitCheckbox')}
            </label>
          )}
          {resolvedOutcome === 'Exit' && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              {t('staffDeployments.detail.exitWarning', { name: deployment.workerName })}
            </p>
          )}
          <Textarea
            label={t('staffDeployments.detail.demobiliseNoteLabel')}
            error={demobiliseErrors.releaseNote?.message}
            {...registerDemobilise('releaseNote')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDemobilising(false)} disabled={demobiliseMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" isLoading={demobiliseMutation.isPending}>
              {t('staffDeployments.detail.demobilise')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(eosbPrompt)}
        onClose={() => setEosbPrompt(null)}
        title={t('staffDeployments.detail.eosbPromptTitle', { name: deployment.workerName })}
      >
        {eosbPrompt && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('staffDeployments.detail.eosbPromptMessage', { name: deployment.workerName })}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEosbPrompt(null)}>
                {t('staffDeployments.detail.eosbPromptLater')}
              </Button>
              <Button
                type="button"
                onClick={() =>
                  navigate(
                    `/eosb/new?employee=${deployment.worker?._id ?? ''}&exitDate=${eosbPrompt.exitDate}&exitReason=${eosbPrompt.exitReason}`
                  )
                }
              >
                {t('staffDeployments.detail.eosbPromptGo')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
