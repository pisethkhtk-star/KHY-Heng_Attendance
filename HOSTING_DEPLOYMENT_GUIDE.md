# សៀវភៅណែនាំអំពីការ Host និង Deploy ប្រព័ន្ធ HR Chomnan (Production Deployment Guide)

ឯកសារនេះណែនាំលម្អិតអំពីរបៀប Host ប្រព័ន្ធ **HR Chomnan** (Spring Boot 3 + React Vite + PostgreSQL + Mobile App Flutter) ទៅកាន់ Production Server (Ubuntu VPS / Cloud)។

---

## ជម្រើសទី ១: Host តាម Docker Compose (ងាយស្រួលបំផុត & ណែនាំ)

ការប្រើ Docker គឺជាវិធីសាស្រ្តដែលមានសុវត្ថិភាព រហ័ស និងមិនចាំបាច់ដំឡើង Java ឬ Node.js លើ Server ឡើយ។

### ជំហានទី ១: Setup Docker លើ Ubuntu VPS
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose Plugin
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

### ជំហានទី ២: Clone / Upload គម្រោងទៅ Server
```bash
git clone <your-repository-url>
cd Hr_chomnan
```

### ជំហានទី ៣: បង្កើត និងកំណត់ `.env`
```bash
cp .env.example .env
nano .env
```
*កែប្រែលេខសម្ងាត់ Database (`POSTGRES_PASSWORD`) និង `JWT_SECRET` ឱ្យមានសុវត្ថិភាព។*

### ជំហានទី ៤: ចាប់ផ្តើមដំណើរការ (1-Command Build & Run)
```bash
docker compose up -d --build
```

### ជំហានទី ៥: ពិនិត្យមើលដំណើរការ
```bash
# មើល status នៃ containers ទាំងអស់
docker compose ps

# មើល logs របស់ backend
docker compose logs -f backend
```

---

## ជម្រើសទី ២: Host ផ្ទាល់លើ Ubuntu VPS (Native Services)

### ១. ដំឡើង PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# បង្កើត Database និង User
sudo -u postgres psql
```
ក្នុង PostgreSQL console:
```sql
CREATE DATABASE employee_attendance_db;
CREATE USER postgres WITH ENCRYPTED PASSWORD 'YourSecurePasswordHere';
GRANT ALL PRIVILEGES ON DATABASE employee_attendance_db TO postgres;
\q
```

### ២. Host Backend (Spring Boot)
1. ដំឡើង Java 21:
```bash
sudo apt install -y openjdk-21-jre-headless
```
2. Build JAR file ពី local ឬ server:
```bash
cd backend
./gradlew bootJar -x test
```
3. បង្កើត Systemd Service `/etc/systemd/system/hr-backend.service`:
```ini
[Unit]
Description=HR Chomnan Spring Boot Backend
After=syslog.target network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/var/www/hr-backend
ExecStart=/usr/bin/java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dfile.encoding=UTF-8 -jar /var/www/hr-backend/backend1-0.0.1-SNAPSHOT.jar
Environment="DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/employee_attendance_db"
Environment="DB_USERNAME=postgres"
Environment="DB_PASSWORD=YourSecurePasswordHere"
Environment="JWT_SECRET=YourSuperSecretJwtKeyHere"
Environment="TZ=Asia/Phnom_Penh"
SuccessExitStatus=143
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
4. ចាប់ផ្តើម Service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hr-backend
sudo systemctl status hr-backend
```

### ៣. Host Frontend (React + Nginx)
1. Build Frontend:
```bash
cd frontend
npm install
npm run build
```
2. Copy `dist/` ទៅកាន់ `/var/www/hr-frontend/dist`
3. កំណត់ Nginx `/etc/nginx/sites-available/hr-chomnan`:
```nginx
server {
    listen 80;
    server_name your-domain.com; # ឬ IP របស់ Server

    root /var/www/hr-frontend/dist;
    index index.html;

    client_max_body_size 50M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;

    # Proxy API ទៅ Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
4. Enable Site & Restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/hr-chomnan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## ការកំណត់ Mobile App សម្រាប់ Production

នៅក្នុង `mobile_app/lib/core/constants/api_config.dart`:
```dart
class ApiConfig {
  // ប្តូរទៅកាន់ Server IP ឬ Domain ពិតប្រាកដ
  static const String serverHost = 'your-server-ip-or-domain.com';
  
  // កំណត់ port (ប្រសិនបើប្រើ Nginx លើ port 80/443 ទុកទទេ '')
  static const String serverPort = ''; 
  
  // បើក true ប្រសិនបើមាន SSL (https://)
  static const bool useHttps = false;
}
```

---

## ថែទាំ និង Backup ទិន្នន័យ (Database Backup)
```bash
# Backup PostgreSQL Database
docker exec -t hr_attendance_postgres pg_dump -U postgres employee_attendance_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore Database
docker exec -i hr_attendance_postgres psql -U postgres employee_attendance_db < backup_file.sql
```
