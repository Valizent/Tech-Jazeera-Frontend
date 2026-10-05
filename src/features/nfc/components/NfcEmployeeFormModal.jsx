/**
 * NfcEmployeeFormModal — add or edit a person under an NFC company. These are
 * the details (and photo) shown on the tap page. The photo uploads after the
 * person is saved, so it works on create too.
 */
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createNfcEmployee,
  updateNfcEmployee,
  uploadNfcEmployeePhoto,
  removeNfcEmployeePhoto,
} from '../nfc.api.js';
import { employeeFormSchema, emptyEmployeeForm } from '../nfc.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';

const IMG_OK = /^image\/(png|jpe?g|webp)$/;
const MAX_MB = 2;

export default function NfcEmployeeFormModal({ open, onClose, companyId, employee, onSaved }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(employee);
  const fileRef = useRef(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(employeeFormSchema), defaultValues: emptyEmployeeForm });

  useEffect(() => {
    if (!open) return;
    reset(employee ? { ...emptyEmployeeForm, ...employee } : emptyEmployeeForm);
    setPhotoFile(null);
    setPhotoPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    setRemovePhoto(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [open, employee, reset]);

  const shownPhoto = photoPreview || (removePhoto ? null : employee?.photoUrl);

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!IMG_OK.test(file.type)) return toast.error('Photo must be a PNG, JPG, or WEBP.');
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Photo is too large (max ${MAX_MB} MB).`);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }
  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  const mutation = useMutation({
    mutationFn: async (values) => {
      const saved = isEdit
        ? await updateNfcEmployee(employee._id, values)
        : await createNfcEmployee({ ...values, company: companyId });
      if (photoFile) await uploadNfcEmployeePhoto(saved._id, photoFile);
      else if (removePhoto && isEdit) await removeNfcEmployeePhoto(saved._id);
      return saved;
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Person updated.' : 'Person added.');
      queryClient.invalidateQueries({ queryKey: ['nfc-company', companyId] });
      onSaved?.();
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit person' : 'Add person'} size="lg">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-bg">
            {shownPhoto ? (
              <img src={shownPhoto} alt="Photo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] text-muted">Photo</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Profile photo</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={pickPhoto}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
              />
              {shownPhoto && (
                <button type="button" onClick={clearPhoto} className="text-xs font-medium text-danger hover:underline">
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-muted">PNG, JPG or WEBP · up to {MAX_MB} MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name *" error={errors.name?.message} {...register('name')} />
          <Input label="Name (Arabic)" dir="rtl" placeholder="الاسم بالعربي" error={errors.nameAr?.message} {...register('nameAr')} />
          <Input label="Job title" error={errors.jobTitle?.message} {...register('jobTitle')} />
          <Input label="Job title (Arabic)" dir="rtl" placeholder="المسمى الوظيفي بالعربي" error={errors.jobTitleAr?.message} {...register('jobTitleAr')} />
          <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
          <Input label="WhatsApp" placeholder="9665… (digits)" error={errors.whatsapp?.message} {...register('whatsapp')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Alternate email" type="email" placeholder="Optional e.g. a work address" error={errors.altEmail?.message} {...register('altEmail')} />
          <Input label="LinkedIn" placeholder="linkedin.com/in/…" error={errors.linkedin?.message} {...register('linkedin')} />
        </div>
        <Textarea label="Short bio" rows={2} error={errors.bio?.message} {...register('bio')} />
        <Textarea label="Short bio (Arabic)" dir="rtl" rows={2} placeholder="نبذة قصيرة بالعربي" error={errors.bioAr?.message} {...register('bioAr')} />
        <Input label="ID / Iqama number (internal)" error={errors.idNumber?.message} {...register('idNumber')} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
