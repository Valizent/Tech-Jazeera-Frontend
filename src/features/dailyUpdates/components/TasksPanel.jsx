/**
 * TasksPanel — the to-do list. A coordinator sees their own tasks (self-written
 * and manager-assigned); someone with team access sees everyone's and can
 * filter to one coordinator. Which buttons a row shows comes straight from the
 * server's per-row `permissions`, never re-derived here.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listDailyUpdates, setTaskStatus, deleteDailyUpdate } from '../dailyUpdates.api.js';
import { apiMessage, cn, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import PagerBar from './PagerBar.jsx';
import TaskFormModal from './TaskFormModal.jsx';

const LIMIT = 20;

export default function TasksPanel({ access, currentUserId, coordinators }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canSeeAll, canAssign, canAddTask } = access;

  // Arriving from the Coordinator Drill-Down modal's "Assigned tasks" tile
  // (?coordinator=<id>) — that link only ever renders for a viewer who
  // already has dailyUpdatesTeam read (canSeeAll here), so this never
  // silently sets a filter the viewer has no way to see the picker for.
  // Status defaults to "" (every status) instead of the usual "Open" —
  // the whole point of that tile is seeing completed AND pending AND
  // overdue in one place, not just the open ones.
  const [searchParams] = useSearchParams();
  const initialCoordinator = searchParams.get('coordinator') ?? '';
  const [filters, setFilters] = useState({
    coordinator: initialCoordinator,
    status: initialCoordinator ? '' : 'Open',
    page: 1,
  });
  const [modal, setModal] = useState({ open: false, task: null });
  const [toDelete, setToDelete] = useState(null);

  const params = {
    kind: 'Task',
    page: filters.page,
    limit: LIMIT,
    ...(filters.coordinator && { coordinator: filters.coordinator }),
    ...(filters.status && { status: filters.status }),
  };
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['daily-updates', 'Task', params],
    queryFn: () => listDailyUpdates(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['daily-updates'] });
  const onMutationError = (what) => (error) => {
    console.error(`[dailyUpdates] ${what} failed`, error);
    toast.error(apiMessage(error));
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => setTaskStatus(id, status),
    onSuccess: (task) => {
      toast.success(t(task.status === 'Done' ? 'staffDailyUpdates.tasks.toasts.done' : 'staffDailyUpdates.tasks.toasts.reopened'));
      invalidate();
    },
    onError: onMutationError('changing a task status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDailyUpdate(id),
    onSuccess: () => {
      toast.success(t('staffDailyUpdates.tasks.toasts.deleted'));
      setToDelete(null);
      invalidate();
    },
    onError: onMutationError('deleting a task'),
  });

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const columns = [
    {
      key: 'text',
      header: t('staffDailyUpdates.tasks.columns.task'),
      render: (task) => (
        <div className="min-w-0 space-y-1">
          <p className={cn('whitespace-pre-wrap break-words', task.status === 'Done' && 'text-muted line-through')}>{task.text}</p>
          {(task.overdue || task.assignedByOther) && (
            <div className="flex flex-wrap gap-1.5">
              {task.overdue && <Badge variant="danger">{t('staffDailyUpdates.tasks.overdue')}</Badge>}
              {task.assignedByOther && (
                <Badge>{t('staffDailyUpdates.tasks.assignedBy', { name: task.createdBy?.name ?? '—' })}</Badge>
              )}
            </div>
          )}
        </div>
      ),
    },
    ...(canSeeAll
      ? [{ key: 'coordinator', header: t('staffDailyUpdates.tasks.columns.assignedTo'), render: (task) => task.coordinator?.name ?? '—' }]
      : []),
    { key: 'due', header: t('staffDailyUpdates.tasks.columns.due'), render: (task) => (task.dueDate ? formatDate(task.dueDate) : '—') },
    {
      key: 'status',
      header: t('staffDailyUpdates.tasks.columns.status'),
      render: (task) => (
        <Badge variant={task.status === 'Done' ? 'success' : 'primary'}>{t(`staffDailyUpdates.tasks.status.${task.status}`)}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (task) => (
        <span className="flex flex-wrap justify-end gap-2">
          {task.permissions.setStatus && (
            <Button
              size="sm"
              variant="secondary"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: task._id, status: task.status === 'Done' ? 'Open' : 'Done' })}
            >
              {t(task.status === 'Done' ? 'staffDailyUpdates.tasks.reopen' : 'staffDailyUpdates.tasks.markDone')}
            </Button>
          )}
          {task.permissions.edit && (
            <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, task })}>
              {t('common.edit')}
            </Button>
          )}
          {task.permissions.remove && (
            <Button size="sm" variant="danger-ghost" onClick={() => setToDelete(task)}>
              {t('common.delete')}
            </Button>
          )}
        </span>
      ),
    },
  ];

  const emptyTitle = filters.status === 'Open' ? t('staffDailyUpdates.tasks.emptyOpenTitle') : t('staffDailyUpdates.tasks.emptyTitle');
  const emptyDescription = canSeeAll ? t('staffDailyUpdates.tasks.emptyDescriptionTeam') : t('staffDailyUpdates.tasks.emptyDescriptionOwn');

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
          <Select
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
            className="sm:min-w-[160px]"
            aria-label={t('staffDailyUpdates.tasks.statusFilterAria')}
          >
            <option value="">{t('staffDailyUpdates.tasks.statusAll')}</option>
            <option value="Open">{t('staffDailyUpdates.tasks.status.Open')}</option>
            <option value="Done">{t('staffDailyUpdates.tasks.status.Done')}</option>
          </Select>
        </div>
        {canAddTask && (
          <Button size="sm" onClick={() => setModal({ open: true, task: null })}>
            {t(canAssign ? 'staffDailyUpdates.tasks.assignTask' : 'staffDailyUpdates.tasks.addTask')}
          </Button>
        )}
      </div>

      {isError ? (
        <EmptyState
          title={t('staffDailyUpdates.couldNotLoad')}
          description={t('staffDailyUpdates.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(task) => task._id}
            loading={isPending}
            emptyState={<EmptyState title={emptyTitle} description={emptyDescription} />}
          />
          <PagerBar data={data} limit={LIMIT} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}

      <TaskFormModal
        open={modal.open}
        task={modal.task}
        canAssign={canAssign}
        coordinators={coordinators}
        defaultCoordinatorId={coordinators?.some((c) => c._id === currentUserId) ? currentUserId : ''}
        onClose={() => setModal({ open: false, task: null })}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('staffDailyUpdates.tasks.deleteConfirmTitle')}
        message={t('staffDailyUpdates.tasks.deleteConfirmMessage', { text: toDelete?.text })}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
