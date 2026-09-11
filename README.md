# VendorHub API status

A small Angular dashboard that checks the VendorHub backend in `~/firstbackendproject/backend`.

| Environment | Backend          | What runs                                           |
| ----------- | ---------------- | --------------------------------------------------- |
| Dev         | `localhost:3001` | Read-only checks every 30 s, plus the full test     |
| Prod        | `localhost:3000` | Read-only checks every 30 s, nothing that writes    |

The full test only runs when you click it. It signs up a throwaway vendor, creates a store,
category and product, edits them, then deletes everything again.

## Views

- **Summary** shows both environments side by side: one pill per group, then only what needs
  attention. **Copy as Markdown** copies it, ready to paste into a PR or a message. Click any
  cell to open that group in Details.
- **Details** lists every endpoint for one environment, and is where you run the full test.

The page opens on whichever view you used last.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:4200. The dev server proxies `/dev/api` and `/prod/api` to the two
backends (see `proxy.conf.json`), so the backend doesn't need CORS.

## Where things live

- `src/app/environments.ts`: the environments and where they run
- `src/app/endpoints.ts`: every endpoint. Keep it in sync with the backend routes.
- `src/app/health-checks.ts`: the automatic read-only checks
- `src/app/full-test.ts`: the full test
- `src/app/status-board.ts`: owns every check and test, decides which result each endpoint shows,
  and builds the summary
- `src/app/summary.ts`: the Summary view
