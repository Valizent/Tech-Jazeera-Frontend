import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listOutsourcedEmployees } from './outsourcedEmployees.api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Card from '../../components/ui/Card.jsx';
import Table from '../../components/ui/Table.jsx';
import Badge from '../../components/ui/Badge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import OutsourcedEmployeeFormModal from './components/OutsourcedEmployeeFormModal.jsx';

export default function OutsourcedEmployeesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const columns = [
    {
      key: 'name',
      header: t('common.name', 'Name'),
      render: (row) => (
        <div>
          <div className="font-medium text-text">{row.name}</div>
          {row.subcontractor && (
            <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
              </svg>
              {row.subcontractor.name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'workerType',
      header: t('common.type', 'Type'),
      render: (row) => (
        <Badge variant={row.workerType === 'Freelancer' ? 'primary' : 'warning'}>
          {t(`employees.workerTypes.${row.workerType}`, row.workerType)}
        </Badge>
      ),
    },
    {
      key: 'iqamaNumber',
      header: t('employees.outsourced.iqamaNumber', 'Iqama Number'),
      render: (row) => (
        <div>
          <div className="text-sm tabular-nums text-text">{row.iqamaNumber || '—'}</div>
          {row.nationality && <div className="text-xs text-muted mt-0.5">{row.nationality}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: t('employees.outsourced.contact', 'Contact'),
      render: (row) => (
        <div>
          <div className="text-sm text-text">{row.phone || '\u2014'}</div>
          {row.email && <div className="text-xs text-muted mt-0.5">{row.email}</div>}
        </div>
      ),
    },
    {
      key: 'agreedRate',
      header: t('employees.outsourced.agreedRate', 'Agreed Rate'),
      render: (row) => (
        <div className="text-sm font-medium text-text">
          {row.agreedRate != null ? `${row.agreedRate} ${row.currency || ''}` : '\u2014'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      hideOnMobile: true,
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleEdit(row._id); }}
        >
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('employees.outsourced.title', 'Outsourced Employees')}
        description={t('employees.outsourced.description', 'Freelancers and subcontractor workers mobilised through this company.')}
        onBack={() => navigate(-1)}
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
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder={t('common.search', 'Search...')}
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
          <option value="">{t('common.allTypes', 'All types')}</option>
          <option value="Freelancer">{t('employees.workerTypes.Freelancer', 'Freelancer')}</option>
          <option value="SupplierEmployee">{t('employees.workerTypes.SupplierEmployee', 'Supplier Employee')}</option>
        </Select>
      </div>

      <Card>
        <Table
          columns={columns}
          rows={employees}
          rowKey={(row) => row._id}
          loading={isLoading}
          onRowClick={(row) => handleEdit(row._id)}
          emptyState={
            <EmptyState
              title={t('employees.outsourced.emptyTitle', 'No outsourced employees yet')}
              description={t('employees.outsourced.emptyDescription', 'Add a freelancer or subcontractor worker, or mobilise one to have them appear here automatically.')}
            />
          }
        />
      </Card>

      <OutsourcedEmployeeFormModal
        open={formOpen}
        employeeId={editingId}
        canWrite={canWrite}
        onClose={closeForm}
      />
    </div>
  );
}
