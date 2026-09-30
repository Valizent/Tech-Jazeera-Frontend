import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPaidInvoices } from '../deployments.api.js';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { formatMoney, formatDate } from '../../../lib/utils.js';
import Input from '../../../components/ui/Input.jsx';

export default function PaidInvoicesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { data: rows = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'paid-invoices'],
    queryFn: getPaidInvoices,
  });

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const lowerSearch = search.toLowerCase();
    return rows.filter((r) => 
      (r.clientName && r.clientName.toLowerCase().includes(lowerSearch)) ||
      (r.workerName && r.workerName.toLowerCase().includes(lowerSearch)) ||
      (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(lowerSearch))
    );
  }, [rows, search]);

  const columns = [
    { header: t('staffDeployments.paidInvoices.columns.client', 'Client'), key: 'clientName', sortable: true, width: 25 },
    { header: t('staffDeployments.paidInvoices.columns.worker', 'Worker'), key: 'workerName', sortable: true, width: 20 },
    { header: t('staffDeployments.paidInvoices.columns.month', 'Month'), key: 'month', sortable: true, width: 15 },
    { 
      header: t('staffDeployments.paidInvoices.columns.invoice', 'Invoice'), 
      key: 'invoiceNumber', 
      sortable: true, 
      width: 20,
      render: (val, row) => (
        <div>
          <span className="font-medium text-text">{val || '—'}</span>
          {row.invoiceDate && <span className="block text-xs text-muted">{formatDate(row.invoiceDate)}</span>}
        </div>
      )
    },
    { 
      header: t('staffDeployments.paidInvoices.columns.amount', 'Amount Paid'), 
      key: 'amountAllocated', 
      sortable: true, 
      align: 'right',
      width: 20,
      render: (val) => formatMoney(val)
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text">{t('staffDeployments.paidInvoices.title', 'Paid Invoices')}</h1>
        <div className="w-full sm:w-64">
          <Input 
            placeholder={t('common.search', 'Search...')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted">
        {t('staffDeployments.paidInvoices.subtitle', 'A complete history of all fully-paid invoices across all clients.')}
      </p>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.paidInvoices.error', 'Could not load')} description={t('common.checkConnection', 'Check your connection')} />
      ) : (
        <Card>
          <Table
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.entryId}
            emptyState={
              <EmptyState
                title={t('staffDeployments.paidInvoices.emptyTitle', 'No paid invoices found')}
                description={t('staffDeployments.paidInvoices.emptyDescription', 'When invoices are fully paid by a client, they will appear here.')}
              />
            }
          />
        </Card>
      )}
    </div>
  );
}
