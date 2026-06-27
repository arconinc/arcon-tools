-- Add poll support to News & Announcements.

ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'article'
    CHECK (content_kind IN ('article', 'poll')),
  ADD COLUMN IF NOT EXISTS poll_question text,
  ADD COLUMN IF NOT EXISTS poll_is_anonymous boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.poll_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT poll_options_text_not_blank CHECK (length(trim(option_text)) > 0)
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  option_id  uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT poll_votes_one_vote_per_user UNIQUE (article_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_options_article_order
  ON public.poll_options(article_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_poll_votes_article
  ON public.poll_votes(article_id);

CREATE INDEX IF NOT EXISTS idx_poll_votes_option
  ON public.poll_votes(option_id);
