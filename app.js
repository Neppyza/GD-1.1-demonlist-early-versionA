import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const levelsContainer = document.getElementById("levels");
const search = document.getElementById("search");

let levels = [];


async function loadLevels() {

    try {

        console.log("Loading levels...");

        const snapshot = await getDocs(
            collection(db, "levels")
        );

        levels = [];

        snapshot.forEach((doc) => {

            levels.push({
                id: doc.id,
                ...doc.data()
            });

        });

        // Sort by position
        levels.sort((a, b) => {
            return Number(a.position || 999999)
                - Number(b.position || 999999);
        });

        console.log("Levels loaded:", levels);

        displayLevels();

    } catch (error) {

        console.error("FIREBASE ERROR:", error);

        levelsContainer.innerHTML = `
            <div class="error">
                Could not load the demonlist.
                <br>
                <small>${error.message}</small>
            </div>
        `;
    }
}


function displayLevels() {

    const searchText =
        search.value.toLowerCase().trim();

    const filtered = levels.filter(level => {

        const name =
            String(level.name || "").toLowerCase();

        const creator =
            String(level.creator || "").toLowerCase();

        const verifier =
            String(level.verifier || "").toLowerCase();

        return (
            name.includes(searchText) ||
            creator.includes(searchText) ||
            verifier.includes(searchText)
        );

    });


    levelsContainer.innerHTML = "";


    if (filtered.length === 0) {

        levelsContainer.innerHTML = `
            <div class="loading">
                No levels found.
            </div>
        `;

        return;
    }


    filtered.forEach(level => {

        const row =
            document.createElement("a");

        row.className = "level-row";

        row.href =
            `level.html?id=${encodeURIComponent(level.id)}`;


        const thumbnailHTML = level.thumbnail

            ? `
                <div class="thumbnail">
                    <img
                        src="${level.thumbnail}"
                        alt="${level.name || "Level"}"
                        loading="lazy"
                    >
                </div>
            `

            : `
                <div class="thumbnail no-thumbnail">
                    NO IMAGE
                </div>
            `;


        row.innerHTML = `

            <span class="position">
                ${level.position ?? "-"}
            </span>

            ${thumbnailHTML}

            <span class="level-name">

                <strong>
                    ${level.name || "Unnamed Level"}
                </strong>

                <small>
                    ${level.difficulty || ""}
                </small>

            </span>

            <span>
                ${level.creator || "-"}
            </span>

            <span>
                ${level.verifier || "-"}
            </span>

            <span class="points">
                ${level.points ?? "-"}
            </span>

        `;


        levelsContainer.appendChild(row);

    });

}


search.addEventListener(
    "input",
    displayLevels
);


loadLevels();
