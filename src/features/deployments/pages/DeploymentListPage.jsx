/**
 * Deployment register — every placement, current and historical, with status
 * and client filters. Read-only overview; a Deployment is born automatically
 * once its source Mobilisation is Approved (see the Mobilisations module) and
 * ended via Release on the deployment's own detail page — there is no manual
 * create/assign here.
 *
 * 2026-09-16, the user's own asks, all four: (1) the status filter now
 * DEFAULTS to 'Active' ("Mobilised") — this register is checked far more
 * often for "who's out right now" than for history, same reasoning as
 * Deployment's own default sort putting the newest first; a real click on
 * "All statuses" still shows everything, this only changes what loads first.
 * (2) the client filter is now a searchable combobox (SearchableSelect),
 * not a plain `<select>` — a company with 50+ clients turned that into a
 * long scroll. (3) "Export to Excel" — same filters as the on-screen list,
 * mirrors MobilisationListPage's own button+mutation pattern exactly.
 * (4) "Overview" — a full-width modal showing EVERY deployment (not just
 * this page's filtered/paginated slice) in one spreadsheet-style table,
 * every column the Excel export itself has, each with its own Excel-style
 * column filter — see DeploymentOverviewModal.jsx. Deep-linkable via
 * `?overview=1` (2026-09-24, the user's own ask — a dashboard card should
 * land straight in the spreadsheet view, not just the plain register) —
 * same "sync open-state with a URL param" precedent TABS-notes.md's own
 * `useTabParam` already established for this app; the param is stripped
 * (via `replace`) the moment the modal opens so it doesn't linger and
 * force itself back open on a later back-navigation.
 *
 * 2026-09-28: compact sort-and-filter popover (sortBy column, asc/desc,
 * site text filter) behind a single icon button next to the existing filters.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { listDeployments, downloadDeploymentsExport, getPendingHoursQueue } from '../deployments.api.js';
import { listClients } from '../../clients/clients.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { DEPLOYMENT_STATUSES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import SearchableSelect from '../../../components/ui/SearchableSelect.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import DeploymentOverviewModal from '../components/DeploymentOverviewModal.jsx';

const STATUS_VARIANT = { Active: 'success', Ended: 'default' };

const SORT_FIELDS = [
  { value: 'startDate', label: 'Start date' },
  { value: 'workerName', label: 'Worker' },
  { value: 'clientName', label: 'Client' },
  { value: 'site', label: 'Site' },
  { value: 'status', label: 'Status' },
];

export default function DeploymentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const sortPanelRef = useRef(null);

  // Deep-link support — see this file's own header comment.
  useEffect(() => {
    if (searchParams.get('overview') === '1') {
      setOverviewOpen(true);
      setSearchParams((prev) => {
        prev.delete('overview');
        return prev;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const [params, setParams] = useState({
    page: 1,
    limit: 20,
    status: 'Active',
    client: '',
    site: '',
    sortBy: 'startDate',
    sortOrder: 'desc',
  });

  // Clients for the filter dropdown (also confirms whether any client exists).
  const { data: clientData, isError: clientsError } = useQuery({
    queryKey: ['clients', 'all-for-filter'],
    queryFn: () => listClients({ limit: 100 }),
    staleTime: 60_000,
  });

  const canDecideHours = Boolean(user.sectionAccessWrite?.includes('deploymentsHoursDecide'));
  const { data: pendingHours } = useQuery({
    queryKey: ['deployments', 'pending-hours'],
    queryFn: getPendingHoursQueue,
    enabled: canDecideHours,
    refetchInterval: 30_000,
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ['deployments', params],
    queryFn: () =>
      listDeployments({
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(params.status && { status: params.status }),
        ...(params.client && { client: params.client }),
        ...(params.site && { site: params.site }),
      }),
    placeholderData: keepPreviousData,
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadDeploymentsExport({
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(params.status && { status: params.status }),
        ...(params.client && { client: params.client }),
        ...(params.site && { site: params.site }),
      }),
    onError: (error) => toast.error(apiMessage(error)),
  });

  // Show dot indicator when non-default sort/filter options are active.
  const sortPanelActive =
    params.sortBy !== 'startDate' || params.sortOrder !== 'desc' || params.site !== '';

  const columns = [
    {
      key: 'worker',
      header: t('staffDeployments.list.columns.worker'),
      render: (d) => (
        <span className="font-medium text-text">
          {d.workerName}
          {d.worker?.employeeId && <span className="block text-xs font-normal text-muted">{d.worker.employeeId}</span>}
        </span>
      ),
    },
    {
      key: 'client',
      header: t('staffDeployments.list.columns.clientSite'),
      render: (d) => (
        <span>
          {d.clientName}
          {d.site && <span className="block text-xs text-muted">{d.site}</span>}
        </span>
      ),
    },
    {
      key: 'startDate',
      header: t('staffDeployments.list.columns.period'),
      render: (d) => (
        <span className="text-sm">
          {formatDate(d.startDate)}
          {d.endDate && <span className="text-muted"> &rarr; {formatDate(d.endDate)}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('staffDeployments.list.columns.status'),
      render: (d) => (
        <Badge variant={STATUS_VARIANT[d.status]}>
          {t(`staffDeployments.status.${d.status}`, d.status)}
          {d.endReason ? ` · ${t(`staffDeployments.reasons.${d.endReason}`, d.endReason)}` : ''}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('staffDeployments.list.pageTitle')}
        description={t('staffDeployments.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canDecideHours && (
              <Button size="sm" variant="primary" onClick={() => navigate('/deployments/hours-review')} className="relative">
                Approve Timesheet
                {pendingHours?.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-surface">
                    {pendingHours.length}
                  </span>
                )}
              </Button>
            )}
            <Button size="sm" variant="secondary" isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              {t('staffDeployments.list.exportExcel')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOverviewOpen(true)}>
              {t('staffDeployments.list.overview')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/deployments/standby')}>
              {t('staffDeployments.list.standbyList')}
            </Button>
          </div>
        }
      />

      <PickerLoadWarning failed={[{ label: 'the client filter list', isError: clientsError }]} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          value={params.status}
          onChange={(e) => setParams((p) => ({ ...p, status: e.target.value, page: 1 }))}
          className="sm:max-w-[180px]"
          aria-label={t('staffDeployments.list.filterStatusAriaLabel')}
        >
          <option value="">{t('common.allStatuses')}</option>
          {DEPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`staffDeployments.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <SearchableSelect
          value={params.client}
          onChange={(value) => setParams((p) => ({ ...p, client: value, page: 1 }))}
          placeholder={t('staffDeployments.list.searchClientPlaceholder')}
          className="sm:max-w-xs"
          aria-label={t('staffDeployments.list.filterClientAriaLabel')}
          options={[
            { value: '', label: t('staffDeployments.list.allClients') },
            ...(clientData?.items ?? []).map((c) => ({ value: c._id, label: c.companyName })),
          ]}
        />

        {/* Compact sort & filter icon button + popover */}
        <div className="relative" ref={sortPanelRef}>
          <button
            type="button"
            id="deploy-sort-filter-btn"
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
            {/* Active indicator dot */}
            {sortPanelActive && (
              <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            )}
          </button>

          {sortPanelOpen && (
            <div
              id="deploy-sort-filter-panel"
              className="absolute start-0 top-12 z-30 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg"
              role="dialog"
              aria-label="Sort and filter options"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sort &amp; Filter</p>

              {/* Sort by */}
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

              {/* Direction toggle */}
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

              {/* Site text filter */}
              <label htmlFor="deploy-site-filter" className="mb-1 block text-xs font-medium text-text">Filter by site</label>
              <input
                id="deploy-site-filter"
                type="text"
                value={params.site}
                onChange={(e) => setParams((p) => ({ ...p, site: e.target.value, page: 1 }))}
                placeholder="e.g. Jizan, Abha..."
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />

              {/* Reset button — only shown when something is non-default */}
              {sortPanelActive && (
                <button
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, sortBy: 'startDate', sortOrder: 'desc', site: '', page: 1 }))}
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
        <EmptyState title={t('staffDeployments.list.couldNotLoad')} description={t('staffDeployments.list.couldNotLoadDescription')} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(d) => d._id}
            loading={isPending}
            onRowClick={(d) => navigate(`/deployments/${d._id}`)}
            emptyState={
              <EmptyState
                title={params.status || params.client || params.site ? t('staffDeployments.list.emptyTitleFiltered') : t('staffDeployments.list.emptyTitleNoFilters')}
                description={
                  params.status || params.client || params.site
                    ? t('common.tryClearingFilters')
                    : t('staffDeployments.list.emptyDescriptionNoFilters')
                }
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

      <DeploymentOverviewModal open={overviewOpen} onClose={() => setOverviewOpen(false)} />
    </div>
  );
}
