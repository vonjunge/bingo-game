const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const path = require('path');

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Load initial terms from environment variable or use empty array
const getInitialTerms = () => {
  const termsEnv = process.env.BINGO_TERMS;
  if (termsEnv) {
    return termsEnv.split(',').map(term => term.trim()).filter(term => term.length > 0);
  }
  return [];
};

// Game State - Managed by Server/Admin
let gameState = {
  terms: getInitialTerms(),
  calledTerms: [],
  players: {},
  bingoWinners: [],
  isGameActive: false
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'christmas2024';

// Helper function to validate admin
function validateAdminSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid authorization header' });
  }
  
  const adminToken = authHeader.split(' ')[1];
  if (!adminToken || !adminToken.startsWith('admin_token_')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token format' });
  }
  
  // Token is valid (basic validation - in production, use proper JWT)
  next();
}

// Calculate leaderboard from player scores
function calculateLeaderboard() {
  const players = Object.values(gameState.players);
  
  // Sort by validClicks (called terms that player clicked) descending
  // Include ALL players (connected and disconnected)
  const sorted = players.map(p => ({
    id: p.id,
    name: p.name,
    validClicks: p.validClicks || 0,
    totalClicks: p.totalClicks || 0,
    hasBingo: p.hasBingo || false,
    bingoPosition: p.bingoPosition || null,
    bingoTime: p.bingoTime || null,
    disconnected: p.disconnected || false,
    clickedTerms: p.clickedTerms || []
  })).sort((a, b) => {
    // BINGO winners are sorted by their frozen position
    if (a.hasBingo && b.hasBingo) {
      return a.bingoPosition - b.bingoPosition;
    }
    // BINGO winners come first
    if (a.hasBingo) return -1;
    if (b.hasBingo) return 1;
    // Then sort by valid clicks
    return b.validClicks - a.validClicks;
  });

  // Assign ranks - BINGO winners keep their frozen position
  let currentRank = 1;
  return sorted.map((player, index) => {
    if (player.hasBingo) {
      return { ...player, rank: player.bingoPosition };
    }
    // Count how many BINGO winners exist
    const bingoCount = sorted.filter(p => p.hasBingo).length;
    return { ...player, rank: bingoCount + (index - bingoCount) + 1 };
  });
}

// Broadcast leaderboard update
function broadcastLeaderboard() {
  const leaderboard = calculateLeaderboard();
  io.emit('leaderboardUpdate', leaderboard);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

// Public API: Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json(calculateLeaderboard());
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin_token_' + Date.now() });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Get Game State (for clients and admin)
app.get('/api/game-state', (req, res) => {
  const connectedPlayersCount = Object.values(gameState.players).filter(p => !p.disconnected).length;
  res.json({
    terms: gameState.terms,
    calledTerms: gameState.calledTerms,
    playerCount: connectedPlayersCount,
    isGameActive: gameState.isGameActive
  });
});

// Admin: Get all terms
app.get('/api/admin/terms', validateAdminSession, (req, res) => {
  res.json(gameState.terms);
});

// Admin: Add term
app.post('/api/admin/terms', validateAdminSession, (req, res) => {
  const { term } = req.body;
  if (term && !gameState.terms.includes(term)) {
    gameState.terms.push(term);
    io.emit('termsUpdated', gameState.terms);
    res.json({ success: true, terms: gameState.terms });
  } else {
    res.status(400).json({ success: false, message: 'Invalid or duplicate term' });
  }
});

// Admin: Delete term
app.delete('/api/admin/terms/:index', validateAdminSession, (req, res) => {
  const index = parseInt(req.params.index);
  if (index >= 0 && index < gameState.terms.length) {
    gameState.terms.splice(index, 1);
    io.emit('termsUpdated', gameState.terms);
    res.json({ success: true, terms: gameState.terms });
  } else {
    res.status(400).json({ success: false, message: 'Invalid index' });
  }
});

// Admin: Call term
app.post('/api/admin/call-term', validateAdminSession, (req, res) => {
  const { term } = req.body;
  if (term && gameState.terms.includes(term) && !gameState.calledTerms.includes(term)) {
    gameState.calledTerms.push(term);
    io.emit('termCalled', { term, calledTerms: gameState.calledTerms });
    res.json({ success: true, calledTerms: gameState.calledTerms });
  } else {
    res.status(400).json({ success: false, message: 'Invalid term or already called' });
  }
});

// Admin: Uncall a term (remove from called terms)
app.post('/api/admin/uncall-term', validateAdminSession, (req, res) => {
  const { term } = req.body;
  const index = gameState.calledTerms.indexOf(term);
  if (index > -1) {
    gameState.calledTerms.splice(index, 1);
    io.emit('termUncalled', { term, calledTerms: gameState.calledTerms });
    res.json({ success: true, calledTerms: gameState.calledTerms });
  } else {
    res.status(400).json({ success: false, message: 'Term not found in called terms' });
  }
});

// Admin: Reset game
app.post('/api/admin/reset-game', validateAdminSession, (req, res) => {
  gameState.calledTerms = [];
  gameState.bingoWinners = [];
  gameState.isGameActive = false;
  // Reset all player scores
  Object.keys(gameState.players).forEach(id => {
    gameState.players[id].validClicks = 0;
    gameState.players[id].totalClicks = 0;
    gameState.players[id].hasBingo = false;
    gameState.players[id].bingoPosition = null;
    gameState.players[id].bingoTime = null;
    gameState.players[id].clickedTerms = [];
  });
  io.emit('gameReset');
  broadcastLeaderboard();
  res.json({ success: true });
});

// WebSocket Handlers (Socket.IO)
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current game state to newly connected client
  const connectedPlayersCount = Object.values(gameState.players).filter(p => !p.disconnected).length;
  socket.emit('initialData', {
    terms: gameState.terms,
    calledTerms: gameState.calledTerms,
    playerCount: connectedPlayersCount,
    isGameActive: gameState.isGameActive,
    leaderboard: calculateLeaderboard()
  });

  // Player Registration
  socket.on('registerPlayer', (playerName) => {
    gameState.players[socket.id] = {
      name: playerName,
      id: socket.id,
      socketId: socket.id,
      card: [],
      clickedTerms: [],
      validClicks: 0,
      totalClicks: 0,
      hasBingo: false,
      bingoPosition: null,
      bingoTime: null,
      disconnected: false
    };
    console.log('Player registered:', playerName, '- Total players:', Object.keys(gameState.players).length);
    const connectedPlayers = Object.values(gameState.players).filter(p => !p.disconnected).length;
    io.emit('playerCountUpdate', connectedPlayers);
    broadcastLeaderboard();
  });

  // Player updates their card
  socket.on('updateCard', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].card = data.card;
    }
  });

  // Player clicks a term
  socket.on('termClicked', (data) => {
    const player = gameState.players[socket.id];
    if (player && !player.hasBingo) {
      const { term, isClicked } = data;
      
      if (isClicked) {
        // Add to clicked terms if not already there
        if (!player.clickedTerms.includes(term)) {
          player.clickedTerms.push(term);
          player.totalClicks++;
          
          // Check if it's a called term (valid click)
          if (gameState.calledTerms.includes(term)) {
            player.validClicks++;
          }
        }
      } else {
        // Remove from clicked terms
        const idx = player.clickedTerms.indexOf(term);
        if (idx > -1) {
          player.clickedTerms.splice(idx, 1);
          player.totalClicks = Math.max(0, player.totalClicks - 1);
          
          // Update valid clicks count
          if (gameState.calledTerms.includes(term)) {
            player.validClicks = Math.max(0, player.validClicks - 1);
          }
        }
      }
      
      broadcastLeaderboard();
    }
  });

  // Player calls BINGO
  socket.on('bingo', (data) => {
    console.log('BINGO event received from socket:', socket.id);
    console.log('BINGO data:', data);
    
    const player = gameState.players[socket.id];
    console.log('Player found:', player ? player.name : 'NOT FOUND');
    console.log('Player hasBingo already:', player ? player.hasBingo : 'N/A');
    
    if (player && !player.hasBingo) {
      // Calculate position (number of existing winners + 1)
      const position = gameState.bingoWinners.length + 1;
      
      player.hasBingo = true;
      player.bingoPosition = position;
      player.bingoTime = new Date().toISOString();
      
      gameState.bingoWinners.push({
        id: socket.id,
        name: player.name,
        position: position,
        time: player.bingoTime
      });
      
      console.log('Sending bingoAnnouncement to socket:', socket.id, 'position:', position);
      
      // Only notify the winning player (not everyone)
      socket.emit('bingoAnnouncement', {
        playerName: player.name,
        playerId: socket.id,
        position: position
      });
      
      console.log('BINGO called by:', player.name, 'Position:', position);
      broadcastLeaderboard();
    } else {
      console.log('BINGO rejected - player not found or already has bingo');
    }
  });

  // Player disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (gameState.players[socket.id]) {
      // Mark player as disconnected but keep them in the leaderboard
      console.log('Player disconnected (kept in leaderboard):', gameState.players[socket.id].name);
      gameState.players[socket.id].disconnected = true;
      
      // Count only connected players for the player count display
      const connectedPlayers = Object.values(gameState.players).filter(p => !p.disconnected).length;
      io.emit('playerCountUpdate', connectedPlayers);
      broadcastLeaderboard();
    }
  });
});

// Error handling middleware - must be after all routes
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// Start Server
const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
  console.log(`🎄 Christmas Bingo Server running on http://0.0.0.0:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
  console.log(`Player panel at http://localhost:${PORT}/`);
  console.log(`Leaderboard at http://localhost:${PORT}/leaderboard`);
});
