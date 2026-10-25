/**
 * MessageBubble - one message in the thread. Your own sit at the end edge in the brand colour, others at the
 * start edge; a deleted message is a plain grey "Message deleted" line. Delete (own) and Report (others') are
 * quiet text actions under the bubble, big enough to tap.
 */
import { useTranslation } from 'react-i18next';
import { cn, formatTime } from '../../../lib/utils.js';
import { fetchChatFileBlob } from '../chat.api.js';
import MessageContent from './MessageContent.jsx';

export default function MessageBubble({ message, mine, showSender, onDelete, onReport }) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-col gap-0.5', mine ? 'items-end' : 'items-start')}>
      {showSender && !mine && <span className="px-1 text-xs font-medium text-muted">{message.senderName}</span>}

      {message.deleted ? (
        <div className="rounded-2xl border border-dashed border-border px-3 py-2 text-sm italic text-muted">{t('chat.messageDeleted')}</div>
      ) : (
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-3 py-2 sm:max-w-[70%]',
            mine ? 'bg-primary/10 text-text ring-1 ring-inset ring-primary/20' : 'border border-border bg-surface text-text'
          )}
        >
          <MessageContent message={message} fileId={message.id} fetchBlob={fetchChatFileBlob} />
        </div>
      )}

      <div className="flex items-center gap-3 px-1 text-xs text-muted">
        <span>{formatTime(message.createdAt)}</span>
        {!message.deleted && mine && (
          <button type="button" className="py-1 hover:text-danger hover:underline" onClick={() => onDelete(message)}>
            {t('chat.delete')}
          </button>
        )}
        {!message.deleted && !mine && (
          <button type="button" className="py-1 hover:text-danger hover:underline" onClick={() => onReport(message)}>
            {t('chat.report')}
          </button>
        )}
      </div>
    </div>
  );
}
