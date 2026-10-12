/**
 * CompanyProfileSummary - read-only company profile cards for the client and
 * subcontractor profile pages (2026-10-12): Arabic name, CR, National Address,
 * contact, Finance person, Owner and coordinators. A value that was never
 * entered shows as a highlighted "Missing", so gaps are visible at a glance.
 */
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import ProfileField from '../../../components/ui/ProfileField.jsx';

function Value({ children, missing }) {
  const { t } = useTranslation();
  if (children) return <>{children}</>;
  return missing ? <span className="text-warning">{t('companyProfile.missingValue')}</span> : null;
}

function PersonCard({ title, person }) {
  const { t } = useTranslation();
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProfileField label={t('companyProfile.person.name')}><Value missing>{person.name}</Value></ProfileField>
        <ProfileField label={t('companyProfile.person.position')}><Value missing>{person.position}</Value></ProfileField>
        <ProfileField label={t('companyProfile.person.phone')}><Value missing>{person.phone}</Value></ProfileField>
        <ProfileField label={t('companyProfile.person.email')}><Value missing>{person.email}</Value></ProfileField>
      </dl>
    </Card>
  );
}

/** `company`: a client or subcontractor from the API. `crNumber` is shown here too, with its expiry. */
export default function CompanyProfileSummary({ company }) {
  const { t } = useTranslation();
  const a = company.nationalAddress ?? {};
  return (
    <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('companyProfile.sections.identity')}</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField label={t('companyProfile.arabicName')}>
            {company.arabicName ? <span dir="rtl" lang="ar">{company.arabicName}</span> : <Value missing />}
          </ProfileField>
          <ProfileField label={t('companyProfile.crNumber')}><Value missing>{company.crNumber}</Value></ProfileField>
          <ProfileField label={t('companyProfile.crExpiry')}><Value missing>{company.crExpiry ? formatDate(company.crExpiry) : ''}</Value></ProfileField>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('companyProfile.sections.nationalAddress')}</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileField label={t('companyProfile.nationalAddress.buildingNumber')}><Value missing>{a.buildingNumber}</Value></ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.streetName')}><Value missing>{a.streetName}</Value></ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.district')}><Value missing>{a.district}</Value></ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.city')}><Value missing>{a.city}</Value></ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.postalCode')}><Value missing>{a.postalCode}</Value></ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.additionalNumber')}><Value missing>{a.additionalNumber}</Value></ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.unitNumber')}>{a.unitNumber}</ProfileField>
          <ProfileField label={t('companyProfile.nationalAddress.shortAddress')}>{a.shortAddress}</ProfileField>
        </dl>
      </Card>

      <PersonCard
        title={t('companyProfile.sections.contact')}
        person={{ name: company.contactPerson, position: company.contactPosition, phone: company.phone, email: company.email }}
      />
      <PersonCard title={t('companyProfile.sections.finance')} person={company.financePerson ?? {}} />
      <PersonCard title={t('companyProfile.sections.owner')} person={company.owner ?? {}} />

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          {t('companyProfile.sections.coordinators')} {company.coordinators?.length ? `(${company.coordinators.length})` : ''}
        </h2>
        {company.coordinators?.length ? (
          <div className="divide-y divide-border">
            {company.coordinators.map((c) => (
              <div key={c._id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">
                  {c.name}
                  {c.designation && <span className="font-normal text-muted"> · {c.designation}</span>}
                </p>
                <p className="text-xs text-muted">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-warning">{t('companyProfile.missingValue')}</p>
        )}
      </Card>
    </>
  );
}
