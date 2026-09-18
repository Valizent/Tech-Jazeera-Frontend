/**
 * NfcCardDetailPage — everything about one card: its public URL + QR, status,
 * current holder, full assignment history, and the lifecycle actions (unassign,
 * mark lost, return, disable, rotate token, edit chip UID). Gated by the real
 * 'nfc' Section Access grant (fixed 2026-09-14 — see NfcCompanyListPage's doc
 * comment); every lifecycle action additionally needs the Write tier.
 *
 * Assigning a card is done from a person's page (you pick who needs it); here we
 * manage a card that already exists.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getNfcCard, cardAction, updateNfcCard, getCardQrObjectUrl, getCardQrOfflineObjectUrl, deleteNfcCard } from '../nfc.api.js';
import { CARD_STATUS_META } from '../nfc.constants.js';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Input from '../../../components/ui/Input.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import CardAnalyticsPanel from '../components/CardAnalyticsPanel.jsx';
import AssignCompanyModal from '../components/AssignCompanyModal.jsx';

export default function NfcCardDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canRead = Boolean(user.sectionAccess?.includes('nfc'));
  const canWrite = Boolean(user.sectionAccessWrite?.includes('nfc'));
  const toast = useToast();
  const queryClient = useQueryClient();

  const [qrUrl, setQrUrl] = useState(null);
  const [qrOfflineUrl, setQrOfflineUrl] = useState(null);
  const [chip, setChip] = useState('');
  const [confirm, setConfirm] = useState(null); // { action, title, message, confirmLabel }
  const [assignCompanyOpen, setAssignCompanyOpen] = useState(false);
  
  const navigate = useNavigate();

  const { data: card, isPending, isError } = useQuery({
    queryKey: ['nfc-card', id],
    queryFn: () => getNfcCard(id),
    enabled: canRead,
  });

  // Load the QR image (authenticated blob → object URL); revoke on change/unmount.
  useEffect(() => {
    if (!canRead) return undefined;
    let revoked = false;
    let url;
    getCardQrObjectUrl(id)
      .then((u) => {
        if (revoked) return;
        url = u;
        setQrUrl(u);
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, canRead, card?.token]); // reload when the token rotates

  // Offline-contact QR: only meaningful once a person is assigned (needs a
  // name/phone/email to encode), so only fetched then.
  useEffect(() => {
    if (!canRead || !card?.employee) return undefined;
    let revoked = false;
    let url;
    getCardQrOfflineObjectUrl(id)
      .then((u) => {
        if (revoked) return;
        url = u;
        setQrOfflineUrl(u);
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, canRead, card?.employee?._id, card?.token]);

  useEffect(() => {
    if (card) setChip(card.chipUid ?? '');
  }, [card]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['nfc-card', id] });
    queryClient.invalidateQueries({ queryKey: ['nfc-cards'] });
    queryClient.invalidateQueries({ queryKey: ['nfc-companies'] });
  };

  const actionMutation = useMutation({
    mutationFn: (action) => {
      if (action === 'delete') return deleteNfcCard(id);
      return cardAction(id, action);
    },
    onSuccess: (_data, action) => {
      toast.success('Done.');
      setConfirm(null);
      invalidate();
      if (action === 'rotate') queryClient.invalidateQueries({ queryKey: ['nfc-card', id] });
      if (action === 'delete') navigate('/nfc/cards');
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirm(null);
    },
  });

  const chipMutation = useMutation({
    mutationFn: () => updateNfcCard(id, { chipUid: chip }),
    onSuccess: () => {
      toast.success('Chip UID saved.');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (!canRead) return <Navigate to="/" replace />;

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title="Card not found"
        description="It may have been deleted."
        action={<BackButton onClick={() => navigate('/nfc/cards')} />}
      />
    );
  }

  const meta = CARD_STATUS_META[card.status] ?? { label: card.status, variant: 'default' };
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(card.url);
      toast.success('URL copied.');
    } catch {
      toast.error('Could not copy.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={<span className="font-mono">{card.token}</span>}
        description={card.batch?.label ? `Batch: ${card.batch.label}` : 'NFC card'}
        onBack={() => navigate(-1)}
        actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
      />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="shrink-0 text-center">
              {qrUrl ? (
                <img src={qrUrl} alt="Card QR code" className="mx-auto h-40 w-40 rounded-lg border border-border" />
              ) : (
                <Skeleton className="mx-auto h-40 w-40" />
              )}
              <p className="mt-2 text-xs text-muted">Links to profile page</p>
              {qrUrl && (
                <a href={qrUrl} download={`nfc_${card.token}.png`} className="inline-block text-xs font-medium text-primary hover:underline">
                  Download PNG
                </a>
              )}
            </div>
            {card.employee && (
              <div className="shrink-0 text-center">
                {qrOfflineUrl ? (
                  <img src={qrOfflineUrl} alt="Offline contact QR code" className="mx-auto h-40 w-40 rounded-lg border border-border" />
                ) : (
                  <Skeleton className="mx-auto h-40 w-40" />
                )}
                <p className="mt-2 text-xs text-muted">Saves contact, no internet needed</p>
                {qrOfflineUrl && (
                  <a href={qrOfflineUrl} download={`nfc_${card.token}_offline.png`} className="inline-block text-xs font-medium text-primary hover:underline">
                    Download PNG
                  </a>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Public URL (write this to the chip)</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-bg px-3 py-2 text-sm">{card.url}</code>
                  <Button size="sm" variant="secondary" onClick={copyUrl}>
                    Copy
                  </Button>
                  <a href={card.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost">
                      Open
                    </Button>
                  </a>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Holder</p>
                <p className="mt-0.5 text-sm">
                  {card.employee ? (
                    <>
                      <span className="font-medium">{card.employee.name}</span>
                      {card.company?.companyName ? ` · ${card.company.companyName}` : ''}
                      {card.assignedAt ? ` · since ${formatDate(card.assignedAt)}` : ''}
                    </>
                  ) : (
                    <span className="text-muted">Not assigned. Assign from a person&apos;s page on the company.</span>
                  )}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <Input label="Chip UID (optional)" value={chip} onChange={(e) => setChip(e.target.value)} className="flex-1" disabled={!canWrite} />
                {canWrite && (
                  <Button variant="secondary" isLoading={chipMutation.isPending} onClick={() => chipMutation.mutate()}>
                    Save
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Lifecycle actions */}
          {canWrite && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
            {card.status === 'active' && (
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate('unassign')}>
                Unassign
              </Button>
            )}
            {card.status === 'unassigned' && (
              <Button size="sm" variant="secondary" onClick={() => setAssignCompanyOpen(true)}>
                Assign to company
              </Button>
            )}
            {card.status !== 'lost' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setConfirm({
                    action: 'lost',
                    title: 'Mark card as lost?',
                    message: 'The tap page stops working immediately. Rotate the token later to reuse the card.',
                    confirmLabel: 'Mark lost',
                  })
                }
              >
                Mark lost
              </Button>
            )}
            {card.status !== 'returned' && card.status !== 'unassigned' && (
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate('return')}>
                Return to inventory
              </Button>
            )}
            {card.status !== 'disabled' && (
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate('disable')}>
                Disable
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                setConfirm({
                  action: 'rotate',
                  title: 'Rotate token?',
                  message: 'A new URL is issued and the old one stops working immediately. You must re-write the chip with the new URL.',
                  confirmLabel: 'Rotate',
                })
              }
            >
              Rotate token
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                setConfirm({
                  action: 'delete',
                  title: 'Delete card?',
                  message: 'This will completely remove the card and its history from the database. This action cannot be undone.',
                  confirmLabel: 'Delete',
                })
              }
            >
              Delete card
            </Button>
          </div>
          )}
        </Card>

        <CardAnalyticsPanel cardId={id} />

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Assignment history</h2>
          {card.history.length === 0 ? (
            <p className="text-sm text-muted">This card has never been assigned.</p>
          ) : (
            <ul className="divide-y divide-border">
              {card.history.map((h) => (
                <li key={h._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{h.employee?.name ?? 'Unknown'}</span>
                    {h.company?.companyName ? <span className="text-muted"> · {h.company.companyName}</span> : null}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDate(h.assignedAt)} → {h.unassignedAt ? formatDate(h.unassignedAt) : 'current'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        loading={actionMutation.isPending}
        onConfirm={() => actionMutation.mutate(confirm.action)}
        onCancel={() => setConfirm(null)}
      />
      
      <AssignCompanyModal
        open={assignCompanyOpen}
        onClose={() => setAssignCompanyOpen(false)}
        cardId={id}
      />
    </div>
  );
}
