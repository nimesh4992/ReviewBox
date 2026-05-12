# ReviewIQ

AI App Review Intelligence Platform for Google Play review operations.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand
- React Query
- Supabase client
- PostgreSQL-ready service boundary
- Lucide Icons

## Setup Commands

```bash
npm install
npm run dev
```

Windows PowerShell may need the npm command shim:

```powershell
npm.cmd install
npm.cmd run dev
```

## Package Installation

Core app dependencies:

```bash
npm install next@15 react@19 react-dom@19 zustand @tanstack/react-query @supabase/supabase-js lucide-react
npm install class-variance-authority clsx tailwind-merge tw-animate-css
npm install -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next tailwindcss @tailwindcss/postcss postcss autoprefixer
```

## shadcn/ui Setup

The project is configured with `components.json` and shadcn components live in `src/components/ui`.

```bash
npx shadcn@latest add button card table dropdown-menu tabs dialog input tooltip sheet badge skeleton
```

## Structure

```txt
src/
  app/                  App Router pages and route groups
  components/           shared layout, providers, and shadcn/ui primitives
  features/             domain features: dashboard, reviews, incidents, releases, settings
  hooks/                React Query and UI hooks
  lib/                  shared utilities
  services/             Supabase and data service boundaries
  store/                Zustand workspace state
  types/                shared TypeScript domain types
  utils/                formatting helpers
```

## Routes

- `/dashboard`
- `/reviews`
- `/incidents`
- `/releases`
- `/settings`

## Supabase

Copy `.env.example` and provide:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
