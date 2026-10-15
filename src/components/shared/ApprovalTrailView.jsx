/**
 * ApprovalTrailView — read-only display of a workflow-governed request's
 * step-by-step progress as a horizontal chain of connected circular nodes.
 * A request with no `workflow` (the legacy single-decision flow) shows one muted
 * line saying so; its decidedBy/At/Note are shown wherever it is used. Shared across every request type's review screen.
 *
 * `pendingStatus` defaults to 'PendingReview' (Leave's own value) purely for
 * backward compatibility with existing callers that don't pass it — every
 * OTHER type's actual pending status is a different string (Timesheet:
 * 'Submitted'; SalaryAdvance/Reimbursement/ExitReentry/Certificate:
 * 'Pending'), so a caller that never passes this prop never resolves a
 * "current step" node — every step just renders decided-or-not-yet-reached,
 * which still degrades sensibly (no crash, no wrong step highlighted) — a
 * real, still-open gap in those callers, not something this default
 * silently fixes for them.
 *
 * A step is "decided" when `approvalTrail` has an entry for it — the engine
 * (approvalEngine.service.js) always appends entries in step order and never
 * skips one, so `entry.step === i` is a reliable per-node lookup. On a
 * rejection `currentStep` freezes at the rejecting step and `status` leaves
 * `pendingStatus`, so every later step naturally falls out of both the
 * "decided" and "current" checks below and renders not-yet-reached — that
 * is what makes the chain visually stop at the rejection with no special
 *-casing needed.
 */
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, formatDateTime } from '../../lib/utils.js';

const CheckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const XIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function ApprovalTrailView({ request, pendingStatus = 'PendingReview', statusField = 'status' }) {
  const { t } = useTranslation();
  if (!request.workflow) return <p className="mt-2 text-xs text-muted">{t('approvalTrail.singleStep')}</p>;

  const steps = request.steps ?? [];
  const trail = request.approvalTrail ?? [];
  const isPending = request[statusField] === pendingStatus;

  return (
    <div className="mt-2 rounded-lg border border-border bg-bg/40 p-3 text-xs">
      {request.workflowName && <p className="mb-3 font-medium text-muted">{request.workflowName}</p>}
      <div className="flex items-start overflow-x-auto overflow-y-hidden pb-1">
        {steps.map((step, i) => {
          const entry = trail.find((e) => e.step === i);
          const isCurrent = !entry && isPending && i === request.currentStep;
          const prevEntry = trail.find((e) => e.step === i - 1);
          const segmentApproved = prevEntry?.decision === 'Approved';

          return (
            <Fragment key={i}>
              {i > 0 && (
                <div className={cn('mt-5 h-0.5 w-8 shrink-0 sm:w-12', segmentApproved ? 'bg-success' : 'bg-border')} />
              )}
              <div className="flex w-20 shrink-0 flex-col items-center text-center sm:w-24">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    entry?.decision === 'Approved' && 'bg-success text-white',
                    entry?.decision === 'Rejected' && 'bg-danger text-white',
                    isCurrent && 'border-2 border-warning bg-warning/10 text-warning',
                    !entry && !isCurrent && 'border border-border bg-surface text-muted'
                  )}
                >
                  {entry?.decision === 'Approved' && CheckIcon}
                  {entry?.decision === 'Rejected' && XIcon}
                  {!entry && i + 1}
                </div>
                <div className="mt-1.5 space-y-0.5 break-words">
                  {/* The stage (HR, Accounts...) above the person: who decided it, or who it is given to. */}
                  <p className={isCurrent ? 'font-medium text-warning' : 'text-muted'}>
                    {step.label || step.roles?.map((r) => r.name).filter(Boolean).join(' / ') || t('approvalTrail.stepNumber', { number: i + 1 })}
                  </p>
                  {entry ? (
                    <>
                      <p className="font-medium text-text">{entry.approvedBy?.name ?? 'Unknown'}</p>
                      <p className="text-muted">{formatDateTime(entry.decidedAt)}</p>
                      {entry.viaAdminOverride && <p className="text-[10px] font-medium text-muted">(admin override)</p>}
                      {entry.note && <p className="italic text-muted">“{entry.note}”</p>}
                    </>
                  ) : (
                    step.assignee?.name && <p className="font-medium text-text">{step.assignee.name}</p>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** One line for a table cell: "Step 2 of 3: Marketing Manager" while the request is pending, nothing otherwise. */
export function ApprovalProgressLine({ request, pendingStatus = 'Pending', statusField = 'status' }) {
  const { t } = useTranslation();
  if (!request.workflow || request[statusField] !== pendingStatus) return null;
  const steps = request.steps ?? [];
  const step = steps[request.currentStep];
  const stage = step?.label || step?.roles?.map((r) => r.name).filter(Boolean).join(' / ') || '';
  const name = step?.assignee?.name ? `${stage} (${step.assignee.name})` : stage;
  return (
    <p className="mt-1 text-xs text-muted">
      {t('approvalTrail.progress', { current: (request.currentStep ?? 0) + 1, total: steps.length, name })}
    </p>
  );
}
