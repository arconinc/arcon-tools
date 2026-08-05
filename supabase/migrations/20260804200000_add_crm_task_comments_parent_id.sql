-- Task conversation threading: replies target a parent comment.
alter table crm_task_comments
  add column if not exists parent_comment_id uuid references crm_task_comments(id) on delete cascade;

create index if not exists idx_crm_task_comments_parent_comment_id
  on crm_task_comments(parent_comment_id);
