/**
 * MobilisationListPage — every placement this viewer can see, from the first
 * draft to its release. One list since 2026-10-12: the Deployments register was
 * folded in, because a deployment is the same placement after approval (born
 * with the approved mobilisation, ended with it). An approved row reads
 * "Mobilised" and opens the placement on its Deployment tab; a released one
 * reads "Demobilised".
 *
 * Who sees a row is the server's call (see mobilisation.service.js's
 * findVisibleMobilisations): their own as coordinator, everything past Draft for
 * the viewer circle, and every approved placement for whoever could open the old
 * Deployments register. Those people also get the register's own controls here
 * — Overview, Standby list, the deployments export — and the red count of
 * timesheet months still to enter.
 *
 * Arriving with `?status=Approved` (the old `/deployments` link) shows who is
 * out right now; `?overview=1` opens the Overview straight away (a dashboard
 * card lands there).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listMobilisations, downloadMobilisationsExport } from '../mobilisations.api.js';
import { downloadDeploymentsExport, getPendingHoursQueue } from '../../deployments/deployments.api.js';
import { getMissingMonthsCount } from '../../deployments/deploymentMonths.js';
import { listClients } from '../../clients/clients.api.js';
import { apiMessage, formatDate, mobilisationStatusLabel } from '../../../lib/utils.js';
import { MOBILISATION_STATUSES, MOBILISATION_STATUS_VARIANT } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import SearchableSelect from '../../../components/ui/SearchableSelect.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import DeploymentOverviewModal from '../../deployments/components/DeploymentOverviewModal.jsx';

const SORT_FIELDS = [
  { value: 'createdAt', label: 'Date created' },
  { value: 'mobilisationDate', label: 'Mobilisation date' },
  { value: 'workerName', label: 'Worker' },
  { value: 'clientName', label: 'Client' },
  { value: 'site', label: 'Site' },
  { value: 'status', label: 'Status' },
];

// The deployments export knows the deployment's own statuses and sort fields.
const DEPLOYMENT_STATUS_OF = { Approved: 'Active', Completed: 'Ended' };
const DEPLOYMENT_SORT_OF = { mobilisationDate: 'startDate', workerName: 'workerName', clientName: 'clientName', site: 'site', status: 'status' };

// An Ascending choice survives a refresh and moving around the app, but resets
// to Descending once the tab closes — sessionStorage has exactly that lifetime.
// try/catch: a private window or blocked site data can make it throw, and this
// is only a personal preference.
const SORT_ORDER_STORAGE_KEY = 'mobilisations-sort-order';
function readStoredSortOrder() {
  try {
    const stored = sessionStorage.getItem(SORT_ORDER_STORAGE_KEY);
    return stored === 'asc' || stored === 'desc' ? stored : 'desc';
  } catch {
    return 'desc';
  }
}

export default function MobilisationListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const sortPanelRef = useRef(null);

  // Arriving from the Coordinator Drill-Down modal's "Generated profit" tile
  // (?coordinator=<id>&coordinatorName=<name>) — the name rides along in the
  // URL so this page can show a real "Filtered to: X" chip without a second
  // fetch just to resolve an id back to a name.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCoordinator = searchParams.get('coordinator') ?? '';
  const initialCoordinatorName = searchParams.get('coordinatorName') ?? '';
  // The dashboard's "Shared employees" tile links here with ?status=Approved&shared=true.
  const linkedStatus = searchParams.get('status');
  const initialStatus = MOBILISATION_STATUSES.includes(linkedStatus) ? linkedStatus : '';
  const initialShared = searchParams.get('shared') === 'true' ? 'true' : '';

  const canReadDeployments = user.role === 'Office Secretary' || Boolean(user.sectionAccess?.includes('deploymentsRelease'));
  const canDecideHours = Boolean(user.sectionAccessWrite?.includes('deploymentsHoursDecide'));

  const [search, setSearch] = useState('');
  const [params, setParams] = useState(() => ({
    page: 1,
    limit: 20,
    search: '',
    status: initialStatus,
    client: '',
    site: '',
    coordinator: initialCoordinator,
    shared: initialShared,
    sortBy: 'createdAt',
    sortOrder: readStoredSortOrder(),
  }));
  const [coordinatorName, setCoordinatorName] = useState(initialCoordinatorName);

  // Deep link: strip the param as the Overview opens so it cannot force itself
  // back open on a later back-navigation.
  useEffect(() => {
    if (canReadDeployments && searchParams.get('overview') === '1') {
      setOverviewOpen(true);
      setSearchParams(
        (prev) => {
          prev.delete('overview');
          return prev;
        },
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SORT_ORDER_STORAGE_KEY, params.sortOrder);
    } catch {
      // Blocked storage: a lost preference for this tab only.
    }
  }, [params.sortOrder]);

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

  // The client filter is the old Deployments register's, so it stays with that
  // audience; a plain mobilisation viewer never had one and must not get a
  // "could not load" warning for a list they cannot fill.
  const { data: clientData, isError: clientsError } = useQuery({
    queryKey: ['clients', 'all-for-filter'],
    queryFn: () => listClients({ limit: 100 }),
    staleTime: 60_000,
    enabled: canReadDeployments,
  });

  const { data: pendingHours } = useQuery({
    queryKey: ['deployments', 'pending-hours'],
    queryFn: getPendingHoursQueue,
    enabled: canDecideHours,
    refetchInterval: 30_000,
  });

  const filters = {
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    ...(params.search && { search: params.search }),
    ...(params.status && { status: params.status }),
    ...(params.client && { client: params.client }),
    ...(params.site && { site: params.site }),
    ...(params.coordinator && { coordinator: params.coordinator }),
    ...(params.shared && { shared: params.shared }),
  };

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['mobilisations', params],
    queryFn: () => listMobilisations({ page: params.page, limit: params.limit, ...filters }),
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
    mutationFn: () => downloadMobilisationsExport(filters),
    onError: (error) => toast.error(apiMessage(error)),
  });

  // Only a mobilised or demobilised filter (or none) has deployments to export.
  const canExportDeployments = canReadDeployments && (!params.status || Boolean(DEPLOYMENT_STATUS_OF[params.status]));
  const deploymentsExportMutation = useMutation({
    mutationFn: () =>
      downloadDeploymentsExport({
        sortOrder: params.sortOrder,
        ...(DEPLOYMENT_SORT_OF[params.sortBy] && { sortBy: DEPLOYMENT_SORT_OF[params.sortBy] }),
        ...(DEPLOYMENT_STATUS_OF[params.status] && { status: DEPLOYMENT_STATUS_OF[params.status] }),
        ...(params.client && { client: params.client }),
        ...(params.site && { site: params.site }),
      }),
    onError: (error) => toast.error(apiMessage(error)),
  });

  // Dot indicator — active when sort or the site filter differ from defaults.
  const sortPanelActive = params.sortBy !== 'createdAt' || params.sortOrder !== 'desc' || params.site !== '';

  // A placement is one page; a mobilised or demobilised one opens on its Deployment tab.
  const openPlacement = (m) => navigate(`/mobilisations/${m._id}${m.deployment ? '?tab=deployment' : ''}`);

  const columns = [
    { key: 'serialNumber', header: t('staffMobilisations.list.columns.serialNumber'), render: (m) => m.serialNumber },
    { key: 'workerName', header: t('staffMobilisations.list.columns.worker'), render: (m) => m.workerName },
    { key: 'jobTitle', header: t('staffMobilisations.list.columns.jobTitle'), hideOnMobile: true, render: (m) => m.jobTitle },
    { key: 'clientName', header: t('staffMobilisations.list.columns.client'), render: (m) => m.clientName },
    { key: 'site', header: t('staffMobilisations.list.columns.site'), hideOnMobile: true, render: (m) => <span className="text-muted">{m.site || ''}</span> },
    {
      key: 'mobilisationDate',
      header: t('staffMobilisations.list.columns.period'),
      hideOnMobile: true,
      render: (m) => (
        <span className="text-sm">
          {formatDate(m.mobilisationDate)}
          {m.deployment?.endDate && <span className="text-muted"> &rarr; {formatDate(m.deployment.endDate)}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('staffMobilisations.list.columns.status'),
      render: (m) => {
        const missing = m.deployment ? getMissingMonthsCount(m.deployment) : 0;
        const reason = m.deployment?.endReason;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={MOBILISATION_STATUS_VARIANT[m.status]}>
              {mobilisationStatusLabel(t, m.status)}
              {reason ? ` · ${t(`staffDeployments.reasons.${reason}`, reason)}` : ''}
            </Badge>
            {missing > 0 && (
              <span
                className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                title={t('staffMobilisations.list.missingMonths', { count: missing })}
              >
                {missing}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openPlacement(m)}>
            {t('common.view')}
          </Button>
        </span>
      ),
    },
  ];

  const noFilters = !params.search && !params.status && !params.client && !params.site && !params.coordinator && !params.shared;

  function clearSharedFilter() {
    setParams((p) => ({ ...p, shared: '', page: 1 }));
  }

  function clearCoordinatorFilter() {
    setParams((p) => ({ ...p, coordinator: '', page: 1 }));
    setCoordinatorName('');
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('staffMobilisations.list.pageTitle')}
        description={t('staffMobilisations.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canDecideHours && (
              <Button size="sm" variant="primary" onClick={() => navigate('/deployments/hours-review')} className="relative">
                {t('staffMobilisations.list.approveTimesheets')}
                {pendingHours?.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-surface">
                    {pendingHours.length}
                  </span>
                )}
              </Button>
            )}
            <Button size="sm" variant="secondary" isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              {t('staffMobilisations.list.exportMobilisations')}
            </Button>
            {canReadDeployments && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canExportDeployments}
                  isLoading={deploymentsExportMutation.isPending}
                  onClick={() => deploymentsExportMutation.mutate()}
                >
                  {t('staffMobilisations.list.exportDeployments')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setOverviewOpen(true)}>
                  {t('staffMobilisations.list.overview')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate('/deployments/standby')}>
                  {t('staffMobilisations.list.standbyList')}
                </Button>
              </>
            )}
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

      {params.shared && (
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('staffMobilisations.list.filteredToShared')}
            <button
              type="button"
              onClick={clearSharedFilter}
              className="hover:text-primary/70"
              aria-label={t('staffMobilisations.list.clearSharedFilterAriaLabel')}
            >
              ✕
            </button>
          </span>
        </div>
      )}

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

      {canReadDeployments && <PickerLoadWarning failed={[{ label: t('staffMobilisations.list.clientFilterList'), isError: clientsError }]} />}
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
              {mobilisationStatusLabel(t, s)}
            </option>
          ))}
        </Select>
        {canReadDeployments && (
          <SearchableSelect
            value={params.client}
            onChange={(value) => setParams((p) => ({ ...p, client: value, page: 1 }))}
            placeholder={t('staffMobilisations.list.searchClientPlaceholder')}
            className="sm:max-w-xs"
            aria-label={t('staffMobilisations.list.filterClientAriaLabel')}
            options={[
              { value: '', label: t('staffMobilisations.list.allClients') },
              ...(clientData?.items ?? []).map((c) => ({ value: c._id, label: c.companyName })),
            ]}
          />
        )}

        {/* Compact sort & filter popover */}
        <div className="relative" ref={sortPanelRef}>
          <button
            type="button"
            id="mob-sort-filter-btn"
            onClick={() => setSortPanelOpen((o) => !o)}
            aria-label="Sort and filter"
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
              className="absolute start-0 top-12 z-30 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg"
              role="dialog"
              aria-label="Sort and filter options"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sort &amp; Filter</p>

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
              <div className="mb-3 flex gap-2">
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

              <label htmlFor="mob-site-filter" className="mb-1 block text-xs font-medium text-text">Filter by site</label>
              <input
                id="mob-site-filter"
                type="text"
                value={params.site}
                onChange={(e) => setParams((p) => ({ ...p, site: e.target.value, page: 1 }))}
                placeholder="e.g. Jizan, Abha..."
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />

              {sortPanelActive && (
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, sortBy: 'createdAt', sortOrder: 'desc', site: '', page: 1 }))}
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
            onRowClick={openPlacement}
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

      {canReadDeployments && <DeploymentOverviewModal open={overviewOpen} onClose={() => setOverviewOpen(false)} />}
    </div>
  );
}
