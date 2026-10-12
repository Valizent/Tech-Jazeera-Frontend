/**
 * SubcontractorTransfersPage - moves of a subcontractor's employee to a
 * different subcontractor (2026-10-12). Raised from a mobilisation; the
 * Marketing Manager approves or rejects them here (reached from Outsourced
 * and from the dashboard's "Waiting on you"). Anyone else sees only the
 * requests they raised, read-only.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTransfers, decideTransfer } from '../subcontractorTransfers.api.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Select from '../../../components/ui/Select.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const STATUS_VARIANT = { Pending: 'warning', Approved: 'success', Rejected: 'danger', Cancelled: 'default' };

export default function SubcontractorTransfersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('Pending');
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['subcontractor-transfers', { status }],
    queryFn: () => listTransfers(status ? { status } : {}),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, ...payload }) => decideTransfer(id, payload),
    onSuccess: (_result, variables) => {
      toast.success(variables.decision === 'Approved' ? t('subcontractorTransfers.approvedToast') : t('subcontractorTransfers.rejectedToast'));
      setRejecting(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['subcontractor-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // A rejection sends the mobilisation back to its coordinators.
      queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
      queryClient.invalidateQueries({ queryKey: ['mobilisation'] });
    },
    onError: (error) => {
      console.error('[subcontractor-transfers] deciding failed', error);
      toast.error(apiMessage(error));
    },
  });

  const canDecide = Boolean(data?.canDecide);
  const columns = [
    {
      key: 'employee',
      header: t('subcontractorTransfers.columns.employee'),
      render: (r) => (
        <div>
          <span className="font-medium">{r.workerName}</span>
          <span className="block text-xs text-muted">{r.iqamaNumber}</span>
        </div>
      ),
    },
    {
      key: 'move',
      header: t('subcontractorTransfers.columns.move'),
      render: (r) => (
        <span>
          {r.from.name} <span className="text-muted">&rarr;</span> {r.to.name}
        </span>
      ),
    },
    {
      key: 'mobilisation',
      header: t('subcontractorTransfers.columns.mobilisation'),
      hideOnMobile: true,
      render: (r) => (
        <Link to={`/mobilisations/${r.mobilisation}`} className="text-primary hover:underline">
          {r.mobilisationSerial}
        </Link>
      ),
    },
    {
      key: 'requestedBy',
      header: t('subcontractorTransfers.columns.requestedBy'),
      hideOnMobile: true,
      render: (r) => (
        <span>
          {r.requestedBy?.name}
          <span className="block text-xs text-muted">{formatDate(r.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t('subcontractorTransfers.columns.status'),
      render: (r) => (
        <div>
          <Badge variant={STATUS_VARIANT[r.status]}>{t(`subcontractorTransfers.statuses.${r.status}`)}</Badge>
          {r.decisionNote && <span className="mt-1 block text-xs text-muted">{r.decisionNote}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) =>
        canDecide && r.status === 'Pending' ? (
          <span className="flex justify-end gap-2">
            <Button size="sm" isLoading={decideMutation.isPending} onClick={() => decideMutation.mutate({ id: r._id, decision: 'Approved' })}>
              {t('subcontractorTransfers.approve')}
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => setRejecting(r)}>
              {t('subcontractorTransfers.reject')}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('subcontractorTransfers.title')}
        description={t('subcontractorTransfers.description')}
        onBack={() => navigate(-1)}
      />

      <div className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[200px]" aria-label={t('subcontractorTransfers.columns.status')}>
          <option value="">{t('common.allStatuses')}</option>
          {['Pending', 'Approved', 'Rejected', 'Cancelled'].map((s) => (
            <option key={s} value={s}>
              {t(`subcontractorTransfers.statuses.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <EmptyState
          title={t('subcontractorTransfers.couldNotLoad')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r._id}
          loading={isPending}
          emptyState={<EmptyState title={t('subcontractorTransfers.emptyTitle')} description={t('subcontractorTransfers.emptyDescription')} />}
        />
      )}

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={t('subcontractorTransfers.rejectTitle')}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {rejecting && `${rejecting.workerName}: ${rejecting.from.name} → ${rejecting.to.name}`}
          </p>
          <Textarea label={t('subcontractorTransfers.reasonLabel')} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!note.trim()}
              isLoading={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: rejecting._id, decision: 'Rejected', decisionNote: note.trim() })}
            >
              {t('subcontractorTransfers.reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
