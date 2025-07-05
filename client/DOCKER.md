# Docker Setup for Finance App Client

This directory contains Docker configuration for the Finance App React client.

## Files Created

- `Dockerfile` - Multi-stage Docker build for development and production
- `docker-compose.yml` - Docker Compose configuration with dev and prod profiles
- `nginx.conf` - Nginx configuration for production deployment
- `.dockerignore` - Files to exclude from Docker build context

## Usage

### Development Mode

Run the client in development mode with hot reloading:

```bash
# Start development server
docker-compose --profile dev up client-dev

# Or build and run
docker-compose --profile dev up --build client-dev
```

The development server will be available at `http://localhost:5173`

### Production Mode

Build and run the optimized production version:

```bash
# Start production server
docker-compose --profile prod up client-prod

# Or build and run
docker-compose --profile prod up --build client-prod
```

The production server will be available at `http://localhost:3000`

### Building Images

```bash
# Build development image
docker build --target build -t finance-client:dev .

# Build production image
docker build --target production -t finance-client:prod .
```

### Environment Variables

For production deployment, you may want to customize:

- `VITE_API_URL` - Backend API URL (default: http://localhost:4000)
- Domain names in Traefik labels for production deployment

### Network Configuration

The docker-compose file expects an external network named `traefik-public`. Create it with:

```bash
docker network create traefik-public
```

### Integration with Backend

To run both client and backend together, you can use the backend's docker-compose and add the client service, or create a root-level docker-compose that includes both services.

## Production Deployment

The production configuration includes:

- Nginx web server for optimal static file serving
- Gzip compression
- Security headers
- Client-side routing support
- Static asset caching
- Traefik labels for reverse proxy integration

## Troubleshooting

1. **Port conflicts**: Make sure ports 5173 (dev) and 3000 (prod) are available
2. **Network issues**: Ensure the `traefik-public` exists
3. **Build failures**: Check that all dependencies in package.json are compatible
4. **API connection**: Verify the VITE_API_URL environment variable points to the correct backend URL