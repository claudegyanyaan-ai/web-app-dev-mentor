let tasks = [];

const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-input');
const taskList = document.querySelector('#task-list');

function saveTasks() {
  localStorage.setItem('todo-tasks', JSON.stringify(tasks));
}

function loadTasks() {
  const saved = localStorage.getItem('todo-tasks');
  if (saved) {
    tasks = JSON.parse(saved);
  }
}

function renderTasks() {
  taskList.innerHTML = '';

  tasks.forEach(function (task, index) {
    const li = document.createElement('li');
    li.className = task.done ? 'done' : '';

    if (task.editing) {
      li.innerHTML = `
        <input type="text" class="edit-input" data-index="${index}" value="${task.text}">
        <button class="save-btn" data-index="${index}">Save</button>
      `;
    } else {
      li.innerHTML = `
        <input type="checkbox" class="toggle" data-index="${index}" ${task.done ? 'checked' : ''}>
        <span class="task-text">${task.text}</span>
        <button class="edit-btn" data-index="${index}">Edit</button>
        <button class="delete-btn" data-index="${index}">Delete</button>
      `;
    }

    taskList.appendChild(li);
  });
}

taskForm.addEventListener('submit', function (event) {
  event.preventDefault();

  const text = taskInput.value.trim();
  if (text === '') return;

  tasks.push({ text: text, done: false, editing: false });
  taskInput.value = '';

  renderTasks();
  saveTasks();
});

taskList.addEventListener('click', function (event) {
  const index = event.target.dataset.index;
  if (index === undefined) return;

  if (event.target.classList.contains('toggle')) {
    tasks[index].done = event.target.checked;
    renderTasks();
    saveTasks();
  }

  if (event.target.classList.contains('delete-btn')) {
    tasks.splice(index, 1);
    renderTasks();
    saveTasks();
  }

  if (event.target.classList.contains('edit-btn')) {
    tasks[index].editing = true;
    renderTasks();
  }

  if (event.target.classList.contains('save-btn')) {
    const input = document.querySelector(`.edit-input[data-index="${index}"]`);
    const newText = input.value.trim();
    if (newText !== '') {
      tasks[index].text = newText;
    }
    tasks[index].editing = false;
    renderTasks();
    saveTasks();
  }
});

loadTasks();
renderTasks();