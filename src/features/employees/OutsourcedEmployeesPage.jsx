import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Building2, UserCircle2 } from 'lucide-react';
import { listOutsourcedEmployees } from './outsourcedEmployees.api.js';
import { useAuth } from '../../app/AuthContext.jsx';
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
  const canWrite = user.role === 'Admin' || user.role === 'HR' || user.role === 'Manager';
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
        action={
          canWrite && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('common.add')}
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
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
                        <Building2 className="h-3 w-3" />
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
