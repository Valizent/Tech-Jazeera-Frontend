/**
 * AuditLogPage ("Security Log") — the full, filterable, paginated audit
 * trail. Gated by the real 'auditLog' Section Access grant (fixed
 * 2026-09-14, a real QA-audit-found gap — this used to hardcode Admin-only
 * client-side even after the server moved to Section Access, so a
 * genuinely-granted Manager still bounced straight home). Read-only — no
 * write action exists for this key. The dashboard's "Recent activity"
 * widget is the 8-item glance version of this same data; this is the
 * complete record — who did what, when, from where.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAuditLog } from '../audit.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatDateTime } from '../../../lib/utils.js';
import { describeAction, actionVariant } from '../../../lib/auditActions.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Compact, safe rendering of an audit row's free-form meta — never secrets
 *  (logAudit()'s callers are trusted not to put any in there; see audit.model.js). */
function MetaSummary({ meta }) {
  if (!meta || Object.keys(meta).length === 0) return <span className="text-muted">—</span>;
  const text = Object.entries(meta)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ');
  return (
    <span className="block max-w-xs truncate font-mono text-xs text-muted" title={text}>
      {text}
    </span>
  );
}

export default function AuditLogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('auditLog'));
  const queryClient = useQueryClient();

  const [actionSearch, setActionSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 25, action: '', from: '', to: '' });

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.action === actionSearch ? p : { ...p, action: actionSearch, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [actionSearch]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['audit-log', params],
    queryFn: () =>
      listAuditLog({
        page: params.page,
        limit: params.limit,
        ...(params.action && { action: params.action }),
        ...(params.from && { from: params.from }),
        ...(params.to && { to: params.to }),
      }),
    placeholderData: keepPreviousData,
    enabled: canRead,
  });

  // Hooks must run before any early return (Rules of Hooks).
  if (!canRead) return <Navigate to="/" replace />;

  const columns = [
    {
      key: 'createdAt',
      header: 'Time',
      render: (a) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(a.createdAt)}</span>,
    },
    {
      key: 'user',
      header: 'User',
      render: (a) => (
        <span>
          {a.user?.name ?? <span className="italic text-muted">System</span>}
          {a.user?.role && <span className="block text-xs text-muted">{a.user.role}</span>}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (a) => (
        <span className="flex flex-col gap-1">
          <Badge variant={actionVariant(a.action)}>{describeAction(a.action)}</Badge>
          <span className="font-mono text-[11px] text-muted">{a.action}</span>
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      hideOnMobile: true,
      render: (a) => (a.targetType ? <span className="text-xs text-muted">{a.targetType}</span> : '—'),
    },
    { key: 'ip', header: 'IP', hideOnMobile: true, render: (a) => a.ip ?? '—' },
    { key: 'meta', header: 'Details', hideOnMobile: true, render: (a) => <MetaSummary meta={a.meta} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Security Log"
        description="Complete, unfiltered record of authentication and CRUD activity across the company — never edited or deleted."
        onBack={() => navigate(-1)}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder="Search actions (e.g. auth, nfc, delete)…"
          value={actionSearch}
          onChange={(e) => setActionSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label="Search actions"
        />
        <Input
          type="date"
          label="From"
          value={params.from}
          onChange={(e) => setParams((p) => ({ ...p, from: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
        />
        <Input
          type="date"
          label="To"
          value={params.to}
          onChange={(e) => setParams((p) => ({ ...p, to: e.target.value, page: 1 }))}
          className="sm:max-w-[160px]"
        />
        {(params.action || params.from || params.to) && (
          <Button
            variant="secondary"
            onClick={() => {
              setActionSearch('');
              setParams({ page: 1, limit: 25, action: '', from: '', to: '' });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isError ? (
        <EmptyState
          title="Could not load the security log"
          description="Check your connection and try again."
          action={
            <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['audit-log'] })}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(a) => a._id}
            loading={isPending}
            emptyState={
              <EmptyState
                title={params.action || params.from || params.to ? 'No matching activity' : 'No activity yet'}
                description={
                  params.action || params.from || params.to
                    ? 'Try clearing the search or date range.'
                    : 'Actions across the system will appear here.'
                }
              />
            }
          />

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                Showing {(data.page - 1) * params.limit + 1}–
                {Math.min(data.page * params.limit, data.total)} of {data.total}
              </span>
              <span className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <span className="tabular-nums">
                  {data.page} / {data.pages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={data.page >= data.pages}
                  onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
