import { db } from "./firebase.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

import {
  getAllPeople,
  groupByGeneration,
  sortGenerationKeys,
  areSpouses,
  toTitleFullName,
} from "./helpers.js";

/* ---------------------------
   MODAL: ADD PERSON (UI ONLY)
--------------------------- */

function setupAddPersonModal() {
  const modal = document.getElementById("addModal");
  const btn = document.getElementById("addPersonBtn");
  const closeBtn = document.querySelector(".modal .close");
  console.log(modal, btn, closeBtn);

  if (!modal || !btn || !closeBtn) return;

  btn.onclick = () => {
    modal.style.display = "block";
  };

  closeBtn.onclick = () => {
    modal.style.display = "none";
  };

  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  const form = document.getElementById("addPersonForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      modal.style.display = "none";
    });
  }
}

/* ---------------------------
   CARD CREATION
--------------------------- */

function createPersonCard(person, familyId = null) {
  // birthDate is likely a Firestore Timestamp
  let formattedDate = "Unknown";
  if (person.birthDate && typeof person.birthDate.toDate === "function") {
    const d = person.birthDate.toDate();
    formattedDate = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const fullTitleName = toTitleFullName(person.firstName, person.lastName);

  const link = document.createElement("a");
  // Include familyId in profile link if it exists
  let profileUrl = `/profile?person=${encodeURIComponent(person.id)}`;
  if (familyId) {
    profileUrl += `&familyId=${encodeURIComponent(familyId)}`;
  }
  link.href = profileUrl;
  link.style.textDecoration = "none";
  link.style.color = "inherit";

  const card = document.createElement("div");
  card.className = "person-card";

  card.innerHTML = `
    <h3>${fullTitleName}</h3>
    <p>Born: ${formattedDate}</p>
    <p class="debug-gen">Generation: ${person.generation}</p>
  `;

  link.appendChild(card);
  return link;
}

/* ---------------------------
   RENDER ONE GENERATION ROW
--------------------------- */

function renderGeneration(genNumber, peopleInGen, treeLayout, familyId = null) {
  const genContainer = document.createElement("div");
  genContainer.className = "generation";
  genContainer.id = `gen-${genNumber}`;

  const title = document.createElement("h2");
  title.className = "generation-title";
  title.textContent = `Generation ${genNumber}`;
  genContainer.appendChild(title);

  const row = document.createElement("div");
  row.className = "generation-row";

  // Pair spouses using helpers.areSpouses
  const usedIds = new Set();

  peopleInGen.forEach((person) => {
    if (usedIds.has(person.id)) return;

    // Try to find their spouse in the same generation
    const spouse = peopleInGen.find(
      (p) => !usedIds.has(p.id) && areSpouses(person, p)
    );

    if (spouse) {
      // spouse-pair container
      const pairContainer = document.createElement("div");
      pairContainer.className = "spouse-pair";

      const personCard = createPersonCard(person, familyId);
      const spouseCard = createPersonCard(spouse, familyId);

      pairContainer.appendChild(personCard);
      pairContainer.appendChild(spouseCard);

      row.appendChild(pairContainer);

      usedIds.add(person.id);
      usedIds.add(spouse.id);
    } else {
      // single person
      const card = createPersonCard(person, familyId);
      row.appendChild(card);
      usedIds.add(person.id);
    }
  });

  genContainer.appendChild(row);
  treeLayout.appendChild(genContainer);
}

/* ---------------------------
   MAIN LOAD FUNCTION
--------------------------- */
function getCurrentFamilyId() {
  const params = new URLSearchParams(window.location.search);
  const familyId = params.get("familyId");
  return familyId || null;
}

async function updateTreeTitle(familyId) {
  const titleEl = document.getElementById("treeTitle");
  if (!titleEl) return;

  // Example tree: no familyId → keep default title
  if (!familyId) {
    titleEl.textContent = "Example Family Tree";
    return;
  }

  try {
    const familyRef = doc(db, "families", familyId);
    const familySnap = await getDoc(familyRef);

    if (!familySnap.exists()) {
      titleEl.textContent = "Family Tree";
      return;
    }

    const data = familySnap.data();
    titleEl.textContent = data.name || "Family Tree";

    // Optional: update browser tab title as well
    document.title = data.name || "Our Family Tree";
  } catch (err) {
    console.error("Error loading family name:", err);
    titleEl.textContent = "Family Tree";
  }
}

async function loadFamilyTree() {
  const treeLayout = document.getElementById("tree-layout");
  if (!treeLayout) {
    console.error("No #tree-layout div found");
    return;
  }

  const familyId = getCurrentFamilyId();

  // Update the title (family name or example)
  await updateTreeTitle(familyId);
    // Keep the nav "Family Tree" link locked on this family if possible
  if (familyId) {
    const navTreeLink = document.querySelector('nav a[href="/tree"]');
    if (navTreeLink) {
      navTreeLink.href = `/tree?familyId=${familyId}`;
    }
  }

  treeLayout.innerHTML = "<p>Loading family tree...</p>";

  try {
    // If familyId exists, this will pull from "people" for that family.
    // If not, it falls back to your static "example" collection.
    const allPeople = await getAllPeople(familyId);
    console.log("All people from Firestore:", allPeople, "for familyId:", familyId);

    if (!allPeople || allPeople.length === 0) {
      treeLayout.innerHTML = "<p>No family members found in the database.</p>";
      return;
    }

    // Group & sort by generation using BFS-based helpers
    const genMap = groupByGeneration(allPeople);
    const genKeys = sortGenerationKeys(genMap);

    console.log("Generation keys:", genKeys);
    console.log("Generation map:", genMap);

    treeLayout.innerHTML = ""; // clear loading text

    genKeys.forEach((genNumber) => {
      const peopleInGen = genMap.get(genNumber) || [];
      console.log(`Generation ${genNumber} people:`, peopleInGen);

      // IMPORTANT: do NOT resort by name here; we rely on BFS order
      renderGeneration(genNumber, peopleInGen, treeLayout, familyId);
    });
  } catch (err) {
    console.error("Error loading family tree:", err);
    treeLayout.innerHTML = "<p>Error loading family tree.</p>";
  }
}


/* ---------------------------
   INIT
--------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  setupAddPersonModal();
  loadFamilyTree();
});
