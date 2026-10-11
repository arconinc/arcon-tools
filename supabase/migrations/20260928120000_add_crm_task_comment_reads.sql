-- Per-user "last opened" marker for task comment threads. Unread comment count
-- = comments by other users created after last_read_at.
create table if not exists crm_task_comment_reads (
  task_id uuid not null references crm_tasks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table crm_task_comment_reads enable row level security;

-- Backfill so existing history doesn't show up as unread on launch.
insert into crm_task_comment_reads (task_id, user_id, last_read_at)
select t.id, u.user_id, now()
from crm_tasks t
cross join lateral (values (t.assigned_to), (t.created_by)) as u(user_id)
where u.user_id is not null
  and exists (select 1 from crm_task_comments c where c.task_id = t.id)
on conflict do nothing;
