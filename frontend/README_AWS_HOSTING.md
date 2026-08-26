# 🌐 មគ្គុទ្ទេសក៍ដាក់ដំណើរការ (Host) លើ AWS Ubuntu Server

ឯកសារនេះបង្ហាញពីរបៀប Host គម្រោង **HR Attendance Frontend (React + Vite + Nginx)** លើ **AWS EC2 Ubuntu Server**៖
- **Frontend Server IP**: `32.195.184.65` (Port 80)
- **Backend API Server IP**: `100.56.149.110` (Port 8080)

---

## 📌 ជំហានទី ១៖ បើក Port លើ AWS Security Group (សំខាន់បំផុត)

មុនពេលដំណើរការ សូមចូលទៅកាន់ **AWS Console** របស់អ្នក៖
1. ចូលទៅ **EC2** -> **Instances** -> ចុចលើ Instance របស់អ្នក -> ជ្រើសរើសផ្ទាំង **Security**
2. ចុចលើ **Security Group** -> ចុចប៊ូតុង **Edit inbound rules**
3. បន្ថែម Rules ដូចខាងក្រោម៖
   - **SSH**: Type: `SSH`, Port: `22`, Source: `0.0.0.0/0` (ឬ My IP)
   - **HTTP**: Type: `HTTP`, Port: `80`, Source: `0.0.0.0/0` (Anywhere)
   - **Custom TCP (Backend)**: Port: `8080`, Source: `0.0.0.0/0` (បើកលើ Server `100.56.149.110`)
4. ចុច **Save rules**

---

## 📌 ជំហានទី ២៖ ភ្ជាប់ទៅកាន់ Server តាមរយៈ SSH (លើកុំព្យូទ័ររបស់អ្នក)

បើក **Terminal** ឬ **PowerShell** លើកុំព្យូទ័ររបស់អ្នក (កន្លែងដែលមាន file key `.pem`) រួចវាយ៖

```bash
ssh -i "your-key.pem" ubuntu@32.195.184.65
```
*(ចំណាំ៖ សូមប្ដូរ `your-key.pem` ទៅជាឈ្មោះ Key Pair ពិតប្រាកដរបស់អ្នក)*

---

## 📌 ជំហានទី ៣៖ ទាញយកកូដគម្រោងដាក់លើ Server

ពេលចូលដល់ក្នុង Ubuntu Server ហើយ សូមដំណើរការបញ្ជា៖

```bash
# ១. Update ប្រព័ន្ធ Server
sudo apt update && sudo apt upgrade -y

# ២. Clone កូដពី Git Repository (ប្រសិនបើមិនទាន់បាន clone)
git clone https://github.com/your-username/your-repo.git Hr_chomnan

# ៣. ចូលទៅកាន់ Folder Frontend
cd Hr_chomnan/frontend
```

---

## 📌 ជំហានទី ៤៖ បើកដំណើរការ Host ដោយស្វ័យប្រវត្ត (1-Command Deploy)

គ្រាន់តែដំណើរការបញ្ជាមួយជួរនេះ៖

```bash
chmod +x deploy.sh && ./deploy.sh
```

> **ដំណើរការដែល Script នឹងធ្វើដោយស្វ័យប្រវត្ត៖**
> 1. ដំឡើង Docker និង Docker Compose បើ server មិនទាន់មាន
> 2. Build React App ជា Production Bundle
> 3. បង្កើត Nginx Web Server និងរត់លើ Port 80 ភ្លាមៗ

---

## 📌 ជំហានទី ៥៖ ចូលប្រើប្រាស់ Web App

បើក Browser (Chrome/Edge/Safari) រួចវាយ៖
- 🌐 **Web App URL**: `http://32.195.184.65`
- 🔑 **Login Page**: `http://32.195.184.65/login`
- 📱 **Kiosk Attendance**: `http://32.195.184.65/kiosk`

---

## 🛠️ ពាក្យបញ្ជាសំខាន់ៗសម្រាប់គ្រប់គ្រង Server ពេលក្រោយ

| កិច្ចការ | ពាក្យបញ្ជា (Command) |
|---|---|
| **ពិនិត្យស្ថានភាព Server** | `docker compose ps` |
| **មើល Logs ផ្ទាល់ (Debug)** | `docker logs -f hr_attendance_frontend` |
| **Restart Server** | `docker compose restart` |
| **បិទ Web Server** | `docker compose down` |
| **Update កូដថ្មីរួច Deploy ម្ដងទៀត** | `git pull && ./deploy.sh` |

