# Railway Project

This project contains a backend (Python/Flask) and frontend (Node.js/React) for railway management/simulation. Follow the steps below to set up and run the project.

---

## Prerequisites

- Python 3.10+ (for backend)
- Node.js 18+ (for frontend)
- npm or pnpm (comes with Node.js)
- Git Bash (for running `.sh` scripts on Windows) or a Linux/macOS terminal

---

## Setup Environment Variables

1. Create a `.env` file inside the `backend` folder:

 Add your environment variables. Example:


JWT_SECRET = ###############
AZURE_STORAGE_KEY = ###########
AZURE_CONN_STR =###########



> **Important:** Do **not** commit `.env` to version control if it contains sensitive keys.

---

## Run the Project

1. Open a terminal and navigate to the project root:

```bash
cd path/to/railway-project
bash run_project.sh
```
### This script will:

Create a virtual environment in backend/venv (if not already present)

Install backend dependencies

Activate the virtual environment

Start the backend server

Install frontend dependencies

Start the frontend server


Backend API: http://127.0.0.1:5000

Frontend: http://localhost:5173