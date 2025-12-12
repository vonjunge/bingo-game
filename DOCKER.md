# Docker Quick Start Guide

## Installation

If you don't have Docker installed, download it from [docker.com](https://www.docker.com/products/docker-desktop).

## Running the Application

### Option 1: Docker Compose (Easiest)

```bash
# Clone/navigate to the project directory
cd bingo-game

# Build and run
docker-compose up --build

# Application will be available at:
# - http://localhost:8080 (Players)
# - http://localhost:8080/admin (Admin)
```

### Option 2: Docker CLI

```bash
# Build the image
docker build -t christmas-bingo .

# Run the container
docker run -p 8080:8080 christmas-bingo

# Application will be available at:
# - http://localhost:8080 (Players)
# - http://localhost:8080/admin (Admin)
```

### Option 3: Using npm scripts

```bash
# Build and run with Docker
npm run docker:compose:build

# Or just build the image
npm run docker:build

# Or just run (if image already exists)
npm run docker:run
```

## Custom Admin Password

### With Docker Compose

```bash
# Edit docker-compose.yml and change:
# ADMIN_PASSWORD: ${ADMIN_PASSWORD:-christmas2024}
# Or pass it via environment:
ADMIN_PASSWORD=myPassword123 docker-compose up
```

### With Docker CLI

```bash
docker run -p 8080:8080 -e ADMIN_PASSWORD=myPassword123 christmas-bingo
```

### With npm scripts

```bash
ADMIN_PASSWORD=myPassword123 npm run docker:run
```

## Stopping the Container

### Docker Compose

```bash
docker-compose down
```

### Docker CLI

```bash
# Find container ID
docker ps

# Stop the container
docker stop <container-id>

# Remove the container
docker rm <container-id>
```

## Checking Logs

### Docker Compose

```bash
# View logs
docker-compose logs

# Follow logs (real-time)
docker-compose logs -f
```

### Docker CLI

```bash
# View logs
docker logs <container-id>

# Follow logs (real-time)
docker logs -f <container-id>
```

## Useful Commands

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# List images
docker images

# Remove image
docker rmi christmas-bingo

# View image layers
docker history christmas-bingo

# Inspect container
docker inspect <container-id>

# Access container shell
docker exec -it <container-id> /bin/sh

# Check container health
docker inspect --format='{{.State.Health.Status}}' <container-id>
```

## Production Deployment

### Environment Setup

Create a `.env` file:

```
PORT=8080
ADMIN_PASSWORD=secure_password_here
NODE_ENV=production
```

### Run with Production Settings

```bash
# Using Docker Compose
docker-compose up -d

# Using Docker CLI
docker run -d \
  -p 8080:8080 \
  -e ADMIN_PASSWORD=secure_password_here \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --name christmas-bingo-server \
  christmas-bingo:latest
```

### Behind a Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name bingo.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8080
# On Linux/Mac:
lsof -i :8080

# On Windows:
netstat -ano | findstr :8080

# Change port in docker-compose.yml or use:
docker run -p 8081:8080 christmas-bingo
```

### Container Exiting Immediately

```bash
# Check logs
docker logs <container-id>

# Common causes:
# - Bad environment variables
# - Port already in use
# - Insufficient resources
```

### Memory Issues

```bash
# Check container resource usage
docker stats

# Limit memory (if needed)
docker run -m 512m -p 8080:8080 christmas-bingo
```

## Performance Monitoring

```bash
# Real-time stats
docker stats christmas-bingo-server

# View container details
docker inspect christmas-bingo-server

# Check for restart count
docker inspect --format='{{.RestartCount}}' christmas-bingo-server
```

## Scaling

For multiple instances, use Docker Compose with load balancing or Kubernetes.

See docker-compose.yml for configuration options.

## Support

For issues, check:
1. Container logs: `docker logs`
2. Browser console for client-side errors
3. Firewall settings
4. Port availability
