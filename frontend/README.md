# Frontend structure

The active cafe application is built with Next.js. Start here when searching for or changing product code:

- `app/` — routes, page layouts, and page-specific UI
- `components/` — reusable React components and providers
- `lib/` — API clients and shared application utilities
- `store/` — client-side state stores
- `styles/` — global design system and shared CSS
- `public/` — static files such as logos and PWA assets

`legacy/vite/` contains the previous Vite application for reference only. It is not loaded by the Next.js application and should not be used for new feature work.
