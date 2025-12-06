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

/* Keep a reference to the last rendered people so we can redraw lines on resize */
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
  link.dataset.personId = person.id; // for connector calculations

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
   PARENT → CHILD CONNECTOR LINES
--------------------------- */

function drawParentChildLines(people) {
  const treeLayout = document.getElementById("tree-layout");
  if (!treeLayout) return;

  // Remove any existing SVG
  const oldSvg = document.getElementById("tree-lines-svg");
  if (oldSvg && oldSvg.parentNode) {
    oldSvg.parentNode.removeChild(oldSvg);
  }

  if (!people || people.length === 0) return;

  const layoutRect = treeLayout.getBoundingClientRect();

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("id", "tree-lines-svg");
  svg.setAttribute("class", "tree-lines");
  svg.setAttribute("width", layoutRect.width);
  svg.setAttribute("height", layoutRect.height);
  svg.setAttribute("viewBox", `0 0 ${layoutRect.width} ${layoutRect.height}`);

  // Map personId -> DOM element + rect info
  const elMap = new Map();
  const allEls = treeLayout.querySelectorAll("[data-person-id]");
  allEls.forEach((el) => {
    const id = el.dataset.personId;
    if (!id) return;
    const rect = el.getBoundingClientRect();
    elMap.set(id, {
      el,
      rect,
      centerX: rect.left + rect.width / 2 - layoutRect.left,
      topY: rect.top - layoutRect.top,
      bottomY: rect.bottom - layoutRect.top,
    });
  });

  // Build fullName -> person map so we can find parents from parent1/parent2 strings
  const nameToPerson = new Map();
  people.forEach((p) => {
    const full = buildFullName(p.firstName, p.lastName);
    if (full) {
      nameToPerson.set(full, p);
    }
  });

  // Group children by their parent pair (order independent)
  const parentGroupMap = new Map();

  people.forEach((child) => {
    const p1 = child.parent1 || "";
    const p2 = child.parent2 || "";
    if (!p1 && !p2) return; // unknown parents

    let key;
    if (p1 && p2) {
      // sort so (A,B) and (B,A) are the same group
      key = [p1, p2].sort().join("|");
    } else {
      key = p1 || p2; // single-parent family
    }

    if (!parentGroupMap.has(key)) {
      parentGroupMap.set(key, {
        parentNames: [p1 || null, p2 || null],
        children: [],
      });
    }
    parentGroupMap.get(key).children.push(child);
  });

  // For each parent group, draw connectors down to their children
  parentGroupMap.forEach((group) => {
    const [p1Name, p2Name] = group.parentNames;

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

    // Get DOM positions for parents
    const parentCenters = parentPersons
      .map((p) => elMap.get(p.id))
      .filter(Boolean);

    if (parentCenters.length === 0) return;

    // Parent anchor: mid-point between parents, at their bottom
    let parentX;
    let parentY;

    if (parentCenters.length === 1) {
      parentX = parentCenters[0].centerX;
      parentY = parentCenters[0].bottomY + 4;
    } else {
      parentX =
        parentCenters.reduce((sum, pc) => sum + pc.centerX, 0) /
        parentCenters.length;
      parentY = Math.max(...parentCenters.map((pc) => pc.bottomY)) + 4;
    }

    // Children positions
    const childCenters = group.children
      .map((child) => elMap.get(child.id))
      .filter(Boolean);

    if (childCenters.length === 0) return;

    // For each child, draw a path: parent bottom -> midY -> child top
    childCenters.forEach((childInfo) => {
      const childX = childInfo.centerX;
      const childY = childInfo.topY - 4;

      const midY = (parentY + childY) / 2;

      const path = document.createElementNS(svgNS, "path");
      const d = `M ${parentX} ${parentY} L ${parentX} ${midY} L ${childX} ${midY} L ${childX} ${childY}`;
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
  });

  treeLayout.prepend(svg);
}

/* ---------------------------
   MAIN LOAD FUNCTION
--------------------------- */
function getCurrentFamilyId() {
  // Use the helper function which checks URL first, then localStorage
  return getFamilyIdFromHelper();
}

async function updateTreeTitle(familyId) {
  const titleEl = document.getElementById("treeTitle");
  const joinCodeDisplay = document.getElementById("joinCodeDisplay");
  const joinCodeValue = document.getElementById("joinCodeValue");
  
  if (!titleEl) return;

  // Example tree: no familyId → keep default title and hide join code
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

    // Optional: update browser tab title as well
    document.title = data.name || "Our Family Tree";
    
    // Display join code if available
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

      renderGeneration(genNumber, peopleInGen, treeLayout, familyId);
    });

    // cache and draw connectors
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

// Setup copy code functionality - make the code itself clickable
function setupCopyCode() {
  const joinCodeValue = document.getElementById("joinCodeValue");
  
  if (joinCodeValue) {
    joinCodeValue.addEventListener("click", async () => {
      const code = joinCodeValue.textContent;
      if (code) {
        try {
          await navigator.clipboard.writeText(code);
          // Visual feedback - briefly change background
          const originalBg = joinCodeValue.style.backgroundColor;
          joinCodeValue.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
          setTimeout(() => {
            joinCodeValue.style.backgroundColor = originalBg;
          }, 500);
        } catch (err) {
          console.error("Failed to copy code:", err);
          // Fallback: select the text
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

  // Redraw connectors on resize so lines stay aligned
  window.addEventListener("resize", () => {
    if (lastRenderedPeople && lastRenderedPeople.length > 0) {
      drawParentChildLines(lastRenderedPeople);
    }
  });
});
