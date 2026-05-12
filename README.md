# 🏛️ Denolith

Denolith (Deno + Monolith) is a modern, high-performance, and type-safe
monolithic backend framework designed for enterprise-grade scalability. It
leverages the raw speed of Deno, the flexibility of Hono, and the type-safety of
Prisma ORM to provide an unparalleled developer experience.

## ✨ Features

- **🚀 Ultra-Fast Routing**: Powered by `Hono`, achieving incredible performance
  on Deno.
- **🛡️ 100% Type-Safe**: End-to-end type safety from the Database (Prisma) to
  the API layer (Valibot).
- **🏰 Enterprise Architecture**: Modular structure (`src/modules`) with a
  Lightweight Lazy DI Container (`src/core/container.ts`).
- **🔐 Granular RBAC & Permissions**: Built-in Role-Based Access Control
  (`OWNER`, `ADMIN`, `USER`) and granular permission parsing.
- **☁️ Background Workers**: Dedicated queue system and cronjobs running
  parallel to the main HTTP cycle.
- **⚡ Built-in Caching & Rate Limiting**: Redis-powered response caching and
  global rate limiting.
- **🚦 API Versioning**: Clean namespace separation (`/api/v1` for protected
  APIs, `/api/v0` for public APIs).
- **🗃️ Soft Delete & Audit Logs**: Safely recover deleted records and track all
  user actions via `AuditService`.
- **🛑 Graceful Shutdown**: Flawless handling of OS signals to cleanly drain
  connections without hanging the event loop.

## 🛠️ Technology Stack

- **Runtime**: [Deno 2.x](https://deno.land/)
- **API Framework**: [Hono](https://hono.dev/)
- **ORM**: [Prisma 7.x](https://www.prisma.io/) (with `@prisma/adapter-pg`)
- **Database**: PostgreSQL (pg)
- **Cache & Queue**: Redis
- **Validation**: [Valibot](https://valibot.dev/)

## 📂 Architecture & Directory Structure

```text
Denolith/
├── prisma/               # Prisma Schema, Migrations, and Seeders
├── src/
│   ├── core/             # Core utilities (Config, Logger, Container, DB, Redis, Queue, Cron)
│   ├── modules/          # Domain-driven modules (Self-contained business logic)
│   │   ├── auth/         # Authentication (Register, Login, Tokens)
│   │   ├── user/         # User Management (CRUD, Soft Delete)
│   │   ├── role/         # Role Definitions
│   │   └── permission/   # Granular Permission Policies
│   ├── shared/           # Cross-module shared resources
│   │   ├── errors/       # Global AppError definitions
│   │   ├── middlewares/  # Auth, Cache, RBAC, Validate-UUID
│   │   └── utils/        # Hash, Pagination, Sanitize, Validation
│   ├── app.router.ts     # Central Router & Lazy DI Injection
│   └── workers/          # Background worker processors
├── main.ts               # Application Entrypoint (Bootstrap)
└── deno.json             # Deno configurations & Tasks
```

### Dependency Injection (Lazy Singleton Container)

Denolith implements a 10/10 Lightweight Lazy DI Container in
`src/core/container.ts`. Services are never instantiated until they are
explicitly requested, saving memory and eliminating circular dependency crashes.

## 🚀 Getting Started

### 1. Prerequisites

- [Deno 2.x](https://deno.com/)
- PostgreSQL Server
- Redis Server (Optional but recommended, will fallback to memory if not found)

### 2. Environment Setup

Clone the `.env.example` file and configure your credentials:

```bash
cp .env.example .env
```

### 3. Database Migration

Apply the Prisma schema to your PostgreSQL database:

```bash
deno task prisma:generate
deno task migrate:dev
```

### 4. Run the Server

For local development with hot-reload:

```bash
deno task dev
```

For production execution:

```bash
deno task start
```

## 📜 Available Scripts

Run any of the following tasks using `deno task <script>`:

| Command           | Description                                                                      |
| ----------------- | -------------------------------------------------------------------------------- |
| `dev`             | Start the server in development mode with `--watch`.                             |
| `start`           | Start the server in production mode.                                             |
| `format`          | Run code formatter and linter (`deno fmt && deno lint`).                         |
| `prisma:generate` | Generate the Prisma Client types. **Run this every time you update the schema.** |
| `migrate:dev`     | Apply database migrations and update schema.                                     |
| `migrate:reset`   | Drop all data and reset the database schema.                                     |
| `seed`            | Seed the database with initial admin data.                                       |
| `compile`         | Compile Denolith into a standalone executable binary.                            |

## 💡 How to create a new Module?

Denolith follows a strict Modular Architecture. To add a new feature (e.g.,
`Product`):

1. **Schema**: Define the `Product` model in `prisma/schema`. Run
   `deno task prisma:generate`.
2. **Directory**: Create `src/modules/product`.
3. **Validation**: Create `product.validation.ts` using Valibot.
4. **Service**: Create `product.service.ts` encapsulating Prisma queries.
5. **Routes**: Create `product.routes.ts` defining endpoints and middlewares.
6. **Container**: Register the service in `src/core/container.ts`.
7. **Router**: Mount the router in `src/app.router.ts`.

## 🛡️ License

Proprietary / Closed Source.
