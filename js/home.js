// js/home.js
import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  Timestamp,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// Grab elements that only exist on the home page.
// If they aren't there, just bail so this file can be safely imported everywhere.
const createTreeBtn      = document.getElementById("createTreeBtn");
const joinTreeBtn        = document.getElementById("joinTreeBtn");
const createFamilyForm   = document.getElementById("createFamilyForm");
const joinFamilyForm     = document.getElementById("joinFamilyForm");
const createFormCard     = document.getElementById("createTreeFormCard");
const joinFormCard       = document.getElementById("joinTreeFormCard");

/* -----------------------------------
   HELPER: JOIN CODE GENERATOR
----------------------------------- */

function generateJoinCode(length = 6) {
    // Exclude confusing characters like 0/O and 1/I
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        code += chars[idx];
    }
    return code;
}

/* -----------------------------------
   BUTTON BEHAVIOR (SCROLL TO FORMS)
----------------------------------- */

if (createTreeBtn && createFormCard) {
    createTreeBtn.addEventListener("click", () => {
        createFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

if (joinTreeBtn && joinFormCard) {
    joinTreeBtn.addEventListener("click", () => {
        joinFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

/* -----------------------------------
   CREATE FAMILY TREE FLOW
----------------------------------- */

if (createFamilyForm) {
    createFamilyForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameInput = /** @type {HTMLInputElement} */ (
            document.getElementById("familyName")
        );
        const descInput = /** @type {HTMLTextAreaElement} */ (
            document.getElementById("familyDescription")
        );

        const rawName = nameInput?.value.trim() || "";
        const rawDesc = descInput?.value.trim() || "";

        if (!rawName) {
            alert("Please enter a name for your family tree.");
            return;
        }

        try {
            const joinCode = generateJoinCode(6);

            const familiesRef = collection(db, "families");
            const docRef = await addDoc(familiesRef, {
                name: rawName,
                description: rawDesc || "",
                joinCode: joinCode,
                createdAt: Timestamp.now()
            });

            const familyId = docRef.id;

            // You can replace this alert with a nice modal later if you want
            alert(
                `Your family tree has been created!\n\n` +
                `Name: ${rawName}\n` +
                `Access code: ${joinCode}\n\n` +
                `Share this code with your family so they can join.`
            );

            // Redirect into the tree view for this family
            window.location.href = `../html/tree_page.html?familyId=${familyId}`;
        } catch (err) {
            console.error("Error creating family tree:", err);
            alert("Sorry, something went wrong creating the family tree. Please try again.");
        }
    });
}

/* -----------------------------------
   JOIN FAMILY TREE FLOW
----------------------------------- */

if (joinFamilyForm) {
  joinFamilyForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const codeInput = /** @type {HTMLInputElement} */ (
      document.getElementById("joinCode")
    );
    const rawCode = codeInput?.value || "";
    const code = rawCode.trim().toUpperCase();

    if (!code) {
      alert("Please enter an access code.");
      return;
    }

    try{
      const familiesRef = collection(db, "families");
      const q = query(
        familiesRef,
        where("joinCode", "==", code),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        alert("No family tree found with that access code. Double-check and try again.");
        return;
      }

      const familyDoc = snap.docs[0];
      const familyId = familyDoc.id;

      // Redirect into that family's tree
      window.location.href = `../html/tree_page.html?familyId=${familyId}`;
    } catch (err) {
      console.error("Error joining family tree:", err);
      alert("Sorry, there was an issue joining that family tree. Please try again.");
    }
    });
}
