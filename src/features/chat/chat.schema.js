/**
 * Client-side chat form schemas - instant feedback; the server's Zod layer is the real gatekeeper.
 */
import { z } from 'zod';

export const newChatSchema = z
  .object({
    type: z.enum(['direct', 'group']),
    personId: z.string(),
    name: z.string().trim().max(80, 'The group name is too long.'),
    memberIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'direct' && !value.personId) {
      ctx.addIssue({ code: 'custom', path: ['personId'], message: 'Choose who to chat with.' });
    }
    if (value.type === 'group' && !value.name) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Give the group a name.' });
    }
    if (value.type === 'group' && value.memberIds.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['memberIds'], message: 'Add at least one other member.' });
    }
  });

export const emptyNewChat = { type: 'direct', personId: '', name: '', memberIds: [] };

export const renameGroupSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name.').max(80, 'The group name is too long.'),
});

export const reportSchema = z.object({
  reason: z.string().trim().max(500, 'Keep the reason under 500 characters.'),
});
