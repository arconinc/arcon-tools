create index if not exists idx_crm_task_comments_task_id_created_at
  on crm_task_comments (task_id, created_at);

-- Unread = comments by other users after the caller's last read (or the
-- baseline for tasks never opened). One small row per task with unread comments.
create or replace function unread_comment_counts(p_task_ids uuid[], p_user_id uuid, p_baseline timestamptz)
returns table (task_id uuid, unread bigint)
language sql stable as $$
  select c.task_id, count(*)
  from crm_task_comments c
  left join crm_task_comment_reads r on r.task_id = c.task_id and r.user_id = p_user_id
  where c.task_id = any(p_task_ids)
    and c.user_id <> p_user_id
    and c.created_at > coalesce(r.last_read_at, p_baseline)
  group by c.task_id
$$;

-- Called only from server routes via the service role.
revoke execute on function unread_comment_counts(uuid[], uuid, timestamptz) from public, anon, authenticated;
