/**
 * RequirementsBoardPage — the pre-mobilisation board: client requirements that
 * have come in but aren't mobilised yet, as cards moving through stages left to
 * right. A coordinator sees the cards they're on; someone with team access sees
 * every card and can filter by coordinator.
 *
 * What each viewer can do is derived once here from Section Access
 * (`requirementsOwn` = my own board, `requirementsTeam` = every coordinator,
 * `requirementStages` = edit the columns) — mirroring requirement.service.js,
 * which is the real enforcement; each card's own buttons come from its
 * server-computed `permissions`.
 *
 * The open card lives in the URL (`?open=<id>`) so a notification's deep link,
 * a refresh, and the browser's back button all land on the same card.
 *
 * Milestone 4: client and subcontractor filters (their choices come back with the
 * board itself, built from the cards this user can see — a coordinator has no access
 * to the Clients / Subcontractors lists, so they can't be fetched from there), and
 * "Export to Excel" of whatever the current filters show.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBoard, listRequirementCoordinators, moveRequirement, createSuggestedStages, downloadRequirementsExport } from '../requirements.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Select from '../../../components/ui/Select.jsx';
import SearchableSelect from '../../../components/ui/SearchableSelect.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import BoardColumn from '../components/BoardColumn.jsx';
import RequirementCard from '../components/RequirementCard.jsx';
import RequirementDetailModal from '../components/RequirementDetailModal.jsx';
import RequirementFormModal from '../components/RequirementFormModal.jsx';
import StageManagerModal from '../components/StageManagerModal.jsx';

const BOARD_KEY = ['requirements', 'board'];

export default function RequirementsBoardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const read = user.sectionAccess ?? [];
  const write = user.sectionAccessWrite ?? [];
  const isCoordinator = user.role === 'Coordinator';
  const canSeeAll = read.includes('requirementsTeam');
  const canAssign = write.includes('requirementsTeam');
  const canCreate = canAssign || (isCoordinator && write.includes('requirementsOwn'));
  const canManageStages = write.includes('requirementStages');

  const [coordinator, setCoordinator] = useState('');
  const [client, setClient] = useState(''); // a company name — a requirement can come from a company that isn't a Client record
  const [subcontractor, setSubcontractor] = useState(''); // a subcontractor id
  const [showOlderClosed, setShowOlderClosed] = useState(false);
  const [formState, setFormState] = useState(null); // null = closed, { requirement: null } = add, { requirement } = edit
  const [stagesOpen, setStagesOpen] = useState(false);
  const openId = searchParams.get('open');

  const params = {
    ...(coordinator && { coordinator }),
    ...(client && { client }),
    ...(subcontractor && { subcontractor }),
    ...(showOlderClosed && { closed: 'all' }),
  };
  const hasFilters = Boolean(coordinator || client || subcontractor);
  const clearFilters = () => {
    setCoordinator('');
    setClient('');
    setSubcontractor('');
  };
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...BOARD_KEY, params],
    queryFn: () => getBoard(params),
    placeholderData: keepPreviousData,
  });

  const { data: coordinators, isError: coordinatorsError } = useQuery({
    queryKey: ['requirements', 'coordinators'],
    queryFn: listRequirementCoordinators,
    enabled: canSeeAll,
  });

  // Memoised: a fresh `[]` every render would defeat the byStage memo below.
  const stages = useMemo(() => data?.stages ?? [], [data]);
  const requirements = data?.requirements;

  const byStage = useMemo(() => {
    const map = new Map(stages.map((s) => [s._id, []]));
    for (const r of requirements ?? []) map.get(r.stage)?.push(r);
    return map;
  }, [stages, requirements]);
  const staleTotal = (requirements ?? []).filter((r) => r.stale).length;
  const hasClosedStage = stages.some((s) => s.isTerminal);
  const clientChoices = data?.filterOptions?.clients ?? [];
  const subcontractorChoices = data?.filterOptions?.subcontractors ?? [];

  const setOpenId = (id) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('open', id);
        else next.delete('open');
        return next;
      },
      { replace: !id } // opening a card is a real history step, so Back closes it
    );

  // Move with an optimistic update — the card jumps immediately and rolls back
  // if the server refuses (a drag that lands in the wrong place, or a stale
  // permission), rather than making every drop wait on the database.
  const moveMutation = useMutation({
    mutationFn: ({ id, stage }) => moveRequirement(id, stage),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY });
      const previous = queryClient.getQueriesData({ queryKey: BOARD_KEY });
      queryClient.setQueriesData({ queryKey: BOARD_KEY }, (old) => {
        if (!old) return old;
        const moved = old.requirements.find((r) => r._id === id);
        if (!moved) return old;
        // Appended at the end, where the server's own sort (longest-waiting first) will put it.
        return { ...old, requirements: [...old.requirements.filter((r) => r._id !== id), { ...moved, stage, daysInStage: 0, stale: false }] };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      context?.previous.forEach(([key, snapshot]) => queryClient.setQueryData(key, snapshot));
      console.error('[requirements] moving a requirement failed', error);
      toast.error(apiMessage(error));
    },
    onSuccess: (updated) => toast.success(t('staffRequirements.toasts.moved', { stage: stages.find((s) => s._id === updated.stage)?.name ?? '' })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['requirements'] }),
  });

  const exportMutation = useMutation({
    mutationFn: () => downloadRequirementsExport(params),
    onError: (error) => {
      console.error('[requirements] exporting the board failed', error);
      toast.error(apiMessage(error));
    },
  });

  const suggestedMutation = useMutation({
    mutationFn: createSuggestedStages,
    onSuccess: () => {
      toast.success(t('staffRequirements.stages.toasts.suggestedAdded'));
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
    },
    onError: (error) => {
      console.error('[requirements] adding the suggested stages failed', error);
      toast.error(apiMessage(error));
    },
  });

  function moveCard(id, stage) {
    const card = requirements?.find((r) => r._id === id);
    if (!card || card.stage === stage) return;
    if (!card.permissions.move) {
      toast.error(t('staffRequirements.cannotMove'));
      return;
    }
    moveMutation.mutate({ id, stage });
  }

  const showCoordinators = (r) => canSeeAll || r.coordinators.length > 1;
  const noStages = !isPending && !isError && stages.length === 0;

  return (
    <div>
      <PageHeader
        title={t('staffRequirements.pageTitle')}
        description={t('staffRequirements.pageDescription')}
        actions={
          <>
            {stages.length > 0 && (
              <Button size="sm" variant="secondary" isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
                {t('staffRequirements.exportExcel')}
              </Button>
            )}
            {canManageStages && stages.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setStagesOpen(true)}>
                {t('staffRequirements.manageStages')}
              </Button>
            )}
            {canCreate && stages.length > 0 && (
              <Button size="sm" onClick={() => setFormState({ requirement: null })}>
                {t('staffRequirements.addRequirement')}
              </Button>
            )}
          </>
        }
      />

      <PickerLoadWarning failed={[{ label: 'the coordinator list', isError: coordinatorsError }]} />

      {stages.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {canSeeAll && (
            <Select
              value={coordinator}
              onChange={(e) => setCoordinator(e.target.value)}
              className="sm:min-w-[200px]"
              aria-label={t('staffRequirements.coordinatorFilterAria')}
            >
              <option value="">{t('staffRequirements.coordinatorFilterAll')}</option>
              {(coordinators ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {clientChoices.length > 0 && (
            <SearchableSelect
              value={client}
              onChange={setClient}
              placeholder={t('staffRequirements.clientFilterPlaceholder')}
              className="sm:min-w-[200px] sm:max-w-xs"
              aria-label={t('staffRequirements.clientFilterAria')}
              options={[{ value: '', label: t('staffRequirements.clientFilterAll') }, ...clientChoices.map((name) => ({ value: name, label: name }))]}
            />
          )}
          {subcontractorChoices.length > 0 && (
            <SearchableSelect
              value={subcontractor}
              onChange={setSubcontractor}
              placeholder={t('staffRequirements.subcontractorFilterPlaceholder')}
              className="sm:min-w-[200px] sm:max-w-xs"
              aria-label={t('staffRequirements.subcontractorFilterAria')}
              options={[
                { value: '', label: t('staffRequirements.subcontractorFilterAll') },
                ...subcontractorChoices.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
          )}
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              {t('staffRequirements.clearFilters')}
            </Button>
          )}
          {hasClosedStage && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="h-4 w-4 rounded border-border" checked={showOlderClosed} onChange={(e) => setShowOlderClosed(e.target.checked)} />
              {t('staffRequirements.showOlderClosed')}
            </label>
          )}
          {staleTotal > 0 && <span className="text-sm font-medium text-danger">{t('staffRequirements.staleCount', { count: staleTotal })}</span>}
        </div>
      )}

      {data?.truncated && <p className="mb-3 rounded-lg bg-warning/10 p-3 text-sm text-warning">{t('staffRequirements.truncated')}</p>}

      {isError ? (
        <EmptyState
          title={t('staffRequirements.couldNotLoad')}
          description={t('staffRequirements.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : isPending ? (
        <div className="flex gap-4 overflow-hidden" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : noStages ? (
        <EmptyState
          title={t('staffRequirements.noStages.title')}
          description={canManageStages ? t('staffRequirements.noStages.descriptionAdmin') : t('staffRequirements.noStages.descriptionOther')}
          action={
            canManageStages && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => suggestedMutation.mutate()} isLoading={suggestedMutation.isPending}>
                  {t('staffRequirements.noStages.useSuggested')}
                </Button>
                <Button variant="secondary" onClick={() => setStagesOpen(true)}>
                  {t('staffRequirements.noStages.setUp')}
                </Button>
              </div>
            )
          }
        />
      ) : (
        // The board scrolls sideways inside its own container — never the page.
        // overflow-y-hidden is required alongside overflow-x (see Tabs.jsx's note:
        // a non-visible overflow-x forces the other axis to `auto`).
        <div className="-mx-1 flex gap-4 overflow-x-auto overflow-y-hidden px-1 pb-4">
          {stages.map((stage) => {
            const cards = byStage.get(stage._id) ?? [];
            return (
              <BoardColumn key={stage._id} stage={stage} count={cards.length} staleCount={cards.filter((c) => c.stale).length} onDropCard={moveCard}>
                {cards.map((card) => (
                  <RequirementCard
                    key={card._id}
                    requirement={card}
                    stages={stages}
                    showCoordinators={showCoordinators(card)}
                    onOpen={setOpenId}
                    onMove={(id, stage) => moveCard(id, stage)}
                  />
                ))}
              </BoardColumn>
            );
          })}
        </div>
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

      {canManageStages && <StageManagerModal open={stagesOpen} stages={stages} onClose={() => setStagesOpen(false)} />}
    </div>
  );
}
