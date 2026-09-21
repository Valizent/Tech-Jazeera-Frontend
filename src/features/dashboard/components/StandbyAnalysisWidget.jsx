import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { useQuery } from '@tanstack/react-query';
import { getStandbyAnalysis } from '../dashboard.api.js';
import { formatCurrency } from '../../../lib/formatters.js';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

export default function StandbyAnalysisWidget() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'standby-analysis'],
    queryFn: getStandbyAnalysis,
  });

  if (isLoading) {
    return (
      <Card>
        <div className="h-48 animate-pulse rounded bg-muted/20" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <PickerLoadWarning failed={[{ label: 'standby analysis', isError: true }]} />
      </Card>
    );
  }

  const workers = data ?? [];

  return (
    <Card className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Standby Workforce Analysis</h2>
        <p className="text-xs text-muted-foreground mt-1">Own outsourced workers currently not deployed.</p>
      </div>

      {workers.length === 0 ? (
        <EmptyState title="No workers on standby" description="All available workforce is currently deployed." />
      ) : (
        <div className="flex-1 overflow-auto max-h-96 -mx-4 sm:mx-0">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-bg text-muted z-10 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">Worker</th>
                <th className="px-4 py-3 font-semibold text-center">Days</th>
                <th className="px-4 py-3 font-semibold text-right">Est. Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workers.map((w) => (
                <tr key={w._id} className="hover:bg-muted/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{w.fullName}</div>
                    <div className="text-xs text-muted">{w.employeeId} • {w.designation}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
                      {w.daysOnStandby}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-muted">
                    {formatCurrency(w.moneyLost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
