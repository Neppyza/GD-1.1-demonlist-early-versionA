import { db } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    orderBy
} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const levelsContainer =
    document.getElementById("levels");

const search =
    document.getElementById("search");


let levels = [];


async function loadLevels() {

    try {

        const levelsQuery = query(
            collection(db, "levels"),
            orderBy("position", "asc")
        );


        const snapshot =
            await getDocs(levelsQuery);


        levels = [];


        snapshot.forEach(document => {

            levels.push({

                id: document.id,

                ...document.data()

            });

        });


        displayLevels();

    }

    catch (error) {

        console.error(error);

        levelsContainer.innerHTML = `
            <div class="error">
                Could not load the demonlist.
            </div>
        `;

    }

}


function displayLevels() {

    const searchText =
        search.value.toLowerCase();


    const filtered =
        levels.filter(level => {

            return (

                level.name
                    .toLowerCase()
                    .includes(searchText)

                ||

                level.creator
                    .toLowerCase()
                    .includes(searchText)

            );

        });


    levelsContainer.innerHTML = "";


    filtered.forEach(level => {

        const row =
            document.createElement("a");


        row.className = "level-row";


        row.href =
            `level.html?id=${level.id}`;


        row.innerHTML = `

            <span class="position">
                ${level.position}
            </span>


            <span class="level-name">

                <strong>
                    ${level.name}
                </strong>

                <small>
                    ${level.difficulty || ""}
                </small>

            </span>


            <span>
                ${level.creator}
            </span>


            <span>
                ${level.verifier || "-"}
            </span>


            <span class="points">
                ${level.points}
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