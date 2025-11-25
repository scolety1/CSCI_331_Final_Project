import { db } from "./firebase.js";
import { doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

let personId = null;

async function loadProfile() {
    const params = new URLSearchParams(window.location.search);
    personId = params.get("person");

    if (!personId) {
        document.getElementById("name").textContent = "No person ID provided in URL.";
        return;
    }

    const docRef = doc(db, "people", personId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        document.getElementById("name").textContent = "Profile not found.";
        return;
    }

    const data = docSnap.data();
    document.getElementById("name").textContent = data.name || "Unnamed";
    document.getElementById("birthDate").textContent = data.birthDate?.toDate()
        ? data.birthDate.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : "Unknown";
    document.getElementById("parents").textContent = (data.parents || []).join(', ') || "Unknown";
    document.getElementById("spouse").textContent = data.spouse || "No spouse listed.";
    document.getElementById("children").textContent = (data.children || []).join(', ') || "No children.";
    document.getElementById("bio").textContent = data.bio || "No bio available.";
}

// Hook up the delete button
document.getElementById("deletePersonBtn").addEventListener("click", async () => {
    if (!personId) return;

    const confirmDelete = confirm("Are you sure you want to delete this person? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
        await deleteDoc(doc(db, "people", personId));
        alert("Person removed successfully.");
        window.location.href = "family_tree.html";
    } catch (error) {
        console.error("Error deleting person:", error);
        alert("Failed to delete this person.");
    }
});

loadProfile();
