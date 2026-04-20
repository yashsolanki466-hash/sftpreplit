# replit.md

## Overview

This is a secure file transfer and project management application called "rest-express". It provides FTP/SFTP connectivity for clients to access, browse, and download files from remote servers. The application features a React frontend with a dashboard interface, project organization, file management, audit logging, and download tracking. It's designed for scenarios where users need secure access to file servers with proper authentication and activity monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Animations**: Framer Motion for page transitions and UI animations
- **Charts**: Recharts for analytics visualizations

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for development, esbuild for production bundling
- **API Design**: RESTful endpoints with Zod schema validation defined in `shared/routes.ts`
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)

### Authentication System
- **Primary Auth**: Replit Auth integration using OpenID Connect
- **Secondary Auth**: FTP/SFTP credential-based connections for file server access
- **Session Storage**: PostgreSQL-backed sessions with passport.js

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` for all database tables
- **Models**: Users, sessions, projects, files, audit logs, downloads
- **Migrations**: Drizzle Kit for schema migrations (`drizzle-kit push`)

### File Transfer Services
- **FTP Client**: basic-ftp package for FTP connections
- **SFTP Client**: ssh2-sftp-client for secure SFTP connections
- **Connection Management**: Session-based connection pooling in `server/ftp-service.ts`

### Project Structure
```
client/           # React frontend (Vite)
  src/
    components/   # UI components including shadcn/ui
    pages/        # Route page components
    hooks/        # Custom React hooks for data fetching
    lib/          # Utilities and query client setup
server/           # Express backend
  replit_integrations/  # Replit Auth setup
shared/           # Shared types, schemas, and route definitions
  models/         # Database models (auth)
  schema.ts       # Drizzle schema definitions
  routes.ts       # API route contracts with Zod validation
```

### Key Design Decisions
1. **Shared Route Contracts**: API routes are defined once in `shared/routes.ts` with Zod schemas, ensuring type safety between frontend and backend
2. **Connection-Based Auth**: Users connect via FTP/SFTP credentials rather than traditional app accounts, with connection state tracked per session
3. **Monorepo Structure**: Frontend and backend share code through the `shared/` directory with TypeScript path aliases
4. **Production Build**: Server bundles common dependencies to reduce cold start times while keeping large/native deps external

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Required Tables**: users, sessions, projects, files, audit_logs, downloads

### Authentication Services
- **Replit Auth**: OpenID Connect provider at `https://replit.com/oidc`
- **Required Env Vars**: `REPL_ID`, `ISSUER_URL`, `SESSION_SECRET`

### File Transfer Protocols
- **FTP/FTPS**: Standard FTP with optional TLS via basic-ftp
- **SFTP**: SSH-based file transfer via ssh2-sftp-client

### Frontend Libraries
- **Google Fonts**: Outfit, Plus Jakarta Sans, DM Sans, Fira Code, Geist Mono
- **Icon Library**: Lucide React

### Build Tools
- **Vite Plugins**: @replit/vite-plugin-runtime-error-modal, cartographer (dev), dev-banner (dev)