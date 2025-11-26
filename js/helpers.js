import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

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

// Get all people (used in loadFamilyTree)
export async function getAllPeople() {
  const snapshot = await getDocs(collection(db, "people"));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// Find a single person by normalized full name
export async function findPersonByFullName(firstName, lastName) {
  const cleanFirst = normalizeNamePart(firstName);
  const cleanLast = normalizeNamePart(lastName);

  if (!cleanFirst || !cleanLast) return null;

  const peopleRef = collection(db, "people");
  const q = query(
    peopleRef,
    where("firstName", "==", cleanFirst),
    where("lastName", "==", cleanLast),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
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

// Get children of a given person from a list of all people.
// Assumes child.parent1 / parent2 store "first last" in lowercase.
export function getChildrenOf(person, allPeople) {
  if (!person) return [];
  const fullName = buildFullName(person.firstName, person.lastName);

  return allPeople.filter(
    p => p.parent1 === fullName || p.parent2 === fullName
  );
}

// Very simple sibling check: do they share at least one parent string?
export function areSiblings(personA, personB) {
  if (!personA || !personB) return false;

  const parentsA = [personA.parent1, personA.parent2].filter(Boolean);
  const parentsB = [personB.parent1, personB.parent2].filter(Boolean);

  if (parentsA.length === 0 || parentsB.length === 0) return false;

  return parentsA.some(pa => parentsB.includes(pa));
}

/* -----------------------------------
   GENERATION HELPERS
----------------------------------- */

export function groupByGeneration(people) {
  const map = new Map();

  people.forEach(p => {
    const gen = typeof p.generation === "number" ? p.generation : 2;
    if (!map.has(gen)) map.set(gen, []);
    map.get(gen).push(p);
  });
  return map;
}

// Sort generation keys: [1,2,3,...]
export function sortGenerationKeys(genMap) {
  return [...genMap.keys()].sort((a, b) => a - b);
}

// Sort people alphabetically by last, then first
export function sortPeopleByName(people) {
  return [...people].sort((a, b) => {
    const lastDiff = (a.lastName || "").localeCompare(b.lastName || "");
    if (lastDiff !== 0) return lastDiff;
    return (a.firstName || "").localeCompare(b.firstName || "");
  });
}

/* -----------------------------------
   VALIDATION HELPERS
----------------------------------- */

export function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

// Very simple base validation, you can expand this later
export function validatePersonData(person) {
  if (!person) return false;
  if (!person.firstName || !person.lastName) return false;
  return true;
}
