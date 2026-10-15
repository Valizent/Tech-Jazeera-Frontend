/**
 * ExpiryTrackerPanel - every document that has an expiry date, from every place it is kept (employees'
 * identity and additional documents, files in Documents, outsourced workers' papers), with where each one
 * stands. The daily reminders run off the same dates; this is where HR looks at them all together.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listExpiryTracker } from '../documents.api.js';
import { formatDate } from '../../../lib/utils.js';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const STATUS_VARIANT = { Expired: 'danger', Expiring: 'warning', Valid: 'success' };
const OWNER_TYPES = ['Employee', 'Outsourced', 'Client', 'Subcontractor'];

export default function ExpiryTrackerPanel() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ page: 1, limit: 25, status: '', ownerType: '', search: '' });

  useEffect(() => {
    const timer = setTimeout(() => setParams((p) => (p.search === search ? p : { ...p, search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['documents', 'expiry-tracker', params],
    queryFn: () => listExpiryTracker(params),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      key: 'owner',
      header: t('staffDocuments.tracker.columns.owner', 'Belongs to'),
      render: (row) => (
        <div>
          <Link to={row.link} className="font-medium text-text hover:text-primary">
            {row.ownerName}
          </Link>
          <span className="block text-xs text-muted">
            {t(`staffDocuments.tracker.ownerTypes.${row.ownerType}`, row.ownerType)}
            {row.ownerRef ? ` · ${row.ownerRef}` : ''}
          </span>
        </div>
      ),
    },
    { key: 'name', header: t('staffDocuments.tracker.columns.document', 'Document'), render: (row) => row.name },
    {
      key: 'expiry',
      header: t('staffDocuments.tracker.columns.expires', 'Expires'),
      render: (row) => (
        <div>
          {formatDate(row.expiry)}
          <span className="block text-xs text-muted">
            {row.daysLeft < 0
              ? t('staffDocuments.tracker.expiredAgo', 'expired {{count}} day(s) ago', { count: Math.abs(row.daysLeft) })
              : t('staffDocuments.tracker.daysLeft', '{{count}} day(s) left', { count: row.daysLeft })}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('staffDocuments.tracker.columns.status', 'Status'),
      render: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{t(`staffDocuments.tracker.statuses.${row.status}`, row.status)}</Badge>,
    },
    {
      key: 'reminder',
      header: t('staffDocuments.tracker.columns.reminder', 'Reminders start'),
      hideOnMobile: true,
      render: (row) => t('staffDocuments.tracker.reminderDays', '{{count}} days before', { count: row.reminderDays }),
    },
  ];

  const counts = data?.counts ?? { Expired: 0, Expiring: 0, Valid: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {['Expired', 'Expiring', 'Valid'].map((status) => (
          <Button
            key={status}
            size="sm"
            variant={params.status === status ? 'primary' : 'secondary'}
            onClick={() => setParams((p) => ({ ...p, status: p.status === status ? '' : status, page: 1 }))}
          >
            {t(`staffDocuments.tracker.statuses.${status}`, status)} · {counts[status]}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          placeholder={t('staffDocuments.tracker.searchPlaceholder', 'Search a person, company or document')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select
          value={params.ownerType}
          onChange={(e) => setParams((p) => ({ ...p, ownerType: e.target.value, page: 1 }))}
          className="sm:max-w-[200px]"
          aria-label={t('staffDocuments.tracker.columns.owner', 'Belongs to')}
        >
          <option value="">{t('staffDocuments.list.allOwners')}</option>
          {OWNER_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`staffDocuments.tracker.ownerTypes.${type}`, type)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState title={t('staffDocuments.list.couldNotLoad')} description={t('staffDocuments.list.couldNotLoadDescription')} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(row) => `${row.source}-${row.ownerId}-${row.name}-${row.expiry}`}
            loading={isPending}
            emptyState={
              <EmptyState
                title={t('staffDocuments.tracker.emptyTitle', 'Nothing with an expiry date yet')}
                description={t(
                  'staffDocuments.tracker.emptyDescription',
                  'Add expiry dates on an employee, outsourced worker, client or subcontractor and they show up here.'
                )}
              />
            }
          />
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>
                {t('common.previous')}
              </Button>
              <span className="tabular-nums">{t('common.pageOf', { page: data.page, pages: data.pages })}</span>
              <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                {t('common.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
