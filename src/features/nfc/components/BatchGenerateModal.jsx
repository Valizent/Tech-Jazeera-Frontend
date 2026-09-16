/**
 * BatchGenerateModal — mint a run of blank cards (fresh tokens) before writing
 * any chips. On success it offers a one-click CSV of the new batch's URLs.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { generateNfcBatch, downloadBatchCsv, listNfcCompanies } from '../nfc.api.js';
import { batchFormSchema } from '../nfc.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

export default function BatchGenerateModal({ open, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null); // { batch, cards } after generation

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(batchFormSchema), defaultValues: { count: 10, label: '', note: '', company: '' } });

  const { data: companies = [], isError: companiesError } = useQuery({
    queryKey: ['nfc-companies', ''],
    queryFn: () => listNfcCompanies({}),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      reset({ count: 10, label: '', note: '', company: '' });
      setResult(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values) => generateNfcBatch(values),
    onSuccess: (data) => {
      toast.success(`${data.cards.length} card${data.cards.length === 1 ? '' : 's'} generated.`);
      queryClient.invalidateQueries({ queryKey: ['nfc-cards'] });
      queryClient.invalidateQueries({ queryKey: ['nfc-batches'] });
      setResult(data);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Generate blank cards">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-semibold">{result.cards.length}</span> blank cards created
            {result.batch.label ? ` in "${result.batch.label}"` : ''}. Download the CSV to write all
            the chips in one sitting.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Button onClick={() => downloadBatchCsv(result.batch._id, result.batch.label)}>
              Download CSV
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
          <PickerLoadWarning failed={[{ label: 'companies', isError: companiesError }]} />
          <Input
            label="How many cards?"
            type="number"
            min={1}
            max={100}
            error={errors.count?.message}
            {...register('count')}
          />
          <Input label="Batch label (optional)" placeholder="e.g. Trial 10" error={errors.label?.message} {...register('label')} />
          <Select label="Assign to company (optional)" error={errors.company?.message} {...register('company')}>
            <option value="">None (Blank inventory)</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.companyName}
              </option>
            ))}
          </Select>
          <Input label="Note (optional)" error={errors.note?.message} {...register('note')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Generate
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
