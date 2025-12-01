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

    // FUN FACT - fetch based on birthday
    if (data.birthDate && typeof data.birthDate.toDate === "function") {
      const birthDate = data.birthDate.toDate();
      await fetchFunFact(birthDate);
    } else {
      document.getElementById("funFact").textContent = "No birthdate available for fun fact.";
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    document.getElementById("name").textContent =
      "Error loading profile.";
  }
}

// Fetch fun fact from Numbers API based on birthday
async function fetchFunFact(birthDate) {
  const funFactEl = document.getElementById("funFact");
  funFactEl.textContent = "Loading fun fact...";
  
  const month = birthDate.getMonth() + 1; // getMonth() returns 0-11, so add 1
  const day = birthDate.getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  try {
    // Use Vercel serverless function to avoid CORS issues
    const apiUrl = `/api/funfact?month=${month}&day=${day}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    funFactEl.textContent = data.text || `On ${monthNames[month - 1]} ${day}, many interesting historical events have occurred throughout history!`;
  } catch (error) {
    console.error("Error fetching fun fact:", error);
    // Fallback message
    funFactEl.textContent = `On ${monthNames[month - 1]} ${day}, many significant historical events have occurred! Did you know that people born on this date share it with many notable figures throughout history?`;
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
    window.location.href = `/tree?edit=${encodeURIComponent(
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
      // Redirect back to tree page using absolute path
      window.location.href = "/tree";
    } catch (error) {
      console.error("Error deleting person:", error);
      alert("Failed to delete this person.");
    }
  });

// Load the profile when the page opens
loadProfile();
