CREATE TABLE IF NOT EXISTS scrape_runs (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    dataset_type TEXT NOT NULL,
    dataset_file TEXT NOT NULL UNIQUE,
    query TEXT,
    label TEXT,
    group_name TEXT,
    title TEXT,
    goal TEXT,
    scraped_at TIMESTAMPTZ,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    raw_payload JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_posts (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    platform_post_id TEXT NOT NULL,
    shortcode TEXT,
    url TEXT,
    creator_username TEXT,
    creator_full_name TEXT,
    creator_is_verified BOOLEAN NOT NULL DEFAULT false,
    caption TEXT,
    media_type TEXT,
    product_type TEXT,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    collect_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    music_title TEXT,
    thumbnail_url TEXT,
    posted_at TIMESTAMPTZ,
    raw_payload JSONB NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform, platform_post_id)
);

CREATE TABLE IF NOT EXISTS scrape_run_posts (
    run_id BIGINT NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    rank INTEGER,
    source TEXT,
    search_source_tag TEXT,
    raw_payload JSONB NOT NULL,
    PRIMARY KEY (run_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    hashtag TEXT NOT NULL,
    PRIMARY KEY (post_id, hashtag)
);

CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES scrape_runs(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES social_posts(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    platform_comment_id TEXT,
    parent_comment_id TEXT,
    username TEXT,
    nickname TEXT,
    text TEXT NOT NULL,
    like_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ,
    sentiment TEXT,
    category TEXT,
    language TEXT,
    is_hate_speech BOOLEAN,
    is_toxic BOOLEAN,
    is_sarcasm BOOLEAN,
    is_wellwish BOOLEAN,
    hate_score DOUBLE PRECISION,
    ml_confidence DOUBLE PRECISION,
    decision_source TEXT,
    content_fingerprint TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform, platform_comment_id),
    UNIQUE (platform, content_fingerprint)
);

CREATE TABLE IF NOT EXISTS keyword_posts (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    keyword TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'keyword',
    rank INTEGER,
    raw_payload JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, post_id, keyword)
);

CREATE TABLE IF NOT EXISTS creator_profiles (
    id BIGSERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    followers INTEGER NOT NULL DEFAULT 0,
    following INTEGER NOT NULL DEFAULT 0,
    posts_count INTEGER NOT NULL DEFAULT 0,
    total_likes INTEGER NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_private BOOLEAN NOT NULL DEFAULT false,
    scraped_at TIMESTAMPTZ,
    raw_payload JSONB NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform, username)
);

CREATE TABLE IF NOT EXISTS analysis_runs (
    id BIGSERIAL PRIMARY KEY,
    analysis_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    topic TEXT,
    caption TEXT,
    stance_target TEXT,
    source_dataset TEXT,
    model TEXT,
    main_model TEXT,
    comparison_model TEXT,
    total INTEGER NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sentiment_analysis_items (
    id BIGSERIAL PRIMARY KEY,
    analysis_run_id BIGINT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    comment_id BIGINT REFERENCES post_comments(id) ON DELETE SET NULL,
    item_index INTEGER NOT NULL,
    username TEXT,
    text TEXT NOT NULL,
    main_label TEXT,
    main_score DOUBLE PRECISION,
    comparison_label TEXT,
    comparison_score DOUBLE PRECISION,
    agree BOOLEAN,
    raw_payload JSONB NOT NULL,
    UNIQUE (analysis_run_id, item_index)
);

CREATE TABLE IF NOT EXISTS procontra_analysis_items (
    id BIGSERIAL PRIMARY KEY,
    analysis_run_id BIGINT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    comment_id BIGINT REFERENCES post_comments(id) ON DELETE SET NULL,
    item_index INTEGER NOT NULL,
    username TEXT,
    text TEXT NOT NULL,
    stance TEXT,
    score DOUBLE PRECISION,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_payload JSONB NOT NULL,
    UNIQUE (analysis_run_id, item_index)
);

ALTER TABLE sentiment_analysis_items
ADD COLUMN IF NOT EXISTS comment_id BIGINT;

ALTER TABLE procontra_analysis_items
ADD COLUMN IF NOT EXISTS comment_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_sentiment_analysis_items_comment_id'
    ) THEN
        ALTER TABLE sentiment_analysis_items
        ADD CONSTRAINT fk_sentiment_analysis_items_comment_id
        FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_procontra_analysis_items_comment_id'
    ) THEN
        ALTER TABLE procontra_analysis_items
        ADD CONSTRAINT fk_procontra_analysis_items_comment_id
        FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scrape_runs_platform_type ON scrape_runs(platform, dataset_type);
CREATE INDEX IF NOT EXISTS idx_social_posts_creator ON social_posts(platform, creator_username);
CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON social_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_sentiment ON post_comments(sentiment);
CREATE INDEX IF NOT EXISTS idx_keyword_posts_keyword ON keyword_posts(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_posts_post_id ON keyword_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag ON post_hashtags(hashtag);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_kind ON analysis_runs(kind);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_source_dataset ON analysis_runs(source_dataset);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_items_comment_id ON sentiment_analysis_items(comment_id);
CREATE INDEX IF NOT EXISTS idx_procontra_analysis_items_comment_id ON procontra_analysis_items(comment_id);
