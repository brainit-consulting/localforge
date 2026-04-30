# Author Landing — Example App Requirements

A minimal landing page an author would use to market a forthcoming book
("Harrowfield" — a gothic horror novel) and collect newsletter signups.

This spec is the captured-by-hand output of a chat with the LocalForge
AI Bootstrapper. The bootstrapper conversation succeeded at producing
the spec, but the **Generate feature list** step failed because the
configured model (`deepseek-r1:8b` on Ollama) emits JSON-shaped tool
calls inline as plain text rather than as structured `tool_calls` —
the same confabulation pattern documented in the
[Model selection](../README.md#model-selection) section.

When the bootstrapper fails, this hand-authored backlog is loaded
through the same HTTP API the UI uses, via the bypass script:

```bash
node scripts/load-example-features.mjs <projectId> --spec docs/author-landing-features.json
```

---

## Bootstrapper conversation that produced this spec

User: "A simple html css landing page for an author to market a book
Called Harrowfield. There should be the ability to subscribe to a
newsletter to learn more about the author and when the book is
published."

User confirmed they want:
- Author photo prominently displayed
- A 5-8 sentence book excerpt that fades towards the end
- Newsletter CTA after the excerpt
- Tagline: **"What happened in the room below..."**

Final book excerpt provided:

> When archivist Maren Calloway is hired to catalogue the private
> collection of a decommissioned Victorian asylum in the English
> Cotswolds, she expects damp boxes and fading paperwork. But the
> archive doesn't cooperate. Patient journals don't match official
> records. Architectural drawings show rooms with no doors. And the
> deeper she digs, the more the building responds. A gothic horror
> novel about institutional amnesia, the architecture of forgetting,
> and seven patients who vanished from the record but never left the
> stone.

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS, soft warm palette (cream / sepia /
  charcoal — fits the Victorian-asylum aesthetic without going overtly
  horror-themed)
- **DB:** SQLite (file-based, in the project root) — used only to
  persist newsletter signups
- **ORM:** Drizzle ORM + drizzle-kit
- **No auth, no admin panel** — the page is a public-facing static
  marketing surface with one POST endpoint for the newsletter form

---

## Page structure

```text
┌────────────────────────────────────────────────────────────────┐
│  HARROWFIELD                                                   │
│  *What happened in the room below…*    ← tagline               │
│                                                                │
│  ┌──────────────┐                                              │
│  │              │  When archivist Maren Calloway is hired…     │
│  │  Author      │  …seven patients who vanished from the       │
│  │  Photo       │  record but never left the stone.            │
│  │              │  ↧ ( fade towards the end )                  │
│  └──────────────┘                                              │
│                                                                │
│  ─────────────  Subscribe to learn more  ─────────────         │
│                                                                │
│  [ your@email.com ]   [ Subscribe ]                            │
│  Get notified when Harrowfield launches and read more about    │
│  the author.                                                   │
└────────────────────────────────────────────────────────────────┘
```

The excerpt fades to the page background via a CSS gradient mask on the
last ~120px of the excerpt block, so the eye is naturally drawn down to
the newsletter CTA.

---

## Data model — `subscribers` table

| Column      | Type           | Notes                                |
|-------------|----------------|--------------------------------------|
| `id`        | integer PK     | autoincrement                        |
| `email`     | text NOT NULL  | UNIQUE — one row per address         |
| `createdAt` | text NOT NULL  | ISO timestamp, default CURRENT_TIMESTAMP |

That's the entire schema. The page collects exactly one piece of data
and one timestamp.

---

## The 8 atomic features

Dependency arrows show what must be `completed` before a feature is
eligible for pickup.

```text
1. Scaffold Next.js
        │
        ▼
2. Add SQLite + Drizzle
        │
        ▼
3. Define subscribers schema and migrate
        │
        ▼
4. Subscribe API
                │
                ├────────────────┐
                ▼                ▼
5. Hero section (title    8. Newsletter signup form
   + tagline)
        │
        ▼
6. Author photo + bio block
        │
        ▼
7. Excerpt section with fade-out
        │
        └─────────────────►  8. Newsletter signup form
                              (depends on 4 + 7)
```

### 1. Scaffold Next.js app

Initialise a Next.js 16 App Router project IN THE CURRENT WORKING
DIRECTORY (the agent's cwd IS the project root) with TypeScript and
Tailwind. Use `npx create-next-app@latest .` so the scaffold lands
directly in cwd.

**Acceptance:**
- `package.json` lists `next`, `react`, `react-dom`, `tailwindcss`
- `app/page.tsx` and `app/layout.tsx` exist
- `npm run dev` listens on `http://localhost:3000`

### 2. Add SQLite + Drizzle ORM

Install `better-sqlite3`, `drizzle-orm`, `drizzle-kit`. Add `lib/db.ts`
opening `data.sqlite` and a `drizzle.config.ts` pointing at
`lib/schema.ts`.

**Acceptance:**
- `lib/db.ts` exports a `db` Drizzle instance
- `drizzle.config.ts` references `./lib/schema.ts` and `./drizzle`
- `npx drizzle-kit generate` runs without error

### 3. Define subscribers schema and migrate

Write the `subscribers` table schema in `lib/schema.ts`. Generate and
apply the migration so `data.sqlite` exists with the table.

**Acceptance:**
- `data.sqlite` exists
- Schema has the three columns from the data model above
- A no-op `drizzle-kit generate` afterwards reports "no changes"

### 4. Subscribe API

Add `app/api/subscribe/route.ts` exporting `POST(request)`. Validates
that `email` looks like an email (regex check), inserts the row using
`OR IGNORE` semantics so duplicate signups silently succeed, returns
`{ ok: true }` on accept and 400 on bad input.

**Acceptance:**
- POST `/api/subscribe` with `{"email":"x@y.com"}` returns `{ "ok": true }`
- POST without an email or with an obviously-bad string returns 400
- Posting the same email twice does not error and does not create a
  second row
- The `subscribers` table contains the row after the request

### 5. Hero section with title + tagline

Edit `app/page.tsx` to render a hero block at the top of the page with
the book title `Harrowfield` (large, serif, all-caps) and the tagline
`What happened in the room below…` (italic, smaller, muted colour). No
buttons yet — visual only.

**Acceptance:**
- `Harrowfield` is the largest text on the page
- The tagline appears directly under it in italic
- Layout is centered horizontally, with breathing room on either side

### 6. Author photo + bio block

Add a two-column block under the hero: author photo on the left
(rounded square, ~280px wide), a one-paragraph bio on the right. Use a
placeholder image (`public/author.jpg`) — the user will swap their own
photo in later.

**Acceptance:**
- The block is visible directly below the hero
- Photo and text sit side-by-side on desktop; stack vertically on
  narrow viewports (< 640px)
- Bio is in a serif font matching the title family

### 7. Excerpt section with fade-out

Add the book excerpt (the 8-sentence paragraph above) under the
photo block. Apply a CSS mask-image gradient to the last ~120px so the
text fades softly into the page background.

**Acceptance:**
- The excerpt is rendered as one continuous paragraph
- The bottom ~120px visibly fades out (use `mask-image:
  linear-gradient(to bottom, black 70%, transparent)` or equivalent)
- Reading the full text is obviously incomplete by design — the eye is
  pulled toward the next section

### 8. Newsletter signup form

Add a centered form section under the excerpt: heading "Subscribe to
learn more", an email input, a Subscribe button, and a one-line note
about what subscribers will receive. The form POSTs to `/api/subscribe`
and shows a thank-you message in place of the form on success.

**Acceptance:**
- Submitting a valid email shows a thank-you confirmation in the same
  spot the form was
- Submitting an invalid email shows an inline validation error and
  doesn't fire the network request
- Submitting an already-subscribed email shows the same thank-you (no
  leak that the address is already in the DB)
- The row exists in `subscribers` after a successful submit

---

## Why this is a good test case for LocalForge

The original DreamForgeIdeas backlog stress-tests dependency chains
and CRUD scaffolding. This Author Landing backlog stress-tests two
different things:

1. **Smaller surface, more polish.** Eight features instead of ten,
   most of them visual. A model that can scaffold real CRUD might
   still struggle with mask-image gradients or responsive
   side-by-side-on-desktop / stacked-on-mobile layouts.
2. **Single-endpoint backend.** The whole API is one POST. If the
   model can't get a single endpoint right with a clear spec, the
   model is too small for any kind of real build.

Both backlogs share the first three features (scaffold, db setup,
schema) so you can also use this to compare how the same model
performs on the same scaffold step run twice.
