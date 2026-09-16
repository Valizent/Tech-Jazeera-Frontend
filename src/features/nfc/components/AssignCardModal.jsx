/**
 * AssignCardModal — give a person a card. Lists blank/returned cards to pick
 * from; if the person already holds one, this reassigns (the old card frees up).
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNfcCards, assignNfcCard } from '../nfc.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import { Link } from 'react-router-dom';

export default function AssignCardModal({ open, onClose, employee, companyId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [cardId, setCardId] = useState('');

  useEffect(() => {
    if (open) setCardId('');
  }, [open]);

  // Assignable cards = unassigned or returned. Fetched fresh when the modal opens.
  const { data: available = [], isPending, isError } = useQuery({
    queryKey: ['nfc-cards', 'assignable'],
    queryFn: async () => {
      const all = await listNfcCards({});
      return all.filter((c) => {
        if (c.status !== 'unassigned' && c.status !== 'returned') return false;
        // Either not owned by any company, or owned by THIS company
        const cardCompanyId = c.company?._id || c.company;
        return !cardCompanyId || cardCompanyId === companyId;
      });
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => assignNfcCard(cardId, employee._id),
    onSuccess: () => {
      toast.success(`Card assigned to ${employee.name}.`);
      queryClient.invalidateQueries({ queryKey: ['nfc-company', companyId] });
      queryClient.invalidateQueries({ queryKey: ['nfc-cards'] });
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Assign a card to ${employee?.name ?? ''}`}>
      <div className="space-y-4">
        {available.length === 0 ? (
          <p className={`text-sm ${isError ? 'text-danger' : 'text-muted'}`} role={isError ? 'alert' : undefined}>
            {isPending
              ? 'Loading available cards…'
              : isError
                ? "Couldn't load available cards — you may be missing read access, or this is a network issue. Try again."
                : 'No blank cards available. Generate a batch on the Cards page first.'}
          </p>
        ) : (
          <Select label="Available card" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Select a card…</option>
            {available.map((c) => (
              <option key={c._id} value={c._id}>
                {c.token}
                {c.batch?.label ? ` · ${c.batch.label}` : ''}
                {c.status === 'returned' ? ' · returned' : ''}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link to="/nfc/cards" className="text-sm font-medium text-primary hover:underline">
            Manage cards
          </Link>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!cardId}>
              Assign
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
