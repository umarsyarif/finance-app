# Docker Setup Guide

This guide explains how to use the consolidated Docker Compose setup for the Finance App.

## Overview

All Docker services have been consolidated into a single `docker-compose.yml` file in the root directory for easier maintenance and deployment.

## Services Included

- **Traefik**: Reverse proxy and load balancer
- **PostgreSQL**: Database server
- **Redis**: Cache server
- **Backend**: Node.js API server
- **Client (Production)**: React frontend for production
- **Client (Development)**: React frontend for development

## Prerequisites

1. Docker and Docker Compose installed
2. Create the external network:
   ```bash
   docker network create traefik-public
   ```

## Usage

### Production Deployment

To run the full production stack:

```bash
# From the root directory
docker-compose --profile prod up -d
```

This will start:
- Traefik (reverse proxy)
- PostgreSQL database
- Redis cache
- Backend API
- Frontend client (production build)

### Development Deployment

To run the development stack:

```bash
# From the root directory
docker-compose --profile dev up -d
```

This will start:
- Traefik (reverse proxy)
- PostgreSQL database
- Redis cache
- Backend API
- Frontend client (development build)

### Running Individual Services

To run only specific services:

```bash
# Database and cache only
docker-compose up -d postgres redis

# Backend only (requires database)
docker-compose up -d postgres redis backend

# All infrastructure services
docker-compose up -d traefik postgres redis
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: This will delete your data)
docker-compose down -v
```

## Service Details

### Ports

- **Traefik**: 80 (HTTP), 443 (HTTPS)
- **PostgreSQL**: 6500 (mapped from 5432)
- **Redis**: 6379
- **Backend**: 4000
- **Client (Production)**: 3000
- **Client (Development)**: 3001

### Domains (Production)

- **Frontend**: https://finance.umarsyariif.site
- **Backend API**: https://finance-api.umarsyariif.site
- **Development Frontend**: https://finance-dev.umarsyariif.site

### Environment Files

The backend service uses the environment file located at `./backend/.env`.

### Volumes

- **postgresDB**: Persistent PostgreSQL data
- **redisDB**: Persistent Redis data

## Migration from Separate Compose Files

The previous separate docker-compose files in `/backend` and `/client` directories are now consolidated. You can:

1. **Keep the old files** as backup or for individual service development
2. **Remove the old files** if you prefer to use only the consolidated setup

### Benefits of Consolidated Setup

1. **Single Command Deployment**: Deploy entire stack with one command
2. **Easier Maintenance**: All services defined in one place
3. **Better Service Discovery**: All services on the same network
4. **Simplified CI/CD**: Single compose file for deployment pipelines
5. **Environment Consistency**: Same network and configuration across all services

## Troubleshooting

### Network Issues

If you encounter network issues, ensure the external network exists:

```bash
docker network ls | grep traefik-public
```

If it doesn't exist, create it:

```bash
docker network create traefik-public
```

### Service Dependencies

The backend service depends on PostgreSQL and Redis. If the backend fails to start, check that the database services are running:

```bash
docker-compose ps
docker-compose logs postgres
docker-compose logs redis
```

### Logs

To view logs for specific services:

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs postgres

# Follow logs in real-time
docker-compose logs -f backend
```

## Development Workflow

For local development, you might want to run only the infrastructure services and run the backend/frontend locally:

```bash
# Start only database and cache
docker-compose up -d postgres redis

# Then run backend locally
cd backend && yarn start

# And frontend locally
cd client && npm run dev
```

This approach gives you faster development cycles while still using containerized databases.