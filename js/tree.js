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
  getCurrentFamilyId as getFamilyIdFromHelper,
  buildFullName
} from "./helpers.js";

let lastRenderedPeople = [];

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
  let profileUrl = `/profile?person=${encodeURIComponent(person.id)}`;
  if (familyId) {
    profileUrl += `&familyId=${encodeURIComponent(familyId)}`;
  }
  link.href = profileUrl;
  link.style.textDecoration = "none";
  link.style.color = "inherit";
  link.dataset.personId = person.id; // used for connectors

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

  const usedIds = new Set();

  peopleInGen.forEach((person) => {
    if (usedIds.has(person.id)) return;

    const spouse = peopleInGen.find(
      (p) => !usedIds.has(p.id) && areSpouses(person, p)
    );

    if (spouse) {
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
      const card = createPersonCard(person, familyId);
      row.appendChild(card);
      usedIds.add(person.id);
    }
  });

  genContainer.appendChild(row);
  treeLayout.appendChild(genContainer);
}


/* ---------------------------
   PARENT → CHILD CONNECTOR LINES
   One connector per child:
   parents' midpoint  ↓  midY  →  child
--------------------------- */

function drawParentChildLines(people) {
  const treeLayout = document.getElementById("tree-layout");
  if (!treeLayout) return;

  // Remove existing SVG
  const oldSvg = document.getElementById("tree-lines-svg");
  if (oldSvg && oldSvg.parentNode) {
    oldSvg.parentNode.removeChild(oldSvg);
  }

  if (!people || people.length === 0) return;

  const containerRect = treeLayout.getBoundingClientRect();
  const scrollLeft = treeLayout.scrollLeft;
  const scrollTop = treeLayout.scrollTop;

  const width = treeLayout.scrollWidth || containerRect.width;
  const height = treeLayout.scrollHeight || containerRect.height;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("id", "tree-lines-svg");
  svg.setAttribute("class", "tree-lines");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Map personId -> DOM position info
  const elMap = new Map();
  const allEls = treeLayout.querySelectorAll("[data-person-id]");
  allEls.forEach((el) => {
    const id = el.dataset.personId;
    if (!id) return;

    const rect = el.getBoundingClientRect();
    const centerX =
      rect.left - containerRect.left + scrollLeft + rect.width / 2;
    const topY = rect.top - containerRect.top + scrollTop;
    const bottomY = rect.bottom - containerRect.top + scrollTop;

    elMap.set(id, { centerX, topY, bottomY });
  });

  // fullName -> person
  const nameToPerson = new Map();
  people.forEach((p) => {
    const full = buildFullName(p.firstName, p.lastName);
    if (full) nameToPerson.set(full, p);
  });

  // For each child, independently draw connectors from their parents
  people.forEach((child) => {
    const p1Name = child.parent1 || "";
    const p2Name = child.parent2 || "";

    const parentPersons = [];
    if (p1Name && nameToPerson.has(p1Name)) {
      parentPersons.push(nameToPerson.get(p1Name));
    }
    if (p2Name && nameToPerson.has(p2Name)) {
      const p2Person = nameToPerson.get(p2Name);
      if (!parentPersons.includes(p2Person)) {
        parentPersons.push(p2Person);
      }
    }

    if (parentPersons.length === 0) return;

    const childInfo = elMap.get(child.id);
    if (!childInfo) return;

    const parentInfos = parentPersons
      .map((p) => elMap.get(p.id))
      .filter(Boolean);
    if (parentInfos.length === 0) return;

    // Parents: center-bottom midpoint
    const parentBottomY = Math.max(...parentInfos.map((pi) => pi.bottomY));
    const parentX =
      parentInfos.reduce((sum, pi) => sum + pi.centerX, 0) /
      parentInfos.length;

    // Child: center-top
    const childTopY = childInfo.topY - 4;
    const childX = childInfo.centerX;

    // Mid Y between parents and child
    const midY = (parentBottomY + childTopY) / 2;

    // Path: parents' midpoint → down to midY → across to childX → down to child
    const path = document.createElementNS(svgNS, "path");
    const d = `M ${parentX} ${parentBottomY} 
               L ${parentX} ${midY} 
               L ${childX} ${midY} 
               L ${childX} ${childTopY}`;
    path.setAttribute("d", d);
    svg.appendChild(path);
  });

  treeLayout.prepend(svg);
}



/* ---------------------------
   MAIN LOAD FUNCTION
--------------------------- */

function getCurrentFamilyId() {
  return getFamilyIdFromHelper();
}

async function updateTreeTitle(familyId) {
  const titleEl = document.getElementById("treeTitle");
  const joinCodeDisplay = document.getElementById("joinCodeDisplay");
  const joinCodeValue = document.getElementById("joinCodeValue");
  
  if (!titleEl) return;

  if (!familyId) {
    titleEl.textContent = "Example Family Tree";
    if (joinCodeDisplay) {
      joinCodeDisplay.style.display = "none";
    }
    return;
  }

  try {
    const familyRef = doc(db, "families", familyId);
    const familySnap = await getDoc(familyRef);

    if (!familySnap.exists()) {
      titleEl.textContent = "Family Tree";
      if (joinCodeDisplay) {
        joinCodeDisplay.style.display = "none";
      }
      return;
    }

    const data = familySnap.data();
    titleEl.textContent = data.name || "Family Tree";
    document.title = data.name || "Our Family Tree";
    
    if (joinCodeDisplay && joinCodeValue && data.joinCode) {
      joinCodeValue.textContent = data.joinCode;
      joinCodeDisplay.style.display = "block";
    } else if (joinCodeDisplay) {
      joinCodeDisplay.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading family name:", err);
    titleEl.textContent = "Family Tree";
    if (joinCodeDisplay) {
      joinCodeDisplay.style.display = "none";
    }
  }
}

async function loadFamilyTree() {
  const treeLayout = document.getElementById("tree-layout");
  if (!treeLayout) {
    console.error("No #tree-layout div found");
    return;
  }

  const familyId = getCurrentFamilyId();

  await updateTreeTitle(familyId);

  if (familyId) {
    const navTreeLink = document.querySelector('nav a[href="/tree"]');
    if (navTreeLink) {
      navTreeLink.href = `/tree?familyId=${familyId}`;
    }
  }

  treeLayout.innerHTML = "<p>Loading family tree...</p>";

  try {
    const allPeople = await getAllPeople(familyId);
    console.log("All people from Firestore:", allPeople, "for familyId:", familyId);

    if (!allPeople || allPeople.length === 0) {
      treeLayout.innerHTML = "<p>No family members found in the database.</p>";
      return;
    }

    const genMap = groupByGeneration(allPeople);
    const genKeys = sortGenerationKeys(genMap);

    console.log("Generation keys:", genKeys);
    console.log("Generation map:", genMap);

    treeLayout.innerHTML = "";

    genKeys.forEach((genNumber) => {
      const peopleInGen = genMap.get(genNumber) || [];
      console.log(`Generation ${genNumber} people:`, peopleInGen);

      renderGeneration(genNumber, peopleInGen, treeLayout, familyId);
    });

    lastRenderedPeople = allPeople;
    drawParentChildLines(lastRenderedPeople);
  } catch (err) {
    console.error("Error loading family tree:", err);
    treeLayout.innerHTML = "<p>Error loading family tree.</p>";
  }
}

/* ---------------------------
   INIT
--------------------------- */

function setupCopyCode() {
  const joinCodeValue = document.getElementById("joinCodeValue");
  
  if (joinCodeValue) {
    joinCodeValue.addEventListener("click", async () => {
      const code = joinCodeValue.textContent;
      if (code) {
        try {
          await navigator.clipboard.writeText(code);
          const originalBg = joinCodeValue.style.backgroundColor;
          joinCodeValue.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
          setTimeout(() => {
            joinCodeValue.style.backgroundColor = originalBg;
          }, 500);
        } catch (err) {
          console.error("Failed to copy code:", err);
          const range = document.createRange();
          range.selectNode(joinCodeValue);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
          alert("Code selected. Press Ctrl+C to copy.");
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupAddPersonModal();
  setupCopyCode();
  loadFamilyTree();

  window.addEventListener("resize", () => {
    if (lastRenderedPeople && lastRenderedPeople.length > 0) {
      drawParentChildLines(lastRenderedPeople);
    }
  });
});
