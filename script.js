import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

const form = document.getElementById("addPersonForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get form values
  const name = document.getElementById("name").value.trim().toLowerCase();
  const birthDateRaw = document.getElementById("birthDate").value;
  const birthDate = birthDateRaw ? Timestamp.fromDate(new Date(birthDateRaw)) : null;

  const parentsRaw = document.getElementById("parents").value.trim();
  const spouse = document.getElementById("spouse").value.trim().toLowerCase();
  const separatedRaw = document.getElementById("separatedWith").value.trim().toLowerCase();
  const generation = parseInt(document.getElementById("generation").value.trim());

  // Normalize comma-separated inputs
  const parents = parentsRaw
    ? parentsRaw.split(',').map(p => p.trim().toLowerCase()).sort()
    : [];

  const separatedWith = separatedRaw
    ? separatedRaw.split(',').map(c => c.trim().toLowerCase()).sort()
    : [];

  // Build the person data object
  const personData = {
    name,
    generation,
    birthDate: birthDate || null
  };

  if (parents.length > 0) personData.parents = parents;
  if (spouse) personData.spouse = spouse;
  if (separatedWith.length > 0) personData.separatedWith = separatedWith;

  try {
    await addDoc(collection(db, "people"), personData);
    alert("Person added! Reload the page to see them.");
    form.reset();
  } catch (error) {
    console.error("Error adding person:", error);
    alert("Something went wrong while saving to Firestore.");
  }
});
