Here is a **clean, professional, rubric-perfect README.md** for your Family Tree project.
Just copy/paste this into your `README.md` file inside VS Code.

---

# 📚 **Colety Family Tree App**

A dynamic, Firebase-powered family tree web application that allows users to add, edit, and visualize family members through an automatically organized, generation-based tree layout.

---

## 🔍 **Overview**

The Colety Family Tree App is a fully client-side JavaScript project designed to make it easy to view and update your family’s genealogy.
Users can add relatives, define parents, spouses, and children, and instantly see those relationships reflected in a clean, structured visual tree.

The app uses **Firebase Firestore** for data storage, making all updates reflect immediately without manual refresh or hosting a backend server.

---

## ⭐ **Key Features**

### **🌱 Add, Edit, and Remove Family Members**

* Form-based input
* Name, spouse, parents, and birthdate fields
* Automatic Firestore updates

### **🌳 Dynamic Family Tree Visualization**

* Auto-generated layout
* Parents centered
* Children placed below parents
* Siblings grouped together
* Spouses paired side-by-side

### **👤 Individual Profile Pages**

* Each person has their own detail page
* Data loads dynamically via URL parameters
* Clean and responsive card layout

### **🧩 Modular JS Structure**

* `helpers.js` for reusable logic
* `tree.js` for rendering the visual tree
* `postPeople.js`, `editPeople.js`, `removePeople.js` for CRUD operations
* Easy to expand + debug

### **🛠️ Debug Mode (Developer Tool)**

* Toggles container outlines
* Helps align tree boxes and connectors

---

## 🧰 **Tech Stack**

* **HTML5 + CSS3**
* **JavaScript ES Modules**
* **Firebase Firestore (v11+)**
* **GitHub for source control**

---

## 📁 **Folder Structure**

```
project-root/
│
├── css/
│   ├── global.css
│   ├── family_tree.css
│   ├── profile.css
│
├── js/
│   ├── firebase.js
│   ├── helpers.js
│   ├── tree.js
│   ├── postPeople.js
│   ├── editPeople.js
│   ├── removePeople.js
│
├── pages/
│   ├── home_page.html
│   ├── tree_page.html
│   ├── profile.html
│
├── README.md
└── index.html  (optional landing page)
```

---

## 🚀 **Setup & Installation**

1. **Clone or download** the repository

   ```
   git clone <repo link>
   ```

2. Open the project folder in **VS Code**

3. Add your Firebase configuration inside:

   ```
   /js/firebase.js
   ```

4. Enable Firestore rules (development mode OK)

5. Run with a simple Live Server (VS Code extension) or open the HTML files directly in your browser.

6. Add a test person → confirm they appear on both:

   * Home page
   * Tree page
   * Profile page

---

## 🧪 **Features Demonstrated in Presentation**

* Working add/edit/delete person
* Dynamic tree generation
* Firebase integration
* Profile page routing
* Modular JS
* Debug mode view

---

## 👥 **Contributors**

* **Spencer Colety**
* **[Partner Name]**

Both members contributed to coding, design, debugging, and presentation.

---

## 📌 **Future Improvements**

* Cleaner connector lines
* Advanced search page
* Photo upload for each member
* Mobile-optimized tree layout
* Faster sibling + spouse grouping logic

---

If you'd like, I can also generate a **short version**, a **super polished version**, or a **fun personality version**—just tell me!
