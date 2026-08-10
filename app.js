// State Management
let players = [];
let currentActivePlayer = null;
let auctionHistory = []; // Stack to keep history for undo functionality

// 8 Teams with pre-assigned Captains and 5000 starting points
let teams = [
    { name: "Team 1", captain: "Pavan Patel", points: 5000, squad: [] },
    { name: "Team 2", captain: "Jaimin Patel", points: 5000, squad: [] },
    { name: "Team 3", captain: "Meet Patel", points: 5000, squad: [] },
    { name: "Team 4", captain: "Saral Patel", points: 5000, squad: [] },
    { name: "Team 5", captain: "Chintal Patel", points: 5000, squad: [] },
    { name: "Team 6", captain: "Nikunj Patel", points: 5000, squad: [] },
    { name: "Team 7", captain: "Vivek Patel", points: 5000, squad: [] },
    { name: "Team 8", captain: "Smit Patel", points: 5000, squad: [] }
];

// Initialize application on load
window.onload = async function() {
    try {
        let response = await fetch('players.json');
        players = await response.json();
        updateUI();
    } catch (error) {
        console.error("Could not load players.json", error);
    }
};

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
    catEl.innerText = currentActivePlayer.category;
}

function nextPlayer() {
    if (players.length === 0) {
        alert("All players have been auctioned!");
        return;
    }
    
    currentActivePlayer = players.shift(); // Pulls the first player from the queue
    updateUI();
}

function populateTeamDropdown() {
    const select = document.getElementById("bidder-select");
    select.innerHTML = "";
    teams.forEach((team, index) => {
        let opt = document.createElement("option");
        opt.value = index;
        // Total players needed to buy from auction is 10
        opt.innerText = `${team.name} (${team.captain}) - Left: ${team.points} pts, Bought: ${team.squad.length}/10`;
        select.appendChild(opt);
    });
}

function submitBid() {
    if (!currentActivePlayer) {
        alert("Please select an active player first!");
        return;
    }

    const teamIndex = document.getElementById("bidder-select").value;
    const bidAmount = parseInt(document.getElementById("bid-amount").value);
    const team = teams[teamIndex];

    const totalAuctionPicksNeeded = 10;
    const picksRemainingToBuy = totalAuctionPicksNeeded - team.squad.length;

    // Mathematical Guardrail: Must reserve 50 points for each remaining unpurchased slot
    const mandatoryReserveForOthers = (picksRemainingToBuy - 1) * 50;
    const maxAllowedBid = team.points - mandatoryReserveForOthers;

    // Validation checks
    if (team.squad.length >= 10) {
        alert(`${team.name} already has a full squad of 10 auction players (plus their captain)!`);
        return;
    }

    if (bidAmount < 50) {
        alert("Minimum bid amount is 50 points.");
        return;
    }

    if (bidAmount > maxAllowedBid) {
        alert(`Bid Rejected! ${team.name} must retain at least 50 points for each of their remaining ${picksRemainingToBuy - 1} auction slots.\nMax safe bid for this team right now is: ${maxAllowedBid} points.`);
        return;
    }

    // Save a deep snapshot of the state *right before* executing the purchase
    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players]
    };
    auctionHistory.push(currentState);

    // Execute the purchase
    team.points -= bidAmount;
    team.squad.push({ name: currentActivePlayer.name, category: currentActivePlayer.category, cost: bidAmount });

    alert(`${currentActivePlayer.name} sold to ${team.name} (${team.captain}) for ${bidAmount} points!`);

    // Reset current player and refresh UI
    currentActivePlayer = null;
    updateUI();
}

function undoLastBid() {
    if (auctionHistory.length === 0) {
        alert("No recent bids to undo!");
        return;
    }

    // Pop the previous state from history stack and restore it
    const previousState = auctionHistory.pop();
    teams = previousState.teams;
    currentActivePlayer = previousState.currentActivePlayer;
    players = previousState.players;

    updateUI();
    alert("Last bid successfully undone!");
}

function renderTeams() {
    const container = document.getElementById("teams-container");
    container.innerHTML = "";

    teams.forEach(team => {
        let div = document.createElement("div");
        div.className = "team-card";
        
        // Calculate progress percentage for squad size (max 10 players)
        const progressPercent = (team.squad.length / 10) * 100;

        // Generate an itemized list of players bought by this team
        let squadListHTML = "";
        if (team.squad.length === 0) {
            squadListHTML = `<p class="purchased-players" style="font-style: italic;">No players bought yet.</p>`;
        } else {
            squadListHTML = `<div class="purchased-players"><ul style="margin: 0; padding-left: 15px;">`;
            team.squad.forEach(player => {
                squadListHTML += `<li>${player.name} <span style="color: #34d399;">[Cat ${player.category}]</span> - <strong>${player.cost} pts</strong></li>`;
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
                Squad: <strong>${team.squad.length} / 10</strong> players
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
    list.innerHTML = "";
    players.forEach(p => {
        let li = document.createElement("li");
        li.innerText = `${p.name} [Cat ${p.category}]`;
        list.appendChild(li);
    });
}
