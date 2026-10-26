import { getTasks, addTask, updateTask, deleteTask } from "./db.js";

const form = document.getElementById("new-task");
const input = document.getElementById("title");
const list = document.getElementById("tasks");
const count = document.getElementById("count");

async function render() {
  const tasks = await getTasks();
  list.replaceChildren(...tasks.map(renderTask));
  const left = tasks.filter((t) => !t.done).length;
  count.textContent = tasks.length ? `${left} of ${tasks.length} left` : "No tasks yet";
}

function renderTask(task) {
  const li = document.createElement("li");
  li.className = task.done ? "done" : "";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = task.done;
  box.setAttribute("aria-label", `Mark "${task.title}" done`);
  box.addEventListener("change", async () => {
    await updateTask({ ...task, done: box.checked });
    render();
  });

  const title = document.createElement("span");
  title.textContent = task.title;

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "Delete";
  del.setAttribute("aria-label", `Delete "${task.title}"`);
  del.addEventListener("click", async () => {
    await deleteTask(task.id);
    render();
  });

  li.append(box, title, del);
  return li;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  await addTask(title);
  input.value = "";
  render();
});

render();
