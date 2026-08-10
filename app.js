// ==========================================
// LOCAL NETWORK SYNC VIA BROADCAST CHANNEL
// ==========================================
const auctionChannel = new BroadcastChannel('pramukh_cup_local_network_auction');

// Listen for updates sent from the Admin screen to update Captain screens instantly
auctionChannel.onmessage = (event) => {
    const state = event.data;
    players = state.players;
    unsoldPlayers = state.unsoldPlayers;
    teams = state.teams;
    currentActivePlayer = state.currentActivePlayer;
    auctionHistory = state.auctionHistory;
    currentHighestBid = state.currentHighestBid !== undefined ? state.currentHighestBid : 50;
    lastAuctionMessage = state.lastAuctionMessage || "";
    lastAuctionMessageType = state.lastAuctionMessageType || "";
    
    // Instantly update whichever view is open on this device
    updateUI();
};

// State Management
let players = [];
let unsoldPlayers = []; 
let currentActivePlayer = null;
let auctionHistory = []; // Stack to keep history for undo functionality
let currentHighestBid = 50; // Track the current live bidding amount/level
let lastAuctionMessage = "";
let lastAuctionMessageType = ""; // "success", "danger", etc.
let currentViewMode = localStorage.getItem('auction_view_mode') || 'admin'; // Persist view mode across refreshes

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

function getCategoryLetter(cat) {
    if (cat === 1 || cat === "1") return "A";
    if (cat === 2 || cat === "2") return "B";
    if (cat === 3 || cat === "3") return "C";
    return cat || "-";
}

window.onload = async function() {
    try {
        const savedPlayers = localStorage.getItem('auction_players');
        const savedUnsold = localStorage.getItem('auction_unsold_players');
        const savedTeams = localStorage.getItem('auction_teams');
        const savedActivePlayer = localStorage.getItem('auction_active_player');
        const savedHistory = localStorage.getItem('auction_history');
        const savedHighestBid = localStorage.getItem('auction_highest_bid');
        const savedMessage = localStorage.getItem('auction_last_message');
        const savedMessageType = localStorage.getItem('auction_last_message_type');

        if (savedPlayers && savedTeams) {
            players = JSON.parse(savedPlayers);
            unsoldPlayers = savedUnsold ? JSON.parse(savedUnsold) : [];
            teams = JSON.parse(savedTeams);
            currentActivePlayer = savedActivePlayer ? JSON.parse(savedActivePlayer) : null;
            auctionHistory = savedHistory ? JSON.parse(savedHistory) : [];
            currentHighestBid = savedHighestBid ? JSON.parse(savedHighestBid) : 50;
            lastAuctionMessage = savedMessage || "";
            lastAuctionMessageType = savedMessageType || "";
        } else {
            let response = await fetch('players.json');
            players = await response.json();
            unsoldPlayers = [];
            teams = JSON.parse(JSON.stringify(initialTeams));
            currentHighestBid = 50;
            lastAuctionMessage = "";
            lastAuctionMessageType = "";
            saveStateToStorage();
        }
        
        // Apply the remembered view mode on load so refreshes stick to captain or admin view
        switchView(currentViewMode, false);
        updateUI();
    } catch (error) {
        console.error("Could not load players.json", error);
    }
};

function saveStateToStorage() {
    localStorage.setItem('auction_players', JSON.stringify(players));
    localStorage.setItem('auction_unsold_players', JSON.stringify(unsoldPlayers));
    localStorage.setItem('auction_teams', JSON.stringify(teams));
    localStorage.setItem('auction_active_player', JSON.stringify(currentActivePlayer));
    localStorage.setItem('auction_history', JSON.stringify(auctionHistory));
    localStorage.setItem('auction_highest_bid', JSON.stringify(currentHighestBid));
    localStorage.setItem('auction_last_message', lastAuctionMessage);
    localStorage.setItem('auction_last_message_type', lastAuctionMessageType);

    // Broadcast the updated state to all other open screens/devices on the same Wi-Fi
    auctionChannel.postMessage({
        players,
        unsoldPlayers,
        teams,
        currentActivePlayer,
        auctionHistory,
        currentHighestBid,
        lastAuctionMessage,
        lastAuctionMessageType
    });
}

function switchView(mode, savePreference = true) {
    currentViewMode = mode;
    if (savePreference) {
        localStorage.setItem('auction_view_mode', mode);
    }

    const adminContainer = document.getElementById("admin-view-container");
    const captainContainer = document.getElementById("captain-view-container");
    const btnAdmin = document.getElementById("btn-view-admin");
    const btnCaptain = document.getElementById("btn-view-captain");

    if (!adminContainer || !captainContainer) return;

    if (mode === 'admin') {
        adminContainer.style.display = "grid";
        captainContainer.style.display = "none";
        if (btnAdmin && btnCaptain) {
            btnAdmin.style.background = "#0284c7";
            btnAdmin.style.color = "white";
            btnCaptain.style.background = "transparent";
            btnCaptain.style.color = "#a7f3d0";
        }
    } else {
        adminContainer.style.display = "none";
        captainContainer.style.display = "grid";
        if (btnAdmin && btnCaptain) {
            btnCaptain.style.background = "#0284c7";
            btnCaptain.style.color = "white";
            btnAdmin.style.background = "transparent";
            btnAdmin.style.color = "#a7f3d0";
        }
    }
    updateUI();
}

function downloadAuctionBackup() {
    const backupData = {
        players: players,
        unsoldPlayers: unsoldPlayers,
        teams: teams,
        currentActivePlayer: currentActivePlayer,
        auctionHistory: auctionHistory,
        currentHighestBid: currentHighestBid,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType,
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
            currentHighestBid = imported.currentHighestBid !== undefined ? imported.currentHighestBid : 50;
            lastAuctionMessage = imported.lastAuctionMessage || "";
            lastAuctionMessageType = imported.lastAuctionMessageType || "";
            
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
    renderCaptainView();
    renderAnnouncements();
}

function renderAnnouncements() {
    const adminAnnouncementEl = document.getElementById("sold-announcement");
    const captainAnnouncementEl = document.getElementById("captain-sold-announcement");

    [adminAnnouncementEl, captainAnnouncementEl].forEach(el => {
        if (!el) return;
        el.innerText = lastAuctionMessage;
        if (lastAuctionMessageType === "danger") {
            el.style.color = "#f87171";
        } else if (lastAuctionMessageType === "success") {
            el.style.color = "#34d399";
        } else {
            el.style.color = "inherit";
        }
    });
}

function renderActivePlayer() {
    const nameEl = document.getElementById("active-player-name");
    const catEl = document.getElementById("active-player-cat");
    const bidDisplayEl = document.getElementById("current-bid-display");
    
    if (!nameEl || !catEl) return;

    if (!currentActivePlayer) {
        nameEl.innerText = "Select 'Next Player' to begin";
        catEl.innerText = "-";
        if (bidDisplayEl) bidDisplayEl.innerText = "0";
        return;
    }

    nameEl.innerText = currentActivePlayer.name;
    catEl.innerText = getCategoryLetter(currentActivePlayer.category);
    if (bidDisplayEl) bidDisplayEl.innerText = currentHighestBid;
}

function renderCaptainView() {
    const capNameEl = document.getElementById("captain-active-name");
    const capCatEl = document.getElementById("captain-active-cat");
    const capBidEl = document.getElementById("captain-active-bid");
    const leftContainer = document.getElementById("captain-teams-left");
    const rightContainer = document.getElementById("captain-teams-right");

    if (!capNameEl || !capCatEl || !capBidEl) return;

    if (!currentActivePlayer) {
        capNameEl.innerText = "Waiting for next player...";
        capCatEl.innerText = "-";
        capBidEl.innerText = "Current Bidding Level / Status: Standby";
    } else {
        capNameEl.innerText = currentActivePlayer.name;
        capCatEl.innerText = getCategoryLetter(currentActivePlayer.category);
        capBidEl.innerText = `Current Bidding Level / Status: Active Player in Category ${getCategoryLetter(currentActivePlayer.category)} | Current Bid: ${currentHighestBid} pts`;
    }

    if (leftContainer) {
        leftContainer.innerHTML = "";
        teams.slice(0, 4).forEach(team => {
            leftContainer.appendChild(createCaptainTeamCard(team));
        });
    }

    if (rightContainer) {
        rightContainer.innerHTML = "";
        teams.slice(4, 8).forEach(team => {
            rightContainer.appendChild(createCaptainTeamCard(team));
        });
    }
}

function createCaptainTeamCard(team) {
    let div = document.createElement("div");
    div.className = "team-card";
    const progressPercent = (team.squad.length / 10) * 100;

    let squadListHTML = "";
    if (team.squad.length === 0) {
        squadListHTML = `<p class="purchased-players" style="font-style: italic; color: var(--text-muted); margin: 0;">No players bought yet.</p>`;
    } else {
        squadListHTML = `<div class="purchased-players"><ul style="margin: 0; padding-left: 15px;">`;
        team.squad.forEach(player => {
            let catLetter = getCategoryLetter(player.category);
            squadListHTML += `<li style="margin: 2px 0;">${player.name} <span style="color: #34d399;">${catLetter}</span></li>`;
        });
        squadListHTML += `</ul></div>`;
    }

    div.innerHTML = `
        <h3>${team.name} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.85em;">(${team.captain})</span></h3>
        <div class="points-display">
            <span>Points Left:</span>
            <span>${team.points} / 5000</span>
        </div>
        <div style="margin-top: 4px; font-size: 0.85em; color: var(--text-muted);">
            Squad: <strong>${team.squad.length} / 10</strong> players
        </div>
        <div class="squad-progress">
            <div class="squad-progress-bar" style="width: ${progressPercent}%;"></div>
        </div>
        ${squadListHTML}
    `;
    return div;
}

function nextPlayer() {
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
        unsoldPlayers: [...unsoldPlayers],
        currentHighestBid: currentHighestBid,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType
    };
    auctionHistory.push(currentState);

    currentActivePlayer = players.shift(); 
    currentHighestBid = 50; // Reset starting bid amount for the new player
    lastAuctionMessage = "";
    lastAuctionMessageType = "";

    saveStateToStorage();
    updateUI();
}

function markAsUnsold() {
    if (!currentActivePlayer) {
        alert("No active player to mark as unsold!");
        return;
    }

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players],
        unsoldPlayers: [...unsoldPlayers],
        currentHighestBid: currentHighestBid,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType
    };
    auctionHistory.push(currentState);

    const playerName = currentActivePlayer.name;
    unsoldPlayers.push(currentActivePlayer);

    lastAuctionMessage = `⚠️ ${playerName} marked as UNSOLD and moved to the Unsold Players column.`;
    lastAuctionMessageType = "danger";

    currentActivePlayer = null;
    currentHighestBid = 50;
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

    if (bidAmount < currentHighestBid) {
        alert(`Bid amount must be at least equal to current highest bid (${currentHighestBid} points).`);
        return;
    }

    if (bidAmount > maxAllowedBid) {
        alert(`Bid Rejected! Max safe bid is ${maxAllowedBid} points.`);
        return;
    }

    // Update the live bidding state
    currentHighestBid = bidAmount;

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players],
        unsoldPlayers: [...unsoldPlayers],
        currentHighestBid: currentHighestBid,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType
    };
    auctionHistory.push(currentState);

    const playerName = currentActivePlayer.name;
    const teamName = team.name;
    const captainName = team.captain;

    team.points -= bidAmount;
    team.squad.push({ name: playerName, category: currentActivePlayer.category, cost: bidAmount });

    lastAuctionMessage = `🎉 ${playerName} Sold to ${teamName} (${captainName}) for ${bidAmount} pts!`;
    lastAuctionMessageType = "success";

    currentActivePlayer = null;
    currentHighestBid = 50;
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
    currentHighestBid = previousState.currentHighestBid !== undefined ? previousState.currentHighestBid : 50;
    lastAuctionMessage = previousState.lastAuctionMessage !== undefined ? previousState.lastAuctionMessage : "↩️ Last action undone.";
    lastAuctionMessageType = previousState.lastAuctionMessageType || "";

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
            squadListHTML = `<p class="purchased-players" style="font-style: italic; color: var(--text-muted); margin: 0;">No players bought yet.</p>`;
        } else {
            squadListHTML = `<div class="purchased-players"><ul style="margin: 0; padding-left: 15px;">`;
            team.squad.forEach(player => {
                let catLetter = getCategoryLetter(player.category);
                squadListHTML += `<li style="margin: 2px 0;">${player.name} <span style="color: #34d399;">${catLetter}</span> - <strong>${player.cost}p</strong></li>`;
            });
            squadListHTML += `</ul></div>`;
        }

        div.innerHTML = `
            <h3>${team.name} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.85em;">(${team.captain})</span></h3>
            <div class="points-display">
                <span>Points Left:</span>
                <span>${team.points} / 5000</span>
            </div>
            <div style="margin-top: 4px; font-size: 0.85em; color: var(--text-muted);">
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
    if (!list) return;
    list.innerHTML = "";
    
    players.forEach(p => {
        let catLetter = getCategoryLetter(p.category);
        let li = document.createElement("li");
        li.innerHTML = `${p.name} <strong style="color: #34d399;">${catLetter}</strong>`;
        list.appendChild(li);
    });

    if (unsoldPlayers.length > 0) {
        let headerLi = document.createElement("li");
        headerLi.innerHTML = `<hr style="border-color: #374151; margin: 8px 0 6px 0;"><strong style="color: #f87171; font-size: 0.9em;">⚠️ Unsold Players (${unsoldPlayers.length}):</strong>`;
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
