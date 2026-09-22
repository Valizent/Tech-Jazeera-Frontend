/**
 * DocumentUploadModal — upload a new document.
 *
 * Two modes:
 *  - fixedOwner given (on an employee/client profile): owner is locked, no picker.
 *  - fixedOwner omitted (global Documents page): the user picks owner type and
 *    then the specific employee/client.
 *
 * Text fields use react-hook-form + Zod; the File and (when applicable) the
 * owner are tracked separately and validated on submit, then everything is
 * assembled into FormData for the multipart POST.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadDocument } from '../documents.api.js';
import { documentFormSchema, emptyDocumentForm } from '../documents.schema.js';
import { useEmployeePicker } from '../../../lib/useEmployeePicker.js';
import { useClientPicker } from '../../../lib/useClientPicker.js';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_OWNER_TYPES,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_MB,
} from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function DocumentUploadModal({ open, onClose, fixedOwner, onUploaded }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  // Owner pickers (only used when there's no fixedOwner).
  const [ownerType, setOwnerType] = useState('Employee');
  const [ownerId, setOwnerId] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(documentFormSchema), defaultValues: emptyDocumentForm });

  // Owner options for the global picker — reuses the SAME shared
  // employee/client picker hooks every other module's picker uses (2026-09-22,
  // a real QA-audit finding — P9: this used to fetch under its own
  // ['ownerPicker', ownerType] key, duplicating an identical request another
  // open picker had already cached). Only the active ownerType's picker is
  // enabled, so switching the type never fetches both.
  const employeePicker = useEmployeePicker({ enabled: open && !fixedOwner && ownerType === 'Employee' });
  const clientPicker = useClientPicker({ enabled: open && !fixedOwner && ownerType === 'Client' });
  const { data: ownerOptions, isError: ownerOptionsError } =
    ownerType === 'Employee' ? employeePicker : clientPicker;

  const closeAndReset = () => {
    reset(emptyDocumentForm);
    setFile(null);
    setFileError(null);
    setOwnerId('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (values) => {
      const owner = fixedOwner ?? { type: ownerType, id: ownerId };
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', values.title);
      fd.append('category', values.category);
      fd.append('ownerType', owner.type);
      fd.append('owner', owner.id);
      if (values.expiryDate) fd.append('expiryDate', values.expiryDate);
      return uploadDocument(fd);
    },
    onSuccess: () => {
      toast.success(t('staffDocuments.upload.uploadedToast'));
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onUploaded?.();
      closeAndReset();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function onSubmit(values) {
    setFileError(null);
    if (!file) {
      setFileError(t('staffDocuments.upload.chooseFileError'));
      return;
    }
    if (file.size > DOCUMENT_MAX_MB * 1024 * 1024) {
      setFileError(t('staffDocuments.upload.fileTooLargeError', { maxMb: DOCUMENT_MAX_MB }));
      return;
    }
    if (!fixedOwner && !ownerId) {
      setFileError(t('staffDocuments.upload.selectOwnerError'));
      return;
    }
    mutation.mutate(values);
  }

  const items = ownerOptions?.items ?? [];

  return (
    <Modal open={open} onClose={closeAndReset} title={t('staffDocuments.upload.title')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <PickerLoadWarning failed={[{ label: 'owner options', isError: !fixedOwner && ownerOptionsError }]} />
        {fixedOwner ? (
          <p className="rounded-lg bg-bg p-2.5 text-sm text-muted">
            {t('staffDocuments.upload.for')} <span className="font-medium text-text">{fixedOwner.name}</span>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('staffDocuments.upload.ownerType')}
              value={ownerType}
              onChange={(e) => {
                setOwnerType(e.target.value);
                setOwnerId('');
              }}
            >
              {DOCUMENT_OWNER_TYPES.map((ot) => (
                <option key={ot} value={ot}>
                  {t(`staffDocuments.ownerTypeLabels.${ot}`, ot)}
                </option>
              ))}
            </Select>
            <Select label={t('staffDocuments.upload.ownerLabel')} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">{t('staffDocuments.upload.selectOwner')}</option>
              {items.map((o) => (
                <option key={o._id} value={o._id}>
                  {ownerType === 'Employee' ? `${o.fullName} (${o.employeeId})` : o.companyName}
                </option>
              ))}
            </Select>
          </div>
        )}

        <Input label={t('staffDocuments.upload.titleLabel')} placeholder={t('staffDocuments.upload.titlePlaceholder')} error={errors.title?.message} {...register('title')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('staffDocuments.upload.category')} error={errors.category?.message} {...register('category')}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`staffDocuments.categoryLabels.${c}`, c)}
              </option>
            ))}
          </Select>
          <Input label={t('staffDocuments.upload.expiryDate')} type="date" error={errors.expiryDate?.message} {...register('expiryDate')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">{t('staffDocuments.upload.fileLabel')}</label>
          <input
            type="file"
            accept={DOCUMENT_ACCEPT}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFileError(null);
            }}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
          />
          <p className="text-xs text-muted">{t('staffDocuments.upload.fileHint', { maxMb: DOCUMENT_MAX_MB })}</p>
          {fileError && <p className="text-sm text-danger">{fileError}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={closeAndReset} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {t('staffDocuments.panel.upload')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
