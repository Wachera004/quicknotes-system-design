# QuickNotes System Design

QuickNotes is a browser-based notes client backed by the JSONPlaceholder
practice API, accompanied by a proposed production REST API, relational data
model, and scalable system architecture for a service designed for 1 million
users.

## Run the API client

1. Download or clone this project.
2. Open `index.html` in a modern browser. If your browser restricts local-file
   requests, serve the folder with any static HTTP server and open its local
   URL instead.
3. Select **Load Notes** to fetch up to 10 sample posts. Use the form to submit
   a note or the **Delete** button to remove a note from the current page.

The client calls `https://jsonplaceholder.typicode.com/posts`. JSONPlaceholder
is a practice API: POST and DELETE demonstrate the HTTP request/response flow,
but changes are not persisted by the remote service. The client updates its
own in-memory list to show the result for the current page session.

## Design documents

- [API design](docs/api-design.md) — production REST endpoints, examples, and
  error format.
- [Data model](docs/data-model.md) — SQL entities, relationships, schema,
  queries, and indexes.
- [Architecture](docs/architecture.md) — requirements, capacity estimates,
  system diagram, request flows, and trade-offs.

## What I learned

- A reusable request helper and explicit loading, success, error, and empty
  states make an API client easier to understand and recover from.
- A relational schema can encode ownership and relationships with foreign
  keys, while transactions keep related note and tag changes consistent.
- Capacity estimates are only useful when their assumptions are stated and
  checked against real service metrics.
- Caches and read replicas improve read capacity but introduce invalidation
  and consistency trade-offs.
