/**
 * StatTilesRow - the compact count tiles at the top of the dashboard
 * (2026-10-12, the user's own layout): Active clients, Active subcontractors,
 * Currently deployed, then either Active employees + Attendance (management)
 * or Shared employees (Coordinator, Office Secretary, Accounts).
 *
 * The caller passes only the tiles the viewer is entitled to (a null figure
 * from the server means "not yours", so the tile is simply not in the list)
 * and the row divides itself evenly: 4 or 5 or 6 in a row on a wide screen,
 * 2 or 3 on a narrow one. A tile with a `to` is a link.
 */
import { Link } from 'react-router-dom';

function Tile({ to, value, label }) {
  const body = (
    <div
      className={`group relative flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-surface px-3 py-4 text-center transition-colors ${
        to ? 'hover:border-primary/40 hover:bg-primary/5' : ''
      }`}
    >
      <span className="text-2xl font-bold text-text">{value ?? 0}</span>
      <span className="mt-1 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted">{label}</span>
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function StatTilesRow({ tiles }) {
  if (tiles.length === 0) return null;
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:[grid-template-columns:repeat(var(--tile-count),minmax(0,1fr))]"
      style={{ '--tile-count': tiles.length }}
    >
      {tiles.map((tile) => (
        <Tile key={tile.key} to={tile.to} value={tile.value} label={tile.label} />
      ))}
    </div>
  );
}
