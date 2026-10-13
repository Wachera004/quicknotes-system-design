const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.getElementById("load-btn");
const statusMsg = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");

// Global notes array state
let currentNotes = [];

// Helper function to update status box state & message
function setStatus(message, type = "normal") {
  statusMsg.textContent = message;
  statusMsg.className = "";
  if (type === "loading") statusMsg.classList.add("status-loading");
  if (type === "success") statusMsg.classList.add("status-success");
  if (type === "error") statusMsg.classList.add("status-error");
}

// Reusable async request function wrapping fetch with error handling
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP Error! Status: ${response.status}`);
  }
  return response;
}

// Render notes securely using textContent only
function renderNotes() {
  notesList.innerHTML = "";

  if (currentNotes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No notes available.";
    li.style.color = "#777";
    li.style.fontStyle = "italic";
    notesList.appendChild(li);
    return;
  }

  currentNotes.forEach((note) => {
    const li = document.createElement("li");
    li.className = "note-item";

    const contentDiv = document.createElement("div");
    contentDiv.className = "note-content";

    const h3 = document.createElement("h3");
    h3.textContent = note.title;

    const p = document.createElement("p");
    p.textContent = note.body;

    contentDiv.appendChild(h3);
    contentDiv.appendChild(p);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteNote(note.id, deleteBtn));

    li.appendChild(contentDiv);
    li.appendChild(deleteBtn);
    notesList.appendChild(li);
  });
}

// TASK 1: GET - Load 10 notes
async function loadNotes() {
  loadBtn.disabled = true;
  setStatus("Loading notes...", "loading");

  try {
    const response = await request(`${API_URL}?_limit=10`);
    currentNotes = await response.json();
    renderNotes();
    setStatus("Loaded 10 notes from the server.", "success");
  } catch (error) {
    setStatus(`Failed to load notes: ${error.message}`, "error");
  } finally {
    loadBtn.disabled = false;
  }
}

// TASK 2: POST - Create note with validation
async function handleCreateNote(e) {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validation: Title required, max 100 characters
  if (!title) {
    setStatus("Validation Error: Title is required.", "error");
    return;
  }
  if (title.length > 100) {
    setStatus("Validation Error: Title must be 100 characters or fewer.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Creating note...", "loading");

  try {
    const response = await request(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ title, body, userId: 1 }),
    });

    const newNote = await response.json();
    
    // Add new note to the top of the local array
    currentNotes.unshift(newNote);
    renderNotes();

    setStatus(`Note created (status ${response.status}, id ${newNote.id}).`, "success");
    
    // Clear form
    titleInput.value = "";
    bodyInput.value = "";
  } catch (error) {
    setStatus(`Failed to create note: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// TASK 3: DELETE - Remove note

async function deleteNote(id, deleteBtn) {
  deleteBtn.disabled = true;
  setStatus(`Deleting note ${id}...`, "loading");

  try {
    const response = await request(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    // JSONPlaceholder returns a successful DELETE but does not persist changes;
    // remove the note from this page's local state to keep the demo responsive.
    currentNotes = currentNotes.filter((note) => note.id !== id);
    renderNotes();
    setStatus(`Note ${id} deleted successfully (status ${response.status}).`, "success");
  } catch (error) {
    setStatus(`Failed to delete note: ${error.message}`, "error");
  } finally {
    deleteBtn.disabled = false;
  }
}

// Event Listeners
loadBtn.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", handleCreateNote);