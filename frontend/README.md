# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

📄 README មាន Section ទាំងអស់:
Section	ខ្លឹមសារ
Tech Stack	React, Node.js, PostgreSQL, Prisma, Leaflet
Prerequisites	Node.js ≥ v18, PostgreSQL ≥ v14
Project Structure	Folder tree backend + frontend
Step-by-Step Setup	9 steps ច្បាស់លាស់ (Windows & Mac/Linux)
Default Accounts	Admin, HR, Manager, Employee + passwords
Main Pages	URLs ទាំងអស់ + access level
Geofencing Guide	របៀប setup KioskSettings
API Endpoints	List endpoints ទាំងអស់
Dev Commands	Prisma Studio, migrate, generate
Permissions Table	Resources ទាំង 11
Troubleshooting	GPS, Prisma Windows, Face models
Quick Start Summary:
bash
# Terminal 1 — Backend
cd backend
npm install
npx.cmd prisma migrate dev --name init
npx.cmd prisma db seed
npm run dev          # → http://localhost:5050
# Terminal 2 — Frontend
cd frontend
npm install
npm run dev          # → http://localhost:5173
