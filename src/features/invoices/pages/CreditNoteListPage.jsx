/**
 * CreditNoteListPage (2026-09-24) — every credit note across every invoice,
 * company-wide. Reuses the same GET /credit-notes endpoint the invoice
 * detail page's own per-invoice list already calls, just without the
 * `invoice` filter. Same shape as InvoiceListPage — search + pagination,
 * no status filter (a credit note has no status/lifecycle to filter by).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listAllCreditNotes, downloadCreditNotePdf } from '../creditNotes.api.js';
import { formatDate, formatMoney, apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function CreditNoteListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [params, setParams] = useState({ page: 1, limit: 20 });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setParams((p) => (p.search === search ? p : { ...p, search, page: 1 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['credit-notes', 'all', params],
    queryFn: () => listAllCreditNotes(params),
    placeholderData: keepPreviousData,
  });

  async function handleDownload(cn) {
    setDownloadingId(cn._id);
    try {
      await downloadCreditNotePdf(cn._id, cn.creditNoteNumber);
    } catch (error) {
      toast.error(apiMessage(error, t('staffInvoices.pdfButton.failedToast')));
    } finally {
      setDownloadingId(null);
    }
  }

  const columns = [
    { key: 'creditNoteNumber', header: t('staffInvoices.creditNotes.list.columns.number'), render: (cn) => cn.creditNoteNumber },
    {
      key: 'invoiceNumber',
      header: t('staffInvoices.creditNotes.list.columns.invoice'),
      render: (cn) => (
        <Link to={`/invoices/${cn.invoice}`} className="text-primary hover:underline">
          {cn.invoiceNumber}
        </Link>
      ),
    },
    { key: 'clientName', header: t('staffInvoices.creditNotes.list.columns.client'), hideOnMobile: true, render: (cn) => cn.clientName },
    { key: 'date', header: t('staffInvoices.creditNotes.list.columns.date'), hideOnMobile: true, render: (cn) => formatDate(cn.date) },
    {
      key: 'reason',
      header: t('staffInvoices.creditNotes.list.columns.reason'),
      hideOnMobile: true,
      render: (cn) => <span className="line-clamp-1">{cn.reason}</span>,
    },
    {
      key: 'grandTotal',
      header: t('staffInvoices.creditNotes.list.columns.amount'),
      className: 'text-right tabular-nums',
      render: (cn) => formatMoney(cn.grandTotal),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (cn) => (
        <Button size="sm" variant="ghost" isLoading={downloadingId === cn._id} onClick={() => handleDownload(cn)}>
          {t('staffInvoices.pdfButton.label')}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('staffInvoices.creditNotes.list.pageTitle')}
        description={t('staffInvoices.creditNotes.list.pageDescription')}
        onBack={() => navigate(-1)}
      />

      <div className="mb-4">
        <Input
          placeholder={t('staffInvoices.creditNotes.list.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('staffInvoices.creditNotes.list.searchAriaLabel')}
        />
      </div>

      {isError ? (
        <EmptyState
          title={t('staffInvoices.creditNotes.list.couldNotLoad')}
          description={t('staffInvoices.creditNotes.list.couldNotLoadDescription')}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(cn) => cn._id}
            loading={isPending}
            emptyState={
              <EmptyState
                title={t('staffInvoices.creditNotes.list.emptyTitle')}
                description={t('staffInvoices.creditNotes.list.emptyDescription')}
              />
            }
          />

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                {t('common.showingRange', { from: (data.page - 1) * params.limit + 1, to: Math.min(data.page * params.limit, data.total), total: data.total })}
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>
                  {t('common.previous')}
                </Button>
                <span className="tabular-nums">{t('common.pageOf', { page: data.page, pages: data.pages })}</span>
                <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
                  {t('common.next')}
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
