/**
 * StandbyListPage — who's currently free to mobilise (2026-09-14, a real
 * user ask). Two genuinely different sections, not one merged table — see
 * the server's own getStandbyWorkforce doc comment for why: an 'Own'
 * Worker-login employee's availability is a live field (`currentClient`);
 * a subcontractor/freelancer worker's is derived from their placement
 * history (no Employee record, no such field exists for them at all).
 *
 * Each row's own "Mobilise" button (2026-09-16, the user's own ask) deep-
 * links to New Mobilisation with that worker pre-filled — see
 * MobilisationNewPage's own header comment for exactly which query params
 * it reads. An Own Employee only needs `workerType`+`worker` (their live
 * Employee record is the trustworthy source for everything else); a
 * SupplierEmployee/Freelancer needs its identity snapshotted into the URL
 * the same way MobilisationForm's own Iqama-autofill/PreviousWorkerPicker
 * already fill those fields in. Table's own onRowClick already ignores
 * clicks that land on a button, so this needed no extra wiring on the Own
 * Employees table (still row-clickable → the Employee profile).
 *
 * 2026-09-28: client-side sort (name/designation/nationality) + text search
 * filter behind the same compact icon-button popover used in the other
 * register pages. The whole list is fetched at once (no pagination), so all
 * sorting/filtering is local — no API changes needed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getStandbyWorkforce } from '../deployments.api.js';
import { formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Builds the New Mobilisation deep-link query string for one standby row —
 *  see this file's own header comment and MobilisationNewPage's for what
 *  each param does. */
function mobiliseOwnEmployeeUrl(employee) {
  return `/mobilisations/new?${new URLSearchParams({ workerType: 'Employee', worker: employee._id })}`;
}

function mobiliseWorkerUrl(worker) {
  const params = new URLSearchParams({ workerType: worker.workerType, workerName: worker.workerName });
  if (worker.iqamaNumber) params.set('iqamaNumber', worker.iqamaNumber);
  if (worker.nationality) params.set('nationality', worker.nationality);
  if (worker.phone) params.set('phone', worker.phone);
  if (worker.workerType === 'SupplierEmployee' && worker.subcontractor) params.set('subcontractor', worker.subcontractor);
  return `/mobilisations/new?${params}`;
}

const OWN_SORT_FIELDS = [
  { value: 'fullName', label: 'Name' },
  { value: 'designation', label: 'Designation' },
  { value: 'nationality', label: 'Nationality' },
];

const SUB_SORT_FIELDS = [
  { value: 'workerName', label: 'Name' },
  { value: 'nationality', label: 'Nationality' },
  { value: 'lastClientName', label: 'Last client' },
  { value: 'subcontractorName', label: 'Subcontractor' },
];

/** Small reusable sort popover */
function SortPopover({ id, fields, sort, onSort, search, onSearch, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const active = sort.by !== fields[0].value || sort.dir !== 'asc' || search !== '';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={`${id}-btn`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Sort and filter"
        aria-expanded={open}
        className={[
          'relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
          open
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-surface text-muted hover:border-muted/50 hover:text-text',
        ].join(' ')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11 10l1.5 1.5L14 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {active && <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id={`${id}-panel`}
          className="absolute start-0 top-10 z-30 w-56 rounded-xl border border-border bg-surface p-4 shadow-lg"
          role="dialog"
          aria-label="Sort and filter"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sort &amp; Filter</p>

          {/* Search */}
          <label htmlFor={`${id}-search`} className="mb-1 block text-xs font-medium text-text">Search</label>
          <input
            id={`${id}-search`}
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-3 h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />

          {/* Sort by */}
          <label className="mb-1 block text-xs font-medium text-text">Sort by</label>
          <div className="relative mb-3">
            <select
              value={sort.by}
              onChange={(e) => onSort({ ...sort, by: e.target.value })}
              className="h-9 w-full appearance-none rounded-lg border border-border bg-bg ps-3 pe-7 text-sm text-text focus:border-primary focus:outline-none"
            >
              {fields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Direction */}
          <label className="mb-1 block text-xs font-medium text-text">Direction</label>
          <div className="flex gap-2">
            {[
              { val: 'asc', icon: '↑', label: 'Asc' },
              { val: 'desc', icon: '↓', label: 'Desc' },
            ].map(({ val, icon, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => onSort({ ...sort, dir: val })}
                className={[
                  'flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-sm transition-colors',
                  sort.dir === val
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border bg-bg text-muted hover:border-muted/50 hover:text-text',
                ].join(' ')}
                aria-pressed={sort.dir === val}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            ))}
          </div>

          {active && (
            <button
              type="button"
              onClick={() => { onSort({ by: fields[0].value, dir: 'asc' }); onSearch(''); }}
              className="mt-3 w-full rounded-lg py-1.5 text-xs text-muted transition-colors hover:text-danger"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function sortAndFilter(rows, keyFn, sort, search) {
  const lc = search.toLowerCase();
  const filtered = lc
    ? rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(lc)))
    : rows;
  return [...filtered].sort((a, b) => {
    const av = keyFn(a, sort.by) ?? '';
    const bv = keyFn(b, sort.by) ?? '';
    const cmp = String(av).localeCompare(String(bv));
    return sort.dir === 'desc' ? -cmp : cmp;
  });
}

export default function StandbyListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isPending, isError } = useQuery({
    queryKey: ['deployments', 'standby'],
    queryFn: getStandbyWorkforce,
  });

  const [ownSort, setOwnSort] = useState({ by: 'fullName', dir: 'asc' });
  const [ownSearch, setOwnSearch] = useState('');
  const [subSort, setSubSort] = useState({ by: 'workerName', dir: 'asc' });
  const [subSearch, setSubSearch] = useState('');

  const ownRows = useMemo(
    () => data ? sortAndFilter(data.ownEmployees, (r, k) => r[k], ownSort, ownSearch) : [],
    [data, ownSort, ownSearch]
  );
  const subRows = useMemo(
    () => data ? sortAndFilter(data.subcontractedWorkers, (r, k) => r[k], subSort, subSearch) : [],
    [data, subSort, subSearch]
  );

  const ownColumns = [
    {
      key: 'fullName',
      header: t('staffDeployments.standby.columns.employee'),
      render: (e) => (
        <span className="font-medium text-text">
          {e.fullName}
          <span className="block text-xs font-normal text-muted">{e.employeeId}</span>
        </span>
      ),
    },
    { key: 'designation', header: t('staffDeployments.standby.columns.designation'), render: (e) => e.designation },
    { key: 'nationality', header: t('staffDeployments.standby.columns.nationality'), hideOnMobile: true, render: (e) => e.nationality },
    { key: 'mobile', header: t('staffDeployments.standby.columns.mobile'), hideOnMobile: true, render: (e) => e.mobile },
    {
      key: 'mobilise',
      header: '',
      className: 'text-right',
      render: (e) => (
        <Button size="sm" onClick={() => navigate(mobiliseOwnEmployeeUrl(e))}>
          {t('staffDeployments.standby.mobiliseAction')}
        </Button>
      ),
    },
  ];

  const subcontractedColumns = [
    {
      key: 'workerName',
      header: t('staffDeployments.standby.columns.worker'),
      render: (w) => (
        <span className="font-medium text-text">
          {w.workerName}
          <span className="block text-xs font-normal text-muted">
            {t(`staffMobilisations.form.workerType.${w.workerType}`, w.workerType)} &middot; {w.iqamaNumber}
          </span>
        </span>
      ),
    },
    { key: 'nationality', header: t('staffDeployments.standby.columns.nationality'), hideOnMobile: true, render: (w) => w.nationality },
    { key: 'phone', header: t('staffDeployments.standby.columns.mobile'), hideOnMobile: true, render: (w) => w.phone },
    {
      key: 'subcontractor',
      header: t('staffDeployments.standby.columns.subcontractor'),
      hideOnMobile: true,
      render: (w) => w.subcontractorName ?? '—',
    },
    {
      key: 'last',
      header: t('staffDeployments.standby.columns.lastPlacement'),
      render: (w) => (
        <span className="text-sm">
          {w.lastClientName}
          {w.lastEndDate && <span className="block text-xs text-muted">{t('staffDeployments.standby.endedOn', { date: formatDate(w.lastEndDate) })}</span>}
        </span>
      ),
    },
    {
      key: 'mobilise',
      header: '',
      className: 'text-right',
      render: (w) => (
        <Button size="sm" onClick={() => navigate(mobiliseWorkerUrl(w))}>
          {t('staffDeployments.standby.mobiliseAction')}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title={t('staffDeployments.standby.pageTitle')}
        description={t('staffDeployments.standby.pageDescription')}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            {user.role === 'Admin' && (
              <Button variant="secondary" onClick={() => navigate('/mobilisations/worker-history')}>
                {t('staffDeployments.standby.workerDataButton')}
              </Button>
            )}
            <Button onClick={() => navigate('/mobilisations/new')}>{t('staffDeployments.standby.newMobilisation')}</Button>
          </div>
        }
      />

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.standby.couldNotLoad')} description={t('common.checkConnection')} />
      ) : (
        <>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t('staffDeployments.standby.ownEmployeesTitle')}
                </h2>
                <p className="text-xs text-muted">{t('staffDeployments.standby.ownEmployeesDescription')}</p>
              </div>
              <SortPopover
                id="standby-own"
                fields={OWN_SORT_FIELDS}
                sort={ownSort}
                onSort={setOwnSort}
                search={ownSearch}
                onSearch={setOwnSearch}
                searchPlaceholder="Search name, designation..."
              />
            </div>
            <Table
              columns={ownColumns}
              rows={ownRows}
              rowKey={(e) => e._id}
              onRowClick={(e) => navigate(`/employees/${e._id}`)}
              emptyState={
                <EmptyState
                  title={t('staffDeployments.standby.ownEmployeesEmptyTitle')}
                  description={t('staffDeployments.standby.ownEmployeesEmptyDescription')}
                />
              }
            />
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t('staffDeployments.standby.subcontractedTitle')}
                </h2>
                <p className="text-xs text-muted">{t('staffDeployments.standby.subcontractedDescription')}</p>
              </div>
              <SortPopover
                id="standby-sub"
                fields={SUB_SORT_FIELDS}
                sort={subSort}
                onSort={setSubSort}
                search={subSearch}
                onSearch={setSubSearch}
                searchPlaceholder="Search name, subcontractor..."
              />
            </div>
            <Table
              columns={subcontractedColumns}
              rows={subRows}
              rowKey={(w) => w.iqamaNumber}
              emptyState={
                <EmptyState
                  title={t('staffDeployments.standby.subcontractedEmptyTitle')}
                  description={t('staffDeployments.standby.subcontractedEmptyDescription')}
                />
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}
