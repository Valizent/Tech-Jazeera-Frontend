import Card from '../../../components/ui/Card.jsx';

export default function DirectoryStatsWidget({ activeClients, activeSubcontractors }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="flex flex-col items-center justify-center py-6">
        <span className="text-3xl font-bold text-text">{activeClients ?? 0}</span>
        <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Active Clients</span>
      </Card>
      <Card className="flex flex-col items-center justify-center py-6">
        <span className="text-3xl font-bold text-text">{activeSubcontractors ?? 0}</span>
        <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Active Subcontractors</span>
      </Card>
    </div>
  );
}
