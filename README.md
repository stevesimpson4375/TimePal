# TimePal

Talk about your day. TimePal turns rambling notes into a private, searchable timesheet — on this device only.

Nothing is uploaded. Notes, charge codes, and chat stay in your browser. There is no cloud model in the loop: TimePal parses what you type locally, matches it to your charge codes, and keeps a file you can search and export.

## What it does

- **Chat** — say what you actually did. TimePal pulls chargeable blocks and asks you to confirm them.
- **Codes** — add the real work items from your company’s time app, with keywords so notes can match them.
- **Week** — a grid you can copy or download as CSV and paste into the time app.
- **Search** — every ramble stays searchable. Export markdown or a JSON backup from the vault menu.
- **Life** — a quiet split of work vs. the rest of the week.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL. A sample week is loaded so you can look around; clear it from the vault menu when you want a blank book.

```bash
npm run typecheck
npm run build
```

## Privacy

Hours, notes, and charge codes live in `localStorage` under `timepal-vault-v1`. Export a JSON backup before wiping the vault or clearing site data.
