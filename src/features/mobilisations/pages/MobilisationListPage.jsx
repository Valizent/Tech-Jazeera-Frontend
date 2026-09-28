/**
 * MobilisationListPage — every mobilisation this viewer can see (M1: their
 * own, as coordinator; Admin sees all). Row-clickable to edit, same "detail
 * view" until a proper detail page lands in M2/M3.
 *
 * 2026-09-28: compact sort-and-filter popover (sortBy column, asc/desc)
 * behind a small icon button next to the existing search/status filters.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listMobilisations, downloadMobilisationsExport } from '../mobilisations.api.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { MOBILISATION_STATUSES, MOBILISATION_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const SORT_FIELDS = [
  { value: 'createdAt', label: 'Date created' },
  { value: 'mobilisationDate', label: 'Mobilisation date' },
  { value: 'workerName', label: 'Worker' },
  { value: 'clientName', label: 'Client' },
  { value: 'status', label: 'Status' },
];

export default function MobilisationListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const sortPanelRef = useRef(null);

  // Arriving from the Coordinator Drill-Down modal's "Generated profit" tile
  // (?coordinator=<id>&coordinatorName=<name>) — the name rides along in the
  // URL so this page can show a real "Filtered to: X" chip without a second
  // fetch just to resolve an id back to a name.
  const [searchParams] = useSearchParams();
  const initialCoordinator = searchParams.get('coordinator') ?? '';
  const initialCoordinatorName = searchParams.get('coordinatorName') ?? '';

  const [search, setSearch] = useState('');
  const [params, setParams] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    coordinator: initialCoordinator,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [coordinatorName, setCoordinatorName] = useState(initialCoordinatorName);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close popover on outside click.
  useEffect(() => {
    if (!sortPanelOpen) return;
    function handleClick(e) {
      if (sortPanelRef.current && !sortPanelRef.current.contains(e.target)) {
        setSortPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortPanelOpen]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['mobilisations', params],
    queryFn: () =>
      listMobilisations({
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
        ...(params.coordinator && { coordinator: params.coordinator }),
      }),
    placeholderData: keepPreviousData,
    // Same reasoning as the Leave review queue: a coordinator submitting or
    // a Marketing Manager deciding a mobilisation from another session has
    // no way to reach this already-open list otherwise. 20s, not 10s
    // (2026-09-22, a real QA-audit finding — P1) — see LeavePage.jsx's own
    // comment on this exact change.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadMobilisationsExport({
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
        ...(params.coordinator && { coordinator: params.coordinator }),
      }),
    onError: (error) => toast.error(apiMessage(error)),
  });

  // Dot indicator — active when sort differs from defaults.
  const sortPanelActive = params.sortBy !== 'createdAt' || params.sortOrder !== 'desc';

  const columns = [
    { key: 'serialNumber', header: t('staffMobilisations.list.columns.serialNumber'), render: (m) => m.serialNumber },
    { key: 'workerName', header: t('staffMobilisations.list.columns.worker'), render: (m) => m.workerName },
    { key: 'jobTitle', header: t('staffMobilisations.list.columns.jobTitle'), hideOnMobile: true, render: (m) => m.jobTitle },
    { key: 'clientName', header: t('staffMobilisations.list.columns.client'), render: (m) => m.clientName },
    { key: 'mobilisationDate', header: t('staffMobilisations.list.columns.mobilisationDate'), hideOnMobile: true, render: (m) => formatDate(m.mobilisationDate) },
    {
      key: 'status',
      header: t('staffMobilisations.list.columns.status'),
      render: (m) => <Badge variant={MOBILISATION_STATUS_VARIANT[m.status]}>{t(`common.status.${m.status}`, m.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/mobilisations/${m._id}`)}>
            {t('common.view')}
          </Button>
        </span>
      ),
    },
  ];

  const noFilters = !params.search && !params.status && !params.coordinator;

  function clearCoordinatorFilter() {
    setParams((p) => ({ ...p, coordinator: '', page: 1 }));
    setCoordinatorName('');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('staffMobilisations.list.pageTitle')}
        description={t('staffMobilisations.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              isLoading={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {t('staffMobilisations.list.exportExcel')}
            </Button>
            {user.role === 'Admin' && (
              <Button size="sm" variant="secondary" onClick={() => navigate('/mobilisations/worker-history')}>
                {t('staffMobilisations.list.workerDataButton')}
              </Button>
            )}
            <Button size="sm" onClick={() => navigate('/mobilisations/new')}>
              {t('staffMobilisations.list.newMobilisation')}
            </Button>
          </div>
        }
      />

      {params.coordinator && (
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('staffMobilisations.list.filteredToCoordinator', { name: coordinatorName || t('staffMobilisations.list.thisCoordinator') })}
            <button
              type="button"
              onClick={clearCoordinatorFilter}
              className="hover:text-primary/70"
              aria-label={t('staffMobilisations.list.clearCoordinatorFilterAriaLabel')}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffMobilisations.list.searchPlaceholderWithSerial')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffMobilisations.list.searchAriaLabel')}
        />
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffMobilisations.list.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {MOBILISATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>

        {/* Compact sort popover */}
        <div className="relative" ref={sortPanelRef}>
          <button
            type="button"
            id="mob-sort-filter-btn"
            onClick={() => setSortPanelOpen((o) => !o)}
            aria-label="Sort"
            aria-expanded={sortPanelOpen}
            className={[
              'relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
              sortPanelOpen
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted hover:border-muted/50 hover:text-text',
            ].join(' ')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M11 10l1.5 1.5L14 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {sortPanelActive && (
              <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            )}
          </button>

          {sortPanelOpen && (
            <div
              id="mob-sort-filter-panel"
              className="absolute start-0 top-12 z-30 w-56 rounded-xl border border-border bg-surface p-4 shadow-lg"
              role="dialog"
              aria-label="Sort options"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sort</p>

              <label className="mb-1 block text-xs font-medium text-text">Sort by</label>
              <div className="relative mb-3">
                <select
                  value={params.sortBy}
                  onChange={(e) => setParams((p) => ({ ...p, sortBy: e.target.value, page: 1 }))}
                  className="h-9 w-full appearance-none rounded-lg border border-border bg-bg ps-3 pe-7 text-sm text-text focus:border-primary focus:outline-none"
                >
                  {SORT_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <label className="mb-1 block text-xs font-medium text-text">Direction</label>
              <div className="flex gap-2">
                {[
                  { val: 'desc', icon: '↓', label: 'Desc' },
                  { val: 'asc', icon: '↑', label: 'Asc' },
                ].map(({ val, icon, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, sortOrder: val, page: 1 }))}
                    className={[
                      'flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-sm transition-colors',
                      params.sortOrder === val
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border bg-bg text-muted hover:border-muted/50 hover:text-text',
                    ].join(' ')}
                    aria-pressed={params.sortOrder === val}
                  >
                    <span aria-hidden="true">{icon}</span> {label}
                  </button>
                ))}
              </div>

              {sortPanelActive && (
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, sortBy: 'createdAt', sortOrder: 'desc', page: 1 }))}
                  className="mt-3 w-full rounded-lg py-1.5 text-xs text-muted transition-colors hover:text-danger"
                >
                  Reset to defaults
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isError ? (
        <EmptyState
          title={t('staffMobilisations.list.couldNotLoad')}
          description={t('staffMobilisations.list.couldNotLoadDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(m) => m._id}
            loading={isPending}
            onRowClick={(m) => navigate(`/mobilisations/${m._id}`)}
            emptyState={
              <EmptyState
                title={noFilters ? t('staffMobilisations.list.emptyTitleNoFilters') : t('staffMobilisations.list.emptyTitleFiltered')}
                description={noFilters ? t('staffMobilisations.list.emptyDescriptionNoFilters') : t('common.tryClearingFilters')}
                action={noFilters && <Button variant="secondary" onClick={() => navigate('/mobilisations/new')}>{t('staffMobilisations.list.newMobilisation')}</Button>}
              />
            }
          />

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                {t('common.showingRange', { from: (data.page - 1) * params.limit + 1, to: Math.min(data.page * params.limit, data.total), total: data.total })}
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>
                  {t('common.previous')}
                </Button>
                <span className="tabular-nums">
                  {t('common.pageOf', { page: data.page, pages: data.pages })}
                </span>
                <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                  {t('common.next')}
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
