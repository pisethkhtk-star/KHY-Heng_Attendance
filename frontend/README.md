# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

# 🏢 HR Chomnan - Frontend (React + Vite + TailwindCSS)

ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិក និងធនធានមនុស្ស (HR Attendance & Kiosk Management System)

---

## 🚀 ការដាក់ដំណើរការលើ AWS Ubuntu Server (Production)

សម្រាប់សេចក្ដីលម្អិតពេញលេញ សូមមើលឯកសារ៖ [README_AWS_HOSTING.md](file:///d:/project/Hr_chomnan/frontend/README_AWS_HOSTING.md)

### ពាក្យបញ្ជាដាក់ដំណើរការលឿន (Quick 1-Command Deploy):
```bash
cd Hr_chomnan/frontend
chmod +x deploy.sh
./deploy.sh
```

---

## 💻 ការរត់នៅក្នុង Local Development

### ១. ដំឡើង Dependencies
```bash
npm install
```

### ២. បង្កើតឯកសារ `.env` (ជម្រើសបន្ថែម)
```bash
cp .env.example .env
```

### ៣. បើកដំណើរការ Dev Server
```bash
npm run dev
```
> Web Frontend នឹងដំណើរការលើ `http://localhost:5173`

---

## 📁 រចនាសម្ព័ន្ធ Folder សំខាន់ៗ

- `src/components/` : UI Components (Sidebar, Navbar, Modal, etc.)
- `src/pages/` : ទំព័រកម្មវិធីទាំងអស់ (Dashboard, Kiosk, Employees, Reports, etc.)
- `src/context/` : React Context (AuthContext)
- `src/utils/` : Axios API Client & Helper Functions
- `Dockerfile` : Multi-stage build សម្រាប់ Nginx Production
- `docker-compose.yml` : Compose configuration សម្រាប់ Docker
- `nginx.conf` : Nginx Reverse Proxy & Static Asset Caching
- `deploy.sh` : Script ស្វ័យប្រវត្តសម្រាប់ Deploy លើ AWS Server

---

## 🛠️ Tech Stack

- **Framework**: React 19 + Vite 8
- **Styling**: TailwindCSS 4
- **Routing**: React Router DOM 7
- **HTTP Client**: Axios
- **Maps / GPS**: Leaflet, React-Leaflet
- **QR Scanner**: html5-qrcode
- **Web Server / Proxy**: Nginx Alpine in Docker

