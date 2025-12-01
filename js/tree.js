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
      // TODO: hook this up to your real postPeople logic
      alert("Add person functionality coming soon!");
      modal.style.display = "none";
    });
  }
}

/* ---------------------------
   CARD CREATION
--------------------------- */

function createPersonCard(person) {
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
  link.href = `profile.html?person=${person.id}`;
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

function renderGeneration(genNumber, peopleInGen, treeLayout) {
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

      const personCard = createPersonCard(person);
      const spouseCard = createPersonCard(spouse);

      pairContainer.appendChild(personCard);
      pairContainer.appendChild(spouseCard);

      row.appendChild(pairContainer);

      usedIds.add(person.id);
      usedIds.add(spouse.id);
    } else {
      // single person
      const card = createPersonCard(person);
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

async function loadFamilyTree() {
  const treeLayout = document.getElementById("tree-layout");
  if (!treeLayout) {
    console.error("No #tree-layout div found");
    return;
  }

  treeLayout.innerHTML = "<p>Loading family tree...</p>";

  try {
    const allPeople = await getAllPeople();
    console.log("All people from Firestore:", allPeople);

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
      renderGeneration(genNumber, peopleInGen, treeLayout);
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
