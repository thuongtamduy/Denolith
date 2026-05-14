# 👥 Users, Roles & Permissions API — Frontend Integration Guide

Base URL: `http://localhost:9999`

> **Auth Required:** All endpoints in this guide require a valid `accessToken` in the `Authorization: Bearer <token>` header, unless noted otherwise.

---

## 🔐 Access Control Overview

Denolith uses a **3-tier Role System** combined with fine-grained Permission Profiles.

```
OWNER  → Bypasses all permission checks. Can do everything.
ADMIN  → Access to admin-level routes. Specific actions require explicit permissions.
USER   → Access to public routes only. Promoted by ADMIN.
```

### How Permissions Are Resolved (Per Request)

```
Request → Auth Middleware (JWT verify + blacklist check)
  ↓
Role Middleware (requireRole) → checks tier (owner / admin / user)
  ↓
Permission Middleware (requirePermission) → checks specific permission codes
  - OWNER: auto-pass
  - Others: load from PermissionProfiles + individual Overrides → AND check
```

**Key permission codes used in this guide:**
- `permissions.manage` — Required to manage roles, permission profiles, and user overrides.

---

## 👤 Users

### Admin Routes — `/api/users` *(requires: `admin` tier)*

#### `GET /api/users`
List all active users (paginated). Response is cached for 60s.

**Query Params:** `page` (default: 1), `limit` (default: 20)

**Response `200 OK`**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "username": "john", "roleCode": "user", ... }],
  "meta": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

---

#### `GET /api/users/:id`
Get details of a single user.

**Response `200 OK`**
```json
{ "success": true, "data": { "id": "uuid", "username": "john", ... } }
```

---

#### `POST /api/users`
Create a new user (admin action).

**Request Body**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Secret123",
  "roleCode": "user",
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "John",
  "gender": "male"
}
```

**Response `201 Created`**
```json
{ "success": true, "data": { "id": "uuid", "username": "john_doe", ... } }
```

---

#### `PATCH /api/users/:id`
Partially update a user's profile info.

**Request Body** (all fields optional)
```json
{
  "firstName": "Jane",
  "bio": "Updated bio",
  "active": false
}
```

---

#### `PATCH /api/users/:id/role` *(requires: `permissions.manage`)*
Change a user's role. Cannot change your own role.

**Request Body**
```json
{ "role": "admin" }
```

---

#### `DELETE /api/users/:id`
Soft-delete a user (recoverable). Cannot delete yourself.

**Response `200 OK`**
```json
{ "success": true, "message": "User has been soft-deleted and can be restored." }
```

Add `?force=true` to permanently hard-delete (returns `204 No Content`).

---

#### `POST /api/users/:id/restore`
Restore a soft-deleted user.

**Response `200 OK`**
```json
{ "success": true, "message": "User 'john_doe' has been restored successfully." }
```

---

### Public Routes — `/api/v0/users` *(no auth required)*

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v0/users` | List users (paginated, cached 60s) |
| `GET` | `/api/v0/users/:id` | Get user details |

---

## 🏷️ Roles

All role endpoints require: **`permissions.manage`** permission.

Base: `/api/roles`

#### `GET /api/roles`
List all roles (paginated).

**Response**
```json
{
  "success": true,
  "data": [{ "code": "admin", "name": "Administrator", "tier": "admin", "system": true }],
  "meta": { ... }
}
```

#### `GET /api/roles/:code`
Get a single role by its code (e.g. `admin`, `user`).

#### `POST /api/roles`
Create a custom role.

**Request Body**
```json
{
  "code": "moderator",
  "name": "Moderator",
  "description": "Can moderate content",
  "tier": "user"
}
```

#### `PATCH /api/roles/:code`
Update a role's `name`, `description`, or `active` status. Cannot modify `code`, `tier`, or `system` flag.

#### `DELETE /api/roles/:code`
Delete a custom role. System roles (`owner`, `admin`, `user`) cannot be deleted.

---

## 🔑 Permissions

All permission endpoints require: **`permissions.manage`** permission.

Base: `/api/permissions`

### Permission Codes

#### `GET /api/permissions`
List all available atomic permission codes in the system (developer-seeded, read-only).

**Response**
```json
{
  "success": true,
  "data": [{ "code": "permissions.manage", "description": "..." }]
}
```

---

### Permission Profiles

A **Permission Profile** is a reusable bundle of permission codes that can be assigned to multiple users.

#### `GET /api/permissions/profiles`
List all profiles (paginated). Filter by tier with `?tier=admin` or `?tier=user`.

#### `POST /api/permissions/profiles`
Create a new profile.

**Request Body**
```json
{
  "name": "Content Editor",
  "description": "Can create and edit content",
  "tier": "user"
}
```

#### `GET /api/permissions/profiles/:id`
Get a profile + its list of permission codes.

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Content Editor",
    "permissions": [{ "code": "content.write", "granted": true }]
  }
}
```

#### `PATCH /api/permissions/profiles/:id`
Update a profile's `name`, `description`, or `active` status.

#### `DELETE /api/permissions/profiles/:id`
Delete a profile. All user assignments to this profile are cascade-removed.

---

### Profile ↔ Permission Codes

#### `PUT /api/permissions/profiles/:id/codes/:code`
Add or update a permission code in a profile.

**Request Body**
```json
{ "granted": true }
```

#### `DELETE /api/permissions/profiles/:id/codes/:code`
Remove a permission code from a profile.

---

### User ↔ Profiles

#### `GET /api/permissions/users/:userId/profiles`
List all profiles currently assigned to a user.

#### `POST /api/permissions/users/:userId/profiles`
Assign a profile to a user.

**Request Body**
```json
{ "profileId": "uuid" }
```

#### `DELETE /api/permissions/users/:userId/profiles/:profileId`
Revoke a profile from a user.

---

### User Individual Overrides

An **Override** is a single permission code applied directly to one user — overrides what their profiles say.

#### `GET /api/permissions/users/:userId/overrides`
List a user's individual permission overrides.

**Response**
```json
{
  "success": true,
  "data": [{ "code": "content.delete", "granted": false }]
}
```

#### `PUT /api/permissions/users/:userId/overrides/:code`
Set an individual override for a user.

**Request Body**
```json
{ "granted": false }
```

> Setting `granted: false` explicitly **denies** a permission, even if the user's profile allows it.

#### `DELETE /api/permissions/users/:userId/overrides/:code`
Remove an override. The user falls back to their profile-based permissions.

---

## ⚠️ Error Responses

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "Insufficient permissions" }
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Validation error |
| `401` | Missing or expired token |
| `403` | Token valid but insufficient role/permissions |
| `404` | Resource not found |
| `500` | Server error |
