# 🚀 ការដាក់ដំណើរការ Backend លើ AWS Ubuntu Server (Port 8080)

ឯកសារនេះបង្ហាញពីរបៀបដាក់ដំណើរការ **Spring Boot Backend (Java 21) + PostgreSQL 16** លើ **AWS EC2 Ubuntu Server** (IP: `100.56.149.110`) យ៉ាងងាយស្រួល និងរហ័ស។

---

## 1. ⚙️ ការបើក Port លើ AWS Security Group
មុនពេលដំណើរការ សូមចូលទៅកាន់ **AWS Console** -> **EC2** -> **Security Groups** -> កែសម្រួល **Inbound Rules**៖
- **Port 22 (SSH)**: សម្រាប់ Remote Terminal
- **Port 8080 (Custom TCP)**: សម្រាប់ Backend Direct API / Mobile App (`0.0.0.0/0`)
- **Port 80 (HTTP)**: ប្រសិនបើដំណើរការ Web Frontend ជាមួយគ្នា

---

## 2. 🚀 វិធីដាក់ដំណើរការដោយស្វ័យប្រវត្តិ (1-Command Deploy)

ចូលទៅកាន់ Ubuntu Server តាមរយៈ SSH៖
```bash
ssh -i "your-key.pem" ubuntu@100.56.149.110
```

ចូលទៅកាន់ Folder Backend រួចដំណើរការ Script៖
```bash
cd Hr_chomnan/backend
chmod +x deploy.sh backup_db.sh
./deploy.sh
```

> **ចំណាំ៖** `deploy.sh` នឹងរៀបចំ៖
> 1. ដំឡើង Docker និង Docker Compose (បើមិនទាន់មាន)
> 2. បង្កើត File `.env` ដោយស្វ័យប្រវត្តិ
> 3. Build & Run Docker Containers (PostgreSQL + Spring Boot Backend)
> 4. ត្រួតពិនិត្យសុខភាព (Health Check) នៃ API

---

## 3. 🛠️ បញ្ជាសំខាន់ៗពេលគ្រប់គ្រង Server (Useful Commands)

| កិច្ចការ | ពាក្យបញ្ជា (Command) |
|---|---|
| **មើល Logs ផ្ទាល់** | `docker logs -f hr_attendance_backend` |
| **មើល Logs Database** | `docker logs -f hr_attendance_postgres` |
| **ពិនិត្យ Container Status** | `docker compose ps` |
| **Restart Server** | `docker compose restart` |
| **បិទ Server** | `docker compose down` |
| **Update កូដថ្មីរួច Re-build** | `git pull && ./deploy.sh` |
| **Backup Database** | `./backup_db.sh` |

---

## 4. 🔗 អាសយដ្ឋាន API សម្រាប់ប្រើប្រាស់
- **Base API URL**: `http://100.56.149.110:8080/api`
- **Kiosk Settings API**: `http://100.56.149.110:8080/api/kiosk-settings`
- **Auth Login API**: `http://100.56.149.110:8080/api/auth/login`
