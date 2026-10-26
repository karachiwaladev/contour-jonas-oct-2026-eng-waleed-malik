# Todo app

A simple todo list that runs entirely in the browser. Tasks are stored in **IndexedDB**, the browser's
built-in client-side database, so they survive page reloads with no server.

Features: create a task, mark it done (checkbox), delete it.

## Run

ES modules don't load from `file://`, so serve the folder:

```
npx serve todo
```

Then open the printed URL (for example http://localhost:3000).

## Files

- `index.html`: the page
- `app.js`: UI: renders tasks and wires up add / done / delete
- `db.js`: IndexedDB wrapper (`getTasks`, `addTask`, `updateTask`, `deleteTask`)
- `styles.css`: styling
