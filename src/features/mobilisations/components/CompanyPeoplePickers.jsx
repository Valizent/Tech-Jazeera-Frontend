/**
 * Pickers for the people at the client / subcontractor on a mobilisation
 * (2026-10-12): which of the company's own coordinators this placement
 * involves (several, added one at a time from a searchable dropdown), and who
 * a commission goes to (one, or "Multiple coordinators": up to three, each
 * with a percentage share - 2026-10-13). Both draw on the company's own
 * coordinator list, and either can add a new person right there - saved to the
 * company itself (the same list its profile edits), so it is available
 * everywhere afterwards. Always dropdowns, never a tick list: a company can
 * have a hundred coordinators.
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
import SearchableSelect from '../../../components/ui/SearchableSelect.jsx';
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
const optionLabel = (c) => [c.name, c.designation].filter(Boolean).join(' · ');

/** Several of the company's coordinators, added one at a time from a searchable
 *  dropdown; each one picked shows below it with a remove button. */
export function CoordinatorMultiPicker({ ownerType, companyId, companyName, coordinators, value, onChange, label, onAdded }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const chosen = value.map((id) => coordinators.find((c) => c._id === id)).filter(Boolean);
  const options = [
    { value: '', label: t('staffMobilisations.form.addCoordinatorPlaceholder') },
    ...coordinators.filter((c) => !value.includes(c._id)).map((c) => ({ value: c._id, label: optionLabel(c) })),
  ];

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
        <>
          <SearchableSelect
            value=""
            onChange={(id) => id && onChange([...value, id])}
            options={options}
            placeholder={t('staffMobilisations.form.addCoordinatorPlaceholder')}
            aria-label={label}
          />
          {chosen.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {chosen.map((c) => (
                <li key={c._id} className="flex items-start justify-between gap-3 p-3">
                  <span className="text-sm">
                    <span className="font-medium">{c.name}</span>
                    {contactLine(c) && <span className="block text-xs text-muted">{contactLine(c)}</span>}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-danger hover:underline"
                    aria-label={t('staffMobilisations.form.removeCoordinatorAria', { name: c.name })}
                    onClick={() => onChange(value.filter((id) => id !== c._id))}
                  >
                    {t('common.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
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

const MULTIPLE = '__multiple__';
const MAX_RECIPIENTS = 3;
const blankRow = () => ({ coordinatorId: '', sharePercent: '' });

/**
 * Who a commission goes to: one of the company's coordinators, or "Multiple
 * coordinators" - up to three, each from a dropdown with a percentage share
 * that must total 100. `recipients` is `[{ coordinatorId, sharePercent }]`;
 * `multiple` is whether the multiple box is showing (it stays open while the
 * rows are being filled in).
 */
export function CommissionRecipientsField({
  ownerType,
  companyId,
  companyName,
  coordinators,
  recipients,
  multiple,
  onChange,
  label,
  error,
  onAdded,
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const optionsFor = (excludeIds) =>
    coordinators.filter((c) => !excludeIds.includes(c._id)).map((c) => ({ value: c._id, label: optionLabel(c) }));
  const mainOptions = [
    { value: '', label: t('staffMobilisations.form.selectCoordinator') },
    { value: MULTIPLE, label: t('staffMobilisations.form.multipleCoordinators') },
    ...coordinators.map((c) => ({ value: c._id, label: optionLabel(c) })),
  ];

  const rows = multiple ? recipients : [];
  const total = rows.reduce((sum, r) => sum + (Number(r.sharePercent) || 0), 0);
  const totalOk = Math.abs(total - 100) <= 0.01;

  function chooseMain(value) {
    if (value === MULTIPLE) {
      const first = recipients[0]?.coordinatorId ? [{ coordinatorId: recipients[0].coordinatorId, sharePercent: '' }] : [blankRow()];
      onChange({ multiple: true, recipients: [...first, blankRow()].slice(0, MAX_RECIPIENTS) });
    } else {
      onChange({ multiple: false, recipients: value ? [{ coordinatorId: value, sharePercent: '100' }] : [] });
    }
  }
  const setRow = (index, patch) =>
    onChange({ multiple: true, recipients: recipients.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
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
      <SearchableSelect
        value={multiple ? MULTIPLE : recipients[0]?.coordinatorId ?? ''}
        onChange={chooseMain}
        options={mainOptions}
        placeholder={t('staffMobilisations.form.selectCoordinator')}
        aria-label={label}
      />

      {multiple && (
        <div className="space-y-3 rounded-lg border border-border bg-bg/40 p-3">
          <p className="text-xs text-muted">{t('staffMobilisations.form.splitHint', { max: MAX_RECIPIENTS })}</p>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  {t('staffMobilisations.form.coordinatorN', { n: index + 1 })}
                </span>
                <SearchableSelect
                  value={row.coordinatorId}
                  onChange={(id) => setRow(index, { coordinatorId: id })}
                  options={[
                    { value: '', label: t('staffMobilisations.form.selectCoordinator') },
                    ...optionsFor(rows.filter((_, i) => i !== index).map((r) => r.coordinatorId)),
                  ]}
                  placeholder={t('staffMobilisations.form.selectCoordinator')}
                  aria-label={t('staffMobilisations.form.coordinatorN', { n: index + 1 })}
                />
              </div>
              <Input
                label={t('staffMobilisations.form.sharePercent')}
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={row.sharePercent}
                onChange={(e) => setRow(index, { sharePercent: e.target.value })}
              />
              {rows.length > 2 ? (
                <button
                  type="button"
                  className="pb-2 text-xs font-medium text-danger hover:underline"
                  onClick={() => onChange({ multiple: true, recipients: recipients.filter((_, i) => i !== index) })}
                >
                  {t('common.remove')}
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {rows.length < MAX_RECIPIENTS ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => onChange({ multiple: true, recipients: [...recipients, blankRow()] })}
              >
                {t('staffMobilisations.form.addAnotherCoordinator')}
              </button>
            ) : (
              <span />
            )}
            <span className={totalOk ? 'text-xs font-medium text-success' : 'text-xs font-medium text-warning'}>
              {t('staffMobilisations.form.shareTotal', { total: Math.round(total * 100) / 100 })}
            </span>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <AddCoordinatorModal
        open={adding}
        onClose={() => setAdding(false)}
        ownerType={ownerType}
        companyId={companyId}
        companyName={companyName}
        onAdded={(coordinator) => {
          onAdded(coordinator);
          // A newly added person is picked straight away: as the commission's only recipient,
          // or into the first empty row of the multiple box.
          if (multiple) {
            const emptyAt = recipients.findIndex((r) => !r.coordinatorId);
            onChange({
              multiple: true,
              recipients:
                emptyAt >= 0
                  ? recipients.map((r, i) => (i === emptyAt ? { ...r, coordinatorId: coordinator._id } : r))
                  : recipients.length < MAX_RECIPIENTS
                    ? [...recipients, { coordinatorId: coordinator._id, sharePercent: '' }]
                    : recipients,
            });
          } else {
            onChange({ multiple: false, recipients: [{ coordinatorId: coordinator._id, sharePercent: '100' }] });
          }
        }}
      />
    </div>
  );
}
