# QuickNotes REST API Design

This document describes the production QuickNotes API, not the JSONPlaceholder
practice service used by the browser client. The production API uses JSON over
HTTPS and authenticates requests with a bearer access token.

## Conventions

- Base URL: `https://api.quicknotes.example/v1`
- Resource identifiers are UUIDs.
- Timestamps are ISO 8601 UTC strings.
- Every successful response returns JSON except `DELETE`, which returns
  `204 No Content`.
- The authenticated user's identity is derived from the access token; clients
  cannot create or modify notes on behalf of another user by supplying a
  `userId`.

## Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Create a user account. | `201 Created` |
| `POST` | `/auth/login` | Authenticate and issue access and refresh tokens. | `200 OK` |
| `GET` | `/notes` | List the authenticated user's notes; supports `limit`, `cursor`, and `tagId` query parameters. | `200 OK` |
| `POST` | `/notes` | Create a note owned by the authenticated user. | `201 Created` |
| `GET` | `/notes/{noteId}` | Retrieve one of the authenticated user's notes. | `200 OK` |
| `PATCH` | `/notes/{noteId}` | Update supplied fields on a note. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Permanently delete a note and its tag links. | `204 No Content` |
| `GET` | `/tags` | List the authenticated user's tags. | `200 OK` |
| `PUT` | `/notes/{noteId}/tags/{tagId}` | Associate an owned tag with an owned note; repeated calls are idempotent. | `204 No Content` |

List endpoints use cursor pagination and return at most 100 records per page.
The API scopes all note and tag operations to the authenticated user.

## Create a note

### Request

`POST /v1/notes`

```json
{
  "title": "Meeting notes",
  "body": "Follow up on the launch checklist.",
  "tagIds": ["tag_2e85a1"]
}
```

The title is required and limited to 100 characters. The body is optional and
may be an empty string. Tag IDs are optional and must belong to the user.

### Response — `201 Created`

```json
{
  "data": {
    "id": "note_9b71d3",
    "title": "Meeting notes",
    "body": "Follow up on the launch checklist.",
    "createdAt": "2026-10-13T12:00:00Z",
    "updatedAt": "2026-10-13T12:00:00Z",
    "tags": [
      {
        "id": "tag_2e85a1",
        "name": "work"
      }
    ]
  }
}
```

## List notes

### Request

`GET /v1/notes?limit=2`

### Response — `200 OK`

```json
{
  "data": [
    {
      "id": "note_9b71d3",
      "title": "Meeting notes",
      "body": "Follow up on the launch checklist.",
      "createdAt": "2026-10-13T12:00:00Z",
      "updatedAt": "2026-10-13T12:00:00Z",
      "tags": [{ "id": "tag_2e85a1", "name": "work" }]
    },
    {
      "id": "note_b204f8",
      "title": "Shopping list",
      "body": "Tea, bread, and apples.",
      "createdAt": "2026-10-12T09:30:00Z",
      "updatedAt": "2026-10-12T09:30:00Z",
      "tags": []
    }
  ],
  "pagination": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTEwLTEyVDA5OjMwOjAwWiJ9",
    "hasMore": true
  }
}
```

## Error responses

Errors use a consistent envelope and an appropriate HTTP status:

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Invalid JSON, validation failure, or malformed query parameter. |
| `401 Unauthorized` | Missing, invalid, or expired access token. |
| `403 Forbidden` | The user is authenticated but lacks permission for the requested operation. |
| `404 Not Found` | The resource does not exist or is not visible to the authenticated user. |
| `409 Conflict` | The request conflicts with current resource state, such as a duplicate tag name. |
| `429 Too Many Requests` | Rate limit exceeded; may include a `Retry-After` header. |
| `500 Internal Server Error` | Unexpected server failure. |

Example — `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "title",
        "message": "Title is required and must be 100 characters or fewer."
      }
    ],
    "requestId": "req_7f31c2"
  }
}
```
