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
    currentHighestBid = state.currentHighestBid !== undefined ? state.currentHighestBid : 0;
    currentLeaderText = state.currentLeaderText || "None";
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
let currentHighestBid = 0; // Track the current live bidding amount/level
let currentLeaderText = "None"; // Tracks the leading team/captain name
let lastAuctionMessage = "";
let lastAuctionMessageType = ""; // "success", "danger", etc.
let currentViewMode = localStorage.getItem('auction_view_mode') || 'admin'; // Persist view mode across refreshes

let initialTeams = [
    { name: "Pragji Pioneers", captain: "Pavan Patel", points: 5000, squad: [] },
    { name: "Yagnapurush Yodha", captain: "Jaimin Patel", points: 5000, squad: [] },
    { name: "Varni Warriors", captain: "Meet Patel", points: 5000, squad: [] },
    { name: "Gunatit Challenders", captain: "Saral Patel", points: 5000, squad: [] },
    { name: "Not Decided Yet", captain: "Chintal Patel", points: 5000, squad: [] },
    { name: "Sahjanand Strikers", captain: "Nikunj Patel", points: 5000, squad: [] },
    { name: "Not Decided Yet", captain: "Vivek Patel", points: 5000, squad: [] },
    { name: "Not Decided Yet", captain: "Smit Patel", points: 5000, squad: [] }
];

let teams = JSON.parse(JSON.stringify(initialTeams));

// Helper to convert team name into a URL-friendly slug
function getTeamSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
        const savedLeaderText = localStorage.getItem('auction_leader_text');
        const savedMessage = localStorage.getItem('auction_last_message');
        const savedMessageType = localStorage.getItem('auction_last_message_type');

        if (savedPlayers && savedTeams) {
            players = JSON.parse(savedPlayers);
            unsoldPlayers = savedUnsold ? JSON.parse(savedUnsold) : [];
            teams = JSON.parse(savedTeams);
            currentActivePlayer = savedActivePlayer ? JSON.parse(savedActivePlayer) : null;
            auctionHistory = savedHistory ? JSON.parse(savedHistory) : [];
            currentHighestBid = savedHighestBid !== undefined ? JSON.parse(savedHighestBid) : 0;
            currentLeaderText = savedLeaderText || "None";
            lastAuctionMessage = savedMessage || "";
            lastAuctionMessageType = savedMessageType || "";
        } else {
            let response = await fetch('players.json');
            players = await response.json();
            unsoldPlayers = [];
            teams = JSON.parse(JSON.stringify(initialTeams));
            currentHighestBid = 0;
            currentLeaderText = "None";
            lastAuctionMessage = "";
            lastAuctionMessageType = "";
            saveStateToStorage();
        }
        
        // Check for URL parameters (?view=captain&team=team-slug)
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');
        const teamParam = urlParams.get('team');

        if (viewParam === 'captain') {
            currentViewMode = 'captain';
        }

        if (teamParam) {
            const badge = document.getElementById("remote-captain-badge");
            if (badge) {
                badge.style.display = "block";
                const matchedTeam = teams.find(t => getTeamSlug(t.name) === teamParam || t.name.toLowerCase().includes(teamParam.toLowerCase()));
                if (matchedTeam) {
                    badge.innerText = `Captain View: ${matchedTeam.name} (${matchedTeam.captain})`;
                }
            }
        }
        
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
    localStorage.setItem('auction_leader_text', currentLeaderText);
    localStorage.setItem('auction_last_message', lastAuctionMessage);
    localStorage.setItem('auction_last_message_type', lastAuctionMessageType);

    auctionChannel.postMessage({
        players,
        unsoldPlayers,
        teams,
        currentActivePlayer,
        auctionHistory,
        currentHighestBid,
        currentLeaderText,
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

    if (!adminContainer || !captainContainer) return;

    if (mode === 'admin') {
        adminContainer.style.display = "grid";
        captainContainer.style.display = "none";
    } else {
        adminContainer.style.display = "none";
        captainContainer.style.display = "grid";
    }
    updateUI();
}

function importPlayerPoolCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split("\n");
        let newPlayers = [];

        for (let i = 1; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;
            
            let row = [];
            let inQuotes = false;
            let currentVal = "";
            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    row.push(currentVal.trim());
                    currentVal = "";
                } else {
                    currentVal += char;
                }
            }
            row.push(currentVal.trim());

            if (row.length >= 2) {
                newPlayers.push({
                    name: row[0].replace(/^["']|["']$/g, ''),
                    category: row[1].replace(/^["']|["']$/g, ''),
                    skill: row[2] ? row[2].replace(/^["']|["']$/g, '') : '',
                    notes: row[3] ? row[3].replace(/^["']|["']$/g, '') : ''
                });
            }
        }

        if (newPlayers.length > 0) {
            players = newPlayers;
            unsoldPlayers = [];
            currentActivePlayer = null;
            auctionHistory = [];
            currentHighestBid = 0;
            currentLeaderText = "None";
            lastAuctionMessage = "📂 Player pool successfully imported from CSV!";
            lastAuctionMessageType = "success";
            saveStateToStorage();
            updateUI();
            alert(`Successfully loaded ${newPlayers.length} players from CSV!`);
        } else {
            alert("Could not parse valid player records from the CSV file.");
        }
    };
    reader.readAsText(file);
}

function downloadAuctionBackup() {
    const backupData = {
        players: players,
        unsoldPlayers: unsoldPlayers,
        teams: teams,
        currentActivePlayer: currentActivePlayer,
        auctionHistory: auctionHistory,
        currentHighestBid: currentHighestBid,
        currentLeaderText: currentLeaderText,
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
            currentHighestBid = imported.currentHighestBid !== undefined ? imported.currentHighestBid : 0;
            currentLeaderText = imported.currentLeaderText || "None";
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
            el.style.color = "#ef4444";
        } else if (lastAuctionMessageType === "success") {
            el.style.color = "#34d399";
        } else {
            el.style.color = "#34d399";
        }
    });
}

function renderActivePlayer() {
    const nameEl = document.getElementById("active-player-name");
    const catEl = document.getElementById("active-player-cat");
    const bidDisplayEl = document.getElementById("current-bid-display");
    const leadingEl = document.getElementById("leading-bidder-display");
    
    if (!nameEl || !catEl) return;

    if (!currentActivePlayer) {
        nameEl.innerText = "Select 'Next Player' to begin";
        catEl.innerText = "-";
        if (bidDisplayEl) bidDisplayEl.innerHTML = "Current Highest Bid: <strong>0 pts</strong> (No bids yet)";
        if (leadingEl) leadingEl.innerText = "Leading Team: None";
        return;
    }

    nameEl.innerText = currentActivePlayer.name;
    catEl.innerText = getCategoryLetter(currentActivePlayer.category);
    if (bidDisplayEl) {
        bidDisplayEl.innerHTML = `Current Highest Bid: <strong>${currentHighestBid} pts</strong>`;
    }
    if (leadingEl) {
        leadingEl.innerText = `Leading Team: ${currentLeaderText}`;
    }
}

function renderCaptainView() {
    const capNameEl = document.getElementById("captain-active-name");
    const capCatEl = document.getElementById("captain-active-cat");
    const capBidEl = document.getElementById("captain-active-bid");
    const capLeadingEl = document.getElementById("captain-leading-display");
    const capMetaEl = document.getElementById("captain-player-meta");
    const leftContainer = document.getElementById("captain-teams-left");
    const rightContainer = document.getElementById("captain-teams-right");

    if (!capNameEl || !capCatEl || !capBidEl) return;

    if (!currentActivePlayer) {
        capNameEl.innerText = "Waiting for next player...";
        capNameEl.style.color = "#34d399";
        capCatEl.innerText = "-";
        if (capMetaEl) capMetaEl.innerText = "";
        if (capBidEl) capBidEl.innerHTML = "Status: Standby | Current Bid: 0 pts";
        if (capLeadingEl) capLeadingEl.innerHTML = "Leading Team: None";
    } else {
        capNameEl.innerText = currentActivePlayer.name;
        capNameEl.style.color = "#34d399";
        capCatEl.innerText = getCategoryLetter(currentActivePlayer.category);
        
        if (capMetaEl) {
            let metaText = "";
            if (currentActivePlayer.skill) metaText += `Skill: ${currentActivePlayer.skill}`;
            if (currentActivePlayer.notes) metaText += (metaText ? " | " : "") + `Notes: ${currentActivePlayer.notes}`;
            capMetaEl.innerText = metaText;
            capMetaEl.style.color = "#34d399";
        }

        if (capBidEl) {
            capBidEl.innerHTML = `Status: Active | Current Bid: ${currentHighestBid} pts`;
        }
        if (capLeadingEl) {
            capLeadingEl.innerHTML = `Leading Team: ${currentLeaderText}`;
        }
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
            squadListHTML += `<li style="margin: 2px 0;">${player.name}</li>`;
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
        currentLeaderText: currentLeaderText,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType
    };
    auctionHistory.push(currentState);

    currentActivePlayer = players.shift(); 
    currentHighestBid = 0; 
    currentLeaderText = "None";
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
        currentLeaderText: currentLeaderText,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType
    };
    auctionHistory.push(currentState);

    const playerName = currentActivePlayer.name;
    unsoldPlayers.push(currentActivePlayer);

    lastAuctionMessage = `${playerName} marked as UNSOLD`;
    lastAuctionMessageType = "danger";

    currentActivePlayer = null;
    currentHighestBid = 0;
    currentLeaderText = "None";
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
    const bidRaiseAmount = parseInt(document.getElementById("bid-amount").value);
    const team = teams[teamIndex];

    if (isNaN(bidRaiseAmount) || bidRaiseAmount <= 0) {
        alert("Please enter a valid bid points amount to raise.");
        return;
    }

    const totalAuctionPicksNeeded = 10;
    const picksRemainingToBuy = totalAuctionPicksNeeded - team.squad.length;
    const mandatoryReserveForOthers = (picksRemainingToBuy - 1) * 50;
    
    let newTotalBid;
    if (currentHighestBid === 0) {
        newTotalBid = Math.max(bidRaiseAmount, 50);
    } else {
        newTotalBid = currentHighestBid + bidRaiseAmount;
    }

    const maxAllowedBid = team.points - mandatoryReserveForOthers;

    if (team.squad.length >= 10) {
        alert(`${team.name} already has a full squad of 10 auction players!`);
        return;
    }

    if (newTotalBid > maxAllowedBid) {
        alert(`Bid Rejected! Total accumulated bid (${newTotalBid} pts) exceeds ${team.name}'s safe budget limit (${maxAllowedBid} pts).`);
        return;
    }

    currentHighestBid = newTotalBid;
    currentLeaderText = `${team.name} (${team.captain})`;

    lastAuctionMessage = `📈 ${team.name} raised bid! Total: ${currentHighestBid} pts`;
    lastAuctionMessageType = "success";

    saveStateToStorage();
    updateUI();
}

function finalizeBid() {
    if (!currentActivePlayer) {
        alert("No active player to finalize sale for!");
        return;
    }

    if (currentLeaderText === "None" || currentHighestBid <= 0) {
        const confirmBase = confirm("No bids have been raised. Would you like to mark this player as UNSOLD instead?");
        if (confirmBase) {
            markAsUnsold();
        }
        return;
    }

    let winningTeam = teams.find(t => currentLeaderText.includes(t.name));
    if (!winningTeam) {
        alert("Could not automatically determine winning team from leader text. Please check or use standard bidding.");
        return;
    }

    const currentState = {
        teams: JSON.parse(JSON.stringify(teams)),
        currentActivePlayer: currentActivePlayer ? { ...currentActivePlayer } : null,
        players: [...players],
        unsoldPlayers: [...unsoldPlayers],
        currentHighestBid: currentHighestBid,
        currentLeaderText: currentLeaderText,
        lastAuctionMessage: lastAuctionMessage,
        lastAuctionMessageType: lastAuctionMessageType
    };
    auctionHistory.push(currentState);

    const playerName = currentActivePlayer.name;
    winningTeam.points -= currentHighestBid;
    winningTeam.squad.push({ name: playerName, category: currentActivePlayer.category, cost: currentHighestBid });

    lastAuctionMessage = `🎉 ${playerName} Sold to ${winningTeam.name} (${winningTeam.captain}) for ${currentHighestBid} pts!`;
    lastAuctionMessageType = "success";

    currentActivePlayer = null;
    currentHighestBid = 0;
    currentLeaderText = "None";
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
    currentHighestBid = previousState.currentHighestBid !== undefined ? previousState.currentHighestBid : 0;
    currentLeaderText = previousState.currentLeaderText || "None";
    lastAuctionMessage = "↩️ Last action undone.";
    lastAuctionMessageType = "success";

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
                squadListHTML += `<li style="margin: 2px 0;">${player.name} - <strong>${player.cost}p</strong></li>`;
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
        let li = document.createElement("div");
        li.innerHTML = `${p.name} <strong style="color: #34d399;">${catLetter}</strong>`;
        list.appendChild(li);
    });

    if (unsoldPlayers.length > 0) {
        let headerLi = document.createElement("div");
        headerLi.innerHTML = `<hr style="border-color: #374151; margin: 8px 0 6px 0;"><strong style="color: #f87171; font-size: 0.9em;">⚠️ Unsold Players (${unsoldPlayers.length}):</strong>`;
        list.appendChild(headerLi);

        unsoldPlayers.forEach(p => {
            let catLetter = getCategoryLetter(p.category);
            let li = document.createElement("div");
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

// Updated function to populate remote links modal using team name slugs
function openRemoteLinksModal() {
    const modal = document.getElementById("remote-links-modal");
    const listContainer = document.getElementById("remote-links-list");
    if (!modal || !listContainer) return;

    listContainer.innerHTML = "";
    const baseUrl = window.location.origin + window.location.pathname;

    teams.forEach((team) => {
        const slug = getTeamSlug(team.name);
        const link = `${baseUrl}?view=captain&team=${slug}`;

        const item = document.createElement("div");
        item.className = "captain-link-item";
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px;";
        
        item.innerHTML = `
            <div style="overflow: hidden; margin-right: 10px;">
                <strong style="color: #f8fafc; font-size: 0.95rem;">${team.name} (${team.captain})</strong><br>
                <span style="color: #94a3b8; font-size: 0.8rem; word-break: break-all;">${link}</span>
            </div>
            <button class="btn primary" style="font-size: 0.8rem; padding: 6px 12px; white-space: nowrap; background: #0284c7; border: none; color: white; border-radius: 4px; cursor: pointer;" onclick="navigator.clipboard.writeText('${link}').then(() => alert('Link copied for ${team.name}!'))">Copy Link</button>
        `;
        listContainer.appendChild(item);
    });

    modal.style.display = "flex";
}
