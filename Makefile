# Finance App Docker Management

.PHONY: help setup prod dev stop clean logs network

# Default target
help:
	@echo "Finance App Docker Commands:"
	@echo ""
	@echo "  setup     - Create required Docker network"
	@echo "  prod      - Start production environment"
	@echo "  dev       - Start development environment"
	@echo "  infra     - Start only infrastructure (DB, Redis, Traefik)"
	@echo "  backend   - Start backend services (DB, Redis, Backend)"
	@echo "  stop      - Stop all services"
	@echo "  clean     - Stop and remove all containers and volumes"
	@echo "  logs      - Show logs for all services"
	@echo "  logs-f    - Follow logs for all services"
	@echo "  status    - Show status of all services"
	@echo "  network   - Create the required Docker network"
	@echo ""
	@echo "Examples:"
	@echo "  make setup && make prod    # First time production setup"
	@echo "  make dev                   # Start development environment"
	@echo "  make infra                 # Start only infrastructure services"

# Create required Docker network
setup: network
	@echo "✅ Setup complete! You can now run 'make prod' or 'make dev'"

network:
	@echo "🔧 Creating Docker network..."
	@docker network create traefik-public 2>/dev/null || echo "Network already exists"

# Production environment
prod: network
	@echo "🚀 Starting production environment..."
	docker-compose --profile prod up -d
	@echo "✅ Production environment started!"
	@echo "Frontend: https://finance.umarsyariif.site"
	@echo "Backend API: https://finance-api.umarsyariif.site"

# Development environment
dev: network
	@echo "🛠️  Starting development environment..."
	docker-compose --profile dev up -d
	@echo "✅ Development environment started!"
	@echo "Frontend: https://finance-dev.umarsyariif.site"
	@echo "Backend API: https://finance-api.umarsyariif.site"

# Infrastructure only (DB, Redis, Traefik)
infra: network
	@echo "🏗️  Starting infrastructure services..."
	docker-compose up -d traefik postgres redis
	@echo "✅ Infrastructure services started!"
	@echo "You can now run backend and frontend locally"

# Backend services (for local frontend development)
backend: network
	@echo "🔧 Starting backend services..."
	docker-compose up -d postgres redis backend
	@echo "✅ Backend services started!"
	@echo "Backend API: http://localhost:4000"

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	docker-compose down
	@echo "✅ All services stopped!"

# Clean up everything (WARNING: This removes volumes/data)
clean:
	@echo "🧹 Cleaning up all containers and volumes..."
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "✅ Cleanup complete!"

# Show logs
logs:
	@echo "📋 Showing logs for all services..."
	docker-compose logs

# Follow logs
logs-f:
	@echo "📋 Following logs for all services (Ctrl+C to stop)..."
	docker-compose logs -f

# Show service status
status:
	@echo "📊 Service status:"
	docker-compose ps

# Individual service logs
logs-backend:
	docker-compose logs backend

logs-frontend:
	docker-compose logs client-prod client-dev

logs-db:
	docker-compose logs postgres

logs-redis:
	docker-compose logs redis

logs-traefik:
	docker-compose logs traefik

# Restart individual services
restart-backend:
	docker-compose restart backend

restart-frontend:
	docker-compose restart client-prod client-dev

restart-db:
	docker-compose restart postgres

restart-redis:
	docker-compose restart redis

restart-traefik:
	docker-compose restart traefik