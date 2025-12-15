let socket;
let terms = [];
let calledTerms = [];
let isAuthenticated = false;
let adminToken = null;
let bingoAnnouncements = [];
let leaderboard = [];

// Helper function to make authenticated API calls
async function adminFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        ...options.headers
    };
    
    console.log('Making request to:', url);
    console.log('With token:', adminToken);
    console.log('Auth header:', `Bearer ${adminToken}`);
    
    const response = await fetch(url, { ...options, headers });
    
    // Check if response is OK and is JSON
    const contentType = response.headers.get('content-type');
    console.log('Response status:', response.status);
    console.log('Response content-type:', contentType);
    
    if (!response.ok) {
        // Try to parse error as JSON, fallback to status text
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            console.log('Error data:', errorData);
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        } else {
            const textError = await response.text();
            console.log('Error text:', textError);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${textError}`);
        }
    }
    
    return response;
}

// Login handling
document.getElementById('loginBtn').addEventListener('click', async () => {
    const password = document.getElementById('adminPassword').value;
    const errorElement = document.getElementById('loginError');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            isAuthenticated = true;
            adminToken = data.token;
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            initializeAdmin();
        } else {
            errorElement.textContent = 'Invalid password. Please try again.';
            errorElement.style.display = 'block';
        }
    } catch (error) {
        errorElement.textContent = 'Login failed. Please try again.';
        errorElement.style.display = 'block';
    }
});

// Allow Enter key for login
document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('loginBtn').click();
    }
});

function initializeAdmin() {
    socket = io();

    // Socket event handlers
    socket.on('initialData', (data) => {
        terms = data.terms;
        calledTerms = data.calledTerms;
        leaderboard = data.leaderboard || [];
        document.getElementById('playerCount').textContent = `Players: ${data.playerCount}`;

        renderTermsList();
        updateCallerInterface();
        renderLeaderboard();
    });

    socket.on('termsUpdated', (updatedTerms) => {
        terms = updatedTerms;
        renderTermsList();
        updateCallerInterface();
    });

    socket.on('termCalled', (data) => {
        calledTerms = data.calledTerms;
        updateCallerInterface();
    });

    socket.on('termUncalled', (data) => {
        calledTerms = data.calledTerms;
        updateCallerInterface();
    });

    socket.on('gameReset', () => {
        calledTerms = [];
        bingoAnnouncements = [];
        leaderboard = [];
        updateCallerInterface();
        renderBingoAnnouncements();
        renderLeaderboard();
    });

    // Admin watches for BINGO winners via leaderboard updates
    // When a player gets BINGO, the leaderboard will show it
    socket.on('leaderboardUpdate', (data) => {
        const previousLeaderboard = leaderboard;
        leaderboard = data;
        renderLeaderboard();
        
        // Check for new BINGO winners and add to announcements
        data.forEach(player => {
            if (player.hasBingo) {
                // Check if this is a new BINGO we haven't announced yet
                const alreadyAnnounced = bingoAnnouncements.some(a => a.playerId === player.id);
                if (!alreadyAnnounced) {
                    const announcement = {
                        playerId: player.id,
                        playerName: player.name,
                        position: player.bingoPosition,
                        time: new Date().toLocaleTimeString()
                    };
                    bingoAnnouncements.unshift(announcement);
                    renderBingoAnnouncements();
                    showBingoAlert(`${player.name} called BINGO! (#${player.bingoPosition})`);
                }
            }
        });
    });

    socket.on('playerCountUpdate', (count) => {
        document.getElementById('playerCount').textContent = `Players: ${count}`;
    });

    // Event listeners
    document.getElementById('addTerm').addEventListener('click', addTerm);
    document.getElementById('newTerm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTerm();
    });

    document.getElementById('callTerm').addEventListener('click', callTermFromSelect);
    document.getElementById('resetGame').addEventListener('click', resetGame);
}

// Term management
async function loadTerms() {
    const response = await adminFetch('/api/admin/terms');
    terms = await response.json();
    renderTermsList();
    updateCallerInterface();
}

function renderTermsList() {
    const termsList = document.getElementById('termsList');
    termsList.innerHTML = '';

    document.getElementById('termCount').textContent = terms.length;

    terms.forEach((term, index) => {
        const div = document.createElement('div');
        div.className = 'term-item';
        div.innerHTML = `
            <span>${term}</span>
            <button onclick="deleteTerm(${index})">Delete</button>
        `;
        termsList.appendChild(div);
    });
}

async function addTerm() {
    const input = document.getElementById('newTerm');
    const term = input.value.trim();

    if (term) {
        try {
            const response = await adminFetch('/api/admin/terms', {
                method: 'POST',
                body: JSON.stringify({ term })
            });

            const data = await response.json();
            if (data.success) {
                input.value = '';
                // Terms will be updated via socket 'termsUpdated' event
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert('Failed to add term: ' + error.message);
        }
    }
}

async function deleteTerm(index) {
    try {
        const response = await adminFetch(`/api/admin/terms/${index}`, { method: 'DELETE' });
        const data = await response.json();
        if (!data.success) {
            alert('Failed to delete term: ' + data.message);
        }
        // Terms will be updated via socket 'termsUpdated' event
    } catch (error) {
        alert('Failed to delete term: ' + error.message);
    }
}

// Caller interface
function updateCallerInterface() {
    updateStats();
    updateTermSelect();
    renderQuickCallButtons();
    renderCalledTerms();
}

function updateStats() {
    const remaining = terms.filter(term => !calledTerms.includes(term)).length;
    document.getElementById('remainingCount').textContent = remaining;
    document.getElementById('calledCount').textContent = calledTerms.length;
}

function updateTermSelect() {
    const select = document.getElementById('termSelect');
    select.innerHTML = '<option value="">Select a term to call...</option>';

    terms.forEach(term => {
        if (!calledTerms.includes(term)) {
            const option = document.createElement('option');
            option.value = term;
            option.textContent = term;
            select.appendChild(option);
        }
    });
}

function renderQuickCallButtons() {
    const container = document.getElementById('quickCallButtons');
    container.innerHTML = '';

    terms.forEach(term => {
        const button = document.createElement('button');
        button.className = 'quick-call-btn';
        button.textContent = term;
        button.disabled = calledTerms.includes(term);

        if (!button.disabled) {
            button.addEventListener('click', () => callTerm(term));
        }

        container.appendChild(button);
    });
}

function renderCalledTerms() {
    const list = document.getElementById('calledTermsList');
    list.innerHTML = '';

    if (calledTerms.length === 0) {
        list.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No terms called yet</p>';
        return;
    }

    calledTerms.slice().reverse().forEach(term => {
        const span = document.createElement('span');
        span.className = 'called-term';
        span.style.display = 'inline-flex';
        span.style.alignItems = 'center';
        span.style.gap = '8px';
        
        const termText = document.createElement('span');
        termText.textContent = term;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove from called terms';
        removeBtn.style.cssText = 'background: #c41e3a; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 14px; line-height: 1; padding: 0;';
        removeBtn.addEventListener('click', () => uncallTerm(term));
        
        span.appendChild(termText);
        span.appendChild(removeBtn);
        list.appendChild(span);
    });
}

async function uncallTerm(term) {
    try {
        const response = await adminFetch('/api/admin/uncall-term', {
            method: 'POST',
            body: JSON.stringify({ term })
        });

        const data = await response.json();
        if (!data.success) {
            alert('Failed to uncall term: ' + data.message);
        }
        // UI will be updated via socket 'termUncalled' event
    } catch (error) {
        alert('Failed to uncall term: ' + error.message);
    }
}

async function callTermFromSelect() {
    const select = document.getElementById('termSelect');
    const term = select.value;

    if (term) {
        await callTerm(term);
        select.value = '';
    } else {
        alert('Please select a term to call');
    }
}

async function callTerm(term) {
    try {
        const response = await adminFetch('/api/admin/call-term', {
            method: 'POST',
            body: JSON.stringify({ term })
        });

        const data = await response.json();
        if (!data.success) {
            alert(data.message);
        }
        // UI will be updated via socket 'termCalled' event
    } catch (error) {
        alert('Failed to call term: ' + error.message);
    }
}

async function resetGame() {
    try {
        const response = await adminFetch('/api/admin/reset-game', { method: 'POST' });
        const data = await response.json();
        if (!data.success) {
            alert('Failed to reset game');
        }
        // UI will be updated via socket 'gameReset' event
    } catch (error) {
        alert('Failed to reset game: ' + error.message);
    }
}

// Bingo announcements
function renderBingoAnnouncements() {
    const list = document.getElementById('bingoList');
    list.innerHTML = '';

    if (bingoAnnouncements.length === 0) {
        list.innerHTML = '<p style="color: #666; text-align: center;">No bingo winners yet</p>';
        return;
    }

    bingoAnnouncements.forEach(announcement => {
        const div = document.createElement('div');
        div.className = 'bingo-item';
        div.innerHTML = `
            <span>🎉 #${announcement.position} - ${announcement.playerName}</span>
            <span class="time">${announcement.time}</span>
        `;
        list.appendChild(div);
    });
}

// Leaderboard
function renderLeaderboard() {
    const tbody = document.getElementById('adminLeaderboardBody');
    
    if (!leaderboard || leaderboard.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #999;">
                    Waiting for players...
                </td>
            </tr>
        `;
        return;
    }
    
    const cardSize = 16; // 4x4 card
    
    tbody.innerHTML = leaderboard.map(player => {
        const rankDisplay = player.rank <= 3 
            ? ['🥇', '🥈', '🥉'][player.rank - 1] 
            : `#${player.rank}`;
        // Progress is out of 16 (the card size), not calledTerms.length
        const progressPercent = Math.round((player.validClicks / cardSize) * 100);
        const rowClass = player.hasBingo ? 'bingo-winner-row' : (player.disconnected ? 'disconnected-row' : '');
        
        // Format clicked terms - highlight valid (called) ones in green
        const clickedTermsDisplay = (player.clickedTerms || []).map(term => {
            const isCalled = calledTerms.includes(term);
            return `<span style="display: inline-block; padding: 2px 6px; margin: 2px; border-radius: 4px; font-size: 0.75em; ${isCalled ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">${term}</span>`;
        }).join('');
        
        return `
            <tr class="${rowClass}">
                <td style="text-align: center; font-weight: bold; font-size: 1.2em; color: #333;">
                    ${rankDisplay}
                </td>
                <td style="color: #333;">
                    ${player.name}${player.disconnected ? ' <span style="color: #999; font-size: 0.8em;">(left)</span>' : ''}
                    ${player.hasBingo ? '<span class="bingo-badge">🎉 BINGO!</span>' : ''}
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="flex: 1; height: 20px; background: #eee; border-radius: 10px; overflow: hidden;">
                            <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, #2d5a3d, #4CAF50);"></div>
                        </div>
                        <span style="min-width: 60px; font-size: 0.9em; color: #333;">${player.validClicks}/${cardSize}</span>
                    </div>
                </td>
                <td style="text-align: center;">
                    ${player.hasBingo 
                        ? `<span style="color: #c41e3a; font-weight: bold;">🏆 Winner #${player.bingoPosition}</span>` 
                        : (player.disconnected ? '<span style="color: #999;">Left</span>' : '<span style="color: #666;">Playing</span>')}
                </td>
            </tr>
            <tr class="${rowClass}" style="border-bottom: 2px solid #ddd;">
                <td colspan="4" style="padding: 5px 10px; background: #f9f9f9;">
                    <strong style="color: #333; font-size: 0.85em;">Clicked:</strong> 
                    ${clickedTermsDisplay || '<span style="color: #999; font-size: 0.8em;">None yet</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

function showBingoAlert(message) {
    const alert = document.getElementById('bingoAlert');
    alert.textContent = message;
    alert.style.display = 'block';

    // Play a sound notification if available
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
        audio.play().catch(() => {});
    } catch (e) {}

    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}
