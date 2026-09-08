/**
 * RamadanPeriodsSection (P3-E) — the configurable Ramadan calendar + hour
 * caps, embedded as a second section on the Holidays page rather than a
 * standalone nav item: both are "company calendar" configuration owned by
 * the same Admin/Manager/HR circle, and a whole new sidebar entry for one
 * small settings list would be pure navigation overhead (same call
 * P2-M3b made for folding timesheet submission into My Attendance).
 *
 * These dates + hour caps feed straight into Payroll's real overtime pay
 * (P3-E) via timesheet.service.js's weekly threshold check — not shown
 * here directly, but this is where that number ultimately comes from.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listRamadanPeriods,
  createRamadanPeriod,
  updateRamadanPeriod,
  deleteRamadanPeriod,
} from '../ramadanPeriods.api.js';
import { ramadanPeriodFormSchema, emptyRamadanPeriodForm, ramadanPeriodToForm } from '../ramadan.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function RamadanPeriodsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  // A real pre-existing mismatch found here: this used HOLIDAY_MANAGE_ROLES
  // (['Admin','HR'], the Holiday calendar's OWN Admin/HR-only circle), which
  // silently hid these controls from Manager even though the server always
  // allowed Manager to manage Ramadan periods — a different config than
  // Holidays. Fixed by using Ramadan's own 'ramadanManage' Section Access
  // grant, matching the real server gate.
  const canManage = Boolean(user.sectionAccessWrite?.includes('ramadanManage'));

  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [toDelete, setToDelete] = useState(null);

  const { data: periods, isPending, isError, refetch } = useQuery({
    queryKey: ['ramadan-periods'],
    queryFn: () => listRamadanPeriods(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(ramadanPeriodFormSchema), defaultValues: emptyRamadanPeriodForm });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ramadan-periods'] });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?._id ? updateRamadanPeriod(editing._id, values) : createRamadanPeriod(values)),
    onSuccess: () => {
      toast.success(editing?._id ? t('staffHolidays.ramadan.updatedSuccess') : t('staffHolidays.ramadan.addedSuccess'));
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteRamadanPeriod(id),
    onSuccess: () => {
      toast.success(t('staffHolidays.ramadan.removedSuccess', { label: toDelete.label }));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptyRamadanPeriodForm);
    setEditing({});
  }
  function openEdit(period) {
    reset(ramadanPeriodToForm(period));
    setEditing(period);
  }

  const columns = [
    { key: 'label', header: t('staffHolidays.ramadan.columns.period'), render: (p) => <span className="font-medium text-text">{p.label}</span> },
    {
      key: 'dates',
      header: t('staffHolidays.ramadan.columns.dates'),
      render: (p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`,
    },
    {
      key: 'caps',
      header: t('staffHolidays.ramadan.columns.hourCaps'),
      hideOnMobile: true,
      render: (p) => t('staffHolidays.ramadan.hourCapsValue', { daily: p.dailyHours, weekly: p.weeklyHours }),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) =>
        canManage ? (
          <span className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(p)}>
              {t('common.delete')}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffHolidays.ramadan.sectionTitle')}</h2>
          <p className="mt-1 text-xs text-muted">
            {t('staffHolidays.ramadan.sectionDescription')}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNew}>
            {t('staffHolidays.ramadan.addPeriod')}
          </Button>
        )}
      </div>

      {isError ? (
        <EmptyState
          title={t('staffHolidays.ramadan.couldNotLoad')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={periods ?? []}
          rowKey={(p) => p._id}
          loading={isPending}
          emptyState={
            <EmptyState
              title={t('staffHolidays.ramadan.emptyTitle')}
              description={
                canManage
                  ? t('staffHolidays.ramadan.emptyDescriptionManage')
                  : t('staffHolidays.ramadan.emptyDescriptionView')
              }
              action={canManage && <Button variant="secondary" onClick={openNew}>{t('staffHolidays.ramadan.addPeriod')}</Button>}
            />
          }
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? t('staffHolidays.ramadan.modalEditTitle') : t('staffHolidays.ramadan.modalAddTitle')}>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <Input label={t('staffHolidays.ramadan.form.label')} placeholder={t('staffHolidays.ramadan.form.labelPlaceholder')} error={errors.label?.message} {...register('label')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('staffHolidays.ramadan.form.startDate')} type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Input label={t('staffHolidays.ramadan.form.endDate')} type="date" error={errors.endDate?.message} {...register('endDate')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('staffHolidays.ramadan.form.dailyHours')} type="number" min="1" max="8" error={errors.dailyHours?.message} {...register('dailyHours')} />
            <Input label={t('staffHolidays.ramadan.form.weeklyHours')} type="number" min="6" max="48" error={errors.weeklyHours?.message} {...register('weeklyHours')} />
          </div>
          <p className="text-xs text-muted">
            {t('staffHolidays.ramadan.form.hint')}
          </p>
          <Textarea label={t('staffHolidays.ramadan.form.notes')} placeholder={t('common.optional')} error={errors.notes?.message} {...register('notes')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffHolidays.ramadan.deleteConfirmTitle')}
        message={t('staffHolidays.ramadan.deleteConfirmMessage', { label: toDelete?.label })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
