# 🌐 ការដាក់ដំណើរការ Frontend លើ AWS Ubuntu Server (Port 80)

ឯកសារនេះបង្ហាញពីរបៀបដាក់ដំណើរការ **React Vite (Single Page Application) + Nginx Web Server** លើ **AWS EC2 Ubuntu Server** (IP: `100.56.149.110`)។

---

## 1. ⚙️ ការកំណត់ AWS Security Group Inbound Rules
មុនពេលដំណើរការ សូមចូលទៅកាន់ **AWS Console** -> **EC2** -> **Security Groups** -> កែសម្រួល **Inbound Rules**៖
- **Port 80 (HTTP)**: សម្រាប់ចូលប្រើប្រាស់ Web Frontend តាម Browser (`0.0.0.0/0`)
- **Port 22 (SSH)**: សម្រាប់ Remote Terminal
- **Port 8080 (Custom TCP)**: សម្រាប់ Backend API

---

## 2. 🚀 វិធីដាក់ដំណើរការដោយស្វ័យប្រវត្តិ (1-Command Deploy)

ចូលទៅកាន់ Ubuntu Server តាមរយៈ SSH៖
```bash
ssh -i "your-key.pem" ubuntu@100.56.149.110
```

ចូលទៅកាន់ Folder Frontend រួចដំណើរការ Script៖
```bash
cd Hr_chomnan/frontend
chmod +x deploy.sh
./deploy.sh
```

---

## 3. 🛠️ វិធីដាក់ដំណើរការដោយដៃ (Manual Commands)

### ជម្រើសទី ១៖ ប្រើ Docker Compose (ណែនាំ)
```bash
cd Hr_chomnan/frontend
docker compose up -d --build
```

### ជម្រើសទី ២៖ Build Static Files រួចដាក់លើ Nginx ផ្ទាល់លើ Host
```bash
# ១. ដំឡើង Node.js និង Build
cd Hr_chomnan/frontend
npm install
npm run build

# ២. ចម្លង Files ទៅកាន់ Web Directory របស់ Nginx
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
```

---

## 4. 🛠️ បញ្ជាសំខាន់ៗពេលគ្រប់គ្រង Frontend

| កិច្ចការ | ពាក្យបញ្ជា (Command) |
|---|---|
| **មើល Logs ផ្ទាល់** | `docker logs -f hr_attendance_frontend` |
| **ពិនិត្យ Container Status** | `docker compose ps` |
| **Restart Frontend** | `docker compose restart` |
| **បិទ Frontend Server** | `docker compose down` |
| **Update កូដថ្មីរួច Re-build** | `git pull && ./deploy.sh` |

---

## 5. 🔗 អាសយដ្ឋានចូលប្រើប្រាស់
- **Web App URL**: `http://100.56.149.110` (ដំណើរការលើ Port 80)
- **Login Page**: `http://100.56.149.110/login`
- **Kiosk Mode**: `http://100.56.149.110/kiosk`
