# 🚀 មគ្គុទ្ទេសក៍ដាក់ឱ្យដំណើរការប្រព័ន្ធ (Production Hosting & Deployment Guide)
### ប្រព័ន្ធគ្រប់គ្រងវត្តមាន និងធនធានមនុស្ស (HR & Attendance Management System)

ឯកសារនេះណែនាំលម្អិតពីរបៀបដាក់ឱ្យដំណើរការ (Host & Deploy) ប្រព័ន្ធ **KHY-HENG Attendance** ទាំងមូលនៅលើ **Linux Cloud VPS (Ubuntu 22.04 / 24.04 LTS, Debian, AWS EC2, DigitalOcean, Linode)** ដោយប្រើប្រាស់ **Docker & Docker Compose** ប្រកបដោយសុវត្ថិភាព ស្ថិរភាព និងប្រសិទ្ធភាពខ្ពស់។

---

## 📑 មាតិកា (Table of Contents)
1. [ស្ថាបត្យកម្មប្រព័ន្ធ (System Architecture)](#1-ស្ថាបត្យកម្មប្រព័ន្ធ-system-architecture)
2. [តម្រូវការប្រព័ន្ធ & ការបើក Port (Prerequisites & Firewall)](#2-តម្រូវការប្រព័ន្ធ--ការបើក-port-prerequisites--firewall)
3. [វិធីទី ១: ដាក់ឱ្យដំណើរការ Full-Stack តាម Docker Compose (ណែនាំបំផុត)](#3-វិធីទី-១-ដាក់ឱ្យដំណើរការ-full-stack-តាម-docker-compose-ណែនាំបំផុត)
4. [វិធីទី ២: ដាក់ឱ្យដំណើរការ Backend ឬ Frontend ដាច់ដោយឡែក (Standalone)](#4-វិធីទី-២-ដាក់ឱ្យដំណើរការ-backend-ឬ-frontend-ដាច់ដោយឡែក-standalone)
5. [ការតម្លើង SSL / HTTPS ដោយឥតគិតថ្លៃ (Let's Encrypt Certbot)](#5-ការតម្លើង-ssl--https-ដោយឥតគិតថ្លៃ-lets-encrypt-certbot)
6. [ការកំណត់ Mobile App (Flutter) ភ្ជាប់ទៅកាន់ Server](#6-ការកំណត់-mobile-app-flutter-ភ្ជាប់ទៅកាន់-server)
7. [ការ Backup & Restore ទិន្នន័យ (Database Management)](#7-ការ-backup--restore-ទិន្នន័យ-database-management)
8. [តារាងពន្យល់ Environment Variables (`.env`)](#8-តារាងពន្យល់-environment-variables-env)
9. [បញ្ជាសំខាន់ៗពេលគ្រប់គ្រង Server (Maintenance & Troubleshooting)](#9-បញ្ជាសំខាន់ៗពេលគ្រប់គ្រង-server-maintenance--troubleshooting)

---

## 1. 🏗️ ស្ថាបត្យកម្មប្រព័ន្ធ (System Architecture)

ប្រព័ន្ធត្រូវបានរៀបចំជា Containerized Micro-architecture៖

```
                    ┌─────────────────────────────────────────┐
                    │               Internet                  │
                    └────────────────────┬────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │               Cloud Server                │
                   │                                           │
                   │  Port 80 / 443                            │
                   │  ┌─────────────────────────────────────┐  │
                   │  │       hr_attendance_frontend        │  │
                   │  │       (Nginx + React SPA)           │  │
                   │  └──────────────────┬──────────────────┘  │
                   │                     │ /api reverse proxy  │
                   │                     ▼                     │
                   │  Port 8080                                │
                   │  ┌─────────────────────────────────────┐  │
                   │  │       hr_attendance_backend         │  │
                   │  │       (Spring Boot 3 + Java 21)     │  │
                   │  └──────────────────┬──────────────────┘  │
                   │                     │ JDBC                │
                   │                     ▼                     │
                   │  Port 5432                                │
                   │  ┌─────────────────────────────────────┐  │
                   │  │       hr_attendance_postgres        │  │
                   │  │       (PostgreSQL 16 Alpine UTF-8)  │  │
                   │  └─────────────────────────────────────┘  │
                   └───────────────────────────────────────────┘
```

* **Frontend Container**: Nginx ដំណើរការ Static React App, Caching, SPA Routing និងធ្វើ Reverse Proxy រាល់ `/api` ទៅកាន់ Backend ដោយស្វ័យប្រវត្តិ (ការពារបញ្ហា CORS)។
* **Backend Container**: Spring Boot 3 + Java 21 REST API រួមទាំង Biometric Recognition Engine, JWT Security, និង Telegram Notification។
* **Database Container**: PostgreSQL 16 Alpine គាំទ្រ UTF-8 (អក្សរខ្មែរ) និងម៉ោងកម្ពុជា `Asia/Phnom_Penh`។

---

## 2. 📋 តម្រូវការប្រព័ន្ធ & ការបើក Port (Prerequisites & Firewall)

### ក. ទំហំ Server អប្បបរមា (Minimum Server Specifications)
- **OS**: Ubuntu 22.04 LTS / 24.04 LTS (ឬ Debian 12)
- **CPU**: 2 vCPU
- **RAM**: 4 GB (យ៉ាងតិច 2 GB RAM ជាមួយ 2 GB Swap)
- **Disk Storage**: 25 GB SSD ឡើងទៅ

### ខ. ការបើក Firewall / Security Group (AWS, DigitalOcean, UFW)
សូមចូលទៅកាន់ផ្ទាំងគ្រប់គ្រង Cloud VPS របស់អ្នក ហើយបើក Ports ដូចខាងក្រោម៖

| Port | Protocol | ការប្រើប្រាស់ | Source |
| :--- | :--- | :--- | :--- |
| **22** | TCP | SSH សម្រាប់ Remote ចូល Server | IP របស់អ្នក ឬ Anywhere (`0.0.0.0/0`) |
| **80** | TCP | HTTP សម្រាប់ Web Portal (Frontend) | Anywhere (`0.0.0.0/0`) |
| **443** | TCP | HTTPS សុវត្ថិភាព (SSL) | Anywhere (`0.0.0.0/0`) |
| **8080** | TCP | Backend API (សម្រាប់ Mobile App ហៅផ្ទាល់) | Anywhere (`0.0.0.0/0`) |

*(ចំណាំ៖ Port `5432` របស់ PostgreSQL **មិនចាំបាច់បើកជាសាធារណៈឡើយ** ព្រោះ Backend ភ្ជាប់ទៅកាន់ Database តាមរយៈ Docker Internal Network)*

---

## 3. 🚀 វិធីទី ១: ដាក់ឱ្យដំណើរការ Full-Stack តាម Docker Compose (ណែនាំបំផុត)

នេះជាវិធីសាស្រ្តដែលងាយស្រួល រហ័ស និងមានសុវត្ថិភាពបំផុត។

### ជំហានទី ១: Remote ចូល Server និង Update ប្រព័ន្ធ
```bash
ssh ubuntu@<SERVER_IP>
sudo apt update && sudo apt upgrade -y
```

### ជំហានទី ២: ដំឡើង Docker & Docker Compose Plugin
```bash
# ដំឡើង Docker និង Compose v2
sudo apt install -y curl git
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# អនុញ្ញាតឱ្យ Docker ចាប់ផ្តើមស្វ័យប្រវត្តិពេល Server បើក
sudo systemctl enable --now docker
```
*(សូម `exit` រួច `ssh` ចូលម្តងទៀតដើម្បីឱ្យ group docker មានសុពលភាព)*

### ជំហានទី ៣: Clone គម្រោងពី Git Repository
```bash
git clone <YOUR_GIT_REPOSITORY_URL> hr_attendance
cd hr_attendance
```

### ជំហានទី ៤: បង្កើត File កំណត់ `.env`
ចម្លងគំរូ `.env.example` ទៅជា `.env`៖
```bash
cp .env.example .env
nano .env
```
កំណត់តម្លៃសំខាន់ៗ៖
```env
# Database Settings
POSTGRES_DB=khyheng_att
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_db_password_here
POSTGRES_PORT=5432

# Backend Security
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
BACKEND_PORT=8080

# Frontend
FRONTEND_PORT=80
VITE_API_BASE_URL=/api
```
*(ចុច `Ctrl + O` រួច Enter ដើម្បី Save និង `Ctrl + X` ដើម្បីចាកចេញ)*

### ជំហានទី ៥: ចាប់ផ្តើមដំណើរការគម្រោង (Build & Run)
ដំណើរការបញ្ជាតែមួយគត់ខាងក្រោម៖
```bash
docker compose up -d --build
```

### ជំហានទី ៦: ត្រួតពិនិត្យដំណើរការ (Verification)
```bash
# ពិនិត្យស្ថានភាព containers
docker compose ps
```
Containers ទាំង ៣ ត្រូវតែបង្ហាញ status `healthy` ឬ `running`:
- `hr_attendance_postgres` (Up, healthy)
- `hr_attendance_backend` (Up, healthy)
- `hr_attendance_frontend` (Up)

តេស្តសុខភាព API Backend៖
```bash
curl http://localhost:8080/api/health
# លទ្ធផលត្រូវចេញ: {"service":"hr-chomnan-backend","status":"UP",...}
```

ឥឡូវនេះ អ្នកអាចបើក Browser ចូលប្រើតាម៖
👉 **`http://<SERVER_IP>/`**

---

## 4. 💻 វិធីទី ២: ដាក់ឱ្យដំណើរការ Backend ឬ Frontend ដាច់ដោយឡែក (Standalone)

ករណីអ្នកមាន Server ពីរដាច់ដោយឡែកពីគ្នា (១ សម្រាប់ Backend/DB និង ១ សម្រាប់ Frontend)៖

### ករណី Server ទី ១ (Backend & PostgreSQL Only)
1. ចូលទៅកាន់ folder `backend`៖
   ```bash
   cd hr_attendance/backend
   cp .env.example .env
   nano .env
   ```
2. ចាប់ផ្តើម Backend Container៖
   ```bash
   docker compose up -d --build
   ```

### ករណី Server ទី ២ (Frontend Only)
1. ចូលទៅកាន់ folder `frontend`៖
   ```bash
   cd hr_attendance/frontend
   cp .env.example .env
   nano .env
   ```
2. បើ Backend នៅលើ IP ផ្សេង សូមកំណត់ IP នោះក្នុង `.env` ឬ `docker-compose.yml` (ឧ. `VITE_API_BASE_URL=http://<BACKEND_SERVER_IP>:8080/api`)
3. ចាប់ផ្តើម Frontend Container៖
   ```bash
   docker compose up -d --build
   ```

---

## 5. 🔒 ការតម្លើង SSL / HTTPS ដោយឥតគិតថ្លៃ (Let's Encrypt Certbot)

ប្រសិនបើអ្នកមាន Domain Name (ឧទាហរណ៍ `hr.yourdomain.com`) ចង្អុលទៅកាន់ Server IP អ្នកអាចបន្ថែម SSL ដោយឥតគិតថ្លៃ៖

```bash
# ១. ដំឡើង Certbot
sudo apt install -y certbot

# ២. បង្កើត SSL Certificate
sudo certbot certonly --standalone -d hr.yourdomain.com

# ៣. Certificate និង Private Key នឹងរក្សាទុកនៅ៖
# /etc/letsencrypt/live/hr.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/hr.yourdomain.com/privkey.pem
```

អ្នកអាច mount certificates ទាំងពីរនេះចូលទៅកាន់ `frontend/nginx.conf` លើ port 443 សម្រាប់ HTTPS ដោយស្វ័យប្រវត្តិ។

---

## 6. 📱 ការកំណត់ Mobile App (Flutter) ភ្ជាប់ទៅកាន់ Server

ដើម្បីឱ្យកម្មវិធីទូរស័ព្ទ (Android / iOS) អាចបញ្ជូនវត្តមាន និងស្កេនផ្ទៃមុខទៅកាន់ Production Server បាន៖

1. បើក File `mobile_app/lib/core/constants/api_config.dart`៖
   ```dart
   class ApiConfig {
     // កំណត់ Server Domain ឬ IP ពិតប្រាកដរបស់ Production Server
     static const String baseUrl = 'http://<SERVER_IP>:8080/api';
     
     // ឬប្រសិនបើមាន SSL/Domain:
     // static const String baseUrl = 'https://hr.yourdomain.com/api';
   }
   ```
2. Build កម្មវិធី Android APK៖
   ```bash
   cd mobile_app
   flutter build apk --release
   ```
   APK នឹងចេញនៅ៖ `mobile_app/build/app/outputs/flutter-apk/app-release.apk`

---

## 7. 💾 ការ Backup & Restore ទិន្នន័យ (Database Management)

### ក. Backup Database ភ្លាមៗ (Instant Backup)
```bash
docker exec -t hr_attendance_postgres pg_dump -U postgres -d khyheng_att > backup_$(date +%Y%m%d_%H%M%S).sql
```

### ខ. Restore Database ពី File Backup
```bash
cat backup_file.sql | docker exec -i hr_attendance_postgres psql -U postgres -d khyheng_att
```

### គ. រៀបចំ Auto Backup រៀងរាល់យប់ (Cron Job)
```bash
crontab -e
```
បន្ថែមបន្ទាត់ខាងក្រោម (ដំណើរការរៀងរាល់ម៉ោង 2:00 យប់)៖
```cron
0 2 * * * docker exec -t hr_attendance_postgres pg_dump -U postgres -d khyheng_att > /home/ubuntu/backups/db_$(date +\%F).sql 2>&1
```

---

## 8. ⚙️ តារាងពន្យល់ Environment Variables (`.env`)

| Variable | Default Value | ការពិពណ៌នា |
| :--- | :--- | :--- |
| `POSTGRES_DB` | `khyheng_att` | ឈ្មោះ Database ក្នុង PostgreSQL |
| `POSTGRES_USER` | `postgres` | Username សម្រាប់ចូល Database |
| `POSTGRES_PASSWORD` | `postgres` | Password Database (*ត្រូវប្តូរឱ្យស្មុគស្មាញ*) |
| `POSTGRES_PORT` | `5432` | Port របស់ Database លើ Host |
| `BACKEND_PORT` | `8080` | Port របស់ Spring Boot API លើ Host |
| `JWT_SECRET` | *(string)* | កូនសោសម្ងាត់ JWT (*ត្រូវមានយ៉ាងតិច 32 តួអក្សរ*) |
| `FRONTEND_PORT` | `80` | Port របស់ Web Portal Nginx |
| `VITE_API_BASE_URL` | `/api` | Base Path សម្រាប់ Frontend ហៅ API តាម Nginx Proxy |

---

## 9. 🛠️ បញ្ជាសំខាន់ៗពេលគ្រប់គ្រង Server (Maintenance & Troubleshooting)

| តម្រូវការ | ពាក្យបញ្ជា (Command) |
| :--- | :--- |
| **ពិនិត្យ Containers ទាំងអស់** | `docker compose ps` |
| **មើល Logs ផ្ទាល់របស់ Backend** | `docker compose logs -f backend` |
| **មើល Logs ផ្ទាល់របស់ Frontend** | `docker compose logs -f frontend` |
| **មើល Logs ផ្ទាល់របស់ Database** | `docker compose logs -f postgres` |
| **Restart Services ទាំងអស់** | `docker compose restart` |
| **បិទ Services ទាំងអស់** | `docker compose down` |
| **ទាញកូដថ្មីរួច Re-build ឡើងវិញ** | `git pull && docker compose up -d --build` |
| **សម្អាត Docker Cache ចាស់ៗ** | `docker system prune -f` |
| **ពិនិត្យការប្រើប្រាស់ RAM/CPU** | `docker stats` |

---

> [!TIP]
> **សុវត្ថិភាពសំខាន់ (Security Tip)**: 
> ពេលដាក់ដំណើរការលើ Production ពិតប្រាកដ សូមកុំប្រើ default password សម្រាប់ `POSTGRES_PASSWORD` និង `JWT_SECRET`។ ត្រូវប្រាកដថាប្រើលេខកូដសម្ងាត់ដែលបង្កើតដោយចៃដន្យ (Random alphanumeric)។

