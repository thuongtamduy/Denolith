# 🔐 Auth API — Frontend Integration Guide

Base URL: `http://localhost:9999`

> **Rate Limit:** Register and login endpoints are capped at **10 requests / 5
> minutes** per IP to prevent brute-force attacks.

---

## 🍪 How the `refresh_token` Cookie Works

On every `login`, `register`, and `refresh` call, the server automatically sets
this cookie:

```http
Set-Cookie: refresh_token=<token>;
  HttpOnly;
  Path=/;
  Max-Age=604800;
  SameSite=Lax (dev) | SameSite=None; Secure (prod)
```

| Flag             | Value           | Why                                                                                                                      |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `HttpOnly`       | Always          | JavaScript **cannot** read this cookie via `document.cookie`. Prevents XSS token theft.                                  |
| `Secure`         | Production only | Cookie is only sent over HTTPS. Off in dev so localhost works.                                                           |
| `SameSite=Lax`   | Development     | Allows cross-page navigation but blocks third-party requests.                                                            |
| `SameSite=None`  | Production      | Required when your frontend and API are on different domains (e.g. `app.com` → `api.com`). Must be paired with `Secure`. |
| `Path=/`         | Always          | The cookie is sent to both public auth routes (`/auth/*`) and private auth routes (`/v1/auth/*`).                        |
| `Max-Age=604800` | 7 days          | Cookie lifetime in seconds.                                                                                              |

> **Summary:** You never manually read or set this cookie. Just call the API
> with `credentials: 'include'` and the browser handles everything
> automatically.

---

## 🔑 How Authentication Works

Denolith uses a **dual-token** strategy:

- **`accessToken`** — Short-lived JWT returned in the response body. Store it
  **in-memory** (a JavaScript variable). Send with every protected request in
  the `Authorization` header.
- **`refresh_token`** — Long-lived token (7 days). Automatically stored in an
  `httpOnly` cookie by the server. The frontend never touches it directly — just
  call `/v1/auth/refresh` and the browser sends it automatically.

```
Login → get accessToken + refresh_token (cookie)
         ↓
Use accessToken on every API request (in-memory)
         ↓
accessToken expires? → call /v1/auth/refresh → get new accessToken
         ↓
User logs out → call /v1/auth/logout → both tokens invalidated
```

---

## Endpoints

### `POST /auth/register`

Register a new user account.

**Request Body**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "secret123"
}
```

| Field      | Type     | Rules                                   |
| ---------- | -------- | --------------------------------------- |
| `username` | `string` | 3–50 chars, letters/numbers/spaces only |
| `email`    | `string` | Valid email, max 255 chars              |
| `password` | `string` | 6–100 chars                             |

**Response `201 Created`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "roleCode": "user",
      "active": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

> Also sets `Set-Cookie: refresh_token=...; HttpOnly; Path=/`

---

### `POST /auth/login`

Authenticate and get tokens.

**Request Body**

```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "john_doe", "roleCode": "user" },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

> Also sets `Set-Cookie: refresh_token=...; HttpOnly; Path=/`

---

### `POST /v1/auth/refresh`

Get a new `accessToken` using the `refresh_token` cookie. No request body
needed.

The browser sends the cookie automatically when `credentials: 'include'` is set.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

> Also rotates the `refresh_token` cookie with a fresh 7-day TTL.

---

### `POST /v1/auth/logout`

Invalidates both the `accessToken` (server-side blacklist) and clears the
`refresh_token` cookie.

**Request Headers**

```http
Authorization: Bearer <accessToken>
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 📌 Frontend Usage Tips

### Sending the Access Token

```javascript
fetch("/v1/users", {
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  credentials: "include", // Required for the refresh_token cookie
});
```

### Auto Token Refresh (Recommended Pattern)

```javascript
async function apiCall(url, options) {
  let res = await fetch(url, { ...options, credentials: "include" });

  if (res.status === 401) {
    const refresh = await fetch("/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (refresh.ok) {
      const { data } = await refresh.json();
      accessToken = data.accessToken; // update in-memory token

      // Retry original request
      res = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          ...options.headers,
          "Authorization": `Bearer ${accessToken}`,
        },
      });
    } else {
      // refresh_token expired → force re-login
      window.location.href = "/login";
    }
  }

  return res;
}
```

### CORS Notes

- Always use `credentials: 'include'` — required for the `refresh_token` cookie.
- The server only accepts requests from the origin set in `FRONTEND_URL` env
  var.

---

## ⚠️ Error Responses

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  }
}
```

| HTTP Status | Meaning                              |
| ----------- | ------------------------------------ |
| `400`       | Validation error                     |
| `401`       | Invalid credentials or token expired |
| `429`       | Rate limit hit — wait 15 minutes     |
| `500`       | Server error                         |
