# Event Management System

This repository contains the shared event-management project.

## Frontend technologies

The client uses all requested frontend technologies together in one dashboard:

- **HTML/CSS/JavaScript:** provide the page structure, presentation, and browser logic.
- **React:** `client/src/App.jsx` renders the dashboard and event cards.
- **jQuery + AJAX:** the same React dashboard calls `jQuery.ajax()` to load `public/data/events.json` without refreshing the page.

Run `npm install` at the project root, then `npm run dev`. Open the Vite URL to use the integrated dashboard.

## Collaboration

- Add your work only on your assigned branch.
- Open a pull request to `main` when it is ready for review.
- Changes become part of the central project after the repository owner approves the pull request.
