/**
 * ApprovalLogPage — every request decided through a configured
 * ApprovalWorkflow, merged across request types and ordered newest first.
 * Visible to any staff user in the NAV (see navConfig.js — no static role
 * gate, since eligibility here is dynamic), but the API applies the real
 * rule: Admin, or an actual ApprovalRole member. A non-member sees this
 * page's error state, not a route redirect — the same "let the real check
 * run and render its result" approach the review screens use for
 * canDecideCurrentStep.
 *
 * Leave, ExitReentry, Certificate, Timesheet, SalaryAdvance, and
 * Reimbursement are all wired in (see approvals.service.js's LOG_SOURCES).
 * Mobilisation is the one deliberate holdout — its `coordinators` are Users
 * directly, not an Employee ref, so it doesn't fit this log's shared
 * `employee`-scoped shape without its own pass.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listApprovalLog } from '../approvals.api.js';
import { APPROVAL_REQUEST_TYPES, APPROVAL_REQUEST_TYPE_LABELS } from '../../../lib/constants.js';

// Fixed 2026-09-15, the QA audit's own UX suggestion #7 ("the approval-log
// UI should not offer a request type that is intentionally unimplemented
// without explaining it"): Mobilisation is a real, valid
// APPROVAL_REQUEST_TYPES member (used correctly elsewhere, e.g. the
// Approval Hierarchy's own workflow-type picker) but is deliberately absent
// from this log's own LOG_SOURCES (see approvals.service.js and this file's
// own doc comment) — picking it here always silently returned zero results,
// indistinguishable from "no decisions yet." Filtered out of THIS page's
// own dropdown only; the shared constant itself is untouched.
const LOG_FILTER_TYPES = APPROVAL_REQUEST_TYPES.filter((t) => t !== 'Mobilisation');
import { apiMessage, formatDate } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

// Fixed 2026-09-15, a real QA-audit-found gap — F9: the filter now sends
// the server's normalized 'Pending' value (see approvals.validation.js),
// not Leave's own literal 'PendingReview' — that string alone silently
// excluded every other source type from the filtered results. Real ITEMS
// still come back with their own source type's actual status literal
// (Leave's 'PendingReview', Timesheet's 'Submitted', every other type's
// 'Pending') — PENDING_STATUSES is how the badge/label below recognizes
// all of them as the same "awaiting decision" state for display.
const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];
const PENDING_STATUSES = new Set(['Pending', 'PendingReview', 'Submitted']);
const statusVariant = (s) => (PENDING_STATUSES.has(s) ? 'warning' : s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : 'default');
const statusLabel = (s) => (PENDING_STATUSES.has(s) ? 'Pending review' : s);

export default function ApprovalLogPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['approval-log', { type, status }],
    queryFn: () => listApprovalLog({ limit: 100, ...(type && { type }), ...(status && { status }) }),
    // Same reasoning as the Leave review queue: a decision made from another
    // session has no way to reach this already-open log otherwise. 20s, not
    // 10s (2026-09-22, a real QA-audit finding — P1) — see LeavePage.jsx's
    // own comment on this exact change.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  // Employee search is client-side, scoped to the currently loaded page —
  // a real limitation at large scale, but this app's request volume is
  // modest and a full server-side employee picker isn't worth the extra
  // surface for that gain today.
  const items = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.items;
    const q = search.trim().toLowerCase();
    return data.items.filter(
      (item) => item.employee?.fullName?.toLowerCase().includes(q) || item.employee?.employeeId?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Approval Log"
        description="Every request decided through a configured approval workflow, in order — for anyone in the hierarchy to see."
        onBack={() => navigate(-1)}
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Request type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {LOG_FILTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {APPROVAL_REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
          <Input label="Employee" placeholder="Search name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : isError ? (
          <EmptyState
            title="Could not load the approval log"
            description={apiMessage(error)}
            action={
              <Button variant="secondary" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState title="No decisions yet" description="Nothing matches this filter." />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={`${item.requestType}-${item._id}`} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.employee?.fullName}{' '}
                      <span className="font-normal text-muted">({item.employee?.employeeId})</span>
                    </p>
                    <p className="text-xs text-muted">
                      {APPROVAL_REQUEST_TYPE_LABELS[item.requestType]} · {item.typeName} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
                <ApprovalTrailView request={item} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
