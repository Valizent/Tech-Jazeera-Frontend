import { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getReadyToInvoice, sendInvoice } from '../deployments.api.js';
import { RECEIPT_ACCEPT, RECEIPT_MAX_MB } from '../../../lib/constants.js';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import MonthlyEntryBreakdownPanel from '../components/MonthlyEntryBreakdown.jsx';

/** The earliest a real invoice for `monthStr` ('YYYY-MM') could exist: the
 *  1st of the FOLLOWING month — the month has to actually finish, with a
 *  real client timesheet entered and its hours approved, before an invoice
 *  date for it makes sense (2026-10-03, a real user-reported gap: nothing
 *  stopped picking a date before the invoiced month had even started).
 *  Mirrors the server's own check in deployment.service.js's sendInvoice —
 *  this is just the immediate UI feedback, not the real enforcement. */
function earliestInvoiceDateFor(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  // Built as plain string arithmetic, deliberately not via Date/toISOString
  // — going through a Date object converts through the browser's local
  // timezone, which can land on the wrong calendar day (this company is
  // UTC+3, where local midnight on the 1st is still the last evening of
  // the prior day in UTC).
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function ReadyToInvoiceRow({ row, isOpen, onToggle, onSendInvoice, t, navigate }) {
  return (
    <>
      <tr
        className="group transition-all duration-200 drop-shadow-sm hover:-translate-y-px cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 align-middle bg-surface border-y border-l border-border/40 rounded-l-xl group-hover:border-primary/30 transition-colors">
          <div className="font-semibold text-text text-sm">{row.clientName}</div>
          <div className="text-xs text-muted mt-0.5">{row.workerName}</div>
        </td>
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-text font-medium">{row.month}</span>
        </td>
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-text">{row.actualHours} hrs</span>
        </td>
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm font-semibold text-primary">{formatMoney(row.revenue)}</span>
        </td>
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-muted">{row.hoursApprovedAt ? formatDate(row.hoursApprovedAt) : '—'}</span>
        </td>
        <td className="px-4 py-3 align-middle text-right bg-surface border-y border-r border-border/40 rounded-r-xl group-hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-end gap-3">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSendInvoice(row);
              }}
            >
              {t('staffDeployments.detail.sendInvoiceButton', 'Send invoice')}
            </Button>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </td>
      </tr>

      {isOpen && (
        <tr>
          <td colSpan={6} className="px-4 pb-3">
            <MonthlyEntryBreakdownPanel row={row} formatMoney={formatMoney}>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/deployments/${row.deploymentId}`);
                  }}
                >
                  View Deployment Details
                </Button>
              </div>
            </MonthlyEntryBreakdownPanel>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReadyToInvoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [invoicingEntry, setInvoicingEntry] = useState(null);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [invoiceDateInput, setInvoiceDateInput] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const invoiceFileInputRef = useRef(null);
  
  const [search, setSearch] = useState('');
  const [openRowId, setOpenRowId] = useState(null);

  const { data = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'ready-to-invoice'],
    queryFn: getReadyToInvoice,
  });

  const filteredRows = useMemo(() => {
    if (!search.trim()) return data;
    const lower = search.toLowerCase();
    return data.filter((r) =>
      (r.clientName && r.clientName.toLowerCase().includes(lower)) ||
      (r.workerName && r.workerName.toLowerCase().includes(lower))
    );
  }, [data, search]);

  function resetInvoiceForm() {
    setInvoiceNumberInput('');
    setInvoiceDateInput('');
    setInvoiceFile(null);
    if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = '';
  }

  function handleInvoiceFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
      toast.error(t('staffDeployments.detail.invoiceFileTooLarge', { maxMb: RECEIPT_MAX_MB }));
      e.target.value = '';
      return;
    }
    setInvoiceFile(file);
  }

  const sendInvoiceMutation = useMutation({
    mutationFn: ({ deploymentId, entryId, formData }) => sendInvoice(deploymentId, entryId, formData),
    onSuccess: () => {
      toast.success(t('staffDeployments.detail.invoiceSentToast'));
      setInvoicingEntry(null);
      resetInvoiceForm();
      queryClient.invalidateQueries({ queryKey: ['deployments', 'ready-to-invoice'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const toggleRow = (id) => setOpenRowId((prev) => (prev === id ? null : id));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.readyToInvoice.pageTitle', 'Ready to invoice')}
        description={t('staffDeployments.readyToInvoice.pageDescription', 'Every approved month waiting on a client invoice, oldest first.')}
        onBack={() => navigate(-1)}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={t('common.search', 'Search client, worker...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.readyToInvoice.couldNotLoad')} description={t('common.checkConnection')} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={t('staffDeployments.readyToInvoice.emptyTitle')}
          description={t('staffDeployments.readyToInvoice.emptyDescription')}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-separate border-spacing-y-[6px] text-sm px-4">
            <thead className="text-left">
              <tr>
                {['Client / Worker', 'Month', 'Hours', 'Invoice Amount', 'Approved On', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-[13px] font-black uppercase tracking-wider text-text bg-border/30 first:rounded-l-xl last:rounded-r-xl whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <ReadyToInvoiceRow
                  key={`${row.deploymentId}-${row.entryId}`}
                  row={row}
                  isOpen={openRowId === `${row.deploymentId}-${row.entryId}`}
                  onToggle={() => toggleRow(`${row.deploymentId}-${row.entryId}`)}
                  onSendInvoice={setInvoicingEntry}
                  t={t}
                  navigate={navigate}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border/40">
            {filteredRows.length} {filteredRows.length === 1 ? 'entry' : 'entries'} {search ? '(filtered)' : ''}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(invoicingEntry)}
        onClose={() => {
          if (sendInvoiceMutation.isPending) return;
          setInvoicingEntry(null);
          resetInvoiceForm();
        }}
        title={invoicingEntry ? t('staffDeployments.detail.sendInvoiceModalTitle', { month: invoicingEntry.month }) : ''}
      >
        {invoicingEntry && (() => {
          const minInvoiceDate = earliestInvoiceDateFor(invoicingEntry.month);
          const invoiceDateTooEarly = Boolean(invoiceDateInput) && invoiceDateInput < minInvoiceDate;
          return (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('staffDeployments.detail.sendInvoiceModalMessage')}</p>
            <Input
              label={t('staffDeployments.detail.invoiceNumberLabel')}
              value={invoiceNumberInput}
              onChange={(e) => setInvoiceNumberInput(e.target.value)}
            />
            <Input
              label={t('staffDeployments.detail.invoiceDateLabel')}
              type="date"
              min={minInvoiceDate}
              value={invoiceDateInput}
              onChange={(e) => setInvoiceDateInput(e.target.value)}
              error={invoiceDateTooEarly ? t('staffDeployments.detail.invoiceDateTooEarly', { month: invoicingEntry.month }) : undefined}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t('staffDeployments.detail.invoiceFileLabel')}</label>
              <input
                ref={invoiceFileInputRef}
                type="file"
                accept={RECEIPT_ACCEPT}
                className="hidden"
                onChange={handleInvoiceFileChange}
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => invoiceFileInputRef.current?.click()}>
                  {invoiceFile ? t('staffDeployments.detail.changeFile') : t('staffDeployments.detail.chooseFile')}
                </Button>
                {invoiceFile && <span className="truncate text-sm text-muted">{invoiceFile.name}</span>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setInvoicingEntry(null);
                  resetInvoiceForm();
                }}
                disabled={sendInvoiceMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                isLoading={sendInvoiceMutation.isPending}
                disabled={!invoiceNumberInput.trim() || !invoiceDateInput || !invoiceFile || invoiceDateTooEarly}
                onClick={() => {
                  const fd = new FormData();
                  fd.append('invoiceNumber', invoiceNumberInput.trim());
                  fd.append('invoiceDate', invoiceDateInput);
                  fd.append('file', invoiceFile);
                  sendInvoiceMutation.mutate({ deploymentId: invoicingEntry.deploymentId, entryId: invoicingEntry.entryId, formData: fd });
                }}
              >
                {t('staffDeployments.detail.sendInvoiceButton')}
              </Button>
            </div>
          </div>
          );
        })()}
      </Modal>
    </div>
  );
}
