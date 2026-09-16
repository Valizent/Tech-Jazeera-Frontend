import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNfcCompanies, assignNfcCardToCompany } from '../nfc.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

export default function AssignCompanyModal({ open, onClose, cardId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (open) setCompanyId('');
  }, [open]);

  const { data: companies = [], isPending, isError: companiesError } = useQuery({
    queryKey: ['nfc-companies', ''],
    queryFn: () => listNfcCompanies({}),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => assignNfcCardToCompany(cardId, companyId),
    onSuccess: () => {
      toast.success('Card assigned to company inventory.');
      queryClient.invalidateQueries({ queryKey: ['nfc-card', cardId] });
      queryClient.invalidateQueries({ queryKey: ['nfc-cards'] });
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Assign card to company">
      <div className="space-y-4">
        <PickerLoadWarning failed={[{ label: 'companies', isError: companiesError }]} />
        <Select label="Select company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Select a company…</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!companyId || isPending}>
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}
