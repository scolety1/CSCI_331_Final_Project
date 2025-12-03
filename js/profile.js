// profile.js
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import { 
  toTitleFullName, 
  toTitle, 
  getChildren,
  getAllPeople 
} from "./helpers.js";

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
    const docRef = doc(db, "example", personId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      document.getElementById("name").textContent = "Profile not found.";
      return;
    }

    const data = docSnap.data();
    const person = { id: personId, ...data };

    // NAME - combine firstName and lastName
    const fullName = toTitleFullName(data.firstName || "", data.lastName || "");
    document.getElementById("name").textContent = fullName || "Unnamed";

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

    // PARENTS - format parent1 and parent2
    const parentsList = [];
    if (data.parent1) {
      const parts = data.parent1.split(" ");
      if (parts.length >= 2) {
        parentsList.push(toTitleFullName(parts[0], parts.slice(1).join(" ")));
      } else {
        parentsList.push(toTitle(data.parent1));
      }
    }
    if (data.parent2) {
      const parts = data.parent2.split(" ");
      if (parts.length >= 2) {
        parentsList.push(toTitleFullName(parts[0], parts.slice(1).join(" ")));
      } else {
        parentsList.push(toTitle(data.parent2));
      }
    }
    document.getElementById("parents").textContent =
      parentsList.length > 0 ? parentsList.join(" and ") : "Unknown";

    // SPOUSE - combine spouseFirstName and spouseLastName
    const spouseName = toTitleFullName(
      data.spouseFirstName || "", 
      data.spouseLastName || ""
    );
    document.getElementById("spouse").textContent =
      spouseName || "No spouse listed.";

    // CHILDREN - use helper function to get children
    const allPeople = await getAllPeople();
    const children = getChildren(person, allPeople);
    if (children.length > 0) {
      const childrenNames = children.map(child => 
        toTitleFullName(child.firstName || "", child.lastName || "")
      );
      document.getElementById("children").textContent = childrenNames.join(", ");
    } else {
      document.getElementById("children").textContent = "No children.";
    }

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

    // --- FILL EDIT FORM IF IT EXISTS ---
    const editFirstName  = document.getElementById("editFirstName");
    const editMiddleInit = document.getElementById("editMiddleInitial");
    const editLastName   = document.getElementById("editLastName");
    const editBirthDate  = document.getElementById("editBirthDate");
    const editParent1    = document.getElementById("editParent1");
    const editParent2    = document.getElementById("editParent2");
    const editSpouse     = document.getElementById("editSpouse");
    const editBio        = document.getElementById("editBio");
    const editImage      = document.getElementById("editImage");

    if (editFirstName) {
        editFirstName.value = toTitle(data.firstName || "");
    }

    if (editMiddleInit) {
        editMiddleInit.value = (data.middleInitial || "").toUpperCase();
    }

    if (editLastName) {
        editLastName.value = toTitle(data.lastName || "");
    }

    if (editParent1) {
        editParent1.value = data.parent1 ? toTitle(data.parent1) : "";
    }

    if (editParent2) {
        editParent2.value = data.parent2 ? toTitle(data.parent2) : "";
    }

    if (editSpouse) {
        const spouseFull = toTitleFullName(
            data.spouseFirstName || "",
            data.spouseLastName || ""
        );
        editSpouse.value = spouseFull;
    }

    if (editBio) {
        editBio.value = data.bio || "";
    }

    if (editImage) {
        editImage.value = data.image || "";
    }

    // Birthdate: convert Firestore Timestamp to yyyy-mm-dd for <input type="date">
    if (editBirthDate && data.birthDate && typeof data.birthDate.toDate === "function") {
        const d = data.birthDate.toDate();
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, "0");
        const dd   = String(d.getDate()).padStart(2, "0");
        editBirthDate.value = `${yyyy}-${mm}-${dd}`;
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

function setupEditPersonModal() {
  const modal    = document.getElementById("editPersonModal");
  const btn      = document.getElementById("editPersonBtn");
  const closeBtn = document.querySelector(".modal .close");
  const form     = document.getElementById("editPersonForm");

  console.log(modal, btn, closeBtn);

  if (!modal || !btn) return;

  // Open modal
  btn.onclick = () => {
    modal.style.display = "block";
  };

  // Close with X
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }

  // Close when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Just prevent default on submit for now
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // later: send updated values to Firestore
      modal.style.display = "none";
    });
  }
}


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
      await deleteDoc(doc(db, "example", personId));
      alert("Person removed successfully.");
      // Redirect back to tree page using absolute path
      window.location.href = "../html/tree_page.html";
    } catch (error) {
      console.error("Error deleting person:", error);
      alert("Failed to delete this person.");
    }
  });

// Load the profile when the page opens
loadProfile();
setupEditPersonModal();