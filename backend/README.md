# feedback-management-backend

This is the backend service for the Feedback Management System. It is built with **Node.js**, **Express**, **Prisma**, and **PostgreSQL**, and handles users, projects, exercises, feedbacks, moderation workflows, and internal messaging.

---

## First-Time Setup & Start the Server

```bash
# Install dependencies
npm install

# Create and apply database migrations
npx prisma migrate dev

# Seed initial data
npx prisma db seed

# Start the backend server
node app.js

# Or start in development mode with auto-reloading
npx nodemon app.js

# Server will be running at:
# http://localhost:3001

# Swagger API documentation available at:
# http://localhost:3001/api-docs


