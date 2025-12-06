import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

/* -----------------------------------
   FAMILY ID PERSISTENCE HELPERS
----------------------------------- */

const FAMILY_ID_STORAGE_KEY = "currentFamilyId";

/**
 * Store familyId in sessionStorage for persistence across page navigation
 * sessionStorage clears when the browser tab/window is closed
 */
export function setFamilyId(familyId) {
  if (familyId) {
    sessionStorage.setItem(FAMILY_ID_STORAGE_KEY, familyId);
  } else {
    sessionStorage.removeItem(FAMILY_ID_STORAGE_KEY);
  }
}

/**
 * Get familyId from sessionStorage
 */
export function getStoredFamilyId() {
  return sessionStorage.getItem(FAMILY_ID_STORAGE_KEY);
}

/**
 * Clear stored familyId (e.g., when viewing example tree)
 */
export function clearFamilyId() {
  sessionStorage.removeItem(FAMILY_ID_STORAGE_KEY);
}

/**
 * Get current familyId from URL or sessionStorage
 * URL takes precedence if present
 * sessionStorage automatically clears when browser tab/window closes
 * @param {boolean} useStored - If false, only check URL (default: true)
 */
export function getCurrentFamilyId(useStored = true) {
  // First check URL parameters
  const params = new URLSearchParams(window.location.search);
  const urlFamilyId = params.get("familyId");
  
  if (urlFamilyId) {
    // If familyId is in URL, update sessionStorage to persist it for this session
    setFamilyId(urlFamilyId);
    return urlFamilyId;
  }
  
  // If URL explicitly has familyId=null or empty, clear stored value
  if (params.has("familyId") && !urlFamilyId) {
    clearFamilyId();
    return null;
  }
  
  // Otherwise, check sessionStorage if useStored is true
  if (useStored) {
    const storedFamilyId = getStoredFamilyId();
    return storedFamilyId || null;
  }
  
  return null;
}

/* -----------------------------------
   NORMALIZATION HELPERS
----------------------------------- */

// Make names lowercase and trimmed for consistent storage
export function normalizeNamePart(name) {
  if (!name) return "";
  return name.trim().toLowerCase();
}

// Build a normalized "first last" full name string
export function buildFullName(firstName, lastName) {
  const f = normalizeNamePart(firstName);
  const l = normalizeNamePart(lastName);
  return `${f} ${l}`.trim();
}

// Turn "john" → "John"
export function toTitle(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Turn "john doe" → "John Doe"
export function toTitleFullName(firstName, lastName) {
  return `${toTitle(firstName)} ${toTitle(lastName)}`.trim();
}

/* -----------------------------------
   FIRESTORE LOOKUPS
----------------------------------- */

// Get all people (used in loadFamilyTree, etc.)
export async function getAllPeople(familyId = null) {
  // If we have a familyId, load the real people for that family from "people"
  if (familyId) {
    const peopleRef = collection(db, "people");
    const qPeople = query(peopleRef, where("familyId", "==", familyId));
    const snapshot = await getDocs(qPeople);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // Otherwise, fall back to the static example tree collection
  const snapshot = await getDocs(collection(db, "example"));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}


export async function findPersonByFullName(firstName, lastName, familyId = null) {
  const cleanFirst = normalizeNamePart(firstName);
  const cleanLast = normalizeNamePart(lastName);

  if (!cleanFirst || !cleanLast) return null;

  const collectionName = familyId ? "people" : "example";
  const peopleRef = collection(db, collectionName);

  const constraints = [
    where("firstName", "==", cleanFirst),
    where("lastName", "==", cleanLast)
  ];

  if (familyId) {
    constraints.push(where("familyId", "==", familyId));
  }

  const qPeople = query(peopleRef, ...constraints, limit(1));

  const snap = await getDocs(qPeople);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}


/* -----------------------------------
   RELATIONSHIP HELPERS
----------------------------------- */

// Check if two people are spouses of each other
// Uses spouseFirstName / spouseLastName fields
export function areSpouses(personA, personB) {
  if (!personA || !personB) return false;

  const aSpouseFull = buildFullName(
    personA.spouseFirstName,
    personA.spouseLastName
  );
  const bFull = buildFullName(personB.firstName, personB.lastName);

  const bSpouseFull = buildFullName(
    personB.spouseFirstName,
    personB.spouseLastName
  );
  const aFull = buildFullName(personA.firstName, personA.lastName);

  return (
    (aSpouseFull && aSpouseFull === bFull) ||
    (bSpouseFull && bSpouseFull === aFull)
  );
}

// Does this person have at least one parent string?
export function hasParents(person) {
  if (!person) return false;
  return Boolean(
    (person.parent1 && person.parent1.trim() !== "") ||
    (person.parent2 && person.parent2.trim() !== "")
  );
}

// Does this person have two parents?
export function hasTwoParents(person) {
  if (!person) return false;
  return Boolean(
    (person.parent1 && person.parent1.trim() !== "") &&
    (person.parent2 && person.parent2.trim() !== "")
  );
}

// Get children of a given person from a list of all people.
// Assumes child.parent1 / parent2 store "first last" in lowercase.
export function getChildren(person, allPeople) {
  if (!person) return [];
  const fullName = buildFullName(person.firstName, person.lastName);

  return allPeople.filter(p =>
    p.parent1 === fullName || p.parent2 === fullName
  );
}

// Get full siblings: share BOTH parents (order doesn’t matter)
export function getSiblings(person, allPeople) {
  if (!person) return [];

  return allPeople.filter(p => {
    if (p.id === person.id) return false; // skip self

    const sameOrder =
      p.parent1 === person.parent1 &&
      p.parent2 === person.parent2;

    const swappedOrder =
      p.parent1 === person.parent2 &&
      p.parent2 === person.parent1;

    return sameOrder || swappedOrder;
  });
}

// Get half-siblings: share EXACTLY one parent
export function getHalfSiblings(person, allPeople) {
  if (!person) return [];

  return allPeople.filter(p => {
    if (p.id === person.id) return false; // skip self

    // share at least one parent (either slot)
    const shareAny =
      p.parent1 === person.parent1 ||
      p.parent2 === person.parent1 ||
      p.parent1 === person.parent2 ||
      p.parent2 === person.parent2;

    // share both parents (full sibling)
    const shareBoth =
      (p.parent1 === person.parent1 && p.parent2 === person.parent2) ||
      (p.parent1 === person.parent2 && p.parent2 === person.parent1);

    return shareAny && !shareBoth;
  });
}

// Very simple sibling check: do they share at least one parent string?
export function areSiblings(personA, personB) {
  if (!personA || !personB) return false;

  const parentsA = [personA.parent1, personA.parent2].filter(Boolean);
  const parentsB = [personB.parent1, personB.parent2].filter(Boolean);

  if (parentsA.length === 0 || parentsB.length === 0) return false;

  return parentsA.some(pa => parentsB.includes(pa));
}

// Convenience: does this person have *any* siblings?
export function hasSiblings(person, allPeople) {
  return !!getSiblings(person, allPeople).length;
}

// Convenience: does this person have *any* children?
export function hasChildren(person, allPeople) {
  return !!getChildren(person, allPeople).length;
}

/* -----------------------------------
   GENERATION + BFS LAYOUT HELPERS
----------------------------------- */

// Internal: build lookup "first last" -> person
function buildNameToPerson(people) {
  const map = new Map();
  people.forEach(p => {
    const full = buildFullName(p.firstName, p.lastName);
    if (full) {
      map.set(full, p);
    }
  });
  return map;
}

// Internal: build parentName -> [children] map
function buildChildrenMap(people) {
  const childrenMap = new Map();

  people.forEach(child => {
    [child.parent1, child.parent2].forEach(parentName => {
      if (!parentName) return;
      if (!childrenMap.has(parentName)) {
        childrenMap.set(parentName, []);
      }
      childrenMap.get(parentName).push(child);
    });
  });

  return childrenMap;
}

// NEW: align spouse generations so married couple stays in same row
function alignSpouseGenerations(people) {
  const n = people.length;

  for (let i = 0; i < n; i++) {
    const p = people[i];

    // Find their spouse in the list, if any
    const spouse = people.find(other => other.id !== p.id && areSpouses(p, other));
    if (!spouse) continue;

    if (p.generation === spouse.generation) continue;

    const pHasParents = hasParents(p);
    const sHasParents = hasParents(spouse);

    let targetGen;

    if (pHasParents && !sHasParents) {
      // Anchor spouse with no parents to the one that has parents
      targetGen = p.generation;
    } else if (!pHasParents && sHasParents) {
      targetGen = spouse.generation;
    } else {
      // Both have (or both don't have) parents → keep kids below them, so use the higher gen
      targetGen = Math.max(
        typeof p.generation === "number" ? p.generation : 1,
        typeof spouse.generation === "number" ? spouse.generation : 1
      );
    }

    p.generation = targetGen;
    spouse.generation = targetGen;
  }
}

// NEW: align co-parents (people who share a child) so they stay in same generation
function alignCoParentGenerations(people) {
  const nameToPerson = buildNameToPerson(people);

  people.forEach(child => {
    const p1Name = child.parent1;
    const p2Name = child.parent2;

    if (!p1Name || !p2Name) return; // need both parents to align

    const p1 = nameToPerson.get(p1Name);
    const p2 = nameToPerson.get(p2Name);

    if (!p1 || !p2) return;
    if (typeof p1.generation !== "number" || typeof p2.generation !== "number") return;

    if (p1.generation === p2.generation) return;

    // Keep them both in the higher generation so kids stay below
    const targetGen = Math.max(p1.generation, p2.generation);
    p1.generation = targetGen;
    p2.generation = targetGen;
  });
}


// Internal: assign generation + BFS index so siblings stay together
function assignGenerationsBFS(people) {
  if (!Array.isArray(people) || people.length === 0) return people;

  const nameToPerson = buildNameToPerson(people);
  const childrenMap = buildChildrenMap(people);

  // Reset any previous generation / bfs index
  people.forEach(p => {
    p.generation = undefined;
    p._bfsIndex = undefined;
  });

  // 1. Roots = people with no known parents in the dataset
  const roots = [];
  people.forEach(p => {
    const hasParent1 = !!p.parent1 && nameToPerson.has(p.parent1);
    const hasParent2 = !!p.parent2 && nameToPerson.has(p.parent2);
    if (!hasParent1 && !hasParent2) {
      roots.push(p);
    }
  });

  if (roots.length === 0 && people.length > 0) {
    // fallback: treat the first person as a root if everything looks connected / messy
    roots.push(people[0]);
  }

  const queue = [];
  const visited = new Set();
  let bfsIndex = 0;

  roots.forEach(root => {
    if (visited.has(root.id)) return;
    root.generation = 1;
    queue.push(root);
    visited.add(root.id);
  });

  while (queue.length > 0) {
    const current = queue.shift();
    current._bfsIndex = bfsIndex++;

    const parentFull = buildFullName(current.firstName, current.lastName);
    const children = childrenMap.get(parentFull) || [];

    children.forEach(child => {
      const proposedGen = (current.generation || 1) + 1;

      // 🔑 Allow child to "upgrade" to a higher generation if a later parent is deeper
      if (
        typeof child.generation !== "number" ||
        child.generation < proposedGen
      ) {
        child.generation = proposedGen;
      }

      if (!visited.has(child.id)) {
        visited.add(child.id);
        queue.push(child);
      }
    });
  }

  // Any leftover disconnected people get default generation and index
  people.forEach(p => {
    if (typeof p.generation !== "number") {
      p.generation = 1;
    }
    if (p._bfsIndex == null) {
      p._bfsIndex = bfsIndex++;
    }
  });

  // First: fix spouse generations after BFS
  alignSpouseGenerations(people);

  // Then: fix co-parent generations (people who share a child)
  alignCoParentGenerations(people);

  return people;
}

// Legacy-style helper: figure out a single person's generation given the full list
export function figureOutGeneration(person, allPeople) {
  if (!person || !Array.isArray(allPeople)) return 1;
  assignGenerationsBFS(allPeople);

  const full = buildFullName(person.firstName, person.lastName);
  const match =
    allPeople.find(p => p.id === person.id) ||
    allPeople.find(p => buildFullName(p.firstName, p.lastName) === full);

  if (match && typeof match.generation === "number") {
    return match.generation;
  }
  return 1;
}

// Sort generation keys: [1,2,3,...]
export function sortGenerationKeys(genMap) {
  return [...genMap.keys()].sort((a, b) => a - b);
}


// Group people by generation, using BFS assignment and BFS order
export function groupByGeneration(people) {
  const list = assignGenerationsBFS([...people]); // shallow copy just in case

  const map = new Map();
  list.forEach(p => {
    const gen = p.generation;
    if (!map.has(gen)) map.set(gen, []);
    map.get(gen).push(p);
  });

  // Within each generation, keep BFS order (siblings together),
  // and within siblings, optionally sort by birth date if available.
  map.forEach(arr => {
    arr.sort((a, b) => {
      const ai = a._bfsIndex ?? 0;
      const bi = b._bfsIndex ?? 0;
      const idxDiff = ai - bi;
      if (idxDiff !== 0) return idxDiff;

      // same BFS cluster → use birthdate to order siblings from oldest to youngest if possible
      const ta = a.birthDate && typeof a.birthDate.toDate === "function"
        ? a.birthDate.toDate().getTime()
        : null;
      const tb = b.birthDate && typeof b.birthDate.toDate === "function"
        ? b.birthDate.toDate().getTime()
        : null;

      if (ta != null && tb != null) {
        return ta - tb;
      }

      // fallback: alphabetical
      const lastDiff = (a.lastName || "").localeCompare(b.lastName || "");
      if (lastDiff !== 0) return lastDiff;
      return (a.firstName || "").localeCompare(b.firstName || "");
    });
  });

  return map;
}

// Sort people alphabetically 
export function sortPeopleByName(people) {
  return [...people].sort((a, b) => {
    const lastDiff = (a.lastName || "").localeCompare(b.lastName || "");
    if (lastDiff !== 0) return lastDiff;
    return (a.firstName || "").localeCompare(b.firstName || "");
  });
}

/*helpers*/

export function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

// Very simple base validation, you can expand this later
export function validatePersonData(person) {
  if (!person) return false;
  if (!person.firstName || !person.lastName) return false;
  return true;
}
