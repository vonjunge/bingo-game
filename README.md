# 🎄 Christmas Bingo Game

A multiplayer Christmas-themed bingo game with an admin control panel. Built with Node.js, Express, and Socket.IO.

## Architecture

### Client-Server Design

The application follows a **client-server architecture** where:

- **Server**: Manages all game state, player connections, and term management. Acts as the single source of truth.
- **Admin Client**: Web-based interface for administrators to manage game terms and call out bingo numbers. Requires password authentication.
- **Player Clients**: Web-based interface for players to join the game, view their bingo cards, and mark cells.

### Key Components

```
Server (server.js)
├── Express HTTP Server
├── Socket.IO WebSocket Server
├── Game State Management
│   ├── Terms
│   ├── Called Terms
│   ├── Players
│   └── Game Status
└── API Routes
    ├── Admin Routes (Password Protected)
    │   ├── POST /api/admin/login - Authenticate admin
    │   ├── GET /api/admin/terms - Get all terms
    │   ├── POST /api/admin/terms - Add term
    │   ├── DELETE /api/admin/terms/:index - Remove term
    │   ├── POST /api/admin/call-term - Call a term
    │   └── POST /api/admin/reset-game - Reset game state
    └── Public Routes
        ├── GET /api/game-state - Get current game state
        └── WebSocket Events for real-time updates

Client Applications
├── Admin Panel (/admin)
│   ├── Term Management (Add/Delete)
│   ├── Term Caller (Select and call terms)
│   ├── Quick Call Buttons
│   ├── Player Count
│   └── Bingo Announcements
└── Player Panel (/)
    ├── Player Registration
    ├── Bingo Card Generation
    ├── Card Marking
    ├── Called Terms Display
    └── Real-time Updates
```

## Features

- 🎮 **Multiplayer Support**: Real-time synchronization of game state across all clients
- 🔐 **Admin Authentication**: Password-protected admin panel for game control
- 👥 **Admin Card Monitoring**: View all player cards and their marked cells in real-time
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔔 **Real-time Updates**: WebSocket-based communication for instant updates
- ♻️ **Game Reset**: Easy game state reset for multiple rounds
- 📊 **Player Tracking**: Monitor active players in real-time
- 🐳 **Docker Ready**: Containerized for easy deployment
- ⚙️ **Docker Swarm Compatible**: Deploy with multiple replicas for high availability

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Docker & Docker Compose (optional, for containerized deployment)

### Local Installation

1. **Clone the repository**
   ```bash
   cd bingo-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   - Players: http://localhost:8080
   - Admin: http://localhost:8080/admin
   - Default admin password: `christmas2024`

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up --build

# Run with custom admin password
ADMIN_PASSWORD=your_password docker-compose up
```

#### Using Docker CLI

```bash
# Build the image
docker build -t christmas-bingo:latest .

# Run the container
docker run -p 8080:8080 -e ADMIN_PASSWORD=christmas2024 christmas-bingo:latest

# Run with custom password
docker run -p 8080:8080 -e ADMIN_PASSWORD=your_secure_password christmas-bingo:latest
```

#### Using npm scripts

```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run

# Run with docker-compose
npm run docker:compose

# Build and run with docker-compose
npm run docker:compose:build
```

### Docker Swarm Deployment

For production deployment with high availability:

```bash
# Initialize Docker Swarm (if not already done)
docker swarm init

# Build and tag the image
docker build -t christmas-bingo:latest .

# Deploy the stack with 3 replicas
docker stack deploy -c docker-stack.yml bingo

# Check service status
docker stack services bingo

# Scale the service
docker service scale bingo_bingo-server=5

# Update the service (rolling update)
docker service update --image christmas-bingo:latest bingo_bingo-server

# Remove the stack
docker stack rm bingo
```

**Docker Stack Features:**
- 3 replicas by default for load distribution
- Rolling updates with automatic rollback on failure
- Health checks for each replica
- Resource limits (256MB memory, 0.5 CPU per replica)
- Overlay network for inter-container communication

## Configuration

### Environment Variables

- `PORT` (default: 8080) - Server port
- `ADMIN_PASSWORD` (default: christmas2024) - Admin login password
- `NODE_ENV` (default: production) - Node environment

### Setting Custom Admin Password

**Local:**
```bash
ADMIN_PASSWORD=your_password npm start
```

**Docker Compose:**
```bash
ADMIN_PASSWORD=your_password docker-compose up
```

**Docker CLI:**
```bash
docker run -p 8080:8080 -e ADMIN_PASSWORD=your_password christmas-bingo:latest
```

## Usage

### For Players

1. Navigate to http://localhost:8080
2. Enter your name and click "Join Game"
3. Click "Generate New Card" to create your bingo card
4. Mark cells as the admin calls out terms
5. Click "BINGO!" when you have a winning pattern

### For Admin

1. Navigate to http://localhost:8080/admin
2. Enter the admin password
3. **Manage Terms**:
   - Add new terms using the input field
   - Delete existing terms with the Delete button
4. **Call Terms**:
   - Use the dropdown to select a term or click quick call buttons
   - Monitor called terms and remaining terms
   - **Uncall terms**: Click the red ✕ button next to any called term to remove it (in case of mistakes)
5. **Monitor Players**:
   - View active player count
   - See BINGO announcements in real-time
6. **Reset Game**: Click "Reset Game" to clear called terms for a new round

## API Reference

### Public Endpoints

#### Get Game State
```
GET /api/game-state
Response: { terms, calledTerms, playerCount, isGameActive }
```

### Admin Endpoints (Require Authorization)

All admin endpoints require the `Authorization: Bearer <token>` header after login.

#### Admin Login
```
POST /api/admin/login
Body: { password }
Response: { success, token }
```

#### Get Terms
```
GET /api/admin/terms
Response: [terms array]
```

#### Add Term
```
POST /api/admin/terms
Body: { term }
Response: { success, terms }
```

#### Delete Term
```
DELETE /api/admin/terms/:index
Response: { success, terms }
```

#### Call Term
```
POST /api/admin/call-term
Body: { term }
Response: { success, calledTerms }
```

#### Uncall Term
```
POST /api/admin/uncall-term
Body: { term }
Response: { success, calledTerms }
```

#### Reset Game
```
POST /api/admin/reset-game
Response: { success }
```

## WebSocket Events

### Client → Server

- `registerPlayer` - Register a player with their name
- `bingo` - Announce when a player has bingo

### Server → Client

- `initialData` - Send initial game state to newly connected client
- `termsUpdated` - Broadcast when terms are modified
- `termCalled` - Broadcast when a term is called
- `termUncalled` - Broadcast when a term is uncalled by admin
- `gameReset` - Broadcast when the game is reset
- `bingoAnnouncement` - Broadcast when a player calls bingo
- `playerCountUpdate` - Broadcast updated player count
- `playersUpdate` - Broadcast updated player card states

## Docker Image Details

- **Base Image**: node:18-alpine (lightweight)
- **Size**: ~150MB
- **Health Check**: Built-in HTTP health check
- **Non-root User**: Runs as non-root user for security
- **Multi-stage Build**: Optimized for production

## Project Structure

```
bingo-game/
├── server.js              # Main server file
├── package.json          # Node.js dependencies
├── Dockerfile            # Docker image definition
├── docker-compose.yml    # Docker Compose configuration
├── .dockerignore         # Docker build exclusions
├── public/               # Static files and client code
│   ├── index.html       # Player interface
│   ├── admin.html       # Admin interface
│   ├── app.js           # Player client code
│   ├── admin.js         # Admin client code
│   ├── style.css        # Main styles
│   └── admin-style.css  # Admin panel styles
└── README.md            # This file
```

## Troubleshooting

### Container won't start
- Check logs: `docker logs christmas-bingo-server`
- Verify port 8080 is not in use
- Ensure Docker has sufficient resources

### Admin password not working
- Verify environment variable is set correctly
- Default password is `christmas2024`
- Restart container after changing password

### WebSocket connection issues
- Check browser console for errors
- Ensure firewall allows WebSocket connections
- Verify CORS is properly configured

### Players can't see admin changes
- Check WebSocket connection status
- Verify all clients are connected to same server
- Check browser console for errors

## Security Considerations

- ✅ Admin routes require authentication token
- ✅ Runs as non-root user in Docker
- ✅ CORS configured for same-origin requests
- ⚠️ Change default admin password in production
- ⚠️ Use HTTPS in production (consider nginx reverse proxy)
- ⚠️ Consider rate limiting for admin endpoints

## Performance Notes

- Handles 30+ concurrent players comfortably
- Real-time WebSocket updates
- Minimal memory footprint (~50MB)
- Scales horizontally with load balancer

## License

MIT

## Support

For issues, questions, or contributions, please create an issue in the repository.

---

**Created**: December 2024  
**Version**: 1.0.0
   - Add or delete Christmas-themed terms
   - Need minimum 24 terms for card generation
   - Changes sync to all players in real-time

2. **Call Terms**:
   - Use dropdown to select and call terms
   - OR use Quick Call buttons to call terms with one click
   - View real-time stats (remaining/called terms)
   - See complete history of called terms

3. **Monitor Players**:
   - View player count
   - See bingo announcements as they happen
   - Track all winners with timestamps
   - **View Player Cards Monitor**: Real-time view of all player cards
     - See each player's bingo card layout with color-coded status:
       - **Gold**: Player marked only (they marked before you called it)
       - **Light Blue**: You called but player hasn't marked yet
       - **Green (pulsing)**: You called AND player marked ✓ (correct!)
       - **Light Green**: FREE space
     - Identify players who haven't generated cards yet
     - Quickly verify if players are marking correctly

4. **Reset Game**:
   - Clear all called terms to start a new round
   - Reset bingo announcements

### For Players

**Access the Player Interface:**
- Navigate to `http://localhost:8080`
- No password required for players

1. **Join the Game**:
   - Enter your name on the welcome screen
   - Click "Join Game"

2. **Generate Your Card**:
   - Click "Generate New Card" to get a random bingo card
   - Each card has 25 spaces (including a FREE center space)

3. **Mark Your Card**:
   - Click on cells to mark them as the host calls terms
   - Called terms will be highlighted automatically
   - The FREE space is pre-marked

4. **Call Bingo**:
   - When you complete a row, column, or diagonal, click "BINGO!"
   - The system validates your win and announces it to all players

5. **Print Your Card**:
   - Click "Print Card" to print a physical copy

### Player Interface (Optional)

Players can also access term management through the "Manage Terms" tab on the player page, but the dedicated admin portal provides a better experience for hosting.

## Default Terms

The game comes pre-loaded with 25 Christmas terms:
- Santa Claus, Reindeer, Snowman, Christmas Tree, Presents
- Candy Cane, Mistletoe, Jingle Bells, Elf, North Pole
- And 15 more festive terms!

## Technical Details

### Technology Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time Communication**: Socket.IO for WebSocket connections

### File Structure
```
bingo-game/
├── server.js           # Express server and Socket.IO setup
├── package.json        # Project dependencies
├── public/
│   ├── index.html      # Main HTML page
│   ├── style.css       # Christmas-themed styles
│   └── app.js          # Client-side JavaScript
└── README.md           # This file
```

### API Endpoints

- `GET /api/terms` - Get all terms
- `POST /api/terms` - Add a new term
- `DELETE /api/terms/:index` - Delete a term
- `GET /api/called-terms` - Get called terms
- `POST /api/call-term` - Call a term
- `POST /api/reset-game` - Reset the game

### Socket Events

- `connection` - Player connects
- `registerPlayer` - Player registers with name
- `termCalled` - Host calls a term
- `bingo` - Player calls bingo
- `bingoAnnouncement` - Broadcast bingo win
- `playerCountUpdate` - Update player count
- `termsUpdated` - Terms list changed
- `gameReset` - Game reset by host

## Customization

### Changing the Admin Password

Edit `server.js` and modify:
```javascript
const ADMIN_PASSWORD = 'christmas2024'; // Change this to your desired password
```

### Changing the Port

The default port is 8080. To change it, edit `server.js` and modify:
```javascript
const PORT = process.env.PORT || 8080;
```

Or set the PORT environment variable:
```bash
PORT=3000 npm start
```

### Adding More Terms

Use the Admin Portal at `/admin` or edit the `terms` array in `server.js`.

### Styling

Modify `public/style.css` to customize colors, fonts, and animations.

## Troubleshooting

**Issue**: Cards won't generate
- **Solution**: Make sure you have at least 24 terms in the term list

**Issue**: Players can't connect
- **Solution**: Check that the server is running and the port isn't blocked by a firewall

**Issue**: Real-time updates not working
- **Solution**: Ensure Socket.IO is properly installed and the client can establish WebSocket connections

## Browser Compatibility

Works with all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## License

Free to use for workplace events and personal gatherings.
