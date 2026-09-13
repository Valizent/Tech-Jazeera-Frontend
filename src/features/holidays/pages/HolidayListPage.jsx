/**
 * HolidayListPage — the company holiday calendar (P3-B). Every staff role and
 * Worker can view it unconditionally (mirrors the Leave-types read-open
 * pattern); adding, editing, or removing an entry is gated by the
 * admin-configurable Section Access 'holidays' write grant (Admin plus
 * whichever ApprovalRole an Admin names — HR by default, preserving today's
 * real access).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from '../holidays.api.js';
import { holidayFormSchema, emptyHolidayForm, holidayToForm } from '../holidays.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import RamadanPeriodsSection from '../../ramadan/components/RamadanPeriodsSection.jsx';

export default function HolidayListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canManage = Boolean(user.sectionAccessWrite?.includes('holidays'));

  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [toDelete, setToDelete] = useState(null);

  const { data: holidays, isPending, isError, refetch } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => listHolidays(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(holidayFormSchema), defaultValues: emptyHolidayForm });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['holidays'] });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing?._id ? updateHoliday(editing._id, values) : createHoliday(values)),
    onSuccess: () => {
      toast.success(editing?._id ? t('staffHolidays.updatedSuccess') : t('staffHolidays.addedSuccess'));
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteHoliday(id),
    onSuccess: () => {
      toast.success(t('staffHolidays.removedSuccess', { name: toDelete.name }));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function openNew() {
    reset(emptyHolidayForm);
    setEditing({});
  }
  function openEdit(holiday) {
    reset(holidayToForm(holiday));
    setEditing(holiday);
  }

  function dayCount(holiday) {
    const days = Math.round((new Date(holiday.endDate) - new Date(holiday.startDate)) / 86_400_000) + 1;
    return t('staffHolidays.dayCount', { count: days });
  }

  const columns = [
    {
      key: 'name',
      header: t('staffHolidays.columns.holiday'),
      render: (h) => (
        <span className="font-medium text-text">
          {h.name}
          {!h.isPaid && <Badge variant="default" className="ml-2">{t('staffHolidays.unpaid')}</Badge>}
        </span>
      ),
    },
    {
      key: 'dates',
      header: t('staffHolidays.columns.dates'),
      render: (h) =>
        h.startDate.slice(0, 10) === h.endDate.slice(0, 10)
          ? formatDate(h.startDate)
          : `${formatDate(h.startDate)} – ${formatDate(h.endDate)}`,
    },
    { key: 'days', header: t('staffHolidays.columns.length'), hideOnMobile: true, render: (h) => dayCount(h) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (h) =>
        canManage ? (
          <span className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => openEdit(h)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(h)}>
              {t('common.delete')}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('staffHolidays.pageTitle')}
        description={t('staffHolidays.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          canManage && (
            <Button size="sm" onClick={openNew}>
              {t('staffHolidays.addHoliday')}
            </Button>
          )
        }
      />

      {isError ? (
        <EmptyState
          title={t('staffHolidays.couldNotLoad')}
          description={t('staffHolidays.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={holidays ?? []}
          rowKey={(h) => h._id}
          loading={isPending}
          emptyState={
            <EmptyState
              title={t('staffHolidays.emptyTitle')}
              description={
                canManage
                  ? t('staffHolidays.emptyDescriptionManage')
                  : t('staffHolidays.emptyDescriptionView')
              }
              action={
                canManage && (
                  <Button variant="secondary" onClick={openNew}>
                    {t('staffHolidays.addHoliday')}
                  </Button>
                )
              }
            />
          }
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? t('staffHolidays.modalEditTitle') : t('staffHolidays.modalAddTitle')}>
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <Input label={t('staffHolidays.form.name')} placeholder={t('staffHolidays.form.namePlaceholder')} error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('staffHolidays.form.startDate')} type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Input label={t('staffHolidays.form.endDate')} type="date" error={errors.endDate?.message} {...register('endDate')} />
          </div>
          <Textarea label={t('staffHolidays.form.notes')} placeholder={t('common.optional')} error={errors.notes?.message} {...register('notes')} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('isPaid')} />
            {t('staffHolidays.form.paidHoliday')}
          </label>
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
        title={t('staffHolidays.deleteConfirmTitle')}
        message={t('staffHolidays.deleteConfirmMessage', { name: toDelete?.name })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />

      {/* P3-E: a second, related calendar-configuration section on the same
          page — see RamadanPeriodsSection's own doc comment for why this
          isn't a separate nav item. */}
      <div className="mt-10 border-t border-border pt-8">
        <RamadanPeriodsSection />
      </div>
    </div>
  );
}
