// State Management
let players = [];
let unsoldPlayers = []; 
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

// Helper function to map category numbers to plain letters (A, B, C)
function getCategoryLetter(cat) {
    if (cat === 1 || cat === "1") return "A";
    if (cat === 2 || cat === "2") return "B";
    if (cat === 3 || cat === "3") return "C";
    return cat || "-";
}

// Initialize application on load
window.onload = async function() {
    try {
        const savedPlayers = localStorage.getItem('auction_players');
        const savedUnsold = localStorage.getItem('auction_unsold_players');
        const savedTeams = localStorage.getItem('auction_teams');
        const savedActivePlayer = localStorage.getItem('auction_active_player');
        const savedHistory = localStorage.getItem('auction_history');

        if (savedPlayers && savedTeams) {
            players = JSON.parse(savedPlayers);
            unsoldPlayers = savedUnsold ? JSON.parse(savedUnsold) : [];
            teams = JSON.parse(savedTeams);
            currentActivePlayer = savedActivePlayer ? JSON.parse(savedActivePlayer) : null;
            auctionHistory = savedHistory ? JSON.parse(savedHistory) : [];
        } else {
            // First time load: fetch from players.json
            let response = await fetch('players.json');
            players = await response.json();
            unsoldPlayers = [];
            teams = JSON.parse(JSON.stringify(initialTeams));
            saveStateToStorage();
        }
        
        updateUI();
    } catch (error) {
        console.error("Could not load players.json", error);
    }
};

// Helper function to save current state into browser storage
function saveStateToStorage() {
    localStorage.setItem('auction_players', JSON.stringify(players));
    localStorage.setItem('auction_unsold_players', JSON.stringify(unsoldPlayers));
    localStorage.setItem('auction_teams', JSON.stringify(teams));
    localStorage.setItem('auction_active_player', JSON.stringify(currentActivePlayer));
    localStorage.setItem('auction_history', JSON.stringify(auctionHistory));
}

// Emergency Backup Download Function
function downloadAuctionBackup() {
    const backupData = {
        players: players,
        unsoldPlayers: unsoldPlayers,
        teams: teams,
        currentActivePlayer: currentActivePlayer,
        auctionHistory: auctionHistory,
        timestamp: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `auction_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Emergency State Restoration Function
function importAuctionState(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            players = imported.players || [];
            unsoldPlayers = imported.unsoldPlayers || [];
            teams = imported.teams || [];
            currentActivePlayer = imported.currentActivePlayer || null;
            auctionHistory = imported.auctionHistory || [];
            
            saveStateToStorage();
            updateUI();
            alert("Auction state successfully restored!");
        } catch (err) {
            alert("Invalid backup file format.");
        }
    };
    reader.readAsText(file);
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
    catEl.innerText = getCategoryLetter(currentActivePlayer.category);
}

function nextPlayer() {
    // If main pool is empty, check for unsold players and prompt reauction
    if (players.length === 0) {
        if (unsoldPlayers.length > 0) {
            const startReauction = confirm("Main player pool is completely finished! Would you like to start re-auctioning the Unsold Players now?");
            if (startReauction) {
                players = [...unsoldPlayers];
                unsoldPlayers = [];
                alert("Unsold pool loaded back in! Starting Re-Auction round.");
            } else {
                return;
            }
        } else {
            alert("All players have been successfully auctioned or processed!");
            return;
        }
    }

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players],
        unsoldPlayers: [...unsoldPlayers]
    };
    auctionHistory.push(currentState);

    currentActivePlayer = players.shift(); 
    
    const announcementEl = document.getElementById("sold-announcement");
    if (announcementEl) announcementEl.innerText = "";

    saveStateToStorage();
    updateUI();
}

// Function to mark current active player as Unsold with clear display messaging
function markAsUnsold() {
    if (!currentActivePlayer) {
        alert("No active player to mark as unsold!");
        return;
    }

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players],
        unsoldPlayers: [...unsoldPlayers]
    };
    auctionHistory.push(currentState);

    const playerName = currentActivePlayer.name;
    unsoldPlayers.push(currentActivePlayer);

    const announcementEl = document.getElementById("sold-announcement");
    if (announcementEl) {
        announcementEl.innerText = `⚠️ ${playerName} marked as UNSOLD and moved to the Unsold Players column.`;
        announcementEl.style.color = "#f87171";
    }

    currentActivePlayer = null;
    saveStateToStorage();
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
        players: [...players],
        unsoldPlayers: [...unsoldPlayers]
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
        announcementEl.style.color = "#34d399";
    }

    currentActivePlayer = null;
    saveStateToStorage();
    updateUI();
}

function undoLastBid() {
    if (auctionHistory.length === 0) {
        alert("No recent actions to undo!");
        return;
    }

    const previousState = auctionHistory.pop();
    teams = previousState.teams;
    currentActivePlayer = previousState.currentActivePlayer;
    players = previousState.players;
    unsoldPlayers = previousState.unsoldPlayers || [];

    const announcementEl = document.getElementById("sold-announcement");
    if (announcementEl) announcementEl.innerText = "↩️ Last action undone.";

    saveStateToStorage();
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
    
    // Render main available pool
    players.forEach(p => {
        let catLetter = getCategoryLetter(p.category);
        let li = document.createElement("li");
        li.innerHTML = `${p.name} <strong style="color: #34d399;">${catLetter}</strong>`;
        list.appendChild(li);
    });

    // Render separate Unsold Players Column section if items exist
    if (unsoldPlayers.length > 0) {
        let headerLi = document.createElement("li");
        headerLi.innerHTML = `<hr style="border-color: #374151; margin: 12px 0 8px 0;"><strong style="color: #f87171; font-size: 0.9em;">⚠️ Unsold Players (${unsoldPlayers.length}):</strong>`;
        list.appendChild(headerLi);

        unsoldPlayers.forEach(p => {
            let catLetter = getCategoryLetter(p.category);
            let li = document.createElement("li");
            li.style.color = "#9ca3af";
            li.innerHTML = `${p.name} <strong style="color: #f87171;">${catLetter}</strong>`;
            list.appendChild(li);
        });
    }
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
