/**
 * PayrollRunPage — one month's payroll: every employee's computed line,
 * editable (Draft only) allowances/deductions, finalize, and per-employee
 * payslip PDFs.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getPayrollRun, updatePayrollLine, finalizePayrollRun, deletePayrollRun, downloadPayslipPdf } from '../payroll.api.js';
import { payrollLineFormSchema, lineToForm, formToLinePayload } from '../payroll.schema.js';
import { apiMessage, formatMoney } from '../../../lib/utils.js';
import { PAYROLL_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function PayrollRunPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // 'payroll' has a real Read/Write split — reaching this page only implies
  // Read (2026-09-14 fix, a real QA-audit-found gap: Finalize/Delete/Edit
  // were only gated by isDraft, not by write access).
  const canWrite = Boolean(user.sectionAccessWrite?.includes('payroll'));

  const [editingLine, setEditingLine] = useState(null);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const { data: run, isPending, isError, error } = useQuery({
    queryKey: ['payroll', id],
    queryFn: () => getPayrollRun(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payroll', id] });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(payrollLineFormSchema), defaultValues: { otherAllowances: '', gosiDeduction: '', otherDeductions: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'otherDeductions' });

  const saveLineMutation = useMutation({
    mutationFn: (values) => updatePayrollLine(id, editingLine._id, formToLinePayload(values)),
    onSuccess: () => {
      toast.success(t('staffPayroll.run.lineUpdatedToast'));
      setEditingLine(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizePayrollRun(id),
    onSuccess: () => {
      toast.success(t('staffPayroll.run.finalizedToast'));
      setConfirmingFinalize(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingFinalize(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePayrollRun(id),
    onSuccess: () => {
      toast.success(t('staffPayroll.run.deletedToast'));
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      navigate('/payroll', { replace: true });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingDelete(false);
    },
  });

  function openEdit(line) {
    reset(lineToForm(line));
    setEditingLine(line);
  }

  async function handleDownload(line) {
    setDownloadingId(line._id);
    try {
      await downloadPayslipPdf(id, line._id, `Payslip-${line.employeeCode}-${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}.pdf`);
    } catch (error) {
      toast.error(apiMessage(error, t('staffPayroll.run.payslipFailedToast')));
    } finally {
      setDownloadingId(null);
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffPayroll.run.couldNotOpenTitle')}
        description={apiMessage(error) || t('staffPayroll.run.couldNotOpenDefaultDescription')}
        action={<BackButton onClick={() => navigate('/payroll')} />}
      />
    );
  }

  const isDraft = run.status === 'Draft';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${t(`common.months.${run.periodMonth}`)} ${run.periodYear}`}
        description={t('staffPayroll.run.descriptionLine', { count: run.lines.length, total: formatMoney(run.totalNet) })}
        onBack={() => navigate(-1)}
        actions={
          <>
            <Badge variant={PAYROLL_STATUS_VARIANT[run.status]} className="mr-1">
              {t(`common.status.${run.status}`, run.status)}
            </Badge>
            {isDraft && canWrite && (
              <Button onClick={() => setConfirmingFinalize(true)}>{t('staffPayroll.run.finalize')}</Button>
            )}
            {isDraft && canWrite && (
              <Button variant="danger-ghost" onClick={() => setConfirmingDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-bg/40 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffPayroll.run.columns.employee')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right">{t('staffPayroll.run.columns.gross')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right">{t('staffPayroll.run.columns.hours')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right">{t('staffPayroll.run.columns.deductions')}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right">{t('staffPayroll.run.columns.netPay')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {run.lines.map((line) => (
              <tr key={line._id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{line.employeeName}</span>
                  <span className="block text-xs text-muted">{line.employeeCode}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(line.grossPay)}
                  {line.overtimePay > 0 && (
                    <span className="block text-xs font-normal text-warning">{t('staffPayroll.run.otSuffix', { amount: formatMoney(line.overtimePay) })}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {line.approvedHours || '—'}
                  {line.overtimeHours > 0 && <span className="block text-xs text-warning">{t('staffPayroll.run.otHoursSuffix', { hours: line.overtimeHours })}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(line.totalDeductions)}
                  {line.sickLeaveDeduction > 0 && (
                    <span className="block text-xs font-normal text-danger" title={line.sickLeaveNote}>
                      {t('staffPayroll.run.sickSuffix', { amount: formatMoney(line.sickLeaveDeduction) })}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(line.netPay)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" isLoading={downloadingId === line._id} onClick={() => handleDownload(line)}>
                      {t('staffPayroll.run.pdfButton')}
                    </Button>
                    {isDraft && canWrite && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(line)}>
                        {t('common.edit')}
                      </Button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!editingLine} onClose={() => setEditingLine(null)} title={t('staffPayroll.run.editModalTitle', { name: editingLine?.employeeName ?? '' })}>
        <form onSubmit={handleSubmit((values) => saveLineMutation.mutate(values))} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('staffPayroll.run.otherAllowances')} type="number" min="0" step="10" error={errors.otherAllowances?.message} {...register('otherAllowances')} />
            <Input
              label={t('staffPayroll.run.gosiDeduction')}
              type="number"
              min="0"
              step="10"
              error={errors.gosiDeduction?.message}
              {...register('gosiDeduction')}
            />
          </div>
          <p className="text-xs text-muted">
            {t('staffPayroll.run.gosiHint')}
          </p>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">{t('staffPayroll.run.otherDeductions')}</label>
              <Button type="button" size="sm" variant="secondary" onClick={() => append({ label: '', amount: '' })}>
                {t('common.add')}
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-start gap-2">
                  <Input
                    className="flex-1"
                    placeholder={t('staffPayroll.run.deductionLabelPlaceholder')}
                    aria-label={t('staffPayroll.run.deductionLabelAriaLabel')}
                    error={errors.otherDeductions?.[i]?.label?.message}
                    {...register(`otherDeductions.${i}.label`)}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    className="w-32"
                    placeholder={t('staffPayroll.run.deductionAmountPlaceholder')}
                    aria-label={t('staffPayroll.run.deductionAmountAriaLabel')}
                    error={errors.otherDeductions?.[i]?.amount?.message}
                    {...register(`otherDeductions.${i}.amount`)}
                  />
                  <Button type="button" size="sm" variant="danger-ghost" onClick={() => remove(i)} aria-label={t('staffPayroll.run.removeDeductionAriaLabel')}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditingLine(null)} disabled={saveLineMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={saveLineMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmingFinalize}
        title={t('staffPayroll.run.finalizeConfirmTitle')}
        message={t('staffPayroll.run.finalizeConfirmMessage')}
        confirmLabel={t('staffPayroll.run.finalize')}
        loading={finalizeMutation.isPending}
        onConfirm={() => finalizeMutation.mutate()}
        onCancel={() => setConfirmingFinalize(false)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffPayroll.run.deleteConfirmTitle')}
        message={t('staffPayroll.run.deleteConfirmMessage')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
