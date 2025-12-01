// profile.js
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
// If you want to use getChildren later, you can uncomment this import.
// import { getChildren } from "./helpers.js";

let personId = null;

async function loadProfile() {
  const params = new URLSearchParams(window.location.search);
  personId = params.get("person");

  if (!personId) {
    document.getElementById("name").textContent =
      "No person ID provided in URL.";
    return;
  }

  try {
    const docRef = doc(db, "people", personId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      document.getElementById("name").textContent = "Profile not found.";
      return;
    }

    const data = docSnap.data();

    // NAME
    document.getElementById("name").textContent =
      data.name || "Unnamed";

    // BIRTHDATE
    const birthDateEl = document.getElementById("birthDate");
    if (data.birthDate && typeof data.birthDate.toDate === "function") {
      birthDateEl.textContent = data.birthDate
        .toDate()
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
    } else {
      birthDateEl.textContent = "Unknown";
    }

    // PARENTS
    document.getElementById("parents").textContent =
      (data.parents && data.parents.length
        ? data.parents.join(", ")
        : "Unknown");

    // SPOUSE
    document.getElementById("spouse").textContent =
      data.spouse || "No spouse listed.";

    // CHILDREN
    // Right now this uses whatever is stored on the doc.
    // If you prefer to query via a helper, you can swap this for getChildren(personId).
    document.getElementById("children").textContent =
      (data.children && data.children.length
        ? data.children.join(", ")
        : "No children.");

    // BIO
    document.getElementById("bio").textContent =
      data.bio || "No bio available.";
  } catch (error) {
    console.error("Error loading profile:", error);
    document.getElementById("name").textContent =
      "Error loading profile.";
  }
}

// EDIT BUTTON – for now, just redirect to your main edit page with a query param.
// Adjust the URL and param name to match how your editPeople.js expects it.
document
  .getElementById("editPersonBtn")
  .addEventListener("click", () => {
    if (!personId) return;

    // Example: go back to tree_page with an ?edit=personId param
    // so editPeople.js can pick it up.
    window.location.href = `tree_page.html?edit=${encodeURIComponent(
      personId
    )}`;
  });

// DELETE BUTTON
document
  .getElementById("deletePersonBtn")
  .addEventListener("click", async () => {
    if (!personId) return;

    const confirmDelete = confirm(
      "Are you sure you want to delete this person? This action cannot be undone."
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "people", personId));
      alert("Person removed successfully.");
      // profile.html is inside /html, so this should get you back to the tree correctly:
      window.location.href = "tree_page.html";
    } catch (error) {
      console.error("Error deleting person:", error);
      alert("Failed to delete this person.");
    }
  });

// Load the profile when the page opens
loadProfile();
