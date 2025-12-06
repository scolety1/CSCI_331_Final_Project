// profile.js
import { db, storage } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-storage.js";

import { 
  toTitleFullName, 
  toTitle, 
  getChildren,
  getAllPeople,
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

    const profileImgEl = document.getElementById("profileImage");
    if (profileImgEl) {
        if (data.image) {
            profileImgEl.src = data.image;
            profileImgEl.style.display = "block";
        } else {
            // Hide the img tag if no image yet
            profileImgEl.style.display = "none";
        }
    }
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


// ... your existing code where personId is set in loadProfile ...

const editForm = document.getElementById("editPersonForm");

if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!personId) {
      console.error("No personId set for editing");
      return;
    }

    // ----- GET & CLEAN INPUT VALUES (from EDIT fields) -----
    const rawFirstName      = document.getElementById("editFirstName").value.trim();
    const rawMiddleInitial  = document.getElementById("editMiddleInitial").value.trim();
    const rawLastName       = document.getElementById("editLastName").value.trim();
    const rawSpouse         = document.getElementById("editSpouse").value.trim();
    const rawParent1        = document.getElementById("editParent1").value.trim();
    const rawParent2        = document.getElementById("editParent2").value.trim();
    const birthDateRaw      = document.getElementById("editBirthDate").value; // "YYYY-MM-DD"
    const rawBio            = document.getElementById("editBio").value.trim();
    const imageFileInput    = document.getElementById("editImageFile");
    const imageFile         = imageFileInput && imageFileInput.files[0];

    const firstName     = rawFirstName.toLowerCase();
    const middleInitial = rawMiddleInitial.toLowerCase();
    const lastName      = rawLastName.toLowerCase();

    const spouseRaw = rawSpouse.toLowerCase();
    const parent1   = rawParent1.toLowerCase();
    const parent2   = rawParent2.toLowerCase();

    let spouseFirstName = "";
    let spouseLastName  = "";

    if (spouseRaw) {
      const parts = spouseRaw.split(" ");
      spouseFirstName = parts[0] || "";
      spouseLastName  = parts.slice(1).join(" ") || "";
    }

    // Birthdate → Timestamp
    let birthDate = null;
    if (birthDateRaw) {
      const [yearStr, monthStr, dayStr] = birthDateRaw.split("-");
      const year  = Number(yearStr);
      const month = Number(monthStr) - 1; // 0-based
      const day   = Number(dayStr);

      const jsDate = new Date(year, month, day);
      birthDate = Timestamp.fromDate(jsDate);
    }

        // ----- OPTIONAL: UPLOAD IMAGE FILE TO FIREBASE STORAGE -----
    let imageUrl = null;

    if (imageFile) {
        try {
            const imageRef = ref(storage, `people/${personId}/${imageFile.name}`);
            await uploadBytes(imageRef, imageFile);
            imageUrl = await getDownloadURL(imageRef);
        } catch (err) {
            console.error("Error uploading image:", err);
            alert("Image upload failed, but other changes will still be saved.");
        }
    }

    // ----- BUILD PERSON OBJECT (same pattern as add) -----
    const personData = {
      firstName,
      lastName,
    };

    if (middleInitial)      personData.middleInitial    = middleInitial;
    if (birthDate)          personData.birthDate        = birthDate;
    if (parent1)            personData.parent1          = parent1;
    if (parent2)            personData.parent2          = parent2;
    if (spouseFirstName)    personData.spouseFirstName  = spouseFirstName;
    if (spouseLastName)     personData.spouseLastName   = spouseLastName;
    if (rawBio)             personData.bio              = rawBio;
    if (imageUrl)           personData.image = imageUrl;

    // ----- UPDATE EXISTING DOC IN FIRESTORE -----
    try {
      const personRef = doc(db, "example", personId);
      await updateDoc(personRef, personData);

      alert("Person updated! Reloading profile...");
      // optional: close modal
      const modal = document.getElementById("editPersonModal");
      if (modal) modal.style.display = "none";

      // Reload page to see updated profile info
      window.location.reload();
    } catch (error) {
      console.error("Error updating person:", error);
      alert("Something went wrong while saving changes.");
    }
  });
} else {
  console.log("No #editPersonForm on this page, skipping edit setup.");
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
      window.location.href = "/tree";
    } catch (error) {
      console.error("Error deleting person:", error);
      alert("Failed to delete this person.");
    }
  });

// Load the profile when the page opens
loadProfile();
setupEditPersonModal();