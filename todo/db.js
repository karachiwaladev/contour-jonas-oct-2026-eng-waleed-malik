// IndexedDB wrapper: tasks live in the browser, no server.
const DB_NAME = "todo-app";
const STORE = "tasks";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getTasks = () => run("readonly", (s) => s.getAll());
export const addTask = (fields) =>
  run("readwrite", (s) => s.add({ done: false, dueDate: null, tags: [], repeat: null, createdAt: Date.now(), ...fields }));
export const updateTask = (task) => run("readwrite", (s) => s.put(task));
export const deleteTask = (id) => run("readwrite", (s) => s.delete(id));
