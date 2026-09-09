/**
 * BrandLogo — the app's logo, wherever it appears (staff sidebar, ESS
 * sidebar, login screen, no-portal-access screen). This app is meant to be
 * deployed for more than one company, so nothing here is hardcoded to a
 * single business: once a company uploads their own logo via Company
 * Settings, every one of these surfaces shows it automatically; until then,
 * a plain "V" mark (for Valizent, the platform itself) is the default —
 * never a specific customer's asset baked into the app shell.
 */
import { useQuery } from '@tanstack/react-query';
import { getCompanyBranding } from '../../features/companySettings/companySettings.api.js';

export const FALLBACK_BRAND_NAME = 'Valizent CRM';

export function useBranding() {
  const { data } = useQuery({
    queryKey: ['company-branding'],
    queryFn: getCompanyBranding,
    staleTime: 5 * 60 * 1000,
  });
  return {
    name: data?.companyName || FALLBACK_BRAND_NAME,
    logoUrl: data?.logoUrl || null,
  };
}

export default function BrandLogo({ className = 'h-9 w-9' }) {
  const { name, logoUrl } = useBranding();

  if (logoUrl) {
    return <img src={logoUrl} alt={name} className={`${className} rounded-xl object-cover shadow-glow`} />;
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`${className} grid place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20 shadow-glow`}
    >
      V
    </div>
  );
}
