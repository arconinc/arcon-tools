-- Reader comments on published news articles.
create table if not exists news_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references news_articles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_news_comments_article_id
  on news_comments(article_id, created_at);

-- Access is via the service-role admin client only (same as poll_votes).
alter table news_comments enable row level security;
