/**
 * Table — THE data-list component for the whole app (spec: responsive tables,
 * cards on mobile). Screens describe columns; this component renders:
 *   - ≥md: a real <table> inside its own horizontal-scroll container
 *   - <md: stacked cards — first column becomes the card title, the rest
 *     become label/value rows (except columns marked hideOnMobile)
 * Loading renders skeleton rows (no layout jump); empty renders the given
 * empty state.
 *
 * Column shape: { key, header, render(row), sortable?, className?, hideOnMobile? }
 *
 * onRowClick(row): makes each row/card clickable (e.g. open the detail view).
 * Clicks that land on a <button> or <a> are ignored, so action buttons and
 * inline links keep working without every caller wiring stopPropagation.
 */
import { cn } from '../../lib/utils.js';
import Skeleton from './Skeleton.jsx';

/** Only fire the row handler when the click wasn't on an interactive child. */
function rowClickHandler(onRowClick, row) {
  if (!onRowClick) return undefined;
  return (e) => {
    if (e.target.closest('button, a')) return;
    onRowClick(row);
  };
}

function SortableHeader({ column, sortBy, sortOrder, onSort }) {
  if (!column.sortable) return column.header;
  const active = sortBy === column.key;
  return (
    <button
      onClick={() => onSort(column.key)}
      className={cn('inline-flex items-center gap-1 hover:text-text', active && 'text-text')}
    >
      {column.header}
      <span className="text-xs">{active ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

export default function Table({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 5,
  emptyState = null,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
}) {
  if (!loading && rows.length === 0) return emptyState;

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto px-1 pb-4 md:block">
        <table className="w-full border-separate border-spacing-y-2 text-sm">
          <thead className="text-left">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-4 text-[14px] font-black uppercase tracking-wider text-slate-900 bg-slate-200/60 border-b-4 border-slate-300/80 shadow-sm first:rounded-tl-2xl last:rounded-tr-2xl"
                >
                  <SortableHeader column={col} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="">
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="group drop-shadow-sm">
                    {columns.map((col, idx) => (
                      <td key={col.key} className={cn(
                        "px-4 py-4 bg-surface border-y border-border/50", 
                        idx === 0 && "rounded-l-xl border-l", 
                        idx === columns.length - 1 && "rounded-r-xl border-r"
                      )}>
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={rowClickHandler(onRowClick, row)}
                    className={cn(
                      'group transition-all duration-200 drop-shadow-sm hover:-translate-y-px',
                      onRowClick && 'cursor-pointer hover:drop-shadow-md'
                    )}
                  >
                    {columns.map((col, idx) => (
                      <td key={col.key} className={cn(
                        'px-4 py-4 align-middle bg-surface border-y border-border/40 transition-colors',
                        onRowClick && 'group-hover:border-primary/40',
                        idx === 0 && 'rounded-l-xl border-l',
                        idx === columns.length - 1 && 'rounded-r-xl border-r',
                        col.className
                      )}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))
          : rows.map((row) => {
              const [titleCol, ...rest] = columns;
              return (
                <div
                  key={rowKey(row)}
                  onClick={rowClickHandler(onRowClick, row)}
                  className={cn(
                    'rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all duration-200',
                    onRowClick && 'cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-[1px]'
                  )}
                >
                  <div className="mb-3">{titleCol.render(row)}</div>
                  <dl className="space-y-2">
                    {rest
                      .filter((col) => !col.hideOnMobile)
                      .map((col) => (
                        <div key={col.key} className="flex items-center justify-between gap-3">
                          <dt className="text-xs uppercase tracking-wide text-muted">{col.header}</dt>
                          <dd className="text-right text-sm">{col.render(row)}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              );
            })}
      </div>
    </>
  );
}
