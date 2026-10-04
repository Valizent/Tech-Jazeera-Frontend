import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAllMonthlyWindow, getMyMonthlyWindow } from '../mobilisationTargets.api.js';
import { formatMoney, formatMonthYear } from '../../../lib/utils.js';
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

  const isCoordinatorBypass = user.role === 'Coordinator' && !canManageTargets;

  const { data: allData, isPending: isAllPending, isError: isAllError } = useQuery({
    queryKey: ['mob-targets-monthly-window-all', currentMonth],
    queryFn: () => getAllMonthlyWindow(currentMonth),
    enabled: canManageTargets,
  });

  const { data: myData, isPending: isMyPending, isError: isMyError } = useQuery({
    queryKey: ['mob-targets-monthly-window-my', currentMonth],
    queryFn: () => getMyMonthlyWindow(currentMonth),
    enabled: isCoordinatorBypass,
  });

  const { data: coordinatorList = [] } = useQuery({
    queryKey: ['coordinator-candidates'],
    queryFn: () => import('../../mobilisations/mobilisations.api.js').then((m) => m.listCoordinatorCandidates()),
    enabled: targetsOpen,
    staleTime: 60_000,
  });

  if (!canManageTargets && !isCoordinatorBypass) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Monthly Targets" />
        <EmptyState title="Access Denied" description="You do not have permission to view this page." />
      </div>
    );
  }

  const isPending = canManageTargets ? isAllPending : isMyPending;
  const isError = canManageTargets ? isAllError : isMyError;

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

  let rows = [];
  if (canManageTargets) {
    rows = allData?.rows ?? [];
  } else if (isCoordinatorBypass && myData) {
    rows = [
      {
        coordinator: { _id: user.id || user._id, name: user.name, email: user.email },
        monthlyData: myData,
      },
    ];
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader
        title="Monthly Targets"
        description={canManageTargets ? "Coordinator performance across the last 6 months." : "Your target performance across the last 6 months."}
        actions={
          canManageTargets && (
            <Button onClick={() => setTargetsOpen(true)}>
              Manage Targets
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No targets set"
          description={canManageTargets ? "There are no targets set for any coordinators in the current window." : "You have no targets set in the current window."}
          action={canManageTargets ? <Button onClick={() => setTargetsOpen(true)}>Set a Target</Button> : null}
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
                        <span className="text-sm font-medium text-text">{formatMonthYear(m.month)}</span>
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
