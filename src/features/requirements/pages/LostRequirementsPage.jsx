/**
 * LostRequirementsPage — every requirement closed without converting to a
 * mobilisation (a terminal, non-mobilised stage — the suggested set's own
 * "Lost", or whatever an admin names a stage like it), with no age cutoff
 * (the board itself hides a closed card after 30 days — see
 * requirement.service.js's CLOSED_VISIBLE_DAYS — this page is the permanent
 * record kept so a Manager/MM can review lost business, 2026-09-30 the
 * user's own ask: "these are relevant data" worth showing management, not
 * deleting). Same own/team access as the board — a plain coordinator sees
 * their own lost cards, team-read sees everyone's.
 *
 * `stages` (the full board's columns, not just the lost ones) is fetched
 * separately so a card opened from here can still be moved back into an
 * active stage via the same RequirementDetailModal the board itself uses —
 * "we didn't actually lose this" shouldn't require going back to the board.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getLostRequirements,
  getBoard,
  listRequirementCoordinators,
  downloadLostRequirementsExport,
} from '../requirements.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatDate, apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import RequirementDetailModal from '../components/RequirementDetailModal.jsx';
import RequirementFormModal from '../components/RequirementFormModal.jsx';

const DAY_MS = 86_400_000;
const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS));

export default function LostRequirementsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [formState, setFormState] = useState(null); // null = closed, { requirement } = edit
  const openId = searchParams.get('open');

  const write = user.sectionAccessWrite ?? [];
  const canSeeAll = (user.sectionAccess ?? []).includes('requirementsTeam');
  const canAssign = write.includes('requirementsTeam');
  const params = coordinator ? { coordinator } : {};

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['requirements', 'lost', params],
    queryFn: () => getLostRequirements(params),
  });

  // Only for the full stage list, so a card opened from here can be moved
  // back into an active stage — the requirements this call returns are
  // otherwise unused on this page.
  const { data: boardData } = useQuery({
    queryKey: ['requirements', 'board', {}],
    queryFn: () => getBoard({}),
  });
  const stages = boardData?.stages ?? [];

  const { data: coordinators, isError: coordinatorsError } = useQuery({
    queryKey: ['requirements', 'coordinators'],
    queryFn: listRequirementCoordinators,
    enabled: canSeeAll,
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadLostRequirementsExport(params),
    onError: (error) => {
      console.error('[requirements] exporting lost requirements failed', error);
      toast.error(apiMessage(error));
    },
  });

  const requirements = useMemo(() => data?.requirements ?? [], [data]);
  const filtered = useMemo(() => {
    if (!search.trim()) return requirements;
    const q = search.toLowerCase();
    return requirements.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.jobTitle.toLowerCase().includes(q) ||
        r.serialNumber.toLowerCase().includes(q)
    );
  }, [requirements, search]);

  const setOpenId = (id) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('open', id);
        else next.delete('open');
        return next;
      },
      { replace: !id }
    );

  const columns = [
    {
      key: 'serialNumber',
      header: t('staffRequirements.lost.columns.requirement'),
      width: 12,
      render: (r) => <span className="font-medium tabular-nums text-muted">{r.serialNumber}</span>,
    },
    { key: 'clientName', header: t('staffRequirements.lost.columns.client'), width: 20, render: (r) => r.clientName },
    {
      key: 'jobTitle',
      header: t('staffRequirements.lost.columns.jobTitle'),
      width: 20,
      render: (r) => (
        <span>
          {r.jobTitle} <span className="tabular-nums text-muted">× {r.headcount}</span>
        </span>
      ),
    },
    {
      key: 'stageName',
      header: t('staffRequirements.lost.columns.stage'),
      width: 12,
      render: (r) => <Badge variant="danger">{r.stageName}</Badge>,
    },
    {
      key: 'coordinators',
      header: t('staffRequirements.lost.columns.coordinators'),
      width: 18,
      render: (r) => r.coordinators.map((c) => c.name).join(', '),
    },
    {
      key: 'neededBy',
      header: t('staffRequirements.lost.columns.neededBy'),
      width: 10,
      render: (r) => (r.neededBy ? formatDate(r.neededBy) : ''),
    },
    {
      key: 'stageEnteredAt',
      header: t('staffRequirements.lost.columns.closedOn'),
      width: 10,
      render: (r) => formatDate(r.stageEnteredAt),
    },
    {
      key: 'daysChased',
      header: t('staffRequirements.lost.columns.daysChased'),
      align: 'right',
      width: 10,
      render: (r) => daysBetween(r.createdAt, r.stageEnteredAt),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffRequirements.lost.pageTitle')}
        description={t('staffRequirements.lost.pageDescription')}
        onBack={() => window.history.back()}
        actions={
          requirements.length > 0 && (
            <Button size="sm" variant="secondary" isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              {t('staffRequirements.exportExcel')}
            </Button>
          )
        }
      />

      <PickerLoadWarning failed={[{ label: 'the coordinator list', isError: coordinatorsError }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="sm:min-w-[240px]">
          <Input
            placeholder={t('staffRequirements.lost.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canSeeAll && (
          <Select value={coordinator} onChange={(e) => setCoordinator(e.target.value)} className="sm:min-w-[200px]">
            <option value="">{t('staffRequirements.coordinatorFilterAll')}</option>
            {(coordinators ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {!isPending && !isError && (
          <span className="text-sm text-muted">{t('staffRequirements.lost.totalCount', { count: filtered.length })}</span>
        )}
      </div>

      {isError ? (
        <EmptyState
          title={t('staffRequirements.lost.couldNotLoad')}
          description={t('staffRequirements.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <Card>
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(r) => r._id}
            loading={isPending}
            onRowClick={(r) => setOpenId(r._id)}
            emptyState={
              <EmptyState
                title={t('staffRequirements.lost.emptyTitle')}
                description={t('staffRequirements.lost.emptyDescription')}
              />
            }
          />
        </Card>
      )}

      {openId && !formState && (
        <RequirementDetailModal
          id={openId}
          stages={stages}
          onClose={() => setOpenId(null)}
          onEdit={(requirement) => setFormState({ requirement })}
        />
      )}

      <RequirementFormModal
        open={Boolean(formState)}
        requirement={formState?.requirement ?? null}
        canAssign={canAssign}
        coordinators={coordinators}
        defaultCoordinatorId={coordinators?.some((c) => c._id === user.id) ? user.id : ''}
        onClose={() => setFormState(null)}
      />
    </div>
  );
}
