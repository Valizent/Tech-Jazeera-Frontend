/**
 * ReadyToInvoicePage (2026-09-27, the user's own ask) — the Clerk's own
 * work queue: every Approved-but-not-yet-invoiced monthly-hours entry
 * across every Deployment, oldest-approved-first. Replaces hunting through
 * individual Deployment detail pages for a "Send Invoice" button — this
 * page IS that button now, moved into its own home under Financial (real
 * accounting/invoicing is ERPNext's job; this app only tracks whether a
 * client has been billed, for target-crediting purposes — see
 * deployment.service.js's getReadyToInvoice).
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getReadyToInvoice, sendInvoice } from '../deployments.api.js';
import { RECEIPT_ACCEPT, RECEIPT_MAX_MB } from '../../../lib/constants.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

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

  const { data = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'ready-to-invoice'],
    queryFn: getReadyToInvoice,
  });

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

  const columns = [
    {
      key: 'worker',
      header: t('staffDeployments.readyToInvoice.columns.worker'),
      render: (row) => (
        <span className="font-medium text-text">
          {row.workerName}
          <span className="block text-xs font-normal text-muted">{row.clientName}</span>
        </span>
      ),
    },
    { key: 'month', header: t('staffDeployments.readyToInvoice.columns.month'), render: (row) => row.month },
    { key: 'hours', header: t('staffDeployments.readyToInvoice.columns.hours'), render: (row) => row.actualHours },
    {
      key: 'waitingSince',
      header: t('staffDeployments.readyToInvoice.columns.waitingSince'),
      render: (row) => (row.hoursApprovedAt ? formatDate(row.hoursApprovedAt) : '—'),
    },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setInvoicingEntry(row);
          }}
        >
          {t('staffDeployments.detail.sendInvoiceButton')}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.readyToInvoice.pageTitle')}
        description={t('staffDeployments.readyToInvoice.pageDescription')}
        onBack={() => navigate(-1)}
      />

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.readyToInvoice.couldNotLoad')} description={t('common.checkConnection')} />
      ) : (
        <Card>
          <Table
            columns={columns}
            rows={data}
            rowKey={(row) => `${row.deploymentId}-${row.entryId}`}
            onRowClick={(row) => navigate(`/deployments/${row.deploymentId}`)}
            emptyState={
              <EmptyState
                title={t('staffDeployments.readyToInvoice.emptyTitle')}
                description={t('staffDeployments.readyToInvoice.emptyDescription')}
              />
            }
          />
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
        {invoicingEntry && (
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
              value={invoiceDateInput}
              onChange={(e) => setInvoiceDateInput(e.target.value)}
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
                disabled={!invoiceNumberInput.trim() || !invoiceDateInput || !invoiceFile}
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
        )}
      </Modal>
    </div>
  );
}
