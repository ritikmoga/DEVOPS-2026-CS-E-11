# 🎓 EventHub Platform

> **A complete campus event management platform for events, attendance, proof verification, and digital certificates.**

EventHub is a full-stack campus event management platform designed to simplify the complete event lifecycle — from **event creation and student registration to attendance tracking, proof submission, verification, and certificate management**.

The platform is built using a lightweight web stack with a clear separation between the **public student experience**, **administrative operations**, and **backend API services**.

---

## ✨ Key Highlights

* 🎪 **Campus Event Management**
* 📝 **Student Event Registration**
* 📊 **Attendance Tracking**
* 📎 **Event Proof Submission**
* ✅ **Proof Verification**
* 🏆 **Certificate Management**
* 🔐 **Administrative Operations Console**
* 📡 **REST API with Express**
* 🗄️ **PostgreSQL Database**
* 🔄 **Prisma ORM**
* 🧩 **jQuery-powered DOM and AJAX interactions**
* 📦 **JSON-based configuration**
* 🐳 **Docker-based PostgreSQL setup**

---

## 🛠️ Technology Stack

| Layer               | Technology         |
| ------------------- | ------------------ |
| 🎨 Frontend         | HTML5, CSS3        |
| ⚡ Client-side Logic | Vanilla JavaScript |
| 🔄 DOM & AJAX       | jQuery             |
| 📦 Configuration    | JSON               |
| 🖥️ Backend         | Node.js + Express  |
| 🗄️ Database        | PostgreSQL         |
| 🔷 ORM              | Prisma             |
| 🐳 Local Database   | Docker Compose     |

---

## 🏗️ Project Architecture

```text
EventHub
│
├── frontend/
│   ├── public-client/      # Student / public-facing application
│   └── admin-client/       # Administrative operations console
│
├── server/                 # Express REST API
│
├── compose.yaml            # PostgreSQL Docker configuration
│
├── docs/
│   └── PROJECT_WALKTHROUGH.md
│
└── package.json
```

### 🚀 Applications

| Application                  | Location                 |   Port |
| ---------------------------- | ------------------------ | -----: |
| 🌐 Public EventHub Site      | `frontend/public-client` | `5173` |
| 🛡️ Admin Operations Console | `frontend/admin-client`  | `5174` |
| ⚙️ Express API               | `server`                 | `5000` |
| 🐘 PostgreSQL                | `compose.yaml`           | `5432` |

---

# 🚀 Getting Started

## 1️⃣ Install Dependencies

From the project root:

```bash
npm run install:all
```

---

## 2️⃣ Start PostgreSQL

Start the PostgreSQL container using Docker Compose:

```bash
docker compose up -d postgres
```

Verify that the database container is running before continuing.

---

## 3️⃣ Configure Environment Variables

Create the server environment file:

```bash
cp server/.env.example server/.env
```

Then configure the required database and application settings inside:

```text
server/.env
```

### 🔐 Bootstrap Administrator

For the first production administrator, configure:

```env
BOOTSTRAP_ADMIN_EMAIL=your-admin-email
BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
```

> **Requirement:** The bootstrap administrator password must contain at least **12 characters**.

After configuring the credentials, seed the database.

---

## 4️⃣ Initialize the Database

Run the database migration:

```bash
npm run db:migrate
```

Seed the database:

```bash
npm run db:seed
```

Verify the database:

```bash
npm run db:verify
```

---

# ▶️ Run the Platform

Open **three terminals** from the project root.

### Terminal 1 — API Server

```bash
npm run start:api
```

API:

```text
http://localhost:5000
```

### Terminal 2 — Public Application

```bash
npm run dev:public
```

Public EventHub site:

```text
http://localhost:5173
```

### Terminal 3 — Admin Console

```bash
npm run dev:admin
```

Admin console:

```text
http://localhost:5174
```

---

# 🧪 Project Verification

Run the complete project verification suite with:

```bash
npm run verify
```

This provides a convenient way to validate the project before development reviews, demonstrations, or deployment.

---

# 🔒 Data & Development Policy

EventHub is designed without fake application data.

The project includes:

* ❌ No sample users
* ❌ No sample events
* ❌ No hard-coded credentials
* ❌ No fake analytics
* ❌ No mock API responses

All application data is intended to originate from the configured PostgreSQL database and API layer.

---

# 📚 Documentation

For a detailed explanation of the project architecture, development flow, demonstration sequence, and review preparation, see:

**[📖 Project Walkthrough](docs/PROJECT_WALKTHROUGH.md)**

---

# 🔄 Typical EventHub Flow

```text
        ┌─────────────────────┐
        │      Admin          │
        │  Creates an Event   │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   Public EventHub   │
        │ Student Registration│
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │     Attendance      │
        │      Tracking       │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   Proof Submission  │
        │     & Verification  │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │     Certificate     │
        │      Management     │
        └─────────────────────┘
```

---

## 💡 Why EventHub?

EventHub brings multiple campus-event workflows into a **single centralized platform**, reducing manual coordination between students and administrators.

Instead of managing registrations, attendance, proofs, and certificates across disconnected systems, EventHub provides one structured workflow backed by a relational database and REST API.

---

## 📌 Quick Command Reference

```bash
# Install
npm run install:all

# Start PostgreSQL
docker compose up -d postgres

# Database
npm run db:migrate
npm run db:seed
npm run db:verify

# Development
npm run start:api
npm run dev:public
npm run dev:admin

# Complete verification
npm run verify
```

---

## 🎯 EventHub

**Events. Attendance. Proof. Certificates. — All in one platform.**
