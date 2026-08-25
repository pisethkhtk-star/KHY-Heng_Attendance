#!/bin/bash
# ==============================================================================
# HR Chomnan - Frontend Automatic Deployment Script for Ubuntu AWS Server
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   🌐 Starting HR Chomnan Frontend Deployment on AWS  ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Check & Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Docker not found. Installing Docker...${NC}"
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-compose
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker installed successfully!${NC}"
fi

# 2. Build and run Frontend container
echo -e "${BLUE}🔨 Building Frontend React (Vite + Nginx) Container...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose down || true
    docker-compose up -d --build
else
    docker compose down || true
    docker compose up -d --build
fi

echo -e "${YELLOW}⏳ Waiting for Nginx Web Server to initialize...${NC}"
sleep 3

# 3. Health Check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ || echo "000")

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 304 ]; then
    echo -e "${GREEN}======================================================${NC}"
    echo -e "${GREEN}   🎉 FRONTEND DEPLOYED & RUNNING SUCCESSFULLY!       ${NC}"
    echo -e "${GREEN}======================================================${NC}"
    echo -e "Web App URL:   ${GREEN}http://$(curl -s ifconfig.me || echo '34.232.147.247')${NC}"
    echo -e "Local URL:     ${GREEN}http://localhost:80${NC}"
    echo -e ""
    echo -e "Useful Commands:"
    echo -e "  - View Logs:    ${BLUE}docker logs -f hr_attendance_frontend${NC}"
    echo -e "  - Stop Server:  ${BLUE}docker compose down${NC}"
    echo -e "  - Restart:      ${BLUE}docker compose restart${NC}"
else
    echo -e "${RED}⚠️ Web Server started with response code: $HTTP_CODE${NC}"
    echo -e "${YELLOW}Check container logs: docker logs hr_attendance_frontend${NC}"
fi
