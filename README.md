# ProjectPulse — Full Stack Setup & Deployment Guide

```
Stack:  React 18  ·  Flask 3  ·  MySQL 8  ·  Nginx  ·  Gunicorn  ·  AWS EC2
```

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Local Development — Quick Start](#2-local-development--quick-start)
3. [Local Development — Manual Setup](#3-local-development--manual-setup)
4. [Server Startup Commands](#4-server-startup-commands)
5. [AWS EC2 Deployment — Step by Step](#5-aws-ec2-deployment--step-by-step)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [API Endpoints Reference](#7-api-endpoints-reference)
8. [Default Credentials](#8-default-credentials)

---

## 1. Project Structure

```
projectpulse/
├── backend/                  # Flask API
│   ├── app.py                # Application factory
│   ├── db.py                 # MySQL helper (PyMySQL)
│   ├── gunicorn.conf.py      # Gunicorn production config
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example          # Copy → .env and fill in
│   └── routes/
│       ├── auth.py           # POST /api/auth/login
│       ├── groups.py         # CRUD /api/groups/
│       ├── employees.py      # CRUD /api/employees/
│       ├── projects.py       # CRUD /api/projects/
│       ├── timesheets.py     # CRUD /api/timesheets/
│       ├── leaves.py         # CRUD /api/leaves/
│       ├── accounts.py       # CRUD /api/accounts/
│       └── reports.py        # GET  /api/reports/
│
├── frontend/                 # React 18 SPA
│   ├── package.json
│   ├── public/index.html
│   └── src/
│       ├── index.js          # React entry point
│       ├── api.js            # Centralised API service layer
│       └── App.js            # All components (single file)
│
├── database/
│   └── schema.sql            # Full MySQL DDL + seed data
│
├── nginx/
│   └── projectpulse.conf     # Nginx reverse proxy config
│
├── deploy/
│   └── projectpulse.service  # Systemd unit file
│
└── docker-compose.yml        # One-command local dev environment
```

---

## 2. Local Development — Quick Start (Docker)

This is the fastest way to run everything locally.

### Prerequisites
- Docker Desktop installed and running
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/projectpulse.git
cd projectpulse

# 2. Create backend .env from example
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY and JWT_SECRET_KEY to random strings

# 3. Start all services (MySQL + Flask + React)
docker compose up --build

# 4. Open the app
#    Frontend:  http://localhost:3000
#    API:       http://localhost:5000/api/health
```

> The first start takes ~2 minutes as Node modules install.
> MySQL is automatically seeded with schema.sql on first boot.

### Stop services
```bash
docker compose down          # stop containers
docker compose down -v       # stop + delete database volume (full reset)
```

---

## 3. Local Development — Manual Setup (No Docker)

### Prerequisites
- Python 3.11+
- Node.js 20+
- MySQL 8.0 running locally

### A — Database

```bash
# Log in to MySQL
mysql -u root -p

# Create database user and database
CREATE DATABASE IF NOT EXISTS projectpulse CHARACTER SET utf8mb4;
CREATE USER 'ppuser'@'localhost' IDENTIFIED BY 'pppassword';
GRANT ALL PRIVILEGES ON projectpulse.* TO 'ppuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Run the schema + seed script
mysql -u ppuser -ppppassword projectpulse < database/schema.sql
```

### B — Backend (Flask)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env:  set SECRET_KEY, JWT_SECRET_KEY, and DB_* values

# Start the development server
flask run --host=0.0.0.0 --port=5000
# OR with auto-reload:
python app.py
```

### C — Frontend (React)

```bash
cd frontend

# Install Node dependencies
npm install

# Start the React dev server (proxies /api → localhost:5000)
npm start
# Opens http://localhost:3000 automatically
```

---

## 4. Server Startup Commands

### Development (manual)

```bash
# Terminal 1 — MySQL (if not running as a service)
mysql.server start                 # macOS
sudo systemctl start mysql         # Linux

# Terminal 2 — Flask backend
cd backend && source venv/bin/activate && flask run --port=5000

# Terminal 3 — React frontend
cd frontend && npm start
```

### Production (Gunicorn)

```bash
cd /opt/projectpulse/backend
source /opt/projectpulse/venv/bin/activate

# Start
gunicorn --config gunicorn.conf.py app:app

# Start in background
gunicorn --config gunicorn.conf.py --daemon app:app

# Stop
pkill gunicorn

# With systemd (recommended on EC2)
sudo systemctl start  projectpulse
sudo systemctl stop   projectpulse
sudo systemctl status projectpulse
sudo journalctl -u projectpulse -f    # live logs
```

### Nginx

```bash
sudo systemctl start   nginx
sudo systemctl stop    nginx
sudo systemctl reload  nginx          # reload config without downtime
sudo nginx -t                         # test config syntax
```

---

## 5. AWS EC2 Deployment — Step by Step

### Phase 1 — Launch EC2 Instance

1. **Open EC2 Console** → Launch Instance
2. **AMI**: Ubuntu Server 22.04 LTS (free tier eligible)
3. **Instance type**: `t3.small` (recommended) or `t2.micro` (free tier)
4. **Key pair**: Create a new key pair, download the `.pem` file
5. **Security Group** — add inbound rules:

   | Type  | Protocol | Port | Source    |
   |-------|----------|------|-----------|
   | SSH   | TCP      | 22   | Your IP   |
   | HTTP  | TCP      | 80   | 0.0.0.0/0 |
   | HTTPS | TCP      | 443  | 0.0.0.0/0 |
   | Custom| TCP      | 5000 | 0.0.0.0/0 |  ← remove after Nginx is set up

6. **Storage**: 20 GB gp3
7. Launch the instance and note the **Public IPv4 address**

---

### Phase 2 — Connect and Prepare Server

```bash
# From your local machine (replace with your key and IP)
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

```bash
# On the EC2 instance — update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    python3.11 python3.11-venv python3-pip \
    mysql-server \
    nginx \
    git \
    curl \
    unzip

# Install Node.js 20 (for building React)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

### Phase 3 — Configure MySQL

```bash
# Secure MySQL installation
sudo mysql_secure_installation
# Answer: Y to all prompts, set a strong root password

# Create app database and user
sudo mysql -u root -p

# Inside MySQL:
CREATE DATABASE IF NOT EXISTS projectpulse CHARACTER SET utf8mb4;
CREATE USER 'ppuser'@'localhost' IDENTIFIED BY 'YOUR_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON projectpulse.* TO 'ppuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### Phase 4 — Deploy Application Code

```bash
# Create app directory
sudo mkdir -p /opt/projectpulse
sudo chown ubuntu:ubuntu /opt/projectpulse

# Clone your repository
cd /opt/projectpulse
git clone https://github.com/yourorg/projectpulse.git .
# OR use scp to copy from your local machine:
# scp -i ~/your-key.pem -r ./projectpulse ubuntu@<IP>:/opt/projectpulse

# Run database schema
mysql -u ppuser -p projectpulse < database/schema.sql
```

---

### Phase 5 — Set Up Python Backend

```bash
cd /opt/projectpulse

# Create and activate virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Create production .env
cp backend/.env.example backend/.env
nano backend/.env
```

**Edit `.env` with production values:**
```env
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_hex(32))">
JWT_SECRET_KEY=<generate another token_hex(32)>

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ppuser
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD
DB_NAME=projectpulse
```

**Test the backend manually:**
```bash
cd /opt/projectpulse/backend
source /opt/projectpulse/venv/bin/activate
gunicorn --config gunicorn.conf.py app:app
# Should show: Listening at: http://0.0.0.0:5000
# Press Ctrl+C to stop
```

---

### Phase 6 — Build React Frontend

```bash
cd /opt/projectpulse/frontend

# Install Node dependencies
npm install

# Set production API URL (Nginx will proxy /api → Flask)
echo "REACT_APP_API_URL=/api" > .env.production

# Build static files
npm run build
# Creates frontend/build/ directory

# Copy built files to Nginx web root
sudo mkdir -p /var/www/projectpulse
sudo cp -r build/* /var/www/projectpulse/
sudo chown -R www-data:www-data /var/www/projectpulse
```

---

### Phase 7 — Configure Nginx

```bash
# Copy Nginx config
sudo cp /opt/projectpulse/nginx/projectpulse.conf /etc/nginx/sites-available/projectpulse

# Enable the site
sudo ln -s /etc/nginx/sites-available/projectpulse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # remove default site

# Test config
sudo nginx -t

# Start / reload Nginx
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

### Phase 8 — Set Up Systemd Service

```bash
# Copy service file
sudo cp /opt/projectpulse/deploy/projectpulse.service /etc/systemd/system/

# Reload systemd, enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable projectpulse
sudo systemctl start projectpulse

# Check service status
sudo systemctl status projectpulse
# Should show: Active: active (running)

# View live logs
sudo journalctl -u projectpulse -f
```

---

### Phase 9 — Verify Deployment

```bash
# Test API health endpoint
curl http://localhost/api/health
# Expected: {"service":"ProjectPulse API","status":"ok"}

# Test login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expected: JSON with access_token
```

Open your browser at `http://<YOUR_EC2_PUBLIC_IP>` — the app should load.

---

### Phase 10 — (Optional) HTTPS with Let's Encrypt

```bash
# Point a domain to your EC2 IP first (via DNS A record), then:
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

### Phase 11 — Create Scheduler Service File

```bash
# Point a domain to your EC2 IP first (via DNS A record), then:
sudo nano /opt/projectpulse/deploy/scheduler.service

[Unit]
Description=ProjectPulse Scheduler Service
After=network.target projectpulse.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/projectpulse
ExecStart=/opt/projectpulse/venv/bin/python run_scheduler.py
Restart=always
RestartSec=10
StandardOutput=append:/opt/projectpulse/scheduler.log
StandardError=append:/opt/projectpulse/scheduler.log
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=/opt/projectpulse/.env

[Install]
WantedBy=multi-user.target

# Auto-renew
# Copy service file
sudo cp /opt/projectpulse/deploy/scheduler.service /etc/systemd/system/

# Reload systemd, enable and start
sudo systemctl daemon-reload
sudo systemctl enable scheduler
sudo systemctl start scheduler

# Check status
sudo systemctl status scheduler

# Live logs via journalctl
sudo journalctl -u scheduler -f

# Or tail the log file directly
tail -f /opt/projectpulse/scheduler.log
```

---

### Redeployment (updating the app)

```bash
# On EC2 — pull latest code
cd /opt/projectpulse
git pull origin main

# rsync -av timesheet/ ./

# Rebuild frontend if changed
cd frontend && npm install && npm run build
sudo cp -r build/* /var/www/projectpulse/

# Restart backend if Python code changed
sudo systemctl restart projectpulse

# Reload Nginx if config changed
sudo nginx -t && sudo systemctl reload nginx
```

---

### Phase 12 — Configure Daily Report Email

Edit `backend/.env` on EC2:

```bash
# Daily report email (Microsoft Graph / Office 365)
MAIL_TENANT_ID=ec822022-88bd-47c3-bb56-fa921ec6656e
MAIL_CLIENT_ID=ee67cd24-43fd-4a1c-98f6-82710b2a4d32
MAIL_CLIENT_SECRET=your_client_secret_here
MAIL_USERNAME=sandeepkumar.md@fascinateit.com
MAIL_RECIPIENTS=sandeepkumar.md@fascinateit.com,naveen.kumar@fascinateit.com,madhu.bk@fascinateit.com
REPORT_HOUR=6
REPORT_MINUTE=0
```

Restart backend:

```bash
# Restart both
sudo systemctl restart projectpulse && sudo systemctl restart scheduler

# Stop both
sudo systemctl stop projectpulse && sudo systemctl stop scheduler

# Status of both at once
sudo systemctl status projectpulse scheduler
```

---

### Your Final EC2 Setup
```
/etc/systemd/system/
├── projectpulse.service   ← Flask API (already running ✅)
└── scheduler.service      ← New scheduler service

/opt/projectpulse/deploy/
├── projectpulse.service   ← source copy
└── scheduler.service      ← new source copy
```

--- 

## 6. Environment Variables Reference

| Variable         | Description                          | Example                        |
|------------------|--------------------------------------|--------------------------------|
| `FLASK_ENV`      | `development` or `production`        | `production`                   |
| `FLASK_DEBUG`    | `1` = debug mode, `0` = off          | `0`                            |
| `SECRET_KEY`     | Flask session secret                 | 64-char random hex             |
| `JWT_SECRET_KEY` | JWT signing secret                   | 64-char random hex             |
| `DB_HOST`        | MySQL host                           | `127.0.0.1`                    |
| `DB_PORT`        | MySQL port                           | `3306`                         |
| `DB_USER`        | MySQL username                       | `ppuser`                       |
| `DB_PASSWORD`    | MySQL password                       | strong password                |
| `DB_NAME`        | Database name                        | `projectpulse`                 |

Generate secrets:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 7. API Endpoints Reference

All endpoints require `Authorization: Bearer <token>` except `/api/auth/login`.

| Method | Endpoint                           | Description                  |
|--------|------------------------------------|------------------------------|
| POST   | `/api/auth/login`                  | Login, returns JWT           |
| GET    | `/api/auth/me`                     | Current user info            |
| GET    | `/api/groups/`                     | List all groups              |
| POST   | `/api/groups/`                     | Create group                 |
| PUT    | `/api/groups/<id>`                 | Update group                 |
| DELETE | `/api/groups/<id>`                 | Delete group                 |
| GET    | `/api/employees/`                  | List all employees           |
| POST   | `/api/employees/`                  | Create employee              |
| GET    | `/api/projects/`                   | List all projects            |
| POST   | `/api/projects/`                   | Create project               |
| GET    | `/api/timesheets/?employee_id=&...`| List timesheets (filterable) |
| POST   | `/api/timesheets/`                 | Create timesheet entry       |
| PATCH  | `/api/timesheets/<id>/approve`     | Approve entry                |
| PATCH  | `/api/timesheets/<id>/reject`      | Reject entry                 |
| GET    | `/api/leaves/?employee_id=&...`    | List leaves (filterable)     |
| POST   | `/api/leaves/`                     | Submit leave request         |
| PATCH  | `/api/leaves/<id>/approve`         | Approve leave                |
| PATCH  | `/api/leaves/<id>/reject`          | Reject leave                 |
| GET    | `/api/accounts/`                   | List user accounts           |
| POST   | `/api/accounts/`                   | Create user account          |
| PUT    | `/api/accounts/<id>`               | Update user account          |
| DELETE | `/api/accounts/<id>`               | Delete user account          |
| GET    | `/api/reports/dashboard`           | Dashboard KPI data           |
| GET    | `/api/reports/project/<id>`        | Project billing report       |
| GET    | `/api/health`                      | Health check                 |

---

## 8. Default Credentials

| Username | Password  | Role     | Access                  |
|----------|-----------|----------|-------------------------|
| admin    | admin123  | Admin    | Full access             |
| arjun    | pass123   | Employee | Timesheets & Leave only |
| priya    | pass123   | Employee | Timesheets & Leave only |
| rahul    | pass123   | Employee | Timesheets & Leave only |
| sneha    | pass123   | Employee | Timesheets & Leave only |
| vikram   | pass123   | Employee | Timesheets & Leave only |

> **Change all passwords immediately after your first login in production.**
