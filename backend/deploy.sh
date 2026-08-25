#!/bin/bash
# ==============================================================================
# HR Chomnan - Backend Automatic Deployment Script for Ubuntu AWS Server
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   🚀 Starting HR Chomnan Backend Deployment on AWS    ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Check & Install Docker / Docker Compose if missing
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

# 2. Check if .env exists, if not copy from .env.example
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  Creating .env file from .env.example...${NC}"
    cp .env.example .env
    # Generate random secure JWT Secret
    RANDOM_JWT=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
    sed -i "s/your_super_secret_jwt_key_at_least_32_characters_long/$RANDOM_JWT/" .env
    echo -e "${GREEN}✅ .env file initialized.${NC}"
fi

# 3. Pull latest images and build backend
echo -e "${BLUE}🔨 Building Backend & Postgres containers...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose down || true
    docker-compose up -d --build
else
    docker compose down || true
    docker compose up -d --build
fi

# 4. Wait for services to become healthy
echo -e "${YELLOW}⏳ Waiting for Spring Boot Backend to initialize (up to 40 seconds)...${NC}"
sleep 15

# 5. Check health check endpoint
MAX_RETRIES=10
COUNT=0
SUCCESS=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/kiosk-settings || echo "000")
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 401 ] || [ "$HTTP_CODE" -eq 403 ]; then
        SUCCESS=true
        break
    fi
    echo -e "${YELLOW}Waiting for backend response... (Attempt $((COUNT+1))/$MAX_RETRIES)${NC}"
    sleep 3
    COUNT=$((COUNT+1))
done

echo ""
if [ "$SUCCESS" = true ]; then
    echo -e "${GREEN}======================================================${NC}"
    echo -e "${GREEN}   🎉 BACKEND DEPLOYED & RUNNING SUCCESSFULLY!        ${NC}"
    echo -e "${GREEN}======================================================${NC}"
    echo -e "Direct API URL: ${GREEN}http://$(curl -s ifconfig.me || echo '100.56.149.110'):8080/api${NC}"
    echo -e "Health Check:   ${GREEN}http://localhost:8080/api/kiosk-settings${NC}"
    echo -e ""
    echo -e "Useful Commands:"
    echo -e "  - View Logs:    ${BLUE}docker logs -f hr_attendance_backend${NC}"
    echo -e "  - Stop Server:  ${BLUE}docker compose down${NC}"
    echo -e "  - Restart:      ${BLUE}docker compose restart${NC}"
else
    echo -e "${RED}⚠️ Backend started but health endpoint did not respond in time.${NC}"
    echo -e "${YELLOW}Check container logs with: docker logs hr_attendance_backend${NC}"
fi
