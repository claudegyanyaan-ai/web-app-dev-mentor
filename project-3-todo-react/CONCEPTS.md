# Concepts — Project 3: To-Do App in React/Next.js

Plain-English notes on every new concept this project introduced. Builds directly on
Project 2's CONCEPTS.md - read that first if concepts here feel unfamiliar.

## 1. Components
A component is just a JavaScript function that returns what should appear on screen. Instead
of one big HTML file, the UI is broken into small, reusable, named pieces:
`TaskItem` (one task row), `TaskList` (loops over all tasks), `AddTaskForm` (the input + Add
button). Each is independent and can be reused - `TaskItem` gets called once per task, with
different data each time, instead of copy-pasting HTML.

## 2. JSX
JSX looks like HTML but is actually JavaScript. It gets transformed into real DOM elements
behind the scenes. Key differences from plain HTML: `className` instead of `class` (since
`class` is a reserved word in JS), and you can drop live JavaScript values directly into
markup using `{...}`, e.g. `{task.text}`.

## 3. Props
Props are how data flows INTO a component. `TaskItem({ task, onToggle, onDelete })` doesn't
know or care what a specific task's text is, or how toggling/deleting actually works - it
just receives that information from whoever uses `<TaskItem />`. This is what makes
components reusable: same component, different data/behavior each time.

## 4. useState
React's tool for data that changes over time and needs to trigger a re-render when it does.
`const [tasks, setTasks] = useState([])` gives you the current value (`tasks`) and a function
to update it (`setTasks`). Calling `setTasks(...)` automatically re-renders anything that
depends on `tasks` - no manual `renderTasks()` call needed, unlike Project 2.

## 5. Never mutate state directly
React needs a brand NEW array/object reference to notice something changed. So instead of
`tasks.push(newTask)` (which changes the existing array in place), we write
`setTasks([...tasks, newTask])` - the `...tasks` spread copies all existing items into a
new array, then adds the new one. Same idea for toggle (`.map()` to build a new array with
one item replaced) and delete (`.filter()` to build a new array with one item excluded).

## 6. useEffect
React's tool for "do something extra, outside of just rendering" - usually to sync with
something outside React, like localStorage. Takes a function and a dependency array:
- `useEffect(fn, [])` - dependency array is empty, so it runs ONCE, right when the
  component first loads. Used here to load saved tasks from localStorage on startup.
- `useEffect(fn, [tasks, loaded])` - re-runs every time `tasks` or `loaded` changes. Used
  here to save to localStorage every time the task list changes.
- The `loaded` flag exists to prevent a save-effect from firing with an empty array before
  the load-effect has finished reading from storage (which would silently wipe saved data).

## 7. "use client"
Next.js tries to render components on the server by default (a performance optimization).
Anything using state or event handlers (`useState`, `onClick`, etc.) needs to run in the
browser instead, so it must be marked `"use client"` at the top of the file.

## 8. The build step
Unlike Projects 1-2 (plain files served as-is), Next.js projects need to be BUILT
(`npm run build`) before deployment - JSX and JS get compiled/bundled into files the browser
can run. This is why `npm run dev` exists for local development (live-reloading, no build
needed) versus what actually happens on Vercel (a real production build).

## 9. Case-sensitivity bug (Windows vs. Linux)
Locally, a folder named `Components` (capital C) worked fine even though the import
statements used lowercase `components` - Windows' filesystem doesn't distinguish the two.
But Vercel builds on Linux, which DOES treat `Components` and `components` as different
folders, so the import failed there with `Module not found`. Fixed via a two-step
`git mv` rename (Components -> components_temp -> components) - a trick needed because a
direct case-only rename is often silently ignored by Git on Windows. Lesson: code that
works locally isn't guaranteed to work identically once deployed to a different OS.
