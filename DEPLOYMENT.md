# Deployment Guide - Christmas Bingo Game

## Overview

This guide covers deploying the Christmas Bingo Game to Docker Swarm for production use.

## Prerequisites

- Docker 20.10+
- Docker Swarm initialized
- Access to a Docker registry (optional, for multi-node deployment)

## Quick Start - Single Node

### 1. Build the Image

```bash
docker build -t christmas-bingo:latest .
```

### 2. Deploy to Swarm

```bash
# Set your admin password
export ADMIN_PASSWORD="your_secure_password_here"

# Deploy the stack
docker stack deploy -c docker-stack.yml bingo
```

### 3. Verify Deployment

```bash
# Check service status
docker stack services bingo

# Check service logs
docker service logs bingo_bingo-server

# View running tasks
docker stack ps bingo
```

### 4. Access the Application

- Player Interface: http://your-server:8080
- Admin Panel: http://your-server:8080/admin

## Multi-Node Deployment

### 1. Push Image to Registry

```bash
# Tag for your registry
docker tag christmas-bingo:latest your-registry.com/christmas-bingo:latest

# Push to registry
docker push your-registry.com/christmas-bingo:latest
```

### 2. Update docker-stack.yml

Replace `image: christmas-bingo:latest` with `image: your-registry.com/christmas-bingo:latest`

### 3. Deploy Across Nodes

```bash
# Deploy to swarm
docker stack deploy -c docker-stack.yml bingo
```

## Configuration

### Environment Variables

Set these when deploying:

```bash
export ADMIN_PASSWORD="your_password"
export PORT=8080
export NODE_ENV=production
```

### Scaling

```bash
# Scale to 5 replicas
docker service scale bingo_bingo-server=5

# Scale down to 2 replicas
docker service scale bingo_bingo-server=2
```

### Resource Limits

Default limits per replica:
- Memory: 256MB limit, 128MB reservation
- CPU: 0.50 limit, 0.25 reservation

Modify in `docker-stack.yml` under `deploy.resources`.

## High Availability Features

### Load Balancing

Docker Swarm automatically load balances across replicas. Configure your load balancer to point to any swarm node on port 8080.

### Health Checks

Each replica is monitored with health checks every 30 seconds. Unhealthy replicas are automatically restarted.

### Rolling Updates

```bash
# Update to new version with zero downtime
docker service update --image christmas-bingo:v2 bingo_bingo-server
```

Update configuration:
- 1 replica updated at a time
- 10 second delay between updates
- Automatic rollback if more than 30% of updates fail

### Rollback

```bash
# Manual rollback to previous version
docker service rollback bingo_bingo-server
```

## Monitoring

### Service Status

```bash
# List all services
docker stack services bingo

# Detailed service info
docker service inspect bingo_bingo-server

# View service logs
docker service logs -f bingo_bingo-server

# View logs for specific replica
docker service logs -f bingo_bingo-server.<replica-id>
```

### Resource Usage

```bash
# Stats for all containers
docker stats

# Stats for specific service
docker stats $(docker ps -q --filter "name=bingo_bingo-server")
```

## Networking

### Overlay Network

The stack creates an overlay network (`bingo-network`) for inter-container communication.

### Port Mapping

- Port 8080 is exposed on all swarm nodes
- Traffic to any node's port 8080 is routed to healthy replicas

### External Load Balancer

For production, use an external load balancer (nginx, HAProxy, etc.):

```nginx
upstream bingo_servers {
    server swarm-node1:8080;
    server swarm-node2:8080;
    server swarm-node3:8080;
}

server {
    listen 80;
    server_name bingo.yourdomain.com;

    location / {
        proxy_pass http://bingo_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Troubleshooting

### Service Won't Start

```bash
# Check service errors
docker service ps bingo_bingo-server --no-trunc

# Check container logs
docker service logs bingo_bingo-server
```

### Port Already in Use

```bash
# Check what's using port 8080
sudo netstat -tulpn | grep 8080

# Or modify the port in docker-stack.yml
ports:
  - "8081:8080"  # Use port 8081 instead
```

### Unhealthy Replicas

```bash
# Check health status
docker service ps bingo_bingo-server

# View logs for unhealthy replicas
docker service logs bingo_bingo-server
```

### WebSocket Connection Issues

Ensure your load balancer supports WebSocket upgrades. The application uses Socket.IO for real-time communication.

## Updating the Application

### Code Changes

1. Make your code changes
2. Build new image: `docker build -t christmas-bingo:v2 .`
3. Update service: `docker service update --image christmas-bingo:v2 bingo_bingo-server`

### Configuration Changes

1. Update `docker-stack.yml`
2. Redeploy: `docker stack deploy -c docker-stack.yml bingo`

## Cleanup

### Remove Stack

```bash
# Remove the entire stack
docker stack rm bingo

# Verify removal
docker stack ls
```

### Remove Images

```bash
# Remove local image
docker rmi christmas-bingo:latest

# Remove all unused images
docker image prune -a
```

## Security Recommendations

1. **Change Default Password**: Always set a strong `ADMIN_PASSWORD`
2. **Use HTTPS**: Deploy behind an SSL-terminating load balancer
3. **Network Isolation**: Use Docker Swarm's network policies
4. **Regular Updates**: Keep Docker and the base image updated
5. **Resource Limits**: Prevent resource exhaustion with limits
6. **Secrets Management**: Use Docker secrets for sensitive data:

```bash
# Create secret
echo "my_secure_password" | docker secret create admin_password -

# Update stack to use secret (modify docker-stack.yml):
secrets:
  - admin_password

environment:
  - ADMIN_PASSWORD_FILE=/run/secrets/admin_password
```

## Performance Tips

1. **Replica Count**: Start with 3 replicas, scale based on load
2. **Resource Tuning**: Monitor and adjust CPU/memory limits
3. **Node Labels**: Use node labels for placement constraints
4. **Persistent Storage**: Not required for this stateless application
5. **CDN**: Consider CDN for static assets in high-traffic scenarios

## Support

For issues or questions:
- Check logs: `docker service logs bingo_bingo-server`
- Review README.md for feature documentation
- Check ARCHITECTURE.md for system design details
