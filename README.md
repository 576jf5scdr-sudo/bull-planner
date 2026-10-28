# Bull Planner
Memecoin entry & exit planner web app. GitHub Pages serves `docs/` from `master`.
- `src/` React/TS source; build: `esbuild src/main.tsx --bundle --minify --format=iife --jsx=automatic --target=es2019 --define:process.env.NODE_ENV='"production"' --outfile=docs/app.js` (needs node_modules with react, react-dom, esbuild).
- `docs/picks.json` is refreshed by `/workspace/memecoin-scout/make_planner_app.py` (commit + push).
