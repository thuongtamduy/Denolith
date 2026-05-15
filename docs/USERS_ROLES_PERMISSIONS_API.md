# 👥 Users, Roles & Permissions API — Frontend Integration Guide

Base URL: `http://localhost:9999`

> **Auth Required:** All endpoints in this guide require a valid `accessToken`
> in the `Authorization: Bearer <token>` header, unless noted otherwise.

---

## 🔐 1. Access Control Overview & Architecture

Denolith uses an enterprise-grade **Hybrid Access Control System** combining
**Role-Based Access Control (RBAC)** and **Attribute-Based Access Control (ABAC
Overrides)**.

```
OWNER  → Bypasses all permission checks. Absolute control.
ADMIN  → Access to admin-level routes. Specific actions require explicit permissions.
USER   → Access to regular routes. Promoted by ADMIN.
```

### 1.1. How Permissions Are Resolved (Precedence Engine)

```
Request → Auth Middleware (JWT verify + Redis status check)
  ↓
Role Middleware (requireRole) → checks tier (owner / admin / user)
  ↓
Permission Middleware (requirePermission) → checks specific permission codes
  - OWNER: auto-pass
  - Others: Precedence Engine resolves Profile Permissions (RBAC) + Individual Overrides (ABAC)
```

**Precedence Engine Rule:** Individual Overrides (ABAC) have absolute priority
over Profile Permissions (RBAC). If an override grants a permission
(`granted: true`), it is completely removed from the `denied` list and added to
`granted`.

### 1.2. Record-level Provenance (7 Standard Tracking Fields)

Every core model (`User`, `Role`, `Permission`, `PermissionProfile`)
automatically tracks 7 provenance fields at the database level:

- `createdAt`: Timestamp of creation.
- `createdBy`: UUID of the actor who created the record (injected automatically
  via AsyncLocalStorage).
- `updatedAt`: Timestamp of last update.
- `updatedBy`: UUID of the actor who updated the record.
- `deleted`: Soft-delete status flag.
- `deletedAt`: Timestamp of deletion.
- `deletedBy`: UUID of the actor who deleted the record.

---

## 🛡️ 2. Authentication & Revocation Trap (Token Security)

Denolith implements **Refresh Token Rotation** with an advanced **Revocation
Trap (Token Family Invalidation)** to protect against Replay Attacks and token
theft.

### Endpoints

- `POST /auth/login`: Returns `accessToken` and `refreshToken` in JSON body and
  `Set-Cookie` (path: `/`).
- `POST /v1/auth/refresh`: Consumes old refresh token (marks as
  `revokedAt = now()`) and issues a new token pair. Supports reading token from
  cookie or JSON body (`{ "refreshToken": "..." }`).
- `POST /v1/auth/logout`: Revokes current sessions.

### 🚨 Revocation Trap Mechanism

If an attacker steals a consumed/revoked `refreshToken` and attempts to use it,
the system detects token reuse immediately. The **Kill Switch** activates:

1. Entire token family is purged (`deleteMany` active sessions for that user).
2. Security breach audit log (`auth.security_compromised`) is recorded.
3. Returns `401 Unauthorized` alerting the user to log in again.

---

## 👤 3. Users API

### 🌟 3.1. Current User Breakdown — `/v1/users/me`

Returns the currently logged-in user profile along with their **complete
permission resolution picture**. Frontend only needs to check the
`permissions.granted` list to dynamically show/hide UI components.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "dd6c797d-f03c-49ec-8545-971ae552dc51",
      "username": "user1",
      "email": "user1@denolith.dev",
      "roleCode": "user",
      "active": true,
      "displayName": "User One",
      "avatar": null,
      "dateOfBirth": null,
      "gender": "male",
      "bio": null,
      "phone": null,
      "phoneVerified": false,
      "emailVerified": true,
      "address": null,
      "city": null,
      "country": null,
      "lastLoginAt": "2026-05-14T14:16:16.159Z",
      "lastLoginIp": "unknown",
      "createdAt": "2026-05-14T13:55:02.522Z",
      "createdBy": null,
      "updatedAt": "2026-05-14T14:16:16.159Z",
      "updatedBy": null,
      "deleted": false,
      "deletedAt": null,
      "deletedBy": null,
      "role": {
        "tier": "user"
      }
    },
    "permissions": {
      "granted": [
        "users.read",
        "reports.view"
      ],
      "denied": [
        "reports.export"
      ],
      "details": {
        "tier": "user",
        "role": "user",
        "profiles": [
          {
            "id": "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5",
            "name": "Sales Representative"
          }
        ],
        "overrides": [
          {
            "permissionCode": "reports.export",
            "granted": false
          }
        ]
      }
    }
  }
}
```

---

### 3.2. Admin Management Routes — `/v1/users` _(requires: `admin` tier)_

#### `GET /v1/users`

List active users (paginated). **Query Params:** `page` (default: 1), `limit`
(default: 20)

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "id": "dd6c797d-f03c-49ec-8545-971ae552dc51",
      "username": "user1",
      "email": "user1@denolith.dev",
      "roleCode": "user",
      "active": true,
      "displayName": "User One",
      "gender": "male",
      "createdAt": "2026-05-14T13:55:02.522Z",
      "updatedAt": "2026-05-14T14:16:16.159Z",
      "role": {
        "tier": "user"
      }
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### `GET /v1/users/:id`

Get single user details.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "dd6c797d-f03c-49ec-8545-971ae552dc51",
    "username": "user1",
    "email": "user1@denolith.dev",
    "roleCode": "user",
    "active": true,
    "firstName": "Nguyễn",
    "lastName": "Văn A",
    "displayName": "User One",
    "gender": "male",
    "phone": "0623731065",
    "phoneVerified": false,
    "emailVerified": true,
    "createdAt": "2026-05-14T13:55:02.522Z",
    "createdBy": null,
    "updatedAt": "2026-05-14T14:16:16.159Z",
    "updatedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
    "deleted": false,
    "deletedAt": null,
    "deletedBy": null,
    "role": {
      "tier": "user"
    }
  }
}
```

---

#### `POST /v1/users`

Create new user.

**Request Body**

```json
{
  "username": "datnguyen",
  "email": "dat@example.com",
  "password": "Password123",
  "phone": "0623731065",
  "roleCode": "user",
  "firstName": "Dat",
  "lastName": "Nguyen",
  "displayName": "Dat Nguyen",
  "gender": "male",
  "bio": "Software Engineer"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "data": {
    "id": "e4b2d398-356a-493e-9f32-72123ab491a1",
    "username": "datnguyen",
    "email": "dat@example.com",
    "roleCode": "user",
    "active": true,
    "firstName": "Dat",
    "lastName": "Nguyen",
    "displayName": "Dat Nguyen",
    "gender": "male",
    "phone": "0623731065",
    "createdAt": "2026-05-14T14:30:00.000Z",
    "createdBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
    "updatedAt": "2026-05-14T14:30:00.000Z",
    "updatedBy": null,
    "deleted": false,
    "role": {
      "tier": "user"
    }
  }
}
```

---

#### `PATCH /v1/users/:id`

Partially update user info.

**Request Body**

```json
{
  "firstName": "Dat Updated",
  "active": false
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "e4b2d398-356a-493e-9f32-72123ab491a1",
    "username": "datnguyen",
    "email": "dat@example.com",
    "roleCode": "user",
    "active": false,
    "firstName": "Dat Updated",
    "lastName": "Nguyen",
    "displayName": "Dat Nguyen",
    "updatedAt": "2026-05-14T14:35:00.000Z",
    "updatedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
    "deleted": false
  }
}
```

---

#### `PATCH /v1/users/:id/role` _(requires: `permissions.manage`)_

Change user role.

**Request Body**

```json
{
  "role": "admin"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "e4b2d398-356a-493e-9f32-72123ab491a1",
    "username": "datnguyen",
    "email": "dat@example.com",
    "roleCode": "admin",
    "updatedAt": "2026-05-14T14:36:00.000Z",
    "updatedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
    "role": {
      "tier": "admin"
    }
  }
}
```

---

#### `DELETE /v1/users/:id`

Soft-delete user (`?force=true` for hard delete).

**Response `200 OK` (Soft Delete)**

```json
{
  "success": true,
  "message": "User has been soft-deleted and can be restored."
}
```

_(Hard delete with `?force=true` returns `204 No Content` with an empty body)._

---

#### `POST /v1/users/:id/restore`

Restore soft-deleted user.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "User 'datnguyen' has been restored successfully.",
  "data": {
    "id": "e4b2d398-356a-493e-9f32-72123ab491a1",
    "username": "datnguyen",
    "deleted": false,
    "deletedAt": null,
    "deletedBy": null
  }
}
```

---

## 🏷️ 4. Roles API

All role endpoints require: **`permissions.manage`** permission.

Base: `/v1/roles`

#### `GET /v1/roles`

List all roles. Response includes provenance tracking fields.

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "code": "admin",
      "tier": "admin",
      "name": "Administrator",
      "description": "System administrator with full management access",
      "icon": "shield",
      "sortOrder": 1,
      "system": true,
      "active": true,
      "createdAt": "2026-05-14T13:55:00.000Z",
      "createdBy": null,
      "updatedAt": "2026-05-14T13:55:00.000Z",
      "updatedBy": null,
      "deleted": false,
      "deletedAt": null,
      "deletedBy": null
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### `POST /v1/roles`

Create custom role.

**Request Body**

```json
{
  "code": "moderator",
  "name": "Moderator",
  "description": "Can moderate content",
  "tier": "user"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "data": {
    "code": "moderator",
    "tier": "user",
    "name": "Moderator",
    "description": "Can moderate content",
    "system": false,
    "active": true,
    "createdAt": "2026-05-14T14:40:00.000Z",
    "createdBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
    "updatedAt": "2026-05-14T14:40:00.000Z",
    "updatedBy": null,
    "deleted": false
  }
}
```

---

#### `PATCH /v1/roles/:code`

Update role info (`name`, `description`, `active`).

**Request Body**

```json
{
  "name": "Community Moderator",
  "active": true
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "code": "moderator",
    "name": "Community Moderator",
    "description": "Can moderate content",
    "system": false,
    "active": true,
    "updatedAt": "2026-05-14T14:45:00.000Z",
    "updatedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5"
  }
}
```

---

#### `DELETE /v1/roles/:code`

Delete custom role.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Role 'moderator' deleted successfully."
}
```

---

## 🔑 5. Permissions API

All permission endpoints require: **`permissions.manage`** permission.

Base: `/v1/permissions`

### 5.1. Atomic Permissions

#### `GET /v1/permissions`

List all available atomic permission codes in the system.

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "id": "f5123d1a-493e-456b-a123-83214560a911",
      "code": "users.read",
      "module": "users",
      "description": "View user profiles",
      "active": true,
      "createdAt": "2026-05-14T13:55:00.000Z",
      "createdBy": null,
      "updatedAt": "2026-05-14T13:55:00.000Z",
      "updatedBy": null
    }
  ]
}
```

---

### 5.2. Permission Profiles (RBAC)

A **Permission Profile** is a reusable bundle of permissions assigned to users.

#### `GET /v1/permissions/profiles`

List profiles (filter with `?tier=admin` or `?tier=user`). Includes provenance
fields.

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "id": "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5",
      "name": "Sales Representative",
      "tier": "user",
      "description": "Standard access for sales team",
      "active": true,
      "createdAt": "2026-05-14T13:55:00.000Z",
      "createdBy": null,
      "updatedAt": "2026-05-14T13:55:00.000Z",
      "updatedBy": null
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### `POST /v1/permissions/profiles`

Create profile.

**Request Body**

```json
{
  "name": "Content Editor",
  "tier": "user",
  "description": "Can create and edit content"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "name": "Content Editor",
    "tier": "user",
    "description": "Can create and edit content",
    "active": true,
    "createdAt": "2026-05-14T14:50:00.000Z",
    "createdBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
    "updatedAt": "2026-05-14T14:50:00.000Z",
    "updatedBy": null
  }
}
```

---

#### `GET /v1/permissions/profiles/:id`

Get profile + assigned permission codes.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5",
    "name": "Sales Representative",
    "tier": "user",
    "description": "Standard access for sales team",
    "active": true,
    "createdAt": "2026-05-14T13:55:00.000Z",
    "updatedAt": "2026-05-14T13:55:00.000Z",
    "permissions": [
      {
        "permissionCode": "reports.view",
        "granted": true
      }
    ]
  }
}
```

---

#### `PATCH /v1/permissions/profiles/:id`

Update profile info.

**Request Body**

```json
{
  "name": "Senior Sales Rep",
  "active": true
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5",
    "name": "Senior Sales Rep",
    "tier": "user",
    "active": true,
    "updatedAt": "2026-05-14T14:55:00.000Z",
    "updatedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5"
  }
}
```

---

#### `DELETE /v1/permissions/profiles/:id`

Delete profile.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Permission profile deleted successfully."
}
```

---

### 5.3. Profile ↔ Permission Assignments

#### `PUT /v1/permissions/profiles/:id/codes/:code`

Grant or update permission in profile.

**Request Body**

```json
{
  "granted": true
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Permission 'reports.export' updated for profile."
}
```

---

#### `DELETE /v1/permissions/profiles/:id/codes/:code`

Remove permission from profile.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Permission 'reports.export' removed from profile."
}
```

---

### 5.4. User ↔ Profile Assignments

#### `GET /v1/permissions/users/:userId/profiles`

List profiles assigned to user.

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "userId": "dd6c797d-f03c-49ec-8545-971ae552dc51",
      "profileId": "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5",
      "assignedAt": "2026-05-14T13:55:00.000Z",
      "assignedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
      "profile": {
        "name": "Sales Representative",
        "tier": "user"
      }
    }
  ]
}
```

---

#### `POST /v1/permissions/users/:userId/profiles`

Assign profile to user.

**Request Body**

```json
{
  "profileId": "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Profile assigned successfully."
}
```

---

#### `DELETE /v1/permissions/users/:userId/profiles/:profileId`

Revoke profile from user.

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Profile revoked successfully."
}
```

---

### 5.5. User Individual Overrides (ABAC Overrides)

An **Override** applies directly to a user, overriding their profile
permissions.

#### `GET /v1/permissions/users/:userId/overrides`

List user individual overrides.

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "userId": "dd6c797d-f03c-49ec-8545-971ae552dc51",
      "permissionCode": "reports.export",
      "granted": false,
      "assignedAt": "2026-05-14T13:55:00.000Z",
      "assignedBy": "37361be2-2510-4a7a-8b0c-8f35e8b338e5",
      "permission": {
        "description": "Export reports data",
        "module": "reports"
      }
    }
  ]
}
```

---

#### `PUT /v1/permissions/users/:userId/overrides/:code`

Set individual override.

**Request Body**

```json
{
  "granted": false
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Override for 'reports.export' set successfully."
}
```

---

#### `DELETE /v1/permissions/users/:userId/overrides/:code`

Remove override (falls back to profile permissions).

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Override removed successfully."
}
```

---

## ⚠️ 6. Error Responses

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "Insufficient permissions" }
}
```

| HTTP Status | Meaning                                       |
| ----------- | --------------------------------------------- |
| `400`       | Validation error                              |
| `401`       | Missing, expired, or revoked token            |
| `403`       | Token valid but insufficient role/permissions |
| `404`       | Resource not found                            |
| `500`       | Internal server error                         |
