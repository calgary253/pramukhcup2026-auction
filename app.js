// State Management
let players = [];
let currentActivePlayer = null;
let auctionHistory = []; // Stack to keep history for undo functionality

// 8 Teams with pre-assigned Captains and 5000 starting points
let initialTeams = [
    { name: "Team 1", captain: "Pavan Patel", points: 5000, squad: [] },
    { name: "Team 2", captain: "Jaimin Patel", points: 5000, squad: [] },
    { name: "Team 3", captain: "Meet Patel", points: 5000, squad: [] },
    { name: "Team 4", captain: "Saral Patel", points: 5000, squad: [] },
    { name: "Team 5", captain: "Chintal Patel", points: 5000, squad: [] },
    { name: "Team 6", captain: "Nikunj Patel", points: 5000, squad: [] },
    { name: "Team 7", captain: "Vivek Patel", points: 5000, squad: [] },
    { name: "Team 8", captain: "Smit Patel", points: 5000, squad: [] }
];

let teams = JSON.parse(JSON.stringify(initialTeams));

// --- Firebase Configuration ---
// TODO: Replace with your web app's Firebase configuration from your Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const AUCTION_DOC_ID = "live_auction_state"; // Document key in Firestore

// Helper function to map category numbers to letters (A, B, C)
function getCategoryLetter(cat) {
    if (cat === 1 || cat === "1") return "A";
    if (cat === 2 || cat === "2") return "B";
    if (cat === 3 || cat === "3") return "C";
    return cat || "-";
}

// Initialize application on load & pull from Cloud Database
window.onload = async function() {
    try {
        const docRef = db.collection("auctions").doc(AUCTION_DOC_ID);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            players = data.players || [];
            teams = data.teams || initialTeams;
            currentActivePlayer = data.currentActivePlayer || null;
            auctionHistory = data.auctionHistory || [];
        } else {
            // First time load: fetch from players.json and set default state in DB
            let response = await fetch('players.json');
            players = await response.json();
            teams = JSON.parse(JSON.stringify(initialTeams));
            await saveStateToStorage();
        }
        
        updateUI();
    } catch (error) {
        console.error("Error loading auction state from database:", error);
    }
};

// Save current state into Firebase Firestore Database
async function saveStateToStorage() {
    try {
        await db.collection("auctions").doc(AUCTION_DOC_ID).set({
            players: players,
            teams: teams,
            currentActivePlayer: currentActivePlayer,
            auctionHistory: auctionHistory,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving state to database:", error);
    }
}

function updateUI() {
    renderActivePlayer();
    renderTeams();
    renderPlayerPool();
    populateTeamDropdown();
}

function renderActivePlayer() {
    const nameEl = document.getElementById("active-player-name");
    const catEl = document.getElementById("active-player-cat");
    
    if (!currentActivePlayer) {
        nameEl.innerText = "Select 'Next Player' to begin";
        catEl.innerText = "-";
        return;
    }

    nameEl.innerText = currentActivePlayer.name;
    // Displays purely as A, B, or C without brackets
    catEl.innerText = getCategoryLetter(currentActivePlayer.category);
}

async function nextPlayer() {
    if (players.length === 0) {
        alert("All players have been auctioned!");
        return;
    }

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players]
    };
    auctionHistory.push(currentState);

    currentActivePlayer = players.shift(); 
    
    const announcementEl = document.getElementById("sold-announcement");
    if (announcementEl) announcementEl.innerText = "";

    await saveStateToStorage();
    updateUI();
}

function populateTeamDropdown() {
    const select = document.getElementById("bidder-select");
    if (!select) return;
    select.innerHTML = "";
    teams.forEach((team, index) => {
        let opt = document.createElement("option");
        opt.value = index;
        opt.innerText = `${team.name} (${team.captain}) - Left: ${team.points} pts, Bought: ${team.squad.length}/10`;
        select.appendChild(opt);
    });
}

async function submitBid() {
    if (!currentActivePlayer) {
        alert("Please select an active player first!");
        return;
    }

    const teamIndex = document.getElementById("bidder-select").value;
    const bidAmount = parseInt(document.getElementById("bid-amount").value);
    const team = teams[teamIndex];

    const totalAuctionPicksNeeded = 10;
    const picksRemainingToBuy = totalAuctionPicksNeeded - team.squad.length;
    const mandatoryReserveForOthers = (picksRemainingToBuy - 1) * 50;
    const maxAllowedBid = team.points - mandatoryReserveForOthers;

    if (team.squad.length >= 10) {
        alert(`${team.name} already has a full squad of 10 auction players!`);
        return;
    }

    if (bidAmount < 50) {
        alert("Minimum bid amount is 50 points.");
        return;
    }

    if (bidAmount > maxAllowedBid) {
        alert(`Bid Rejected! Max safe bid is ${maxAllowedBid} points.`);
        return;
    }

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players]
    };
    auctionHistory.push(currentState);

    const playerName = currentActivePlayer.name;
    const teamName = team.name;
    const captainName = team.captain;

    team.points -= bidAmount;
    team.squad.push({ name: playerName, category: currentActivePlayer.category, cost: bidAmount });

    const announcementEl = document.getElementById("sold-announcement");
    if (announcementEl) {
        announcementEl.innerText = `🎉 ${playerName} Sold to ${teamName} (${captainName}) for ${bidAmount} pts!`;
    }

    currentActivePlayer = null;
    await saveStateToStorage();
    updateUI();
}

async function undoLastBid() {
    if (auctionHistory.length === 0) {
        alert("No recent bids to undo!");
        return;
    }

    const previousState = auctionHistory.pop();
    teams = previousState.teams;
    currentActivePlayer = previousState.currentActivePlayer;
    players = previousState.players;

    const announcementEl = document.getElementById("sold-announcement");
    if (announcementEl) announcementEl.innerText = "↩️ Last action undone.";

    await saveStateToStorage();
    updateUI();
}

function renderTeams() {
    const container = document.getElementById("teams-container");
    if (!container) return;
    container.innerHTML = "";

    teams.forEach(team => {
        let div = document.createElement("div");
        div.className = "team-card";
        const progressPercent = (team.squad.length / 10) * 100;

        let squadListHTML = "";
        if (team.squad.length === 0) {
            squadListHTML = `<p class="purchased-players" style="font-style: italic; color: var(--text-muted);">No players bought yet.</p>`;
        } else {
            squadListHTML = `<div class="purchased-players"><ul style="margin: 0; padding-left: 15px;">`;
            team.squad.forEach(player => {
                let catLetter = getCategoryLetter(player.category);
                squadListHTML += `<li style="margin: 4px 0;">${player.name} <span style="color: #34d399;">${catLetter}</span> - <strong>${player.cost} pts</strong></li>`;
            });
            squadListHTML += `</ul></div>`;
        }

        div.innerHTML = `
            <h3>${team.name} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.9em;">(${team.captain})</span></h3>
            <div class="points-display">
                <span>Points Left:</span>
                <span>${team.points} / 5000</span>
            </div>
            <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-muted);">
                Squad Progress: <strong>${team.squad.length} / 10</strong> players
            </div>
            <div class="squad-progress">
                <div class="squad-progress-bar" style="width: ${progressPercent}%;"></div>
            </div>
            ${squadListHTML}
        `;
        container.appendChild(div);
    });
}

function renderPlayerPool() {
    const list = document.getElementById("player-pool-list");
    if (!list) return;
    list.innerHTML = "";
    players.forEach(p => {
        let catLetter = getCategoryLetter(p.category);
        let li = document.createElement("li");
        li.innerHTML = `${p.name} <strong style="color: #34d399;">${catLetter}</strong>`;
        list.appendChild(li);
    });
}

function downloadSquadCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Team Name,Captain,Points Left,Player Name,Category,Cost (Points)\n";

    teams.forEach(team => {
        if (team.squad.length === 0) {
            let row = `"${team.name}","${team.captain}",${team.points},"None","N/A",0`;
            csvContent += row + "\n";
        } else {
            team.squad.forEach(player => {
                let catLetter = getCategoryLetter(player.category);
                let row = `"${team.name}","${team.captain}",${team.points},"${player.name}","${catLetter}",${player.cost}`;
                csvContent += row + "\n";
            });
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Pramukh_Cup_2026_Squads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

