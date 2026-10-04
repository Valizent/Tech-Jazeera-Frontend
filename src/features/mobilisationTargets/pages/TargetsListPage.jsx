import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAllMonthlyWindow } from '../mobilisationTargets.api.js';
import { formatMoney } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Card from '../../../components/ui/Card.jsx';
import ManageTargetsModal from '../../dashboard/components/ManageTargetsModal.jsx';
import Button from '../../../components/ui/Button.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function TargetsListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const [targetsOpen, setTargetsOpen] = useState(false);

  const canManageTargets =
    user.role === 'Admin' ||
    user.role === 'Manager' ||
    (user.sectionAccessWrite || []).includes('mobilisationTargets');

  const { data, isPending, isError } = useQuery({
    queryKey: ['mob-targets-monthly-window-all', currentMonth],
    queryFn: () => getAllMonthlyWindow(currentMonth),
    enabled: canManageTargets,
  });

  const { data: coordinatorList = [] } = useQuery({
    queryKey: ['coordinator-candidates'],
    queryFn: () => import('../../mobilisations/mobilisations.api.js').then((m) => m.listCoordinatorCandidates()),
    enabled: targetsOpen,
    staleTime: 60_000,
  });

  if (!canManageTargets) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Monthly Targets" />
        <EmptyState title="Access Denied" description="You do not have permission to view this page." />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <PageHeader title="Monthly Targets" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Monthly Targets" />
        <EmptyState title="Failed to load targets" description="Please try again later." />
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader
        title="Monthly Targets"
        description="Coordinator performance across the last 6 months."
        actions={
          <Button onClick={() => setTargetsOpen(true)}>
            Manage Targets
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No targets set"
          description="There are no targets set for any coordinators in the current window."
          action={<Button onClick={() => setTargetsOpen(true)}>Set a Target</Button>}
        />
      ) : (
        <div className="space-y-6">
          {rows.map((row) => (
            <Card key={row.coordinator._id} className="overflow-hidden p-0">
              <div className="border-b border-border bg-surface px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {row.coordinator.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{row.coordinator.name}</h3>
                    <p className="text-sm text-muted">{row.coordinator.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
                {row.monthlyData.map((m) => {
                  const progress = m.target > 0 ? Math.min(m.achieved / m.target, 1) : 0;
                  return (
                    <div key={m.month} className="px-6 py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-text">{m.month}</span>
                        {m.isClosed && (
                          <span className="text-[10px] font-bold uppercase text-success">Closed</span>
                        )}
                      </div>
                      
                      {!m.hasTarget ? (
                        <p className="text-sm text-muted">No target</p>
                      ) : (
                        <div>
                          <div className="mb-1 flex items-end justify-between">
                            <span className="text-lg font-bold text-text">{formatMoney(m.achieved)}</span>
                          </div>
                          <p className="text-xs text-muted mb-2">Target: {formatMoney(m.target)}</p>
                          
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${progress * 100}%`,
                                backgroundColor: m.hit ? '#f59e0b' : 'var(--color-primary)' 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ManageTargetsModal
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        coordinators={coordinatorList}
      />
    </div>
  );
}
