✅ MVP Scope: Personal Finance Tracker App

🔐 1. Authentication

Register and Login

JWT-based auth (store token in localStorage or HttpOnly cookie)

Basic password validation and hashing (bcrypt)

💰 2. Transaction Management

Add transaction (amount, category, date, description)

Edit/Delete transaction

View list of transactions

Categories: default set (Food, Bills, Salary, etc.)

Type: Income or Expense

📊 3. Dashboard

Monthly summary: total income, total expense, balance

Category breakdown chart (Recharts pie/bar)

Filter by month

🌐 4. PWA Support

Installable on phone

Offline support for dashboard and transaction list

App icon and splash screen

let's start by creating the scaffold with these stacks:

✅ Techstacks
Frontend

• Framework: React.js with Vite

• UI Library: Tailwind CSS + shadcn/ui

• PWA: Vite PWA plugin

• Charting: Recharts

Backend

• API: Node.js with Express

• Auth: JWT

• Database: PostgreSQL

• ORM: Prisma