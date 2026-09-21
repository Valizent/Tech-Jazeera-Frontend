import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import { getCoordinatorDrillDown } from '../dashboard.api.js';
import { formatMoney, formatDate } from '../../../lib/utils.js';

export default function CoordinatorDrillDownModal({ isOpen, onClose, coordinator }) {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'coordinator-drill-down', coordinator?._id],
    queryFn: () => getCoordinatorDrillDown(coordinator._id),
    enabled: isOpen && !!coordinator?._id,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Performance: ${coordinator?.name}`}>
      {isLoading ? (
        <div className="h-48 animate-pulse rounded bg-muted/20" />
      ) : isError ? (
        <div className="text-center text-danger py-4">Failed to load coordinator data.</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-bg/50 p-4 text-center">
              <div className="text-sm font-medium text-muted mb-1">Generated Profit</div>
              <div className="text-2xl font-bold text-success">{formatMoney(data.totalMonthlyProfit)}</div>
            </div>
            <div className="rounded-lg border border-border bg-bg/50 p-4 text-center">
              <div className="text-sm font-medium text-muted mb-1">Assigned Tasks</div>
              <div className="text-xl font-bold text-text">
                <span className="text-success">{data.tasks.completed}</span> / {data.tasks.open + data.tasks.completed}
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold mb-3 border-b border-border pb-2">Recent Log Entries</h3>
            {data.recentLogs?.length === 0 ? (
              <p className="text-xs text-muted italic">No logs submitted in the last 30 days.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentLogs.map((log) => (
                  <li key={log._id} className="text-sm border-l-2 border-primary/40 pl-3">
                    <div className="text-xs font-semibold text-muted">{formatDate(log.date)}</div>
                    {log.logEntries.slice(0, 3).map((entry, idx) => (
                      <div key={idx} className="mt-1 line-clamp-1">{entry.text}</div>
                    ))}
                    {log.logEntries.length > 3 && (
                      <div className="mt-1 text-xs text-primary italic">+{log.logEntries.length - 3} more entries</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      
      <div className="mt-6 flex justify-end border-t border-border pt-4">
        <Button variant="secondary" onClick={onClose}>
          {t('common.actions.close')}
        </Button>
      </div>
    </Modal>
  );
}
