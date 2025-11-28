# Testing Guide

This document describes how to run the unit, integration and end-to-end tests for the FindIt - Lost & Found project.

## Backend (dotnet)

Requirements: .NET 9 SDK

Run the backend unit and integration tests:

```powershell
cd backend\LostAndFoundApp.Tests
dotnet restore
dotnet test
```

Notes:
- Integration tests use an in-memory SQLite instance and apply migrations in test setup.
- The test project is `backend/LostAndFoundApp.Tests` and references the main project.

## Frontend (Vitest + Playwright)

Requirements: Node 20+, npm

Install dependencies and run unit tests:

```powershell
cd frontend\lostfound-client
npm ci
npm run test
```

Run Playwright E2E (requires running backend and frontend dev servers first):

```powershell
# start backend
# (in a new terminal)
cd backend\LostAndFoundApp
dotnet run

# start frontend
# (in a new terminal)
cd frontend\lostfound-client
npm run dev

# run playwright tests
npx playwright test
```

## CI

A GitHub Actions workflow is included at `.github/workflows/ci.yml` which runs the backend tests and frontend unit tests.