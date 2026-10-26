# Todo app

A simple todo list that runs entirely in the browser. Tasks are stored in **IndexedDB**, the browser's
built-in client-side database, so they survive page reloads with no server.

Features:
- Create a task with an optional **due date** and **tags** (comma-separated, e.g. `work, urgent`)
- Mark done (checkbox), edit due date/tags inline, delete
- Filter by status (**All / Active / Completed**, remembered across reloads) and by **tag** (click a chip;
  click again to clear). The two filters combine.
- Sorted by due date (soonest first, undated last); **overdue** tasks are highlighted red
- **Recurring tasks**: repeat daily, weekly, monthly or every N days. Ticking one done keeps it as
  history and adds the next copy, dated from the due date (skipping ahead if you finished late).
  Monthly keeps its day (31st → last day of shorter months). Set Repeat to "Doesn't repeat" to stop.

## Run

ES modules don't load from `file://`, so serve the folder:

```
npx serve todo
```

Then open the printed URL (for example http://localhost:3000).

## Test

```
cd todo
npm install        # test-only: jsdom (fake page), fake-indexeddb (fake browser database), Stryker
npm test
npm run coverage
npm run mutation   # Stryker: mutates the code, checks the tests catch it (~13 min); report in reports/mutation/
```

## Files

- `index.html`: the page
- `app.js`: app state and event wiring
- `render.js`: builds the task rows, inline editor and repeat picker (DOM only)
- `tasks.js`: pure task logic (normalize, tags, overdue, sort, filter, next occurrence), unit-tested
- `recurrence.js`: pure date maths for repeats (next date, skip-ahead, month ends), unit-tested
- `tasks.test.mjs`, `recurrence.test.mjs`: unit tests for the pure logic
- `db.test.mjs`, `render.test.mjs`, `app.test.mjs`: storage, DOM building and whole-page tests (jsdom + fake-indexeddb)
- `test-dom.mjs`: test helper that sets up the fake page
- `stryker.config.json`: mutation-testing config
- `db.js`: IndexedDB wrapper (`getTasks`, `addTask`, `updateTask`, `deleteTask`)
- `styles.css`: styling
- `package.json`: ES modules, test scripts, test-only dependencies
- `screenshots/`: browser verification screenshots attached to tickets
