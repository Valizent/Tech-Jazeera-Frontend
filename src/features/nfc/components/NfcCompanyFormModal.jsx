/**
 * NfcCompanyFormModal — add or edit an NFC company (brand colour + logo drive
 * how its tap pages look). The logo uploads after the company is saved, so it
 * works on create too; empty selection leaves it unchanged.
 */
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createNfcCompany,
  updateNfcCompany,
  uploadNfcCompanyLogo,
  removeNfcCompanyLogo,
} from '../nfc.api.js';
import { companyFormSchema, emptyCompanyForm } from '../nfc.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';

const IMG_OK = /^image\/(png|jpe?g|webp)$/;
const MAX_MB = 2;

export default function NfcCompanyFormModal({ open, onClose, company, onSaved }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(company);
  const fileRef = useRef(null);

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(companyFormSchema), defaultValues: emptyCompanyForm });

  useEffect(() => {
    if (!open) return;
    reset(company ? { ...emptyCompanyForm, ...company } : emptyCompanyForm);
    setLogoFile(null);
    setLogoPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    setRemoveLogo(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [open, company, reset]);

  const brand = watch('brandColour');
  const brandValid = /^#[0-9a-fA-F]{6}$/.test(brand || '');
  const shownLogo = logoPreview || (removeLogo ? null : company?.logoUrl);

  function pickLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!IMG_OK.test(file.type)) return toast.error('Logo must be a PNG, JPG, or WEBP.');
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Logo is too large (max ${MAX_MB} MB).`);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  }
  function clearLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  const mutation = useMutation({
    mutationFn: async (values) => {
      const saved = isEdit ? await updateNfcCompany(company._id, values) : await createNfcCompany(values);
      if (logoFile) await uploadNfcCompanyLogo(saved._id, logoFile);
      else if (removeLogo && isEdit) await removeNfcCompanyLogo(saved._id);
      return saved;
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Company updated.' : 'Company created.');
      queryClient.invalidateQueries({ queryKey: ['nfc-companies'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['nfc-company', company._id] });
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit company' : 'Add company'} size="lg">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
        <Input label="Company name *" error={errors.companyName?.message} {...register('companyName')} />
        <Input label="Company name (Arabic)" dir="rtl" placeholder="اسم الشركة بالعربي" error={errors.companyNameAr?.message} {...register('companyNameAr')} />

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-bg">
            {shownLogo ? (
              <img src={shownLogo} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[11px] text-muted">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Company logo</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={pickLogo}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
              />
              {shownLogo && (
                <button type="button" onClick={clearLogo} className="text-xs font-medium text-danger hover:underline">
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-muted">PNG, JPG or WEBP · up to {MAX_MB} MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Contact person" error={errors.contactPerson?.message} {...register('contactPerson')} />
          <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Website" placeholder="company.com" error={errors.website?.message} {...register('website')} />
        </div>
        <Input label="Address" error={errors.address?.message} {...register('address')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Maps link (optional)" placeholder="https://maps.app.goo.gl/…" error={errors.mapLink?.message} {...register('mapLink')} />
          <Input label="City" error={errors.city?.message} {...register('city')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Brand colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Brand colour picker"
              value={brandValid ? brand : '#4F46E5'}
              onChange={(e) => setValue('brandColour', e.target.value, { shouldValidate: true })}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1"
            />
            <Input className="flex-1" placeholder="#4F46E5" error={errors.brandColour?.message} {...register('brandColour')} />
          </div>
          <p className="text-xs text-muted">The accent that drives this company&apos;s tap pages (and picks light/dark).</p>
        </div>
        <Textarea label="Notes (internal)" rows={2} error={errors.notes?.message} {...register('notes')} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
