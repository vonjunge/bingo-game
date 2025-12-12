const socket = io();

let currentCard = [];
let markedCells = new Set();
let terms = [];
let calledTerms = [];
let playerName = '';
let termsLoaded = false;
let fadeTimers = {}; // Track fade timers for uncalled terms

// Spam detection - track recent clicks
let recentClicks = [];
const SPAM_THRESHOLD = 4; // Number of clicks
const SPAM_TIMEFRAME = 4000; // Within 4 seconds
let spamPenaltyActive = false;

// Socket event handlers - MUST be registered immediately before any events fire
socket.on('initialData', (data) => {
    console.log('Received initialData:', data);
    terms = data.terms || [];
    calledTerms = data.calledTerms || [];
    termsLoaded = true;
    document.getElementById('playerCount').textContent = `Players: ${data.playerCount}`;
});

socket.on('termsUpdated', (updatedTerms) => {
    terms = updatedTerms;
    termsLoaded = true;
    // If a player is waiting and now we have enough terms, they can generate a card
    if (document.getElementById('gameArea').style.display === 'block' && currentCard.length === 0 && terms.length >= 16) {
        alert('Admin has added enough terms! You can now generate your card.');
    }
});

socket.on('termCalled', (data) => {
    // Keep track of called terms
    calledTerms = data.calledTerms;
    // Re-render card to update visual state and cancel fade timers for newly called terms
    if (currentCard.length > 0) {
        updateCardForCalledTerms();
    }
});

socket.on('termUncalled', (data) => {
    // Keep track when admin uncalls a term
    calledTerms = data.calledTerms;
    // Re-render card to update visual state
    if (currentCard.length > 0) {
        renderBingoCard();
    }
});

socket.on('gameReset', () => {
    calledTerms = [];
    markedCells.clear();
    fadeTimers = {};
    if (currentCard.length > 0) {
        renderBingoCard();
    }
});

socket.on('bingoAnnouncement', (data) => {
    console.log('Received bingoAnnouncement:', data);
    // This is sent only to the winning player now
    showBingoAlert(`🎉 CONGRATULATIONS! 🎉\nYou WON and came in position #${data.position}!`);
});

socket.on('playerCountUpdate', (count) => {
    document.getElementById('playerCount').textContent = `Players: ${count}`;
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Player setup
document.getElementById('joinGame').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();

    if (name) {
        playerName = name;
        socket.emit('registerPlayer', name);
        document.getElementById('playerSetup').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';

        // Wait for terms to be loaded from initialData before attempting auto-generation
        const checkTermsAndGenerate = setInterval(() => {
            if (termsLoaded && terms.length >= 16) {
                clearInterval(checkTermsAndGenerate);
                generateBingoCard();
            }
        }, 50);

        // Timeout after 5 seconds - show message but don't reload
        setTimeout(() => {
            clearInterval(checkTermsAndGenerate);
            if (terms.length < 16) {
                alert('Waiting for admin to add more terms. You need at least 16 terms. Currently: ' + terms.length + ' terms available.');
            }
        }, 5000);
    } else {
        alert('Please enter your name');
    }
});

// Generate bingo card - 4x4 grid (16 terms, no FREE space)
function generateBingoCard() {
    // Combine called and uncalled terms for the card pool
    const allTerms = [...new Set([...terms, ...calledTerms])];

    if (allTerms.length < 16) {
        alert('Need at least 16 terms to generate a card. Admin has only provided ' + allTerms.length + ' terms.');
        return;
    }

    const shuffled = [...allTerms].sort(() => Math.random() - 0.5);
    currentCard = shuffled.slice(0, 16); // 4x4 = 16 terms
    markedCells.clear();
    fadeTimers = {};

    renderBingoCard();
    document.getElementById('bingoButton').style.display = 'block';

    // Send card state to server
    sendCardUpdate();
}

// Send card update to server
function sendCardUpdate() {
    socket.emit('updateCard', {
        card: currentCard,
        markedCells: Array.from(markedCells)
    });
}

// Update card when terms are called - convert uncalled marks to called marks
function updateCardForCalledTerms() {
    const cardElement = document.getElementById('bingoCard');
    const cells = cardElement.querySelectorAll('.bingo-cell');
    
    cells.forEach((cell, index) => {
        const term = currentCard[index];
        const isCalled = calledTerms.includes(term);
        
        // If this term is now called and was marked as uncalled, convert it
        if (isCalled && cell.classList.contains('marked-uncalled')) {
            // Cancel the fade timer
            if (fadeTimers[index]) {
                clearTimeout(fadeTimers[index]);
                delete fadeTimers[index];
            }
            // Convert to called (permanent red)
            cell.classList.remove('marked-uncalled');
            cell.classList.add('marked-called');
            // Notify server this is now a valid click
            socket.emit('termClicked', { term, isClicked: true });
        }
    });
}

function renderBingoCard() {
    const cardElement = document.getElementById('bingoCard');
    cardElement.innerHTML = '';

    // 4x4 grid - no headers needed
    currentCard.forEach((term, index) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        cell.textContent = term;
        cell.dataset.index = index;
        cell.dataset.term = term;

        // Check if term is called (should be red when clicked)
        const isCalled = calledTerms.includes(term);
        
        if (markedCells.has(index)) {
            if (isCalled) {
                cell.classList.add('marked-called'); // Red - stays marked
            } else {
                cell.classList.add('marked-uncalled'); // Will fade
            }
        }

        cell.addEventListener('click', () => handleCellClick(cell, term, index));
        cardElement.appendChild(cell);
    });
}

function handleCellClick(cell, term, index) {
    const isCalled = calledTerms.includes(term);
    const now = Date.now();
    
    // Track this click for spam detection
    recentClicks.push(now);
    // Remove clicks older than the timeframe
    recentClicks = recentClicks.filter(t => now - t < SPAM_TIMEFRAME);
    
    // Check if spam clicking is happening
    const isSpamming = recentClicks.length >= SPAM_THRESHOLD;
    
    if (markedCells.has(index)) {
        // Unmark the cell
        markedCells.delete(index);
        cell.classList.remove('marked-called', 'marked-uncalled');
        
        // Clear any existing fade timer
        if (fadeTimers[index]) {
            clearTimeout(fadeTimers[index]);
            delete fadeTimers[index];
        }
        
        // Notify server
        socket.emit('termClicked', { term, isClicked: false });
    } else {
        // Mark the cell
        markedCells.add(index);
        
        // If spamming OR term is uncalled, make it fade after 10 seconds
        if (isSpamming || !isCalled) {
            // Treat as uncalled - turns red but fades back after 10 seconds
            cell.classList.add('marked-uncalled');
            
            // Set timer to fade back to white AND notify server
            fadeTimers[index] = setTimeout(() => {
                if (markedCells.has(index)) {
                    markedCells.delete(index);
                    cell.classList.remove('marked-uncalled', 'marked-called');
                    delete fadeTimers[index];
                    // Notify server that this term is no longer clicked
                    socket.emit('termClicked', { term, isClicked: false });
                }
            }, 10000);
            
            // Only notify server if actually called (spam clicks on called terms still count but fade)
            if (isCalled) {
                socket.emit('termClicked', { term, isClicked: true });
            }
        } else {
            // Called term and not spamming - turns red and stays
            cell.classList.add('marked-called');
            socket.emit('termClicked', { term, isClicked: true });
        }
    }
    
    checkBingo();
    sendCardUpdate();
}

function checkBingo() {
    // Win condition: 
    // 1. ALL called terms on the card must be marked
    // 2. NO uncalled terms can be marked (prevents clicking everything quickly)
    
    if (currentCard.length !== 16) {
        return false;
    }
    
    // Find all called terms that are on this player's card
    const calledTermsOnCard = currentCard.filter(term => calledTerms.includes(term));
    
    // Must have at least some called terms to win
    if (calledTermsOnCard.length === 0) {
        return false;
    }
    
    // Check each cell
    for (let i = 0; i < currentCard.length; i++) {
        const term = currentCard[i];
        const isCalled = calledTerms.includes(term);
        const isMarked = markedCells.has(i);
        
        // If a term is called but NOT marked, no bingo
        if (isCalled && !isMarked) {
            return false;
        }
        
        // If a term is NOT called but IS marked, no bingo (prevents spam-clicking)
        if (!isCalled && isMarked) {
            return false;
        }
    }
    
    // All called terms are marked AND no uncalled terms are marked
    return true;
}

document.getElementById('bingoButton').addEventListener('click', () => {
    console.log('BINGO button clicked');
    console.log('currentCard:', currentCard);
    console.log('calledTerms:', calledTerms);
    console.log('markedCells:', Array.from(markedCells));
    
    const result = checkBingo();
    console.log('checkBingo result:', result);
    
    if (result) {
        console.log('Emitting bingo event to server');
        socket.emit('bingo', { playerName, card: currentCard });
        // Server will send back bingoAnnouncement with position
    } else {
        alert('Not quite a BINGO yet! You must click ONLY the called terms (no uncalled terms can be selected).');
    }
});

// Load terms from server
async function loadTerms() {
    const response = await fetch('/api/game-state');
    const data = await response.json();
    terms = data.terms;
}

function renderCalledTerms() {
    // Players should not see called terms - this is now only for admin
    // Keep function for compatibility but don't render anything
}

function showBingoAlert(message) {
    const alert = document.getElementById('bingoAlert');
    alert.textContent = message;
    alert.style.display = 'block';

    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}
