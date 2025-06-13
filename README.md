# Finance App

Welcome to the Finance App! This is a full-stack application designed to help users manage their finances, track transactions, and gain insights into their spending habits.

## Project Structure

The project is divided into two main parts:

- **`backend/`**: Contains the Node.js API with Express, Prisma (for PostgreSQL ORM), and Redis (for caching).
- **`client/`**: Contains the React frontend application built with Vite.

## Features

- **User Authentication**: Secure user registration, login, and password management.
- **Wallet Management**: Create and manage multiple wallets with support for different currencies (currently KRW and IDR).
- **Transaction Tracking**: Record and categorize income and expenses.
- **Category Management**: Define custom categories for transactions.
- **Data Visualization**: (Planned/Future) Visual representation of financial data.

## Technologies Used

### Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- JWT for authentication

### Frontend
- React.js
- TypeScript
- Vite
- Tailwind CSS + Shadcn UI
- React Query (or similar for data fetching)

### Infrastructure
- Docker & Docker Compose
- Traefik (Reverse Proxy)

## Getting Started

This project uses Docker and Docker Compose for easy setup and deployment. All Docker services are consolidated into a single `docker-compose.yml` file in the root directory.

### Prerequisites

- Docker and Docker Compose installed on your system.

### Setup and Running the Application

1.  **Create the Docker Network (first-time setup only):**
    ```bash
    make setup
    ```

2.  **Run the Application in Production Mode:**
    This will start Traefik, PostgreSQL, Redis, the Backend API, and the Production Frontend.
    ```bash
    make prod
    ```

3.  **Run the Application in Development Mode:**
    This will start Traefik, PostgreSQL, Redis, the Backend API, and the Development Frontend with hot-reloading.
    ```bash
    make dev
    ```

### Stopping Services

To stop all running Docker services:

```bash
make stop
```

### Cleaning Up (WARNING: This will delete all data!)

To stop all services and remove all Docker containers, networks, and volumes (including database data):

```bash
make clean
```

## Development Workflow

For local development with faster iteration cycles, you can run only the infrastructure services via Docker and run the backend and frontend applications directly on your host machine:

1.  **Start Infrastructure Services (PostgreSQL, Redis, Traefik):**
    ```bash
    make infra
    ```

2.  **Run Backend Locally:**
    Navigate to the `backend/` directory and start the development server:
    ```bash
    cd backend
    npm run dev # or yarn dev, pnpm dev
    ```

3.  **Run Frontend Locally:**
    Navigate to the `client/` directory and start the development server:
    ```bash
    cd client
    npm run dev # or yarn dev, pnpm dev
    ```

## Configuration

-   **Environment Variables**: The backend service uses environment variables defined in `./backend/.env`.
-   **Currency Options**: The application is currently configured to support only KRW and IDR currencies for wallets.

## Contributing

(Add contributing guidelines here if applicable)

## License

(Add license information here)