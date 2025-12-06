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

function createPersonCard(person, familyId) {
  let birth = "Unknown";
  if (person.birthDate && person.birthDate.toDate) {
    birth = person.birthDate.toDate().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  const link = document.createElement("a");
  let url = `/profile?person=${person.id}`;
  if (familyId) url += `&familyId=${familyId}`;
  link.href = url;
  link.dataset.personId = person.id;

  const card = document.createElement("div");
  card.className = "person-card";
  card.innerHTML = `
    <h3>${toTitleFullName(person.firstName, person.lastName)}</h3>
    <p>Born: ${birth}</p>
  `;

  link.appendChild(card);
  return link;
}

function renderGeneration(gen, peopleInGen, treeLayout, familyId) {
  const container = document.createElement("div");
  container.className = "generation";

  const row = document.createElement("div");
  row.className = "generation-row";

  const used = new Set();

  peopleInGen.forEach(p => {
    if (used.has(p.id)) return;

    const spouse = peopleInGen.find(
      s => !used.has(s.id) && areSpouses(p, s)
    );

    if (spouse) {
      const pair = document.createElement("div");
      pair.className = "spouse-pair";
      pair.appendChild(createPersonCard(p, familyId));
      pair.appendChild(createPersonCard(spouse, familyId));
      row.appendChild(pair);
      used.add(p.id);
      used.add(spouse.id);
    } else {
      row.appendChild(createPersonCard(p, familyId));
      used.add(p.id);
    }
  });

  container.appendChild(row);
  treeLayout.appendChild(container);
}

function drawLines(people) {
  const layout = document.getElementById("tree-layout");
  if (!layout) return;

  const old = document.getElementById("tree-lines-svg");
  if (old) old.remove();

  const r = layout.getBoundingClientRect();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "tree-lines-svg";
  svg.classList.add("tree-lines");
  svg.setAttribute("width", layout.scrollWidth);
  svg.setAttribute("height", layout.scrollHeight);

  const els = layout.querySelectorAll("[data-person-id]");
  const map = new Map();

  els.forEach(el => {
    const rect = el.getBoundingClientRect();
    const id = el.dataset.personId;
    map.set(id, {
      centerX: rect.left - r.left + layout.scrollLeft + rect.width / 2,
      top: rect.top - r.top + layout.scrollTop,
      bottom: rect.bottom - r.top + layout.scrollTop
    });
  });

  const nameMap = new Map();
  people.forEach(p => {
    nameMap.set(buildFullName(p.firstName, p.lastName), p);
  });

  const groups = new Map();
  people.forEach(child => {
    const parents = [child.parent1, child.parent2].filter(x => x);
    if (parents.length === 0) return;

    const key = parents.sort().join("|");
    if (!groups.has(key)) groups.set(key, { parents, children: [] });
    groups.get(key).children.push(child);
  });

  groups.forEach(g => {
    const parentPts = g.parents
      .map(name => nameMap.get(name))
      .filter(Boolean)
      .map(p => map.get(p.id))
      .filter(Boolean);

    const childPts = g.children
      .map(c => map.get(c.id))
      .filter(Boolean);

    if (parentPts.length === 0 || childPts.length === 0) return;

    const xs = parentPts.map(p => p.centerX).concat(childPts.map(c => c.centerX));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const parentBottom = Math.min(...parentPts.map(p => p.bottom));
    const childTop = Math.max(...childPts.map(c => c.top));
    const midY = (parentBottom + childTop) / 2;

    const h = document.createElementNS("http://www.w3.org/2000/svg", "path");
    h.setAttribute("d", `M ${minX} ${midY} L ${maxX} ${midY}`);
    svg.appendChild(h);

    parentPts.forEach(p => {
      const v = document.createElementNS("http://www.w3.org/2000/svg", "path");
      v.setAttribute("d", `M ${p.centerX} ${p.bottom} L ${p.centerX} ${midY}`);
      svg.appendChild(v);
    });

    childPts.forEach(c => {
      const v = document.createElementNS("http://www.w3.org/2000/svg", "path");
      v.setAttribute("d", `M ${c.centerX} ${midY} L ${c.centerX} ${c.top}`);
      svg.appendChild(v);
    });
  });

  layout.prepend(svg);
}

async function loadFamilyTree() {
  const layout = document.getElementById("tree-layout");
  const familyId = getFamilyIdFromHelper();

  const people = await getAllPeople(familyId);
  const genMap = groupByGeneration(people);
  const genKeys = sortGenerationKeys(genMap);

  layout.innerHTML = "";

  genKeys.forEach(gen => {
    renderGeneration(gen, genMap.get(gen), layout, familyId);
  });

  lastRenderedPeople = people;
  drawLines(people);
}

document.addEventListener("DOMContentLoaded", loadFamilyTree);
window.addEventListener("resize", () => drawLines(lastRenderedPeople));
