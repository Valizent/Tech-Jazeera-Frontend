/**
 * BoardColumn — one stage of the board, and the drop target for dragging a card
 * into it. Purely presentational: the page decides what a drop does (and
 * whether the dragged card is even allowed to move).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils.js';

export default function BoardColumn({ stage, count, staleCount, onDropCard, children }) {
  const { t } = useTranslation();
  const [over, setOver] = useState(false);

  const rules = [
    stage.staleAfterDays && t('staffRequirements.stage.flagAfter', { count: stage.staleAfterDays }),
    stage.notifyOnEnter && t('staffRequirements.stage.notifies'),
    stage.isMobilisedStage && t('staffRequirements.stage.mobilisedDestination'),
    stage.isTerminal && t('staffRequirements.stage.closed'),
  ].filter(Boolean);

  return (
    <section
      aria-label={stage.name}
      onDragOver={(e) => {
        e.preventDefault(); // required, or the browser never fires `drop`
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // dragleave also fires when moving onto a child — only clear on a real exit.
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropCard(id, stage._id);
      }}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl border bg-bg/50 p-3 transition-colors duration-150',
        over ? 'border-primary/60 bg-primary/5' : 'border-border'
      )}
    >
      <header className="mb-3 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold tracking-tight" title={stage.name}>
            {stage.name}
          </h2>
          <span className="flex shrink-0 items-center gap-1.5">
            {staleCount > 0 && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium tabular-nums text-danger" title={t('staffRequirements.column.staleTitle')}>
                {staleCount}
              </span>
            )}
            <span className="rounded-full bg-border/50 px-2 py-0.5 text-xs font-medium tabular-nums text-muted">{count}</span>
          </span>
        </div>
        {rules.length > 0 && <p className="mt-0.5 truncate text-xs text-muted">{rules.join(' · ')}</p>}
      </header>
      <div className="flex min-h-[5rem] flex-1 flex-col gap-3">
        {count === 0 ? <p className="px-1 py-4 text-center text-xs text-muted">{t('staffRequirements.column.empty')}</p> : children}
      </div>
    </section>
  );
}
