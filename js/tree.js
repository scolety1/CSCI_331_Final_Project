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
  link.dataset.personId = person.id; // used for possible future connectors

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
   FAMILY BLOCK LAYOUT HELPERS
--------------------------- */

/**
 * Build a map: generation -> array of family blocks.
 *
 * Family block:
 * {
 *   key: string,
 *   parents: Person[],  // one or two
 *   children: Person[], // 0+
 *   generation: number  // parents' generation
 * }
 */
function buildFamilyBlocks(allPeople) {
  const blocksByKey = new Map();

  // helper: name -> person
  const nameToPerson = new Map();
  allPeople.forEach((p) => {
    const full = buildFullName(p.firstName, p.lastName);
    if (full) nameToPerson.set(full, p);
  });

  // 1) Create blocks for each parent-set that actually has children
  allPeople.forEach((child) => {
    const parents = [child.parent1, child.parent2].filter(Boolean);
    if (parents.length === 0) return;

    const sortedParents = [...parents].sort();
    const key = "P:" + sortedParents.join("|");

    if (!blocksByKey.has(key)) {
      const parentPersons = sortedParents
        .map((name) => nameToPerson.get(name))
        .filter(Boolean);

      if (parentPersons.length === 0) {
        // parents not in dataset – nothing good to render
        return;
      }

      const gen = parentPersons.reduce(
        (g, p) =>
          Math.max(
            g,
            typeof p.generation === "number" ? p.generation : 1
          ),
        1
      );

      blocksByKey.set(key, {
        key,
        parents: parentPersons,
        children: [],
        generation: gen,
      });
    }

    const block = blocksByKey.get(key);
    if (!block.children.some((c) => c.id === child.id)) {
      block.children.push(child);
    }
  });

  // helper: does this person already appear in any existing block
  function personAppears(p) {
    for (const block of blocksByKey.values()) {
      if (
        block.parents.some((pp) => pp.id === p.id) ||
        block.children.some((c) => c.id === p.id)
      ) {
        return true;
      }
    }
    return false;
  }

  // 2) Add spouse-only or single-person blocks for people
  //    who don't appear in any parent/child block yet
  allPeople.forEach((p) => {
    if (personAppears(p)) return;

    // Try to find their spouse who also doesn't appear anywhere yet
    const spouse = allPeople.find(
      (other) =>
        other.id !== p.id &&
        areSpouses(p, other) &&
        !personAppears(other)
    );

    if (spouse) {
      const pairKey = "S:" + [p.id, spouse.id].sort().join("|");
      if (!blocksByKey.has(pairKey)) {
        const gen = Math.max(
          typeof p.generation === "number" ? p.generation : 1,
          typeof spouse.generation === "number" ? spouse.generation : 1
        );
        blocksByKey.set(pairKey, {
          key: pairKey,
          parents: [p, spouse],
          children: [],
          generation: gen,
        });
      }
    } else {
      const singleKey = "I:" + p.id;
      if (!blocksByKey.has(singleKey)) {
        const gen = typeof p.generation === "number" ? p.generation : 1;
        blocksByKey.set(singleKey, {
          key: singleKey,
          parents: [p],
          children: [],
          generation: gen,
        });
      }
    }
  });

  // 3) Group blocks by generation
  const genMap = new Map();

  blocksByKey.forEach((block) => {
    const g = block.generation || 1;
    if (!genMap.has(g)) genMap.set(g, []);
    genMap.get(g).push(block);
  });

  // 4) Within each generation, sort blocks by BFS index of their first parent
  genMap.forEach((blocks) => {
    blocks.sort((a, b) => {
      const aIdx = Math.min(
        ...a.parents.map((p) => (p._bfsIndex != null ? p._bfsIndex : 0))
      );
      const bIdx = Math.min(
        ...b.parents.map((p) => (p._bfsIndex != null ? p._bfsIndex : 0))
      );
      return aIdx - bIdx;
    });
  });

  return genMap;
}

/* ---------------------------
   RENDER ONE GENERATION ROW
   (now: rows of FAMILY BLOCKS)
--------------------------- */

function renderGeneration(genNumber, familyBlocks, treeLayout, familyId = null) {
  const genContainer = document.createElement("div");
  genContainer.className = "generation";
  genContainer.id = `gen-${genNumber}`;

  const title = document.createElement("h2");
  title.className = "generation-title";
  title.textContent = `Generation ${genNumber}`;
  genContainer.appendChild(title);

  const row = document.createElement("div");
  row.className = "generation-row";

  familyBlocks.forEach((block) => {
    const familyEl = document.createElement("div");
    familyEl.className = "family-block";

    // --- parents row ---
    const parentsRow = document.createElement("div");
    parentsRow.className = "family-parents-row";

    if (block.parents.length === 2) {
      // keep your nice spouse-pair styling
      const pair = document.createElement("div");
      pair.className = "spouse-pair";
      pair.appendChild(createPersonCard(block.parents[0], familyId));
      pair.appendChild(createPersonCard(block.parents[1], familyId));
      parentsRow.appendChild(pair);
    } else if (block.parents.length === 1) {
      parentsRow.appendChild(createPersonCard(block.parents[0], familyId));
    }

    familyEl.appendChild(parentsRow);

    // --- children row (if any) ---
    if (block.children && block.children.length > 0) {
      const connector = document.createElement("div");
      connector.className = "family-connector";
      familyEl.appendChild(connector);

      const childrenRow = document.createElement("div");
      childrenRow.className = "family-children-row";

      block.children.forEach((child) => {
        childrenRow.appendChild(createPersonCard(child, familyId));
      });

      familyEl.appendChild(childrenRow);
    }

    row.appendChild(familyEl);
  });

  genContainer.appendChild(row);
  treeLayout.appendChild(genContainer);
}

/* ---------------------------
   PARENT → CHILD CONNECTOR LINES (DISABLED)
--------------------------- */

/**
 * We used to draw big SVG lines across generations.
 * The new layout keeps connections *inside* each family block via CSS,
 * so this is intentionally a no-op now.
 */
function drawParentChildLines(people) {
  return;
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

    // This assigns .generation and ._bfsIndex on each person
    const genMapForPeople = groupByGeneration(allPeople);
    console.log("Generation map (people):", genMapForPeople);

    // Now build family blocks based on those generations
    const familyGenMap = buildFamilyBlocks(allPeople);
    const genKeys = sortGenerationKeys(familyGenMap);

    console.log("Family generation keys:", genKeys);
    console.log("Family generation map:", familyGenMap);

    treeLayout.innerHTML = "";

    genKeys.forEach((genNumber) => {
      const blocksInGen = familyGenMap.get(genNumber) || [];
      renderGeneration(genNumber, blocksInGen, treeLayout, familyId);
    });

    lastRenderedPeople = allPeople;
    drawParentChildLines(lastRenderedPeople); // no-op but keeps API
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
      drawParentChildLines(lastRenderedPeople); // still a no-op
    }
  });
});
