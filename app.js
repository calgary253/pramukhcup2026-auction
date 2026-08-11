// ==========================================
// FIREBASE REAL-TIME CLOUD SYNC CONFIGURATION
// ==========================================
const firebaseConfig = {
    databaseURL: "https://pramukhcup-2026-auction-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const dbRef = firebase.database().ref('auction_state');

// State Management variables
let players = [];
let unsoldPlayers = []; 
let currentActivePlayer = null;
let auctionHistory = []; 
let currentHighestBid = 0; 
let currentLeaderText = "None"; 
let lastAuctionMessage = "";
let lastAuctionMessageType = ""; 
let currentViewMode = localStorage.getItem('auction_view_mode') || 'admin'; 

// STEP 1: Updated initialTeams with explicit squad array
let initialTeams = [
    { name: "Pragji Pioneers", captain: "Pavan Patel", points: 5000, squad: [] },
    { name: "Yagnapurush Yodha", captain: "Jaimin Patel", points: 5000, squad: [] },
    { name: "Varni Warriors", captain: "Meet Patel", points: 5000, squad: [] },
    { name: "Rajipo Royals", captain: "Saral Patel", points: 5000, squad: [] },
    { name: "Akshar United", captain: "Chintal Patel", points: 5000, squad: [] },
    { name: "Sahjanand Strikers", captain: "Nikunj Patel", points: 5000, squad: [] },
    { name: "Sarang Sirens", captain: "Vivek Patel", points: 5000, squad: [] },
    { name: "Keshav Challengers", captain: "Smit Patel", points: 5000, squad: [] }
];

let teams = JSON.parse(JSON.stringify(initialTeams));

// Helper to convert team name into a URL-friendly slug
function getTeamSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getCategoryLetter(cat) {
    if (!cat) return "-";
    const cleanCat = String(cat).trim().toUpperCase();
    if (cleanCat.includes('1') || cleanCat === 'A') return "A";
    if (cleanCat.includes('2') || cleanCat === 'B') return "B";
    if (cleanCat.includes('3') || cleanCat === 'C') return "C";
    return cleanCat.replace(/CAT\s*/gi, ''); 
}

window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const teamParam = urlParams.get('team');

    if (viewParam === 'captain' || teamParam) {
        currentViewMode = 'captain';
        document.body.classList.add('captain-view-mode');
    }

    // Listen to real-time changes from Firebase Cloud Database
    dbRef.on('value', async (snapshot) => {
        const cloudState = snapshot.val();
        if (cloudState && cloudState.teams && cloudState.teams.length > 0) {
            players = cloudState.players || [];
            unsoldPlayers = cloudState.unsoldPlayers || [];
            teams = cloudState.teams;
            currentActivePlayer = cloudState.currentActivePlayer || null;
            auctionHistory = cloudState.auctionHistory || [];
            currentHighestBid = cloudState.currentHighestBid !== undefined ? cloudState.currentHighestBid : 0;
            currentLeaderText = cloudState.currentLeaderText || "None";
            lastAuctionMessage = cloudState.lastAuctionMessage || "";
            lastAuctionMessageType = cloudState.lastAuctionMessageType || "";
            
            updateUI();
        } else {
            // If cloud state is completely empty on first load, populate default player pool
            await loadInitialPlayerPool();
        }
    });

    if (teamParam) {
        const badge = document.getElementById("remote-captain-badge");
        if (badge) {
            badge.style.display = "block";
            setTimeout(() => {
                const matchedTeam = teams.find(t => getTeamSlug(t.name) === teamParam || t.name.toLowerCase().includes(teamParam.toLowerCase()));
                if (matchedTeam) {
                    badge.innerText = `Captain View: ${matchedTeam.name} (${matchedTeam.captain})`;
                }
            }, 500);
        }
    }
    
    switchView(currentViewMode, false);
};

async function loadInitialPlayerPool() {
    try {
        let response = await fetch('players.json');
        if (!response.ok) throw new Error("Network response failed");
        players = await response.json();
    } catch (error) {
        console.warn("Could not load players.json (CORS/Missing file). Using default fallback pool:", error);
        players = [
            { name: "Sample Player 1", category: "1", skillLevel: "Advanced", notes: "All-rounder" },
            { name: "Sample Player 2", category: "2", skillLevel: "Intermediate", notes: "Batsman" },
            { name: "Sample Player 3", category: "3", skillLevel: "Beginner", notes: "Bowler" }
        ];
    }
    
    unsoldPlayers = [];
    teams = JSON.parse(JSON.stringify(initialTeams));
    currentActivePlayer = null; 
    currentHighestBid = 50; // Initial default base bid starts at 50 points
    currentLeaderText = "None";
    lastAuctionMessage = "Auction system ready. Click 'Next Player' to begin.";
    lastAuctionMessageType = "info";
    
    saveStateToCloud();
}

// Complete Auction & Player Pool Reset Feature
async function resetEntireAuction() {
    if (!confirm("⚠️ Are you sure you want to completely reset all teams, squads, and player pools? This will erase all history and cannot be undone!")) {
        return;
    }

    try {
        let response = await fetch('players.json');
        if (!response.ok) throw new Error("Network response failed");
        players = await response.json();
    } catch (error) {
        console.warn("Could not load players.json, using fallback pool:", error);
        players = [
            { name: "Sample Player 1", category: "1", skillLevel: "Advanced", notes: "All-rounder" },
            { name: "Sample Player 2", category: "2", skillLevel: "Intermediate", notes: "Batsman" },
            { name: "Sample Player 3", category: "3", skillLevel: "Beginner", notes: "Bowler" }
        ];
    }
    
    unsoldPlayers = [];
    teams = JSON.parse(JSON.stringify(initialTeams));
    currentActivePlayer = null; 
    auctionHistory = [];
    currentHighestBid = 50;
    currentLeaderText = "None";
    lastAuctionMessage = "Auction system fully reset! Click 'Next Player' to start.";
    lastAuctionMessageType = "info";
    
    saveStateToCloud();
    alert("Auction has been successfully reset!");
}

// Save state to Firebase Cloud (instant broadcast to all remote captains)
function saveStateToCloud() {
    const payload = {
        players,
        unsoldPlayers,
        teams,
        currentActivePlayer,
        auctionHistory,
        currentHighestBid,
        currentLeaderText,
        lastAuctionMessage,
        lastAuctionMessageType
    };
    dbRef.set(payload).catch(err => console.error("Firebase sync error:", err));
}

// ==========================================
// VIEW SWITCHING & UI LOGIC
// ==========================================
function switchView(mode, savePreference = true) {
    currentViewMode = mode;
    if (savePreference) {
        localStorage.setItem('auction_view_mode', mode);
    }

    const adminContainer = document.getElementById('admin-view-container');
    const captainContainer = document.getElementById('captain-view-container');
    const btnAdmin = document.getElementById('btn-view-admin');

    if (mode === 'captain') {
        if (adminContainer) adminContainer.style.display = 'none';
        if (captainContainer) captainContainer.style.display = 'grid';
        if (btnAdmin) {
            btnAdmin.innerText = "Switch to Admin Mode";
            btnAdmin.style.background = "#334155";
        }
    } else {
        if (adminContainer) adminContainer.style.display = 'grid';
        if (captainContainer) captainContainer.style.display = 'none';
        if (btnAdmin) {
            btnAdmin.innerText = "Admin Mode";
            btnAdmin.style.background = "#0284c7";
        }
    }
    updateUI();
}

// ==========================================
// CORE AUCTION CONTROLS (ADMIN ACTIONS)
// ==========================================
function nextPlayer() {
    if (players.length === 0) {
        alert("No players remaining in the pool!");
        return;
    }

    currentActivePlayer = players.shift();
    currentHighestBid = 50; // Base bid starts at 50 points for each new player
    currentLeaderText = "None";
    lastAuctionMessage = `Now Bidding: ${currentActivePlayer.name}`;
    lastAuctionMessageType = "info";

    saveStateToCloud();
}

function markAsUnsold() {
    if (!currentActivePlayer) {
        alert("No active player to mark unsold.");
        return;
    }

    unsoldPlayers.push(currentActivePlayer);
    lastAuctionMessage = `${currentActivePlayer.name} marked as Unsold.`;
    lastAuctionMessageType = "warning";

    currentActivePlayer = null;
    currentHighestBid = 50;
    currentLeaderText = "None";

    saveStateToCloud();
}

function submitBid() {
    if (!currentActivePlayer) {
        alert("Select an active player first.");
        return;
    }

    const selectEl = document.getElementById('bidder-select');
    const amountEl = document.getElementById('bid-amount');

    const teamIndex = parseInt(selectEl.value);
    const addedAmount = parseInt(amountEl.value);

    if (isNaN(teamIndex) || teamIndex < 0 || teamIndex >= teams.length) {
        alert("Please select a valid team.");
        return;
    }

    if (isNaN(addedAmount) || addedAmount <= 0) {
        alert("Please enter a valid points increment amount.");
        return;
    }

    // Accumulative Addition Rule: Adds the entered points on top of the existing Current Highest Bid
    currentHighestBid += addedAmount;
    
    if (teams[teamIndex].points < currentHighestBid) {
        // Rollback addition if team lacks funds
        currentHighestBid -= addedAmount;
        alert(`${teams[teamIndex].name} does not have enough points for this total bid (${currentHighestBid} pts)!`);
        return;
    }

    currentLeaderText = `${teams[teamIndex].name} (${teams[teamIndex].captain}) - ${currentHighestBid} pts`;
    
    auctionHistory.push({
        type: 'bid',
        player: currentActivePlayer,
        teamIndex: teamIndex,
        amount: currentHighestBid,
        increment: addedAmount
    });

    saveStateToCloud();
}

function finalizeBid() {
    if (!currentActivePlayer) {
        alert("No active player to finalize.");
        return;
    }

    const selectEl = document.getElementById('bidder-select');
    const amountEl = document.getElementById('bid-amount');

    const teamIndex = parseInt(selectEl.value);
    let targetTeamIndex = teamIndex;
    let finalSaleAmount = currentHighestBid;

    const lastBidAction = auctionHistory.slice().reverse().find(h => h.type === 'bid' && h.player.name === currentActivePlayer.name);
    
    if (lastBidAction) {
        targetTeamIndex = lastBidAction.teamIndex;
        finalSaleAmount = lastBidAction.amount;
    } else {
        const fallbackAdd = parseInt(amountEl.value);
        if (!isNaN(fallbackAdd) && fallbackAdd > 0) {
            currentHighestBid += fallbackAdd;
            finalSaleAmount = currentHighestBid;
        }
    }

    if (isNaN(targetTeamIndex) || targetTeamIndex < 0 || targetTeamIndex >= teams.length) {
        alert("Please select a team before finalizing.");
        return;
    }

    const winningTeam = teams[targetTeamIndex];

    if (winningTeam.points < finalSaleAmount) {
        alert(`${winningTeam.name} does not have enough points (${winningTeam.points} pts left) to cover this bid!`);
        return;
    }

    // Safety check: ensure squad array exists before pushing
    if (!winningTeam.squad) {
        winningTeam.squad = [];
    }

    winningTeam.points -= finalSaleAmount;
    winningTeam.squad.push({
        ...currentActivePlayer,
        purchasePrice: finalSaleAmount
    });

    lastAuctionMessage = `SOLD! ${currentActivePlayer.name} to ${winningTeam.name} for ${finalSaleAmount} pts!`;
    lastAuctionMessageType = "success";

    currentActivePlayer = null;
    currentHighestBid = 50;
    currentLeaderText = "None";

    saveStateToCloud();
}

function undoLastBid() {
    if (auctionHistory.length === 0) {
        alert("No recent bids to undo.");
        return;
    }

    const lastAction = auctionHistory.pop();
    if (lastAction.type === 'bid') {
        const previousBid = auctionHistory.slice().reverse().find(h => h.type === 'bid' && h.player.name === lastAction.player.name);
        if (previousBid) {
            currentHighestBid = previousBid.amount;
            currentLeaderText = `${teams[previousBid.teamIndex].name} (${teams[previousBid.teamIndex].captain}) - ${previousBid.amount} pts`;
        } else {
            currentHighestBid = 50;
            currentLeaderText = "None";
        }
        lastAuctionMessage = "Last bid undone.";
        lastAuctionMessageType = "info";
        saveStateToCloud();
    }
}

// ==========================================
// UI RENDERING ENGINE
// ==========================================
function updateUI() {
    const activeCatEl = document.getElementById('active-player-cat');
    const activeNameEl = document.getElementById('active-player-name');
    const currentBidDisplay = document.getElementById('current-bid-display');
    const leadingBidderDisplay = document.getElementById('leading-bidder-display');
    const announcementEl = document.getElementById('sold-announcement');

    if (activeCatEl) activeCatEl.innerText = currentActivePlayer ? `${getCategoryLetter(currentActivePlayer.category)}` : "-";
    if (activeNameEl) activeNameEl.innerText = currentActivePlayer ? currentActivePlayer.name : "Waiting for next player...";
    if (currentBidDisplay) currentBidDisplay.innerHTML = `Current Highest Bid: <strong>${currentHighestBid} pts</strong>`;
    if (leadingBidderDisplay) leadingBidderDisplay.innerText = `Leading Team: ${currentLeaderText}`;

    if (announcementEl) {
        announcementEl.innerText = lastAuctionMessage;
        announcementEl.className = `sold-announcement ${lastAuctionMessageType}`;
    }

    const captainActiveCat = document.getElementById('captain-active-cat');
    const captainActiveName = document.getElementById('captain-active-name');
    const captainPlayerMeta = document.getElementById('captain-player-meta');
    const captainActiveBid = document.getElementById('captain-active-bid');
    const captainLeadingDisplay = document.getElementById('captain-leading-display');
    const captainAnnouncement = document.getElementById('captain-sold-announcement');

    if (captainActiveCat) captainActiveCat.innerText = currentActivePlayer ? `${getCategoryLetter(currentActivePlayer.category)}` : "-";
    if (captainActiveName) captainActiveName.innerText = currentActivePlayer ? currentActivePlayer.name : "Waiting for next player...";
    if (captainPlayerMeta) {
        captainPlayerMeta.innerText = currentActivePlayer ? `Skill Level: ${currentActivePlayer.skillLevel || 'N/A'} | Notes: ${currentActivePlayer.notes || 'None'}` : "";
    }
    if (captainActiveBid) captainActiveBid.innerText = `Current Highest Bid: ${currentHighestBid} pts`;
    if (captainLeadingDisplay) captainLeadingDisplay.innerText = `Leading Team: ${currentLeaderText}`;
    if (captainAnnouncement) captainAnnouncement.innerText = lastAuctionMessage;

    const bidderSelect = document.getElementById('bidder-select');
    if (bidderSelect) {
        const currentSelectedVal = bidderSelect.value;
        bidderSelect.innerHTML = "";
        teams.forEach((team, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.innerText = `${team.name} (${team.captain}) - ${team.points} pts left`;
            bidderSelect.appendChild(opt);
        });
        if (currentSelectedVal) bidderSelect.value = currentSelectedVal;
    }

    renderTeamsContainer();
    renderCaptainTeamsGrid();
    renderPlayerPool();
}

function renderTeamsContainer() {
    const container = document.getElementById('teams-container');
    if (!container) return;
    container.innerHTML = "";

    teams.forEach((team, index) => {
        const card = document.createElement('div');
        card.className = 'team-card';
        
        let squadHtml = (team.squad || []).map(p => `
            <li style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>${p.name}</span>
                <strong style="color: #34d399;">${p.purchasePrice} pts</strong>
            </li>
        `).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 1.05rem; color: #f8fafc;">${team.name}</h3>
                <span style="background: #0284c7; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">#${index + 1}</span>
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 8px;">Captain: <strong>${team.captain}</strong></div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #38bdf8; margin-bottom: 10px;">Purse Balance: ${team.points} pts</div>
            <div style="max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 6px;">
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${squadHtml || '<li style="color: #64748b; font-size: 0.8rem; text-align: center;">No players bought yet</li>'}
                </ul>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderCaptainTeamsGrid() {
    const leftContainer = document.getElementById('captain-teams-left');
    const rightContainer = document.getElementById('captain-teams-right');
    if (!leftContainer || !rightContainer) return;

    leftContainer.innerHTML = "";
    rightContainer.innerHTML = "";

    teams.forEach((team, index) => {
        const targetContainer = index < 4 ? leftContainer : rightContainer;
        const card = document.createElement('div');
        card.className = 'captain-team-box';
        card.style.background = "#111827";
        card.style.border = "1px solid #1f2937";
        card.style.borderRadius = "8px";
        card.style.padding = "10px";
        card.style.marginBottom = "8px";

        let squadNames = (team.squad || []).map(p => `<span style="display: inline-block; background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin: 2px; color: #e2e8f0;">${p.name}</span>`).join('');

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 0.9rem; color: #f8fafc;">${team.name}</span>
                <span style="color: #38bdf8; font-weight: 700; font-size: 0.85rem;">${team.points} pts</span>
            </div>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 6px;">Cap: ${team.captain}</div>
            <div style="display: flex; flex-wrap: wrap; max-height: 60px; overflow-y: auto;">
                ${squadNames || '<span style="color: #64748b; font-size: 0.75rem;">No players yet</span>'}
            </div>
        `;
        targetContainer.appendChild(card);
    });
}

function renderPlayerPool() {
    const poolList = document.getElementById('player-pool-list');
    if (!poolList) return;
    poolList.innerHTML = "";

    if (players.length === 0 && unsoldPlayers.length === 0) {
        poolList.innerHTML = `<li style="text-align: center; color: #64748b; padding: 20px;">Player pool is empty.</li>`;
        return;
    }

    players.forEach(p => {
        const li = document.createElement('li');
        li.className = 'player-pool-item';
        li.style.display = 'flex';
        li.style.justify = 'space-between';
        li.style.padding = '8px';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        li.innerHTML = `
            <div>
                <strong style="color: #f8fafc; font-size: 0.9rem;">${p.name}</strong>
                <div style="font-size: 0.75rem; color: #94a3b8;">Skill: ${p.skillLevel || '-'} | Notes: ${p.notes || '-'}</div>
            </div>
            <span style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; height: fit-content;">${getCategoryLetter(p.category)}</span>
        `;
        poolList.appendChild(li);
    });

    if (unsoldPlayers.length > 0) {
        const headerLi = document.createElement('li');
        headerLi.innerHTML = `<h3 style="color: #f87171; margin: 15px 0 5px 0; font-size: 0.95rem;">Unsold Section</h3>`;
        poolList.appendChild(headerLi);

        unsoldPlayers.forEach(p => {
            const li = document.createElement('li');
            li.style.padding = '6px';
            li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            li.style.opacity = '0.7';
            li.innerHTML = `
                <strong style="color: #fca5a5; font-size: 0.85rem;">${p.name}</strong> 
                <span style="font-size: 0.75rem; color: #94a3b8;">(${getCategoryLetter(p.category)})</span>
            `;
            poolList.appendChild(li);
        });
    }
}

// ==========================================
// MODAL & BACKUP / EXPORT HELPERS
// ==========================================
function openRemoteLinksModal() {
    const modal = document.getElementById("remote-links-modal");
    const listContainer = document.getElementById("remote-links-list");
    if (!modal || !listContainer) return;

    listContainer.innerHTML = "";
    const baseUrl = window.location.origin + window.location.pathname;

    teams.forEach(team => {
        const slug = getTeamSlug(team.name);
        const captainUrl = `${baseUrl}?view=captain&team=${slug}`;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'captain-link-item';
        itemDiv.innerHTML = `
            <div>
                <strong style="color: #f8fafc; display: block; font-size: 0.9rem;">${team.name} (${team.captain})</strong>
                <span>${captainUrl}</span>
            </div>
            <button onclick="navigator.clipboard.writeText('${captainUrl}'); alert('Copied link for ${team.name}!');" class="btn primary-outline" style="padding: 6px 10px; font-size: 0.75rem; white-space: nowrap; cursor: pointer; background: #0284c7; color: white; border: none; border-radius: 4px;">Copy Link</button>
        `;
        listContainer.appendChild(itemDiv);
    });

    modal.style.display = "flex";
}

function downloadSquadCSV() {
    let csvContent = "data:text/csv;charset=utf-8,Team Name,Captain,Remaining Points,Player Name,Category,Purchase Price\n";
    teams.forEach(team => {
        if (!team.squad || team.squad.length === 0) {
            csvContent += `"${team.name}","${team.captain}",${team.points},,,\n`;
        } else {
            team.squad.forEach(p => {
                csvContent += `"${team.name}","${team.captain}",${team.points},"${p.name}",${p.category},${p.purchasePrice}\n`;
            });
        }
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "auction_squads_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadAuctionBackup() {
    const state = { players, unsoldPlayers, teams, currentActivePlayer, auctionHistory, currentHighestBid, currentLeaderText };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "auction_state_backup.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
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
            teams = imported.teams || teams;
            currentActivePlayer = imported.currentActivePlayer || null;
            auctionHistory = imported.auctionHistory || [];
            currentHighestBid = imported.currentHighestBid || 50;
            currentLeaderText = imported.currentLeaderText || "None";
            saveStateToCloud();
            alert("Auction state successfully restored from backup!");
        } catch (err) {
            alert("Invalid JSON backup file.");
        }
    };
    reader.readAsText(file);
}

function importPlayerPoolFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    reader.onload = function(e) {
        try {
            let data;
            let workbook;

            if (fileName.endsWith('.csv')) {
                data = e.target.result;
                workbook = XLSX.read(data, { type: 'string' });
            } else {
                data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, { type: 'array' });
            }
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            processImportedRows(rows);
        } catch (err) {
            console.error("File parse error:", err);
            alert("Could not parse file. Ensure it is a valid CSV or Excel file.");
        }
    };

    if (fileName.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function processImportedRows(rows) {
    let newPlayers = [];
    
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols || cols.length === 0 || !cols[0]) continue;
        
        newPlayers.push({
            name: String(cols[0] || '').trim(),
            category: String(cols[1] || '1').trim(),
            skillLevel: String(cols[2] || '').trim(),
            notes: String(cols[3] || '').trim()
        });
    }

    if (newPlayers.length > 0) {
        players = newPlayers;
        unsoldPlayers = [];
        currentActivePlayer = null;
        currentHighestBid = 50;
        currentLeaderText = "None";
        saveStateToCloud();
        alert(`Successfully replaced player pool with ${newPlayers.length} players!`);
    } else {
        alert("No valid players found in the file.");
    }
}
