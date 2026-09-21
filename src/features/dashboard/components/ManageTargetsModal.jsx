/**
 * ManageTargetsModal — MM / Section Access holders can set, edit, and remove
 * monthly mobilisation targets for coordinators, and see everyone's live
 * progress for the selected month.
 *
 * Tabs:
 *   "Progress"  — all coordinators with a target for the selected month,
 *                 showing their live achieved / target / % and a hit badge.
 *   "Set target" — form to upsert a target (coordinator + month + count + %).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllProgress, listAllTargets, setTarget, deleteTarget } from '../../mobilisationTargets/mobilisationTargets.api.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage } from '../../../lib/utils.js';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import CoordinatorDrillDownModal from './CoordinatorDrillDownModal.jsx';

const currentMonth = () => new Date().toISOString().slice(0, 7);

/** Mini inline progress bar */
function ProgressBar({ achieved, target }) {
  const pct = Math.min((achieved / target) * 100, 100);
  const hit = achieved >= target;
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: hit ? '#f59e0b' : 'var(--color-primary)' }}
      />
    </div>
  );
}

export default function ManageTargetsModal({ open, onClose, coordinators = [] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('progress');
  const [month, setMonth] = useState(currentMonth);
  const [drillDownCoordinator, setDrillDownCoordinator] = useState(null);

  // Form state for set-target tab
  const [form, setForm] = useState({ coordinatorId: '', month: currentMonth(), target: '', incentivePercent: '' });

  const { data: progress = [], isLoading: progressLoading } = useQuery({
    queryKey: ['mob-targets-progress', month],
    queryFn: () => getAllProgress(month),
    enabled: open && tab === 'progress',
  });

  const { data: allTargets = [], isLoading: allLoading } = useQuery({
    queryKey: ['mob-targets-all'],
    queryFn: listAllTargets,
    enabled: open && tab === 'set',
  });

  const setMutation = useMutation({
    mutationFn: setTarget,
    onSuccess: () => {
      toast.success('Target set.');
      queryClient.invalidateQueries({ queryKey: ['mob-targets-progress'] });
      queryClient.invalidateQueries({ queryKey: ['mob-targets-all'] });
      queryClient.invalidateQueries({ queryKey: ['mob-target-my'] });
      setForm({ coordinatorId: '', month: currentMonth(), target: '', incentivePercent: '' });
    },
    onError: (e) => toast.error(apiMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTarget,
    onSuccess: () => {
      toast.success('Target removed.');
      queryClient.invalidateQueries({ queryKey: ['mob-targets-progress'] });
      queryClient.invalidateQueries({ queryKey: ['mob-targets-all'] });
      queryClient.invalidateQueries({ queryKey: ['mob-target-my'] });
    },
    onError: (e) => toast.error(apiMessage(e)),
  });

  function handleSetSubmit(e) {
    e.preventDefault();
    if (!form.coordinatorId || !form.month || !form.target) return;
    setMutation.mutate({
      coordinatorId: form.coordinatorId,
      month: form.month,
      target: Number(form.target),
      incentivePercent: form.incentivePercent ? Number(form.incentivePercent) : 0,
    });
  }

  // Pre-fill the set form when "Edit" is clicked in the all-targets list.
  function prefillEdit(t) {
    setForm({
      coordinatorId: t.coordinator._id,
      month: t.month,
      target: String(t.target),
      incentivePercent: String(t.incentivePercent),
    });
    setTab('set');
  }

  return (
    <Modal open={open} onClose={onClose} title="Mobilisation Targets" size="lg">
      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-bg p-1">
        {[
          { key: 'progress', label: 'Monthly Progress' },
          { key: 'set', label: 'Set / Edit Target' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-surface text-text shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Progress Tab ── */}
      {tab === 'progress' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          {progressLoading && (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          )}

          {!progressLoading && progress.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted">No targets set for this month.</p>
              <button
                onClick={() => setTab('set')}
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Set one now →
              </button>
            </div>
          )}

          <div className="space-y-3">
            {progress.map((row) => (
              <div
                key={row._id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                {/* Avatar + name */}
                <div 
                  className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer group"
                  onClick={() => setDrillDownCoordinator({ _id: row.coordinator._id, name: row.coordinator.name })}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors group-hover:bg-primary/20">
                    {row.coordinator.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text group-hover:text-primary transition-colors">{row.coordinator.name}</p>
                    <ProgressBar achieved={row.achieved} target={row.target} />
                    <p className="mt-0.5 text-xs text-muted">
                      {row.achieved} / {row.target} mobilisations
                      {row.incentivePercent > 0 && ` · ${row.incentivePercent}% incentive`}
                    </p>
                  </div>
                </div>

                {/* Badges + actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {row.hit ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Hit!
                    </span>
                  ) : (
                    <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium text-muted">
                      {row.remaining} left
                    </span>
                  )}
                  <button
                    onClick={() => prefillEdit({ ...row, month })}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(row._id)}
                    disabled={deleteMutation.isPending}
                    className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Set / Edit Tab ── */}
      {tab === 'set' && (
        <div className="space-y-5">
          <form onSubmit={handleSetSubmit} className="space-y-4">
            <Select
              label="Coordinator *"
              value={form.coordinatorId}
              onChange={(e) => setForm((f) => ({ ...f, coordinatorId: e.target.value }))}
            >
              <option value="">Select a coordinator…</option>
              {coordinators.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text">Month *</label>
                <input
                  type="month"
                  value={form.month}
                  onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                  required
                  className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Input
                label="Target (# of mobilisations) *"
                type="number"
                min="1"
                max="500"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              />
            </div>

            <Input
              label="Incentive % (profit per extra mobilisation beyond target)"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="e.g. 5"
              value={form.incentivePercent}
              onChange={(e) => setForm((f) => ({ ...f, incentivePercent: e.target.value }))}
            />

            <div className="rounded-lg border border-border/50 bg-bg p-3 text-xs text-muted">
              <strong className="text-text">How this works:</strong> once the coordinator reaches their target, every additional
              Approved/Completed mobilisation in this month earns them the incentive percentage of that
              mobilisation's estimated profit per month.
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm({ coordinatorId: '', month: currentMonth(), target: '', incentivePercent: '' })}>
                Clear
              </Button>
              <Button
                type="submit"
                isLoading={setMutation.isPending}
                disabled={!form.coordinatorId || !form.month || !form.target}
              >
                Save target
              </Button>
            </div>
          </form>

          {/* Existing targets list */}
          {!allLoading && allTargets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">All existing targets</p>
              {allTargets.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium text-text">{t.coordinator.name}</span>
                    <span className="ml-2 text-muted">{t.month}</span>
                    <span className="ml-2 text-muted">→ {t.target} mobilisations</span>
                    {t.incentivePercent > 0 && (
                      <span className="ml-1 text-muted">· {t.incentivePercent}% incentive</span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => prefillEdit(t)} className="text-xs font-medium text-primary hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(t._id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {drillDownCoordinator && (
        <CoordinatorDrillDownModal
          isOpen={!!drillDownCoordinator}
          onClose={() => setDrillDownCoordinator(null)}
          coordinator={drillDownCoordinator}
        />
      )}
    </Modal>
  );
}
