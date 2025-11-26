import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

const form = document.getElementById("addPersonForm");

async function findPersonByName(name) {
  if (!name) return null;

  peopleRef = collection(db, "people");
  const q = query(
    peopleRef,
    where("name", "==", name.toLowerCase()),
    limit(1)
  )
}


form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // ----- GET & CLEAN INPUT VALUES -----
  const rawFirstName = document.getElementById("firstName").value.trim();
  const rawMiddleInitial = document.getElementById("middleInitial").value.trim();
  const rawLastName = document.getElementById("lastName").value.trim();
  const rawSpouse = document.getElementById("spouse").value.trim();
  const rawParent1 = document.getElementById("parent1").value.trim();
  const rawParent2 = document.getElementById("parent2").value.trim();
  const birthDateRaw = document.getElementById("birthDate").value;

  const firstName = rawFirstName.toLowerCase();
  const middleInitial = rawMiddleInitial.toLowerCase();
  const lastName = rawLastName.toLowerCase();

  const spouseRaw = rawSpouse.toLowerCase();
  const parent1 = rawParent1.toLowerCase();
  const parent2 = rawParent2.toLowerCase();
   
  if (spouseRaw) {
    const parts = spouseRaw.split(" ");
    spouseFirstName = parts[0] || "";
    spouseLastName = parts[1] || "";
  }


  const birthDate = birthDateRaw
    ? Timestamp.fromDate(new Date(birthDateRaw))
    : null;

  // ----- BUILD PERSON OBJECT (ONLY REQUIRED FIELDS FIRST) -----
  const personData = { 
    firstName,
    lastName
   };

  // Optional fields added only if provided
  if (middleInitial) personData.middleInitial = middleInitial;
  if (birthDate) personData.birthDate = birthDate;
  if (parent1) personData.parent1 = parent1;
  if (parent2) personData.parent2 = parent2;
  if (spouseFirstName) personData.spouseFirstName = spouseFirstName;
  if (spouseLastName) personData.spouseLastName = spouseLastName;
  
  // ----- SAVE TO FIRESTORE -----
  try {
    await addDoc(collection(db, "people"), personData);
    alert("Person added! Reload the page to see them.");
    form.reset();
  } catch (error) {
    console.error("Error adding person:", error);
    alert("Something went wrong while saving to Firestore.");
  }
});
