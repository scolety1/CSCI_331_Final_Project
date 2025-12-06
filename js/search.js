import {
  getAllPeople,
  toTitleFullName,
  normalizeNamePart,
  buildFullName,
  getCurrentFamilyId,
} from "./helpers.js";

let allPeople = [];
let currentFamilyId = null;

/**
 * Render a single search result card that links to the profile page.
 */
function createResultCard(person, familyId = null) {
  const link = document.createElement("a");
  let profileUrl = `/profile?person=${encodeURIComponent(person.id)}`;
  if (familyId) {
    profileUrl += `&familyId=${encodeURIComponent(familyId)}`;
  }
  link.href = profileUrl;
  link.className = "person-card search-result-card";
  link.style.textDecoration = "none";
  link.style.color = "inherit";

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

  link.innerHTML = `
    <h3>${fullTitleName}</h3>
    <p>Born: ${formattedDate}</p>
    ${
      person.generation != null
        ? `<p>Generation: ${person.generation}</p>`
        : ""
    }
  `;

  return link;
}

/**
 * Core search logic: filter allPeople and render results.
 */
function runSearch(rawQuery, resultsContainer) {
  resultsContainer.innerHTML = "";

  const trimmed = rawQuery.trim();
  if (!trimmed) {
    resultsContainer.innerHTML = "<p>Type a name above to search.</p>";
    return;
  }

  const q = normalizeNamePart(trimmed);
  console.log("Search query (normalized):", q);

  const matches = allPeople.filter((person) => {
    const full = buildFullName(person.firstName, person.lastName);
    return full.includes(q);
  });

  console.log("Search matches:", matches);

  if (matches.length === 0) {
    resultsContainer.innerHTML = `<p>No results for "<strong>${trimmed}</strong>".</p>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "search-results-list";

  matches.forEach((person) => {
    const card = createResultCard(person, currentFamilyId);
    list.appendChild(card);
  });

  resultsContainer.appendChild(list);
}

/**
 * Initialize search page. This will silently no-op on pages that
 * don't have the search elements.
 */
async function initSearchPage() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const resultsContainer = document.getElementById("search-results");

  if (!form || !input || !resultsContainer) {
    return;
  }

  console.log("Initializing search page…");

  currentFamilyId = getCurrentFamilyId();

  try {
    allPeople = await getAllPeople(currentFamilyId);
    console.log("Loaded people for search (count):", allPeople.length);
    console.log("Sample people:", allPeople.slice(0, 3));
  } catch (err) {
    console.error("Error loading people for search:", err);
    resultsContainer.innerHTML = "<p>Error loading search data.</p>";
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    console.log("Form submitted, query:", input.value);
    runSearch(input.value, resultsContainer);
  });

  input.addEventListener("input", () => {
    runSearch(input.value, resultsContainer);
  });
}


document.addEventListener("DOMContentLoaded", initSearchPage);
