# សៀវភៅណែនាំអំពីការ Host ប្រព័ន្ធលើ Kali Linux ដោយប្រើ Command តែមួយ (One-Command Guide)

ឯកសារនេះណែនាំអំពីវិធីសាស្រ្ត Host ប្រព័ន្ធ **HR Chomnan (KHY-Heng Attendance)** លើ **Kali Linux** យ៉ាងងាយស្រួល រហ័ស និងមានសុវត្ថិភាពខ្ពស់។

---

## ⚡ វិធី Host ដោយប្រើ Command តែមួយ (One-Command Fast Deploy)

បើក **Terminal** ក្នុង Kali Linux ហើយចូលទៅកាន់ folder គម្រោង រួចវាយបញ្ជា (Command) ខាងក្រោមតែមួយគត់៖

```bash
chmod +x deploy-kali.sh && sudo ./deploy-kali.sh
```

> **ចំណាំ៖** Script នេះនឹងធ្វើការទាំងអស់ដោយស្វ័យប្រវត្តិ៖
> 1. ដំឡើង Docker និង Docker Compose លើ Kali Linux (បើមិនទាន់មាន)
> 2. បើកដំណើរការ Docker Service
> 3. កំណត់ `.env` ដោយស្វ័យប្រវត្តិជាមួយ Secure Random Password & JWT Secret
> 4. កែសម្រួល Line Endings (CRLF -> LF) ការពារ Error ពេលចម្លងពី Windows
> 5. Build & Start containers ទាំង ៣ (PostgreSQL, Backend Spring Boot, Frontend Nginx)
> 6. រង់ចាំរហូតដល់ Services ដំណើរការស្រួល រួចបង្ហាញ IP Address និង Link សម្រាប់បើក Browser ភ្លាមៗ!

---

## 🌐 របៀបចូលប្រើប្រាស់ក្រោយពេល Host រួច

នៅពេល Script រត់ចប់ជោគជ័យ អ្នកនឹងទទួលបាន Link សម្រាប់ចូលប្រើ៖

| ប្រព័ន្ធ | អាសយដ្ឋាន (URL) | ការពិពណ៌នា |
| :--- | :--- | :--- |
| 💻 **Web Portal (Frontend)** | `http://localhost/` ឬ `http://<KALI_IP>/` | ផ្ទាំងគ្រប់គ្រង និងស្កេនវត្តមាន |
| ⚙️ **Backend REST API** | `http://<KALI_IP>:8080/api` | Spring Boot 3 API Service |
| 🩺 **Health Check** | `http://<KALI_IP>:8080/api/health` | ពិនិត្យមើលស្ថានភាព Server |
| 🗄️ **PostgreSQL Database** | Port `5432` (DB: `khyheng_att`) | ទិន្នន័យបុគ្គលិក និងវត្តមាន |

*(អ្នកអាចមើល IP របស់ Kali Linux បានតាមរយៈ command: `hostname -I` ឬ `ip a`)*

---

## 📂 របៀប Copy គម្រោងពី Windows ទៅកាន់ Kali Linux

ប្រសិនបើអ្នកចង់ផ្ទេរ Folder គម្រោងនេះពី Windows ទៅកាន់ Kali Linux អ្នកអាចប្រើវិធីមួយក្នុងចំណោមវិធីខាងក្រោម៖

### វិធីទី ១: ប្រើ Git (ណែនាំបំផុត)
```bash
git clone <URL_គម្រោង_របស់អ្នក>
cd KHY-Heng_Attendance
chmod +x deploy-kali.sh && sudo ./deploy-kali.sh
```

### វិធីទី ២: ប្រើ SCP តាម Terminal ពី Windows ទៅ Kali
```powershell
# វាយលើ PowerShell ក្នុង Windows (ប្តូរ kali_user និង 192.168.x.x តាម Kali IP របស់អ្នក)
scp -r "d:\IT\project\New folder\KHY-Heng_Attendance" kali_user@192.168.x.x:~/
```
បន្ទាប់មកលើ Kali Terminal:
```bash
cd ~/KHY-Heng_Attendance
chmod +x deploy-kali.sh && sudo ./deploy-kali.sh
```

---

## 🛠️ Command សំខាន់ៗសម្រាប់គ្រប់គ្រងប្រព័ន្ធលើ Kali Linux

| ការងារ | Command |
| :--- | :--- |
| 📜 **មើល Live Logs ទាំងអស់** | `docker compose logs -f` |
| 📜 **មើល Logs របស់ Backend** | `docker compose logs -f backend` |
| 📜 **មើល Logs របស់ Frontend** | `docker compose logs -f frontend` |
| 🔄 **Restart ប្រព័ន្ធឡើងវិញ** | `docker compose restart` |
| ⏹️ **បិទដំណើរការប្រព័ន្ធ** | `docker compose down` |
| ▶️ **បើកដំណើរការឡើងវិញ** | `docker compose up -d` |
| 💾 **Backup ទិន្នន័យ Database** | `docker exec -t hr_attendance_postgres pg_dump -U postgres khyheng_att > backup.sql` |
| 📥 **Restore ទិន្នន័យ Database** | `docker exec -i hr_attendance_postgres psql -U postgres khyheng_att < backup.sql` |

---

## 🔍 ការដោះស្រាយបញ្ហាទូទៅ (Troubleshooting)

### ១. បញ្ហា Port 80 ឬ Port 8080 ជាន់គ្នា (Address already in use)
លើ Kali Linux ជួនកាលមាន Apache2 ដើរស្រាប់នៅលើ Port 80។
ដោះស្រាយដោយបិទ Apache2 ជាបណ្តោះអាសន្ន៖
```bash
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### ២. បញ្ហា Docker Daemon មិនទាន់ដើរ
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### ៣. ចង់ Build ឡើងវិញបន្ទាប់ពីមានការកែប្រែ Code ថ្មី
```bash
sudo docker compose up -d --build
```
