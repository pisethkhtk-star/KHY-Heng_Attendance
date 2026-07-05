# 🇰🇭 ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិក (Employee Attendance & Leave System)

A premium, modern, and responsive **Employee Attendance and Leave Management System** built with **React (Vite)**, **Node.js (Express)**, **Prisma ORM**, and **PostgreSQL**. Features localized language switching (Khmer/English), interactive charts, QR code check-ins, face scanning integration, work shift compliance tracking, and customized leave allowances.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React (Vite), TailwindCSS, Heroicons, Leaflet (Map Integration)
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL
- **Database**: PostgreSQL (Relational schema)
- **Features**:
  - 🌐 Multi-language support (Khmer / English)
  - 📸 Profile Photo Upload & Face Descriptor Scan enrollment
  - 🎫 QR Code Badge Generation & Download for Kiosk Check-ins
  - 📍 Kiosk Settings with GPS Geofencing (Latitude, Longitude & Allowed Radius)
  - ⏱️ Shift Configuration (Multi-shift daily setups)
  - 📅 Leaves management with customized allowances and limits per employee
  - 📊 Graphical Dashboard stats and logs history exportable to CSV

---

## 📁 Project Structure

```
Hr_chomnan/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database models
│   │   └── seed.js             # Initial db seeds
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── middlewares/        # Auth & Permission checks
│   │   ├── routes/             # Express endpoint routing
│   │   └── utils/              # Helper functions & database wrapper
│   ├── .env.example            # Backend env template
│   └── server.js               # Entry point of Backend server
└── frontend/
    ├── src/
    │   ├── components/         # Reusable layouts (Navbar, Sidebar, etc.)
    │   ├── context/            # Global state (Auth, Language)
    │   ├── pages/              # Main page views
    │   └── utils/              # Axios API instance config
    └── index.html              # Main HTML entry
```

---

## 🚀 Setup & Execution Guide (Step-by-Step)

### 1. Prerequisites
Make sure you have installed:
- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **Git**

---

### 2. Step 1: Clone the Repository
Open your terminal and run:
```bash
git clone https://github.com/pisethkhtk-star/Hr_chomnan.git
cd Hr_chomnan
```

---

### 3. Step 2: Database Setup
1. Open your PostgreSQL console or PgAdmin.
2. Create a new database named `employee_attendance_db`:
   ```sql
   CREATE DATABASE employee_attendance_db;
   ```

---

### 4. Step 3: Backend Configuration & Server Setup
Open a new terminal window inside the `backend` folder:
```bash
cd backend
```

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the `backend` root directory. You can copy the contents from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Modify your `.env` to match your local PostgreSQL configuration:
   ```env
   PORT=5050
   DATABASE_URL="postgresql://<db_username>:<db_password>@127.0.0.1:5432/employee_attendance_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this"
   ```

3. **Run Prisma Migrations** (creates all necessary tables):
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed the Database** (populates initial mock users, departments, and positions):
   ```bash
   npx prisma db seed
   ```

5. **Start the Backend Server**:
   ```bash
   npm run dev
   ```
   The backend server should now be running at: **`http://localhost:5050`**

---

### 5. Step 4: Frontend Server Setup
Open another terminal window at the project root (`Hr_chomnan`), then enter the `frontend` folder:
```bash
cd frontend
```

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The application will launch in your browser at: **`http://localhost:5173`**

---

## 🔑 Default Accounts (គណនីសាកល្បងលំនាំដើម)

All accounts are created during database seeding. Use them to log in and test different system permission levels:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@attendance.com` | `admin123` |
| **HR** | `hr@attendance.com` | `hr123` |
| **Manager** | `manager@attendance.com` | `manager123` |
| **Employee** | `rath@attendance.com` | `emp123` |

---

## 📍 Geofencing & Kiosk Mode Guide

1. Log in as an **Admin** or **HR**.
2. Go to **Setup** > **Employees** to enroll Face descriptors or download QR Code badges.
3. Access **Kiosk Settings** to configure your office branch geofence boundary coordinates (Latitude, Longitude) and the allowed radius (in meters) for check-ins.
4. Run **Kiosk Mode** on a tablet or gate screen to allow employees to scan their QR Badges or perform facial verification for immediate check-in compliance.

---

## 🤝 Contributing
Feel free to open issues or submit pull requests for additional features or UI improvements!
