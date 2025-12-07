import { db } from "./firebase.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

import {
  getAllPeople,
  toTitleFullName,
  getCurrentFamilyId as getFamilyIdFromHelper,
  buildFullName,
  hasParents,
  getChildren
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
   BASIC CARD CREATION
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
  link.dataset.personId = person.id; // still useful if we ever want lines later

  const card = document.createElement("div");
  card.className = "person-card";

  card.innerHTML = `
    <h3>${fullTitleName}</h3>
    <p>Born: ${formattedDate}</p>
  `;

  link.appendChild(card);
  return link;
}

/* ---------------------------
   FAMILY-TREE HELPERS
--------------------------- */

// Build "first last" → person map once
function buildNameMap(allPeople) {
  const map = new Map();
  allPeople.forEach(p => {
    const full = buildFullName(p.firstName, p.lastName);
    if (full) map.set(full, p);
  });
  return map;
}

// For a given parent, group their children by co-parent.
// Each group = { otherParentName, otherParent (person or null), children: [] }
function groupChildrenByCoParent(person, allPeople, nameMap) {
  const myName = buildFullName(person.firstName, person.lastName);
  const myKids = getChildren(person, allPeople);

  const groups = new Map(); // key = otherParentName or "__solo__"

  myKids.forEach(child => {
    const parents = [child.parent1, child.parent2].filter(Boolean);
    const otherName = parents.find(n => n !== myName) || null;
    const key = otherName || "__solo__";

    if (!groups.has(key)) {
      const otherParent =
        otherName && nameMap.has(otherName) ? nameMap.get(otherName) : null;
      groups.set(key, {
        otherParentName: otherName,
        otherParent,
        children: []
      });
    }
    groups.get(key).children.push(child);
  });

  return Array.from(groups.values());
}

/* ---------------------------
   RECURSIVE RENDERING
--------------------------- */

function renderSubtree(person, allPeople, nameMap, familyId, visited) {
  // Prevent infinite loops if data is weird
  if (visited.has(person.id)) {
    return null;
  }
  visited.add(person.id);

  const wrapper = document.createElement("div");
  wrapper.className = "person-family";

  // MAIN PERSON CARD AT TOP
  const mainCard = createPersonCard(person, familyId);
  mainCard.classList.add("person-main-card");
  wrapper.appendChild(mainCard);

  // GROUP CHILDREN BY CO-PARENT
  const childGroups = groupChildrenByCoParent(person, allPeople, nameMap);

  childGroups.forEach(group => {
    const groupEl = document.createElement("div");
    groupEl.className = "coparent-group";

    // PARENTS ROW (this person + co-parent if known)
    const parentsRow = document.createElement("div");
    parentsRow.className = "coparent-parents-row";

    // Re-use the same person but visually it's clear this is "as a parent"
    const parentACard = createPersonCard(person, familyId);
    parentsRow.appendChild(parentACard);

    if (group.otherParent) {
      const parentBCard = createPersonCard(group.otherParent, familyId);
      parentsRow.appendChild(parentBCard);
    } else if (group.otherParentName) {
      const label = document.createElement("div");
      label.className = "coparent-label";
      label.textContent = group.otherParentName;
      parentsRow.appendChild(label);
    }

    groupEl.appendChild(parentsRow);

    // VERTICAL CONNECTOR
    const connector = document.createElement("div");
    connector.className = "connector-line";
    groupEl.appendChild(connector);

    // CHILDREN ROW
    const childrenRow = document.createElement("div");
    childrenRow.className = "children-row";

    group.children.forEach(child => {
      const childSubtree = renderSubtree(child, allPeople, nameMap, familyId, visited);
      if (childSubtree) {
        childrenRow.appendChild(childSubtree);
      }
    });

    groupEl.appendChild(childrenRow);
    wrapper.appendChild(groupEl);
  });

  return wrapper;
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

    lastRenderedPeople = allPeople;

    const nameMap = buildNameMap(allPeople);

    // ROOTS: people with no parents set
    const roots = allPeople.filter(p => !hasParents(p));

    treeLayout.innerHTML = "";

    const rootsRow = document.createElement("div");
    rootsRow.className = "roots-row";

    const visited = new Set();

    roots.forEach(root => {
      const subtree = renderSubtree(root, allPeople, nameMap, familyId, visited);
      if (subtree) {
        rootsRow.appendChild(subtree);
      }
    });

    treeLayout.appendChild(rootsRow);
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
});
