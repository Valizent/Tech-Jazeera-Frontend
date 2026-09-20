/**
 * LogPanel — the daily log: "what I did today", newest day first, grouped by
 * day. A coordinator adds entries here and sees only their own; someone with
 * team access sees every coordinator's (with the name on each line) and can
 * narrow by coordinator and date range. Edit/delete buttons follow the
 * server's per-row `permissions`.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listDailyUpdates, createDailyUpdate, updateDailyUpdate, deleteDailyUpdate } from '../dailyUpdates.api.js';
import { logToForm } from '../dailyUpdates.schema.js';
import { apiMessage, formatDate, formatDateTime, formatTime } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import LogEntryForm from './LogEntryForm.jsx';
import PagerBar from './PagerBar.jsx';
import RequirementTag from './RequirementTag.jsx';

const LIMIT = 20;

export default function LogPanel({ access, coordinators }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canSeeAll, canAddLog, canOpenBoard } = access;

  const [filters, setFilters] = useState({ coordinator: '', from: '', to: '', page: 1 });
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const params = {
    kind: 'Log',
    page: filters.page,
    limit: LIMIT,
    ...(filters.coordinator && { coordinator: filters.coordinator }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
  };
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['daily-updates', 'Log', params],
    queryFn: () => listDailyUpdates(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['daily-updates'] });
  const onMutationError = (what) => (error) => {
    console.error(`[dailyUpdates] ${what} failed`, error);
    toast.error(apiMessage(error));
  };

  const addMutation = useMutation({
    mutationFn: (values) => createDailyUpdate({ kind: 'Log', text: values.text, date: values.date }),
    onSuccess: () => {
      toast.success(t('staffDailyUpdates.log.toasts.added'));
      invalidate();
    },
    onError: onMutationError('adding a log entry'),
  });

  const editMutation = useMutation({
    mutationFn: (values) => updateDailyUpdate(editing._id, { text: values.text, date: values.date }),
    onSuccess: () => {
      toast.success(t('staffDailyUpdates.log.toasts.updated'));
      setEditing(null);
      invalidate();
    },
    onError: onMutationError('editing a log entry'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDailyUpdate(id),
    onSuccess: () => {
      toast.success(t('staffDailyUpdates.log.toasts.deleted'));
      setToDelete(null);
      invalidate();
    },
    onError: onMutationError('deleting a log entry'),
  });

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const hasDateFilter = Boolean(filters.from || filters.to);

  // The API returns newest day first already; group consecutive entries by day.
  const groups = useMemo(() => {
    const out = [];
    for (const entry of data?.items ?? []) {
      const key = entry.date.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.key === key) last.entries.push(entry);
      else out.push({ key, date: entry.date, entries: [entry] });
    }
    return out;
  }, [data]);

  return (
    <div>
      {canAddLog && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t('staffDailyUpdates.log.addHeading')}</h2>
          <LogEntryForm mutation={addMutation} submitLabel={t('staffDailyUpdates.log.addEntry')} />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {canSeeAll && (
          <Select
            value={filters.coordinator}
            onChange={(e) => setFilter({ coordinator: e.target.value })}
            className="sm:min-w-[200px]"
            aria-label={t('staffDailyUpdates.coordinatorFilterAria')}
          >
            <option value="">{t('staffDailyUpdates.coordinatorFilterAll')}</option>
            {(coordinators ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Input
          label={t('staffDailyUpdates.log.filterFrom')}
          type="date"
          value={filters.from}
          onChange={(e) => setFilter({ from: e.target.value })}
          className="sm:max-w-[180px]"
        />
        <Input
          label={t('staffDailyUpdates.log.filterTo')}
          type="date"
          value={filters.to}
          onChange={(e) => setFilter({ to: e.target.value })}
          className="sm:max-w-[180px]"
        />
        {hasDateFilter && (
          <Button size="sm" variant="ghost" onClick={() => setFilter({ from: '', to: '' })}>
            {t('staffDailyUpdates.log.clearDates')}
          </Button>
        )}
      </div>

      {isError ? (
        <EmptyState
          title={t('staffDailyUpdates.couldNotLoad')}
          description={t('staffDailyUpdates.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title={hasDateFilter || filters.coordinator ? t('staffDailyUpdates.log.emptyFilteredTitle') : t('staffDailyUpdates.log.emptyTitle')}
          description={
            hasDateFilter || filters.coordinator
              ? t('common.tryClearingFilters')
              : canSeeAll
                ? t('staffDailyUpdates.log.emptyDescriptionTeam')
                : t('staffDailyUpdates.log.emptyDescriptionOwn')
          }
        />
      ) : (
        <>
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 text-sm font-semibold text-muted">{formatDate(group.date)}</h3>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-surface shadow-sm">
                  {group.entries.map((entry) => (
                    <li key={entry._id} className="flex items-start gap-3 px-4 py-3">
                      <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted">{formatTime(entry.createdAt)}</span>
                      <div className="min-w-0 flex-1">
                        {canSeeAll && <p className="mb-0.5 text-xs font-medium text-primary">{entry.coordinator?.name}</p>}
                        {entry.requirement && (
                          <p className="mb-0.5">
                            <RequirementTag requirement={entry.requirement} linked={canOpenBoard} />
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm">{entry.text}</p>
                        {entry.backdated && (
                          <p className="mt-1 text-xs text-muted">
                            {t('staffDailyUpdates.log.backdatedNote', { when: formatDateTime(entry.createdAt) })}
                          </p>
                        )}
                      </div>
                      <span className="flex shrink-0 gap-1">
                        {entry.permissions.edit && (
                          <Button size="sm" variant="ghost" onClick={() => setEditing(entry)}>
                            {t('common.edit')}
                          </Button>
                        )}
                        {entry.permissions.remove && (
                          <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(entry)}>
                            {t('common.delete')}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <PagerBar data={data} limit={LIMIT} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={t('staffDailyUpdates.log.modalEditTitle')} size="lg">
        {editing && (
          <LogEntryForm
            key={editing._id}
            mutation={editMutation}
            defaultValues={logToForm(editing)}
            submitLabel={t('common.save')}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffDailyUpdates.log.deleteConfirmTitle')}
        message={t('staffDailyUpdates.log.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
