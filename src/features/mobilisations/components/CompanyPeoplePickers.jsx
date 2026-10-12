/**
 * Pickers for the people at the client / subcontractor on a mobilisation
 * (2026-10-12): which of the company's own coordinators this placement
 * involves (several), and who a commission goes to (one). Both draw on the
 * company's own coordinator list, and either can add a new person right
 * there - saved to the company itself (the same list its profile edits), so
 * it is available everywhere afterwards.
 *
 * Not to be confused with our own coordinators (staff) on the mobilisation.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addCompanyCoordinator } from '../mobilisations.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';

const EMPTY = { name: '', designation: '', phone: '', email: '' };

/** The same four fields the company's own coordinator form asks for. */
function AddCoordinatorModal({ open, onClose, ownerType, companyId, companyName, onAdded }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => addCompanyCoordinator({ ownerType, company: companyId, ...form }),
    onSuccess: (coordinator) => {
      toast.success(t('staffMobilisations.form.coordinatorAddedToast', { name: coordinator.name, company: companyName }));
      queryClient.invalidateQueries({ queryKey: [ownerType === 'Client' ? 'clients' : 'subcontractors'] });
      onAdded(coordinator);
      setForm(EMPTY);
      onClose();
    },
    onError: (error) => {
      console.error('[mobilisations] adding a company coordinator failed', error);
      toast.error(apiMessage(error));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t('staffMobilisations.form.addCoordinatorModalTitle')}>
      <div className="flex flex-col gap-4">
        <Input label={t('companyProfile.person.name')} value={form.name} onChange={set('name')} autoFocus />
        <Input label={t('companyProfile.coordinatorDesignation')} value={form.designation} onChange={set('designation')} />
        <Input label={t('companyProfile.person.phone')} placeholder="+966 5x xxx xxxx" value={form.phone} onChange={set('phone')} />
        <Input label={t('companyProfile.person.email')} type="email" value={form.email} onChange={set('email')} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!form.name.trim()}>
            {t('common.add')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const contactLine = (c) => [c.designation, c.phone, c.email].filter(Boolean).join(' · ');

/** Several of the company's coordinators, ticked from its own list. */
export function CoordinatorMultiPicker({ ownerType, companyId, companyName, coordinators, value, onChange, label, onAdded }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text">{label}</span>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          disabled={!companyId}
          onClick={() => setAdding(true)}
        >
          {t('staffMobilisations.form.addNew')}
        </button>
      </div>
      {coordinators.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
          {companyId ? t('staffMobilisations.form.noCompanyCoordinators') : t('staffMobilisations.form.selectCompanyFirst')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {coordinators.map((c) => (
            <li key={c._id}>
              <label className="flex cursor-pointer items-start gap-3 p-3">
                <input type="checkbox" className="mt-1" checked={value.includes(c._id)} onChange={() => toggle(c._id)} />
                <span className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {contactLine(c) && <span className="block text-xs text-muted">{contactLine(c)}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <AddCoordinatorModal
        open={adding}
        onClose={() => setAdding(false)}
        ownerType={ownerType}
        companyId={companyId}
        companyName={companyName}
        onAdded={(coordinator) => {
          onAdded(coordinator);
          onChange([...value, coordinator._id]);
        }}
      />
    </div>
  );
}

/** One of the company's coordinators - who a commission goes to. */
export function CommissionRecipientSelect({ ownerType, companyId, companyName, coordinators, value, onChange, label, error, onAdded }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-text">{label}</label>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          disabled={!companyId}
          onClick={() => setAdding(true)}
        >
          {t('staffMobilisations.form.addNew')}
        </button>
      </div>
      <Select value={value} onChange={(e) => onChange(e.target.value)} error={error}>
        <option value="">{t('staffMobilisations.form.selectCoordinator')}</option>
        {coordinators.map((c) => (
          <option key={c._id} value={c._id}>
            {[c.name, c.designation].filter(Boolean).join(' · ')}
          </option>
        ))}
      </Select>
      <AddCoordinatorModal
        open={adding}
        onClose={() => setAdding(false)}
        ownerType={ownerType}
        companyId={companyId}
        companyName={companyName}
        onAdded={(coordinator) => {
          onAdded(coordinator);
          onChange(coordinator._id);
        }}
      />
    </div>
  );
}
