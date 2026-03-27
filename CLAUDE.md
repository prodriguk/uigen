# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Build for production
npm run build

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Reset database
npm run db:reset
```

The dev server requires `NODE_OPTIONS="--require ./node-compat.cjs"` — this is handled by the npm scripts, so always use them rather than calling `next` directly.

## Architecture Overview

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude generates and iterates on the code; the result is previewed live in an iframe.

### Data Flow

1. **Chat submission** → `ChatContext` sends current file system state + messages to `POST /api/chat`
2. **Claude processes** → uses two tools: `str_replace_editor` (create/edit files) and `file_manager` (rename/delete)
3. **Tool calls streamed back** → `FileSystemContext` applies each tool call to the in-memory `VirtualFileSystem`
4. **Preview re-renders** → `PreviewFrame` transforms JSX via Babel + `@babel/standalone`, builds an import map pointing to `esm.sh` CDN, and renders inside an `<iframe>`
5. **Persistence** → after Claude finishes, `POST /api/chat` serializes the file system and chat history into the `Project` row (SQLite via Prisma)

### Virtual File System

All generated code lives in memory — nothing is written to disk. `VirtualFileSystem` (`src/lib/file-system.ts`) stores a tree of nodes. The full state is JSON-serialized into `Project.data` (a string column) for persistence. `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) wraps this and drives re-renders when files change.

### AI Provider

`src/lib/provider.ts` exports either a real Anthropic Claude Haiku 4.5 provider (when `ANTHROPIC_API_KEY` is set in `.env`) or a deterministic mock provider that returns pre-built component code. The mock lets the app run without an API key.

The system prompt is in `src/lib/prompts/generation.tsx`. Key constraints it enforces on Claude:
- Always create `/App.jsx` as the entry point
- Use Tailwind CSS, not inline styles
- Use `@/` import alias for non-library files

### Preview Rendering

`src/lib/transform/jsx-transformer.ts` handles the JSX → runnable JS pipeline:
- Transpiles with Babel
- Builds an ES module import map (resolving `@/` paths to virtual files, library imports to `esm.sh`)
- Injects Tailwind CSS via CDN
- Returns a complete HTML document for the iframe

### Authentication

JWT-based, stored in HTTP-only cookies. `src/lib/auth.ts` issues 7-day tokens. Server actions in `src/actions/index.ts` handle sign-up/sign-in/sign-out. Anonymous users can generate components without signing in; their work is tracked in localStorage and only persisted to the database after authentication.

### Database

SQLite (dev) via Prisma. Two models:
- `User` — email + bcrypt-hashed password
- `Project` — `messages` (JSON string) + `data` (JSON string of VFS state) + optional `userId`

Schema is the source of truth for all DB models: `prisma/schema.prisma`. Generated client goes to `src/generated/prisma/`.

## Key Conventions

- **Styling**: Tailwind CSS v4 throughout. shadcn/ui components (`new-york` style) in `src/components/ui/`.
- **Import alias**: `@/` maps to `src/`.
- **Server vs. client**: API routes and server actions handle DB access; contexts and hooks are client-side.
- **Testing**: Vitest + jsdom. Test files live in `__tests__/` directories next to the code they test.
- **Comments**: Use sparingly — only comment complex or non-obvious code.
- **Memory**: Whenever saving something to memory, also add it to this file.
