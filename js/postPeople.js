import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

const form = document.getElementById("addPersonForm");



if(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ----- GET & CLEAN INPUT VALUES -----
    const rawFirstName   = document.getElementById("firstName").value.trim();
    const rawMiddleInitial = document.getElementById("middleInitial").value.trim();
    const rawLastName    = document.getElementById("lastName").value.trim();
    const rawSpouse      = document.getElementById("spouse").value.trim();
    const rawParent1     = document.getElementById("parent1").value.trim();
    const rawParent2     = document.getElementById("parent2").value.trim();
    const birthDateRaw   = document.getElementById("birthDate").value; // "YYYY-MM-DD"

    const firstName      = rawFirstName.toLowerCase();
    const middleInitial  = rawMiddleInitial.toLowerCase();
    const lastName       = rawLastName.toLowerCase();

    const spouseRaw      = rawSpouse.toLowerCase();
    const parent1        = rawParent1.toLowerCase();
    const parent2        = rawParent2.toLowerCase();
    
    let spouseFirstName = "";
    let spouseLastName = "";

    if (spouseRaw) {
      const parts = spouseRaw.split(" ");
      spouseFirstName = parts[0] || "";
      spouseLastName  = parts.slice(1).join(" ") || "";
    }

    // 🔧 FIXED: create date in LOCAL time instead of UTC
    let birthDate = null;
    if (birthDateRaw) {
      // birthDateRaw is "YYYY-MM-DD"
      const [yearStr, monthStr, dayStr] = birthDateRaw.split("-");
      const year  = Number(yearStr);
      const month = Number(monthStr) - 1; // JS months are 0-based
      const day   = Number(dayStr);

      const jsDate = new Date(year, month, day); // local midnight
      birthDate = Timestamp.fromDate(jsDate);
    }

    // ----- BUILD PERSON OBJECT (ONLY REQUIRED FIELDS FIRST) -----
    const personData = { 
      firstName,
      lastName
    };

    // Optional fields added only if provided
    if (middleInitial)    personData.middleInitial    = middleInitial;
    if (birthDate)        personData.birthDate        = birthDate;
    if (parent1)          personData.parent1          = parent1;
    if (parent2)          personData.parent2          = parent2;
    if (spouseFirstName)  personData.spouseFirstName  = spouseFirstName;
    if (spouseLastName)   personData.spouseLastName   = spouseLastName;
    
    // ----- SAVE TO FIRESTORE -----
    try {
      await addDoc(collection(db, "example"), personData);
      alert("Person added! Reload the page to see them.");
      form.reset();
    } catch (error) {
      console.error("Error adding person:", error);
      alert("Something went wrong while saving to Firestore.");
    }
  });
  
} else {
    console.log("postPeople.js: no #addPersonForm on this page, skipping add-person setup.");
}