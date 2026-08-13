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

// State Management variables (Player pool starts completely empty)
let players = [];
let unsoldPlayers = []; 
let currentActivePlayer = null;
let auctionHistory = []; 
let currentHighestBid = 0; 
let currentLeaderText = "None"; 
let lastAuctionMessage = "";
let lastAuctionMessageType = ""; 
let currentViewMode = 'admin'; // Default fallback

let initialTeams = [
    { name: "Pragji Pioneers", shortName: "PP", captain: "Pavan Patel", points: 5000, squad: [] },
    { name: "Yagnapurush Yodha", shortName: "YY", captain: "Jaimin Patel", points: 5000, squad: [] },
    { name: "Varni Warriors", shortName: "VW", captain: "Meet Patel", points: 5000, squad: [] },
    { name: "Rajipo Royals", shortName: "RR", captain: "Saral Patel", points: 5000, squad: [] },
    { name: "Akshar United", shortName: "AU", captain: "Chintan Patel", points: 5000, squad: [] },
    { name: "Shreehari Superkings", shortName: "SHS", captain: "Virag Patel", points: 5000, squad: [] },
    { name: "Sarang Sirens", shortName: "SS", captain: "Vivek Patel", points: 5000, squad: [] },
    { name: "Keshav Challengers", shortName: "KC", captain: "Smit Patel", points: 5000, squad: [] }
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

// Helper utility to shuffle arrays randomly
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Group players by category, shuffle randomly inside each category, then merge back (A -> B -> C)
function randomizePlayerPool(playerList) {
    const categories = {};
    
    playerList.forEach(p => {
        const cat = getCategoryLetter(p.category);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(p);
    });

    let randomizedList = [];
    const sortedCats = Object.keys(categories).sort();

    sortedCats.forEach(cat => {
        const shuffledCategoryPlayers = shuffleArray(categories[cat]);
        randomizedList = randomizedList.concat(shuffledCategoryPlayers);
    });

    return randomizedList;
}

window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const teamParam = urlParams.get('team');

    // Determine view mode based on URL parameters without prompting for a password
    if (viewParam === 'captain' || teamParam) {
        currentViewMode = 'captain';
        document.body.classList.add('captain-view-mode');
    } else {
        currentViewMode = 'admin';
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
    players = []; 
    unsoldPlayers = [];
    teams = JSON.parse(JSON.stringify(initialTeams));
    currentActivePlayer = null; 
    currentHighestBid = 0; 
    currentLeaderText = "None";
    lastAuctionMessage = "";
    lastAuctionMessageType = "";
    
    saveStateToCloud();
}

// Complete Auction & Player Pool Reset Feature
async function resetEntireAuction() {
    if (!confirm("⚠️ Are you sure you want to completely reset all teams, squads, and player pools? This will clear the player pool and all history!")) {
        return;
    }

    players = []; 
    unsoldPlayers = [];
    teams = JSON.parse(JSON.stringify(initialTeams));
    currentActivePlayer = null; 
    auctionHistory = [];
    currentHighestBid = 0;
    currentLeaderText = "None";
    lastAuctionMessage = "";
    lastAuctionMessageType = "";
    
    saveStateToCloud();
    alert("Auction has been successfully reset with an empty player pool!");
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
// VIEW SWITCHING LOGIC
// ==========================================
function switchView(mode, savePreference = true) {
    currentViewMode = mode;

    const adminContainer = document.getElementById('admin-view-container');
    const captainContainer = document.getElementById('captain-view-container');
    const btnAdmin = document.getElementById('btn-view-admin');

    if (mode === 'captain') {
        if (adminContainer) adminContainer.style.display = 'none';
        if (captainContainer) {
            captainContainer.style.display = 'grid';
            captainContainer.style.gridTemplateColumns = "1.2fr 1fr 1.2fr";
            captainContainer.style.gap = "16px";
            captainContainer.style.alignItems = "stretch";
        }
        if (btnAdmin) btnAdmin.style.display = 'none';
    } else {
        if (adminContainer) adminContainer.style.display = 'grid';
        if (captainContainer) captainContainer.style.display = 'none';
    }
    updateUI();
}

// ==========================================
// CORE AUCTION CONTROLS (ADMIN ACTIONS)
// ==========================================
function nextPlayer() {
    if (players.length === 0) {
        if (unsoldPlayers.length > 0) {
            players = [...unsoldPlayers];
            unsoldPlayers = [];
        } else {
            alert("No players remaining in the pool! Please upload a CSV/Excel file containing players.");
            return;
        }
    }

    lastAuctionMessage = "";
    lastAuctionMessageType = "";

    currentActivePlayer = players.shift();

    currentHighestBid = 50; 
    currentLeaderText = "None";

    saveStateToCloud();
}

function markAsUnsold() {
    if (!currentActivePlayer) {
        alert("No active player to mark unsold.");
        return;
    }

    unsoldPlayers.push(currentActivePlayer);
    
    auctionHistory.push({
        type: 'unsold',
        player: currentActivePlayer
    });

    lastAuctionMessage = `${currentActivePlayer.name} marked as Unsold.`;
    lastAuctionMessageType = "warning";

    currentActivePlayer = null;
    currentHighestBid = 0;
    currentLeaderText = "None";

    saveStateToCloud();
}

function submitBid() {
    if (!currentActivePlayer) {
        alert("Select an active player first.");
        return;
    }

    const hiddenInput = document.getElementById('selected-team-index');
    const amountEl = document.getElementById('bid-amount');

    const teamIndex = parseInt(hiddenInput ? hiddenInput.value : 0);
    const addedAmount = parseInt(amountEl.value);

    if (isNaN(teamIndex) || teamIndex < 0 || teamIndex >= teams.length) {
        alert("Please select a valid team.");
        return;
    }

    if (isNaN(addedAmount) || addedAmount <= 0) {
        alert("Please enter a valid points increment amount.");
        return;
    }

    const team = teams[teamIndex];
    const squadSize = team.squad ? team.squad.length : 0;
    
    const totalSquadSizeNeeded = 10;
    const playersRemaining = totalSquadSizeNeeded - squadSize;
    const reservedBasePoints = (playersRemaining - 1) * 50;
    const maximumAllowableBid = team.points - reservedBasePoints;

    const proposedBid = currentHighestBid + addedAmount;

    if (proposedBid > maximumAllowableBid) {
        alert(`${team.name} cannot bid ${proposedBid} pts! Maximum allowable bid is ${maximumAllowableBid} pts to reserve base points (${reservedBasePoints} pts) for the remaining ${playersRemaining - 1} players.`);
        return;
    }

    currentHighestBid = proposedBid;
    
    if (team.points < currentHighestBid) {
        currentHighestBid -= addedAmount;
        alert(`${team.name} does not have enough points for this total bid (${currentHighestBid} pts)!`);
        return;
    }

    currentLeaderText = `${team.name} (${team.captain}) - ${currentHighestBid} pts`;
    
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

    const hiddenInput = document.getElementById('selected-team-index');
    const amountEl = document.getElementById('bid-amount');

    const teamIndex = parseInt(hiddenInput ? hiddenInput.value : 0);
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

    if (!winningTeam.squad) {
        winningTeam.squad = [];
    }

    winningTeam.points -= finalSaleAmount;
    winningTeam.squad.push({
        ...currentActivePlayer,
        purchasePrice: finalSaleAmount
    });

    auctionHistory.push({
        type: 'sold',
        player: currentActivePlayer,
        teamIndex: targetTeamIndex,
        amount: finalSaleAmount
    });

    lastAuctionMessage = `SOLD! ${currentActivePlayer.name} to ${winningTeam.name} for ${finalSaleAmount} pts!`;
    lastAuctionMessageType = "success";

    currentActivePlayer = null;
    currentHighestBid = 0;
    currentLeaderText = "None";

    saveStateToCloud();
}

function undoLastBid() {
    if (auctionHistory.length === 0) {
        alert("No recent actions to undo.");
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
        lastAuctionMessage = ""; 
        lastAuctionMessageType = "";
    } 
    else if (lastAction.type === 'sold') {
        const team = teams[lastAction.teamIndex];
        if (team) {
            if (team.squad) {
                const squadIndex = team.squad.findIndex(p => p.name === lastAction.player.name);
                if (squadIndex !== -1) {
                    team.squad.splice(squadIndex, 1);
                }
            }
            team.points += lastAction.amount;
        }
        
        players.unshift(lastAction.player);
        currentActivePlayer = null; 
        currentHighestBid = 0;
        currentLeaderText = "None";
        
        lastAuctionMessage = `Undo: ${lastAction.player.name} returned to the pool.`;
        lastAuctionMessageType = "warning";
    }
    else if (lastAction.type === 'unsold') {
        const unsoldIndex = unsoldPlayers.findIndex(p => p.name === lastAction.player.name);
        if (unsoldIndex !== -1) {
            unsoldPlayers.splice(unsoldIndex, 1);
        }
        
        players.unshift(lastAction.player);
        currentActivePlayer = null; 
        currentHighestBid = 0;
        currentLeaderText = "None";
        
        lastAuctionMessage = `Undo: ${lastAction.player.name} returned to the pool from unsold.`;
        lastAuctionMessageType = "info";
    }

    saveStateToCloud();
    updateUI();
}

// ==========================================
// UI RENDERING ENGINE
// ==========================================
function updateUI() {
    const activeCatEl = document.getElementById('active-player-cat');
    const activeNameEl = document.getElementById('active-player-name');
    const currentBidDisplay = document.getElementById('current-bid-display');
    const leadingBidderDisplay = document.getElementById('leading-bidder-display');

    if (lastAuctionMessage) {
        if (activeCatEl) activeCatEl.innerText = "-";
        if (activeNameEl) {
            activeNameEl.innerText = lastAuctionMessage;
            if (lastAuctionMessageType === 'success') {
                activeNameEl.className = "player-name-text sold-highlight";
            } else if (lastAuctionMessageType === 'warning') {
                activeNameEl.className = "player-name-text unsold-highlight";
            } else {
                activeNameEl.className = "player-name-text";
            }
        }
        if (currentBidDisplay) currentBidDisplay.innerHTML = "";
        if (leadingBidderDisplay) leadingBidderDisplay.innerText = "";
    } else {
        if (activeCatEl) activeCatEl.innerText = currentActivePlayer ? `${getCategoryLetter(currentActivePlayer.category)}` : "-";
        if (activeNameEl) {
            activeNameEl.className = "player-name-text";
            activeNameEl.innerText = currentActivePlayer ? currentActivePlayer.name : (players.length === 0 ? "Import players via CSV to begin..." : "Waiting for next player...");
        }
        if (currentBidDisplay) currentBidDisplay.innerHTML = `Current Highest Bid: <strong>${currentHighestBid} pts</strong>`;
        if (leadingBidderDisplay) leadingBidderDisplay.innerText = `Leading Team: ${currentLeaderText}`;
    }
    
    let activePlayerMeta = document.getElementById('admin-player-meta');
    if (!activePlayerMeta && activeNameEl) {
        activePlayerMeta = document.createElement('div');
        activePlayerMeta.id = 'admin-player-meta';
        activePlayerMeta.style.fontSize = "0.95rem";
        activePlayerMeta.style.color = "#94a3b8";
        activePlayerMeta.style.marginTop = "6px";
        activeNameEl.parentNode.insertBefore(activePlayerMeta, activeNameEl.nextSibling);
    }
    if (activePlayerMeta) {
        activePlayerMeta.innerText = (!lastAuctionMessage && currentActivePlayer) ? `Skill Level: ${currentActivePlayer.skillLevel || 'N/A'} | Notes: ${currentActivePlayer.notes || 'None'}` : "";
    }

    const captainActiveCat = document.getElementById('captain-active-cat');
    const captainActiveName = document.getElementById('captain-active-name');
    const captainPlayerMeta = document.getElementById('captain-player-meta');
    const captainActiveBid = document.getElementById('captain-active-bid');
    const captainLeadingDisplay = document.getElementById('captain-leading-display');

    if (lastAuctionMessage) {
        if (captainActiveCat) captainActiveCat.innerText = "-";
        if (captainActiveName) {
            captainActiveName.innerText = lastAuctionMessage;
            captainActiveName.style.fontSize = "1.8em";
            if (lastAuctionMessageType === 'success') {
                captainActiveName.style.color = "#34d399";
            } else if (lastAuctionMessageType === 'warning') {
                captainActiveName.style.color = "#f87171";
            } else {
                captainActiveName.style.color = "#f8fafc";
            }
        }
        if (captainPlayerMeta) captainPlayerMeta.innerText = "";
        if (captainActiveBid) captainActiveBid.innerText = "";
        if (captainLeadingDisplay) captainLeadingDisplay.innerText = "";
    } else {
        if (captainActiveCat) captainActiveCat.innerText = currentActivePlayer ? `${getCategoryLetter(currentActivePlayer.category)}` : "-";
        if (captainActiveName) {
            captainActiveName.style.fontSize = "2.4em";
            captainActiveName.style.color = "#34d399";
            captainActiveName.innerText = currentActivePlayer ? currentActivePlayer.name : (players.length === 0 ? "Import players via CSV to begin..." : "Waiting for next player...");
        }
        if (captainPlayerMeta) {
            captainPlayerMeta.innerText = currentActivePlayer ? `Skill Level: ${currentActivePlayer.skillLevel || 'N/A'} | Notes: ${currentActivePlayer.notes || 'None'}` : "";
        }
        if (captainActiveBid) captainActiveBid.innerText = `Current Highest Bid: ${currentHighestBid} pts`;
        if (captainLeadingDisplay) captainLeadingDisplay.innerText = `Leading Team: ${currentLeaderText}`;
    }

    // Render quick-click team buttons using shortCode - Captain Name formatting
    const bidderButtonsContainer = document.getElementById('bidder-buttons-container');
    const hiddenTeamInput = document.getElementById('selected-team-index');

    if (bidderButtonsContainer && hiddenTeamInput) {
        let selectedIndex = hiddenTeamInput.value !== "" ? parseInt(hiddenTeamInput.value) : 0;
        if (isNaN(selectedIndex) || selectedIndex >= teams.length) selectedIndex = 0;
        hiddenTeamInput.value = selectedIndex;

        bidderButtonsContainer.innerHTML = "";
        teams.forEach((team, index) => {
            const btn = document.createElement('button');
            const isSelected = index === selectedIndex;
            const squadCount = team.squad ? team.squad.length : 0;
            
            btn.type = "button";
            btn.innerText = `${team.shortName} - ${team.captain} (${squadCount}/10, ${team.points}p)`;
            btn.title = `${team.name} - Captain: ${team.captain} (${squadCount}/10 players, ${team.points} pts left)`;
            
            btn.style.padding = "6px 4px";
            btn.style.fontSize = "0.75rem";
            btn.style.fontWeight = "600";
            btn.style.borderRadius = "4px";
            btn.style.border = isSelected ? "2px solid #38bdf8" : "1px solid #334155";
            btn.style.background = isSelected ? "#0284c7" : "#1e293b";
            btn.style.color = "#f8fafc";
            btn.style.cursor = "pointer";
            btn.style.overflow = "hidden";
            btn.style.textOverflow = "ellipsis";
            btn.style.whiteSpace = "nowrap";

            btn.onclick = () => {
                hiddenTeamInput.value = index;
                updateUI();
            };

            bidderButtonsContainer.appendChild(btn);
        });
    }

    renderTeamsContainer();
    renderCaptainTeamsGrid();
    renderPlayerPool();
}

function renderTeamsContainer() {
    const col1 = document.getElementById('teams-col-1');
    const col2 = document.getElementById('teams-col-2');
    if (!col1 || !col2) return;

    col1.innerHTML = "";
    col2.innerHTML = "";

    teams.forEach((team, index) => {
        const targetCol = index < 4 ? col1 : col2;
        const card = document.createElement('div');
        const squadCount = team.squad ? team.squad.length : 0;
        
        card.className = 'team-card';
        card.style.background = "#111827";
        card.style.border = "1px solid #1f2937";
        card.style.borderRadius = "8px";
        card.style.padding = "8px 10px";
        card.style.flex = "1";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.justifyContent = "space-between";
        card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

        let squadHtml = (team.squad || []).map(p => `
            <li style="display: flex; justify-content: space-between; font-size: 0.7rem; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 6px;">${p.name}</span>
                <strong style="color: #34d399; white-space: nowrap;">${p.purchasePrice}p</strong>
            </li>
        `).join('');

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <h3 style="margin: 0; font-size: 0.85rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${team.name}">${team.name} <span style="font-size: 0.75rem; color: #38bdf8; font-weight: normal;">(${squadCount}/10)</span></h3>
                    <span style="background: #0284c7; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; font-weight: 600;">#${index + 1}</span>
                </div>
                <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 2px;">Cap: <strong>${team.captain}</strong></div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #38bdf8; margin-bottom: 4px;">Purse: ${team.points} pts</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 4px; border-radius: 4px;">
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${squadHtml || '<li style="color: #64748b; font-size: 0.65rem; text-align: center; padding: 2px 0;">No players yet</li>'}
                </ul>
            </div>
        `;
        targetCol.appendChild(card);
    });
}

function renderCaptainTeamsGrid() {
    const leftContainer = document.getElementById('captain-teams-left');
    const rightContainer = document.getElementById('captain-teams-right');
    if (!leftContainer || !rightContainer) return;

    leftContainer.style.display = "flex";
    leftContainer.style.flexDirection = "column";
    leftContainer.style.flex = "1";
    leftContainer.style.gap = "14px";

    rightContainer.style.display = "flex";
    rightContainer.style.flexDirection = "column";
    rightContainer.style.flex = "1";
    rightContainer.style.gap = "14px";

    leftContainer.innerHTML = "";
    rightContainer.innerHTML = "";

    teams.forEach((team, index) => {
        const targetContainer = index < 4 ? leftContainer : rightContainer;
        const card = document.createElement('div');
        const squadCount = team.squad ? team.squad.length : 0;

        card.className = 'captain-team-box';
        card.style.background = "#111827";
        card.style.border = "2px solid #1f2937";
        card.style.borderRadius = "10px";
        card.style.padding = "16px";
        card.style.flex = "1"; 
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.justifyContent = "space-between";
        card.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.3)";

        let squadHtml = (team.squad || []).map(p => `
            <li style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; color: #e2e8f0;">${p.name}</span>
            </li>
        `).join('');

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-weight: 800; font-size: 1.2rem; color: #f8fafc;">${team.name} <span style="font-size: 0.95rem; color: #38bdf8; font-weight: normal;">(${squadCount}/10)</span></span>
                    <span style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; font-weight: 800; font-size: 1.1rem; padding: 3px 10px; border-radius: 6px;">${team.points} pts</span>
                </div>
                <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 10px;">Captain: <strong style="color: #cbd5e1;">${team.captain}</strong></div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.25); padding: 8px; border-radius: 6px;">
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${squadHtml || '<li style="color: #64748b; font-size: 0.85rem; text-align: center; padding: 4px 0;">No players bought yet</li>'}
                </ul>
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
        poolList.innerHTML = `<li style="text-align: center; color: #64748b; padding: 20px;">Player pool is empty.<br><span style="font-size: 0.8rem;">Upload a CSV or Excel file to populate players.</span></li>`;
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
                <div style="font-size: 0.75rem; color: #94a3b8;">Skill Level: ${p.skillLevel || '-'} | Notes: ${p.notes || '-'}</div>
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
            li.style.opacity = '0.8';
            li.innerHTML = `
                <div>
                    <strong style="color: #fca5a5; font-size: 0.85rem;">${p.name}</strong> 
                    <span style="font-size: 0.75rem; color: #94a3b8;">(${getCategoryLetter(p.category)})</span>
                    <div style="font-size: 0.7rem; color: #94a3b8;">Skill Level: ${p.skillLevel || '-'} | Notes: ${p.notes || '-'}</div>
                </div>
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
    const state = { players, unsoldPlayers, teams, currentActivePlayer, auctionHistory, currentHighestBid, currentLeaderText, lastAuctionMessage, lastAuctionMessageType };
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
            currentHighestBid = imported.currentHighestBid || 0;
            currentLeaderText = imported.currentLeaderText || "None";
            lastAuctionMessage = imported.lastAuctionMessage || "";
            lastAuctionMessageType = imported.lastAuctionMessageType || "";
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
    let rawPlayers = [];
    
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols || cols.length === 0 || !cols[0]) continue;
        
        rawPlayers.push({
            name: String(cols[0] || '').trim(),
            category: String(cols[1] || '1').trim(),
            skillLevel: String(cols[2] || '').trim(),
            notes: String(cols[3] || '').trim()
        });
    }

    if (rawPlayers.length > 0) {
        players = randomizePlayerPool(rawPlayers);
        unsoldPlayers = [];
        currentActivePlayer = null;
        currentHighestBid = 0;
        currentLeaderText = "None";
        lastAuctionMessage = "";
        lastAuctionMessageType = "";
        auctionHistory = [];
        saveStateToCloud();
        alert(`Successfully imported and randomized ${players.length} players across categories!`);
    } else {
        alert("No valid players found in the file.");
    }
}
