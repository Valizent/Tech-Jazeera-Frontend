/** Small helpers shared by the chat screens. */

/** A group's name, or the other person's name in a direct chat. */
export function conversationTitle(conversation, myId, t) {
  if (conversation.type === 'group') return conversation.name;
  const other = conversation.members.find((m) => m.id !== myId);
  return other?.name ?? t('chat.formerUser');
}

/** Opens a downloaded Blob in a new tab (the object URL is released a minute later). */
export function openBlobInTab(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Saves a downloaded Blob under its original file name. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const isImage = (mimeType) => mimeType?.startsWith('image/');
