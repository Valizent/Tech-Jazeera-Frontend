/**
 * ExpenseFormModal — the Add/Edit expense form, extracted from
 * ExpenseListPage.jsx (2026-09-24) so the new per-Deployment Expenses
 * section on DeploymentDetailPage.jsx can reuse the exact same form/
 * mutations instead of a second, duplicate one — same "one formula/one
 * component, reused everywhere" discipline this session's own dashboard
 * work already followed for the Revenue/Expenses math itself.
 *
 * `lockedDeployment` (optional): when a caller already knows which
 * deployment (and therefore which client) an expense belongs to — the new
 * Deployment-detail entry point — the client/deployment pickers are replaced
 * by a fixed, read-only line instead of asking the user to pick them again.
 * Omit it (the normal ExpenseListPage flow) for the original picker-driven
 * behavior, unchanged.
 *
 * `duplicateFrom` (optional): a "recurring expense" convenience (rent,
 * subscriptions, ...) — pre-fills every field from a past expense (except
 * the date, reset to today) while `editing` stays `{}`, so saving creates a
 * genuinely NEW record, never touching the original. Deliberately a manual,
 * one-click prefill rather than a real recurrence scheduler — nothing about
 * money should be created unattended.
 */
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createExpense, updateExpense } from '../expenses.api.js';
import { expenseFormSchema, emptyExpenseForm, expenseToForm } from '../expenses.schema.js';
import { useClientPicker } from '../../../lib/useClientPicker.js';
import { listDeployments } from '../../deployments/deployments.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { EXPENSE_CATEGORIES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const RECEIPT_MAX_MB = 10;

export default function ExpenseFormModal({ open, editing, onClose, onSaved, lockedDeployment, duplicateFrom }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(expenseFormSchema), defaultValues: emptyExpenseForm });

  useEffect(() => {
    if (!open) return;
    resetFile();
    if (editing?._id) {
      reset(expenseToForm(editing));
    } else if (duplicateFrom) {
      reset({ ...expenseToForm(duplicateFrom), date: emptyExpenseForm.date });
    } else if (lockedDeployment) {
      reset({ ...emptyExpenseForm, client: lockedDeployment.client, deployment: lockedDeployment._id });
    } else {
      reset(emptyExpenseForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, lockedDeployment, duplicateFrom]);

  const selectedClient = useWatch({ control, name: 'client' });

  // Both pickers are skipped entirely when lockedDeployment is given — nothing
  // to pick, the deployment (and its client) are already known.
  const { data: clientData, isError: clientsError } = useClientPicker({ enabled: open && !lockedDeployment });
  const clients = clientData?.items ?? [];

  const { data: deploymentData, isError: deploymentsError } = useQuery({
    queryKey: ['deployments', 'for-expense', selectedClient],
    queryFn: () => listDeployments({ client: selectedClient, limit: 100 }),
    enabled: open && !lockedDeployment && Boolean(selectedClient),
  });
  const deployments = deploymentData?.items ?? [];

  function resetFile() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
      toast.error(`File is too large (maximum ${RECEIPT_MAX_MB} MB).`);
      e.target.value = '';
      return;
    }
    setPendingFile(file);
  }

  const saveMutation = useMutation({
    mutationFn: (values) => {
      // Update sends the full form (like Holidays) — an untouched optional
      // field just re-affirms its current value; an emptied one clears it,
      // since the key stays present in the JSON body either way (see
      // expense.validation.js's emptyToUndef).
      if (editing?._id) return updateExpense(editing._id, values);
      const fd = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (value) fd.append(key, value); // skip empty optional fields entirely
      }
      if (pendingFile) fd.append('file', pendingFile);
      return createExpense(fd);
    },
    onSuccess: () => {
      toast.success(editing?._id ? 'Expense updated.' : 'Expense recorded.');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onSaved?.();
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  // A client-side validation failure previously failed silently for every form
  // in this app (react-hook-form never fires a mutation's own onError for
  // one) — the standing fix since found: every form surfaces this as a toast.
  // See MobilisationForm.jsx's own onInvalid for the pattern this mirrors.
  function onInvalid(formErrors) {
    const messages = Object.values(formErrors)
      .map((err) => err?.message)
      .filter(Boolean);
    console.error('[ExpenseFormModal] validation failed:', formErrors);
    toast.error(messages.length ? messages.join(' · ') : 'Check the highlighted fields.');
  }

  return (
    <Modal open={open} onClose={onClose} title={editing?._id ? 'Edit expense' : 'Add expense'} size="lg">
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        {!lockedDeployment && (
          <PickerLoadWarning
            failed={[
              { label: 'clients', isError: clientsError },
              { label: 'deployments', isError: Boolean(selectedClient) && deploymentsError },
            ]}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Date *" type="date" error={errors.date?.message} {...register('date')} />
          <Select label="Category *" error={errors.category?.message} {...register('category')}>
            <option value="">Choose a category…</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input label="Vendor *" placeholder="e.g. ACME Trading Est." error={errors.vendor?.message} {...register('vendor')} />
          <Input label="Amount (⃁) *" type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount')} />
          {lockedDeployment ? (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium">Deployment</p>
              <p className="rounded-lg border border-border bg-bg/50 px-3 py-2 text-sm text-muted">{lockedDeployment.label}</p>
              <input type="hidden" {...register('client')} />
              <input type="hidden" {...register('deployment')} />
            </div>
          ) : (
            <>
              <Select label="Client (optional)" error={errors.client?.message} {...register('client')}>
                <option value="">No client link</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
              <Select label="Deployment (optional)" disabled={!selectedClient} error={errors.deployment?.message} {...register('deployment')}>
                <option value="">{selectedClient ? 'No deployment link' : 'Select a client first'}</option>
                {deployments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.site} — {d.worker?.fullName} ({d.status})
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
        <Textarea label="Notes" placeholder="Optional" error={errors.notes?.message} {...register('notes')} />

        {editing?._id ? (
          editing.receipt && (
            <p className="text-sm text-muted">Receipt: {editing.receipt.originalName} — attached at entry, cannot be changed here.</p>
          )
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Receipt (optional)</label>
            <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {pendingFile ? 'Change file' : 'Choose file'}
              </Button>
              {pendingFile && <span className="truncate text-sm text-muted">{pendingFile.name}</span>}
            </div>
            <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, or WEBP — up to {RECEIPT_MAX_MB} MB.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
