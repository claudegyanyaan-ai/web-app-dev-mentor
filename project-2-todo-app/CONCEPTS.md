# Concepts — Project 2: Interactive To-Do App

Plain-English notes on every new concept this project introduced. Project 1's CONCEPTS.md
covers the HTML/CSS basics; this file only covers what's NEW here.

## 1. State
"State" just means: the data your app is currently holding, kept in a JS variable while the
page is open. Here it's a plain array of task objects:
```js
let tasks = [
  { text: "Buy milk", done: false, editing: false },
  ...
];
```
Everything the user sees on screen is a reflection of what's inside this array. Change the
array → re-draw the screen. This is the core idea frameworks like React are built around later.

## 2. Render-by-rebuild
Instead of hand-editing individual list items, `renderTasks()` wipes the whole list
(`taskList.innerHTML = ''`) and rebuilds it from scratch off the `tasks` array every single
time something changes. Simple to reason about (screen always matches data) but has a
side-effect: any event listener attached directly to an old `<li>` gets destroyed along with
it. That's *why* event delegation (next section) was needed.

## 3. Event delegation
Instead of attaching a click listener to every single Edit/Delete/checkbox (which would break
every time the list re-renders), we attach ONE listener to the parent `<ul id="task-list">`.
Clicks bubble up from the child that was actually clicked to the parent, and we inspect
`event.target` to figure out which button was clicked and which task it belongs to (via a
`data-index` attribute). One listener, works forever, survives re-renders.

## 4. `data-*` attributes
Custom attributes like `data-index="2"` let you stash small bits of information directly on
an HTML element, readable in JS via `element.dataset.index`. Used here to tag every task's
row/buttons with *which* task in the array they correspond to.

## 5. Template literals
Backtick strings like `` `<li>${task.text}</li>` `` let you build HTML as text, dropping JS
values directly in with `${...}`. This is how `renderTasks()` generates the list markup
from the `tasks` array on every render.

## 6. localStorage + JSON
`localStorage` is a small key-value store built into the browser that survives page
refreshes and browser restarts (until manually cleared). It only stores strings, so:
- `saveTasks()`: `JSON.stringify(tasks)` turns the array into a string, saved under one key.
- `loadTasks()`: `JSON.parse(...)` turns that string back into a real array on page load.

## 7. The `prompt()` bug (embedded-browser limitation)
The first version of "Edit" used `window.prompt(...)`, a native browser popup. It threw
`Uncaught Error: prompt() is not supported` — not a code bug, but a *limitation of the preview
environment* (an embedded VS Code webview), which disables native dialogs for security
reasons. Fixed by building the edit UI ourselves: an `editing` boolean on each task object
flips `renderTasks()` between showing normal buttons or an inline `<input>` + Save button.
Lesson: not every red error is your code's fault — sometimes it's the environment.

## 8. `event.preventDefault()`
Submitting a `<form>` normally reloads the page. Since we handle the add-task logic in JS,
`preventDefault()` on the submit event stops that default reload so the page stays put and
our own logic runs instead.
