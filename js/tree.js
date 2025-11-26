import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

function toTitleCase(str) {
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

async function loadFamilyTree() {
    const peopleCol = collection(db, "people");
    const snapshot = await getDocs(peopleCol);

    const peopleList = snapshot.docs.map(doc => ({
        docID: doc.id,
        ...doc.data()
    }));


    const peopleByName = new Map();

    for (const person of peopleList) {
        peopleByName.set(person.name.trim().toLowerCase(), person);
    }

    const modal = document.getElementById("addModal");
    const btn = document.getElementById("addPersonBtn");
    const span = document.querySelector(".close");

    btn.onclick = () => {
        modal.style.display = "block";
    };

    span.onclick = () => {
        modal.style.display = "none";
    };

    window.onclick = event => {
        if (event.target === modal) {
        modal.style.display = "none";
        }
    };

    document.getElementById("addPersonForm").addEventListener("submit", e => {
        e.preventDefault();
        // TODO: Add person to Firestore and reload tree
        alert("Person added! (Functionality coming soon)");
        modal.style.display = "none";
    });




    const rendered = new Set();
    const nodeTree = new Map();
    const personElements = new Map();
    const parentMap = new Map();
    const tempElements = new Map();
    let count = 0;

    for (const person of peopleList) {
        const generation = person.generation || 1;
        const container = document.getElementById(`gen-${generation}`);
        if (!container) continue;

        if (rendered.has(person.docID)) continue;

        const spouseName = person.spouse?.trim().toLowerCase();
        const isSeparated = Array.isArray(person.separatedWith) && person.separatedWith.length > 0;

        // Handle separated logic first
        if (isSeparated) {
            for (const exName of person.separatedWith) {
                const ex = peopleByName.get(person.spouse?.trim().toLowerCase());
                const spouseObj = peopleByName.get(person.spouse?.trim().toLowerCase());

                if (ex && !rendered.has(ex.docID)) {
                    const divorcedContainer = document.createElement("div");
                    divorcedContainer.className = "divorced-pair";

                    const exCard = createPersonCard(ex);
                    const personCard = createPersonCard(person);
                    const spouseCard = spouseObj && !rendered.has(spouseObj.docID)
                        ? createPersonCard(spouseObj)
                        : null;

                    divorcedContainer.appendChild(exCard);
                    divorcedContainer.appendChild(personCard);
                    if (spouseCard) divorcedContainer.appendChild(spouseCard);

                    tempElements.set(person.name, divorcedContainer);
                    tempElements.set(ex.name, divorcedContainer);
                    if (spouseObj) tempElements.set(spouseObj.name, divorcedContainer);

                    rendered.add(person.docID);
                    rendered.add(ex.docID);
                    if (spouseObj) rendered.add(spouseObj.docID);
                }
            }
            continue;
        }

        // Handle spouse pairing
        if (spouseName) {
            for (const candidate of peopleList) {
                if (
                    candidate.generation === generation &&
                    candidate.name.toLowerCase() === spouseName &&
                    candidate.spouse?.toLowerCase() === person.name.toLowerCase() &&
                    !rendered.has(candidate.docID)
                ) {
                    const pairContainer = document.createElement('div');
                    pairContainer.className = 'spouse-pair';

                    const personCard = createPersonCard(person);
                    const spouseCard = createPersonCard(candidate);

                    pairContainer.appendChild(personCard);
                    pairContainer.appendChild(spouseCard);

                    nodeTree.set(person.name, (1000 * generation) + count);
                    nodeTree.set(candidate.name, (1000 * generation) + count + 1);

                    tempElements.set(person.name, pairContainer);
                    tempElements.set(candidate.name, pairContainer);

                    rendered.add(person.docID);
                    rendered.add(candidate.docID);

                    count += 2;
                    break;
                }
            }
        }

        if (!rendered.has(person.docID)) {
            const personCard = createPersonCard(person);
            tempElements.set(person.name, personCard);
            rendered.add(person.docID);
            nodeTree.set(person.name, (1000 * generation) + count);
            count++;
        }

        if (Array.isArray(person.parents) && person.parents.length > 0) {
            const key = person.parents.slice().sort().join(',');
            if (!parentMap.has(key)) parentMap.set(key, new Set());
            parentMap.get(key).add(person.name);
        }
    }

    editFamilyTree(parentMap, tempElements);

    // Append elements to DOM
    for (const [name, element] of tempElements.entries()) {
        const generation = peopleList.find(p => p.name === name)?.generation || 1;
        const container = document.getElementById(`gen-${generation}`);
        if (container && !container.contains(element)) {
            container.appendChild(element);
        }
    }  

    return { count, nodeTree };
}

function createPersonCard(person) {
    const birthDate = person.birthDate?.toDate();
    const formattedDate = birthDate
        ? birthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : "Unknown";

    const link = document.createElement('a');
    link.href = `profile.html?person=${person.docID}`;
    link.style.textDecoration = "none";
    link.style.color = "inherit";

    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
        <h3>${toTitleCase(person.name)}</h3>
        <p>Born: ${formattedDate}</p>
    `;

    link.appendChild(card);
    return link;
}

function editFamilyTree(parentMap, personElements) {
    parentMap.forEach((childrenSet, parentKey) => {
        const children = Array.from(childrenSet);
        if (children.length < 2) return;

        const siblingGroup = document.createElement("div");
        siblingGroup.className = "sibling-group";

        let container = null;
        const added = new Set();

        for (const childName of children) {
            const el = personElements.get(childName);
            if (!el || added.has(el)) continue;
            if (!container) container = el.closest(".generation");
            siblingGroup.appendChild(el);
            added.add(el);
        }

        if (siblingGroup.children.length > 1 && container) {
            container.appendChild(siblingGroup);
        }
    });
}

loadFamilyTree();
