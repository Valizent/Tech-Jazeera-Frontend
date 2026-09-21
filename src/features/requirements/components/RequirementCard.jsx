/**
 * RequirementCard — one card on the board. Draggable (native HTML5 drag) when
 * the viewer may move it; on a phone/tablet, where dragging isn't available, a
 * "Move to…" select on the card does the same job. Whether it's movable comes
 * from the server's per-card `permissions`, never re-derived here.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, formatDate } from '../../../lib/utils.js';
import Badge from '../../../components/ui/Badge.jsx';

const DAY_MS = 86_400_000;

export default function RequirementCard({ requirement, stages, showCoordinators, onOpen, onMove }) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const canMove = requirement.permissions.move;

  const daysSinceUpdate = requirement.lastUpdateAt
    ? Math.max(0, Math.floor((Date.now() - new Date(requirement.lastUpdateAt).getTime()) / DAY_MS))
    : null;
  const updateLabel =
    daysSinceUpdate === null
      ? t('staffRequirements.card.noUpdates')
      : daysSinceUpdate === 0
        ? t('staffRequirements.card.updatedToday')
        : t('staffRequirements.card.updatedDaysAgo', { count: daysSinceUpdate });

  return (
    <div
      draggable={canMove}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', requirement._id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      // Whole-card click for mouse users; the client name below is a real
      // button for keyboard users. A click on the select is ignored, same rule
      // Table.jsx uses so inline controls never also trigger the row action.
      onClick={(e) => {
        if (!e.target.closest('select, button')) onOpen(requirement._id);
      }}
      className={cn(
        'rounded-xl border bg-surface p-3 text-sm shadow-sm transition-all duration-200 ease-out-expo',
        requirement.stale ? 'border-danger/40' : 'border-border',
        'cursor-pointer hover:border-primary/40 hover:shadow-md',
        canMove && 'active:cursor-grabbing',
        dragging && 'opacity-40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium tabular-nums text-muted">{requirement.serialNumber}</span>
        {requirement.stale && <Badge variant="danger">{t('staffRequirements.card.stale')}</Badge>}
      </div>

      <button
        type="button"
        onClick={() => onOpen(requirement._id)}
        className="mt-1 block w-full text-start font-semibold text-text hover:text-primary focus-visible:text-primary"
      >
        {requirement.clientName}
      </button>
      <p className="text-muted">
        {requirement.jobTitle} <span className="tabular-nums">× {requirement.headcount}</span>
      </p>

      {requirement.neededBy && (
        <p className="mt-1 text-xs text-muted">{t('staffRequirements.card.neededBy', { date: formatDate(requirement.neededBy) })}</p>
      )}
      {requirement.candidateCount > 0 && (
        <p className="mt-1 text-xs text-muted">
          {t('staffRequirements.card.candidates', { count: requirement.candidateCount })}
          {' · '}
          <span className={cn(requirement.mobilisedCount > 0 && 'font-medium text-success')}>
            {t('staffRequirements.card.mobilisedProgress', { mobilised: requirement.mobilisedCount, headcount: requirement.headcount })}
          </span>
        </p>
      )}
      {showCoordinators && (
        <p className="mt-1 truncate text-xs font-medium text-primary">{requirement.coordinators.map((c) => c.name).join(', ')}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted">
        <span className={cn(requirement.stale && 'font-medium text-danger')}>
          {t('staffRequirements.card.daysInStage', { count: requirement.daysInStage })}
        </span>
        <span>{updateLabel}</span>
      </div>

      {canMove && (
        <select
          value={requirement.stage}
          onChange={(e) => onMove(requirement._id, e.target.value)}
          aria-label={t('staffRequirements.card.moveToAria', { name: requirement.clientName })}
          className="mt-2 h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs text-text md:hidden"
        >
          {stages.map((s) => (
            <option key={s._id} value={s._id}>
              {s._id === requirement.stage ? s.name : t('staffRequirements.card.moveTo', { name: s.name })}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
