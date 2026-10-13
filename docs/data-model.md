# QuickNotes Data Model

QuickNotes uses a relational SQL database (for example, PostgreSQL). Users own
notes and tags, and notes can be linked to multiple tags. Foreign keys,
transactions, and unique constraints keep ownership and note/tag associations
consistent.

## Entities and relationships

| Entity | Columns and types | Keys |
| --- | --- | --- |
| `users` | `id UUID`, `email VARCHAR(320)`, `password_hash TEXT`, `created_at TIMESTAMPTZ` | `id` primary key; `email` unique |
| `notes` | `id UUID`, `user_id UUID`, `title VARCHAR(100)`, `body TEXT`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | `id` primary key; `user_id` foreign key to `users.id` |
| `tags` | `id UUID`, `user_id UUID`, `name VARCHAR(50)`, `created_at TIMESTAMPTZ` | `id` primary key; `user_id` foreign key to `users.id`; unique `(user_id, name)` |
| `note_tags` | `note_id UUID`, `tag_id UUID`, `created_at TIMESTAMPTZ` | Composite primary key `(note_id, tag_id)`; foreign keys to `notes.id` and `tags.id` |

The `users` to `notes` relationship is one-to-many: one user owns many notes,
and each note has exactly one owner. `users` to `tags` is also one-to-many.
Notes and tags have a many-to-many relationship implemented by `note_tags`.
The composite key prevents the same tag from being attached to the same note
more than once. Cascading deletes clean up an owner's notes, tags, and join
records.

## PostgreSQL schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (note_id, tag_id)
);
```

The application must also verify that the note and tag in a `note_tags` insert
belong to the same user. That ownership check should be performed in a
transaction (or enforced with an additional database constraint/trigger) so
users cannot associate another user's tag with their note.

## Example queries

1. List the newest notes for one user:

   ```sql
   SELECT id, title, body, created_at, updated_at
   FROM notes
   WHERE user_id = $1
   ORDER BY created_at DESC, id DESC
   LIMIT $2;
   ```

2. Get notes with their tag names (JOIN):

   ```sql
   SELECT n.id, n.title, t.id AS tag_id, t.name AS tag_name
   FROM notes AS n
   LEFT JOIN note_tags AS nt ON nt.note_id = n.id
   LEFT JOIN tags AS t ON t.id = nt.tag_id
   WHERE n.user_id = $1 AND n.id = $2;
   ```

3. Create a note and associate a tag atomically:

   ```sql
   BEGIN;
   INSERT INTO notes (user_id, title, body)
   VALUES ($1, $2, $3)
   RETURNING id;
   INSERT INTO note_tags (note_id, tag_id)
   VALUES ($4, $5)
   ON CONFLICT (note_id, tag_id) DO NOTHING;
   COMMIT;
   ```

4. Count notes per user:

   ```sql
   SELECT u.id, u.email, COUNT(n.id) AS note_count
   FROM users AS u
   LEFT JOIN notes AS n ON n.user_id = u.id
   GROUP BY u.id, u.email;
   ```

## Indexes

```sql
CREATE INDEX notes_user_created_idx
    ON notes (user_id, created_at DESC, id DESC);

CREATE INDEX note_tags_tag_idx
    ON note_tags (tag_id, note_id);
```

`notes_user_created_idx` supports the common per-user, newest-first listing
without scanning all users' notes. The reverse `note_tags` index makes finding
notes associated with a tag efficient; the primary key already supports lookup
starting from a note.

## SQL vs. NoSQL

SQL is the better fit because notes, users, tags, and associations have clear
relationships and integrity rules. PostgreSQL provides transactions for
creating notes and tag links together, constraints to protect ownership and
uniqueness, and flexible querying for filtering and pagination. The expected
data volume is manageable with indexing and read replicas, so a NoSQL store's
schema flexibility does not outweigh those consistency benefits.
