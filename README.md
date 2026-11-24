# Vault

A calm, fast personal link library for saving, categorizing, and searching videos, posts, articles, and ebooks across YouTube, X, Instagram, Facebook, TikTok, and the web.

## Core Features

- **Quick-Add Flow**: Paste a URL on Home (or press `n` / `Cmd+V`) to auto-fetch metadata (YouTube oEmbed, X oEmbed, Open Graph) and save in seconds with category, note, and tags.
- **Graceful Fallback & Duplicate Detection**: Never blocks saving if a social site blocks metadata; detects duplicate URLs and links directly to the existing item.
- **Multilingual & RTL Ready**: Automatic `dir="auto"` rendering for Arabic, French, and English across titles, notes, categories, and tags, paired with `simple` full-text search.
- **Organization & Export**: Categories (with inline rename and drag-to-reorder), Inbox for uncategorized links, To watch / Done status tracking, JSON & CSV export, and System / Light / Dark themes.

## Setup

### 1. Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. Without Supabase env vars configured, Vault runs with its built-in server-side workspace storage (`data/vault-db.json`) so you can test every feature immediately.

### 2. Supabase Setup (Postgres, Auth & RLS)

1. Create a new project on [Supabase](https://supabase.com).
2. Open **SQL Editor** and run the migration in `supabase/migrations/20261124000000_init.sql`.
3. In **Authentication -> Providers**, enable **Email** (Magic Link) and **Google** OAuth.
4. Set your environment variables in `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Deploy

Build the client and run the production Express server:

```bash
npm run build
npm start
```

For Vercel or container hosting, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project environment settings.
