# ProximaTrax

A web-based project management system for interior design and construction workflows. Built with Next.js, Supabase, and Tailwind CSS.

## Clone and run locally

```bash
git clone https://github.com/twtjosh/proximatrax.git
cd proximatrax
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app requires a Supabase backend and environment variables in `.env.local`. Copy `.env.example` and add your own project credentials from the [Supabase dashboard](https://supabase.com/dashboard).

## Architecture

ProximaTrax is a **Next.js App Router** app with route groups for public auth (`/(auth)`), the main workspace (`/(dashboard)`), and server **API routes** under `/api`. **Supabase** provides PostgreSQL, Auth (cookie sessions via `@supabase/ssr`), Realtime, and Storage. A **service layer** (`services/`) handles data access; **role-based middleware** (`proxy.ts`) sends each user to the right shell—Project Manager, Middleman, Client, or SuperAdmin—and blocks cross-role routes at the edge.

## Tech stack

- Next.js 16 (App Router)
- Supabase (PostgreSQL, Auth, Realtime, Storage)
- Tailwind CSS 4 + Shadcn/UI
- Zustand, @hello-pangea/dnd, Frappe Gantt

## License

MIT — see [LICENSE](LICENSE).
