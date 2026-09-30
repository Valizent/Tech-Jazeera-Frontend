import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listOutsourcedEmployees } from './outsourcedEmployees.api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Table from '../../components/ui/Table.jsx';
import Badge from '../../components/ui/Badge.jsx';
import OutsourcedEmployeeFormModal from './components/OutsourcedEmployeeFormModal.jsx';

export default function OutsourcedEmployeesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Fixed 2026-09-30: matches the route guard (router.jsx gates this whole
  // page on 'employeeCreate', the same key the rest of the Employees module
  // uses) instead of a hardcoded role list that could show write controls
  // to a role with no real grant, or hide them from a real one (e.g. an
  // Office Secretary designated via ApprovalRole, per the app's own
  // established pattern).
  const canWrite = Boolean(user.sectionAccessWrite?.includes('employeeCreate'));
  const [search, setSearch] = useState('');
  const [workerType, setWorkerType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['outsourcedEmployees', { search, workerType }],
    queryFn: () => listOutsourcedEmployees({ search, workerType }),
  });

  const handleEdit = (id) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={t('employees.outsourced.title', 'Outsourced Employees')}
        description={t('employees.outsourced.description', 'Manage freelancers and subcontractor workers.')}
        actions={
          canWrite && (
            <Button onClick={() => setFormOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="me-2 h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('common.add')}
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select
          value={workerType}
          onChange={(e) => setWorkerType(e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="">{t('common.all')}</option>
          <option value="Freelancer">{t('employees.workerTypes.Freelancer', 'Freelancer')}</option>
          <option value="SupplierEmployee">{t('employees.workerTypes.SupplierEmployee', 'Supplier Employee')}</option>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.type')}</th>
              <th>{t('employees.outsourced.contact', 'Contact')}</th>
              <th>{t('employees.outsourced.agreedRate', 'Agreed Rate')}</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted">
                  {t('common.loading')}
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted">
                  {t('common.noRecords')}
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee._id} className="group hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => handleEdit(employee._id)}>
                  <td>
                    <div className="font-medium text-text">{employee.name}</div>
                    {employee.subcontractor && (
                      <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 shrink-0">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01"
                          />
                        </svg>
                        {employee.subcontractor.name}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge variant={employee.workerType === 'Freelancer' ? 'primary' : 'warning'}>
                      {t(`employees.workerTypes.${employee.workerType}`, employee.workerType)}
                    </Badge>
                  </td>
                  <td>
                    <div className="text-sm text-text">{employee.phone || '-'}</div>
                    {employee.email && <div className="text-xs text-muted mt-0.5">{employee.email}</div>}
                  </td>
                  <td>
                    <div className="text-sm text-text font-medium">
                      {employee.agreedRate != null ? `${employee.agreedRate} ${employee.currency}` : '-'}
                    </div>
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(employee._id); }}>
                      {t('common.edit')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <OutsourcedEmployeeFormModal
        open={formOpen}
        employeeId={editingId}
        onClose={closeForm}
      />
    </div>
  );
}
