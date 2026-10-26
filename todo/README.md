# Todo app

A simple todo list that runs entirely in the browser. Tasks are stored in **IndexedDB**, the browser's
built-in client-side database, so they survive page reloads with no server.

Features:
- Create a task with an optional **due date** and **tags** (comma-separated, e.g. `work, urgent`)
- Mark done (checkbox), edit due date/tags inline, delete
- Filter by status (**All / Active / Completed**, remembered across reloads) and by **tag** (click a chip;
  click again to clear). The two filters combine.
- Sorted by due date (soonest first, undated last); **overdue** tasks are highlighted red

## Run

ES modules don't load from `file://`, so serve the folder:

```
npx serve todo
```

Then open the printed URL (for example http://localhost:3000).

## Test

```
node --test todo/tasks.test.mjs
```

## Files

- `index.html`: the page
- `app.js`: UI: renders tasks, filters, inline editor; wires up events
- `tasks.js`: pure logic (normalize, parse tags, overdue, sort, filter), unit-tested
- `tasks.test.mjs`: unit tests for `tasks.js`
- `db.js`: IndexedDB wrapper (`getTasks`, `addTask`, `updateTask`, `deleteTask`)
- `styles.css`: styling
- `package.json`: marks the folder as ES modules so Node can run the tests
- `screenshots/`: browser verification screenshots attached to tickets
