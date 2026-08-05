export type ParticipantRef = {
  id: string
  display_name: string
  avatar_url?: string | null
  profile_image_url?: string | null
}

// Everyone who has touched a task — creator, current/past assignees, and
// everyone who's posted a message or triggered a status/assignment change —
// de-duplicated by user id, first-seen order. Used to render the "Involved"
// avatar stack on the task header, replacing the old one-directional
// "creator → assignee" chip (which only ever showed two people).
export function computeTaskParticipants(input: {
  created_user?: ParticipantRef | null
  assigned_user?: ParticipantRef | null
  last_worked_user?: ParticipantRef | null
  delegator_users?: ParticipantRef[]
  comments?: { user_id: string; user: { display_name: string; avatar_url?: string | null; profile_image_url?: string | null } }[]
  history?: { user: ParticipantRef }[]
}): ParticipantRef[] {
  const byId = new Map<string, ParticipantRef>()

  function add(id: string | null | undefined, ref: ParticipantRef | null | undefined) {
    if (!id || !ref || byId.has(id)) return
    byId.set(id, ref)
  }

  add(input.created_user?.id, input.created_user)
  add(input.assigned_user?.id, input.assigned_user)
  add(input.last_worked_user?.id, input.last_worked_user)
  for (const d of input.delegator_users ?? []) add(d.id, d)
  for (const c of input.comments ?? []) {
    add(c.user_id, { id: c.user_id, display_name: c.user.display_name, avatar_url: c.user.avatar_url, profile_image_url: c.user.profile_image_url })
  }
  for (const h of input.history ?? []) add(h.user.id, h.user)

  return [...byId.values()]
}
