#!/usr/bin/env bash
# ==============================================================================
# HR Chomnan (KHY-Heng Attendance) - All-In-One Deployment Script for Kali Linux
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "=================================================================="
echo "    🚀 HR CHOMNAN (ATTENDANCE SYSTEM) - KALI LINUX DEPLOYMENT    "
echo "=================================================================="
echo -e "${NC}"

# 1. Check Root Privileges
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Script needs superuser privileges for Docker & Port 80.${NC}"
    echo -e "${CYAN}Relaunching with sudo...${NC}"
    exec sudo bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 2. Fix Windows Line Endings (CRLF to LF) if files were copied from Windows
echo -e "${BLUE}🔧 Ensuring Unix line endings and permissions...${NC}"
sed -i 's/\r$//' backend/gradlew 2>/dev/null || true
chmod +x backend/gradlew 2>/dev/null || true

# 3. Check & Install Docker & Docker Compose on Kali / Debian
echo -e "${BLUE}🔍 Checking Docker environment...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Docker not found. Installing Docker on Kali Linux...${NC}"
    apt-get update -qq
    apt-get install -y -qq docker.io docker-compose
    systemctl enable --now docker
    echo -e "${GREEN}✅ Docker installed and service started.${NC}"
else
    # Ensure Docker service is running
    if ! systemctl is-active --quiet docker; then
        echo -e "${YELLOW}Starting Docker service...${NC}"
        systemctl enable --now docker
    fi
    echo -e "${GREEN}✅ Docker is ready.${NC}"
fi

# Detect Docker Compose command (docker compose vs docker-compose)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${YELLOW}Installing docker-compose...${NC}"
    apt-get update -qq && apt-get install -y -qq docker-compose
    COMPOSE_CMD="docker-compose"
fi

# 4. Configure Environment (.env)
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  Configuring .env file from .env.example...${NC}"
    cp .env.example .env
    
    # Generate random strong JWT secret (64 chars hex)
    RANDOM_JWT=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
    # Generate random strong DB password
    RANDOM_DB_PASS=$(openssl rand -hex 16 2>/dev/null || date +%s | sha256sum | head -c 16)
    
    sed -i "s/change_this_to_a_strong_password_in_production/$RANDOM_DB_PASS/" .env
    sed -i "s/super_secret_jwt_key_at_least_32_characters_long_123456/$RANDOM_JWT/" .env
    echo -e "${GREEN}✅ Generated secure random secrets in .env${NC}"
fi

# 5. Build and Launch Containers
echo -e "\n${BLUE}🔨 Building and starting containers (PostgreSQL, Backend, Frontend)...${NC}"
echo -e "${CYAN}This may take a few minutes on the first build...${NC}\n"

$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
$COMPOSE_CMD up -d --build

# 6. Health & Readiness Verification Loop
echo -e "\n${YELLOW}⏳ Waiting for services to initialize...${NC}"

# Check backend health
MAX_RETRIES=30
COUNT=0
BACKEND_OK=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://localhost:8080/api/health &> /dev/null; then
        BACKEND_OK=true
        break
    fi
    printf "."
    sleep 3
    COUNT=$((COUNT+1))
done
echo ""

# 7. Detect Server IP Address
KALI_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$KALI_IP" ]; then
    KALI_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
fi
if [ -z "$KALI_IP" ]; then
    KALI_IP="localhost"
fi

# 8. Print Deployment Status Banner
echo ""
if [ "$BACKEND_OK" = true ]; then
    echo -e "${GREEN}${BOLD}=================================================================="
    echo -e "   🎉 HR CHOMNAN SYSTEM IS UP & RUNNING ON KALI LINUX!          "
    echo -e "==================================================================${NC}"
    echo -e ""
    echo -e "  🌐 ${BOLD}Web Portal (Frontend):${NC}  ${CYAN}http://${KALI_IP}/${NC} (or http://localhost/)"
    echo -e "  ⚙️  ${BOLD}API Endpoint (Backend):${NC} ${CYAN}http://${KALI_IP}:8080/api${NC}"
    echo -e "  🩺 ${BOLD}API Health Check:${NC}       ${CYAN}http://${KALI_IP}:8080/api/health${NC}"
    echo -e "  🗄️  ${BOLD}PostgreSQL Database:${NC}    ${CYAN}localhost:5432 (DB: khyheng_att)${NC}"
    echo -e ""
    echo -e "${BOLD}📋 Management Commands:${NC}"
    echo -e "  - View live logs:    ${YELLOW}${COMPOSE_CMD} logs -f${NC}"
    echo -e "  - View backend logs: ${YELLOW}${COMPOSE_CMD} logs -f backend${NC}"
    echo -e "  - Restart services:  ${YELLOW}${COMPOSE_CMD} restart${NC}"
    echo -e "  - Stop all services: ${YELLOW}${COMPOSE_CMD} down${NC}"
    echo -e "=================================================================="
else
    echo -e "${YELLOW}==================================================================${NC}"
    echo -e "${YELLOW}⚠️  Containers started, but backend is still compiling/starting up.${NC}"
    echo -e "Check live progress by running: ${CYAN}${COMPOSE_CMD} logs -f backend${NC}"
    echo -e "Once ready, access via: ${CYAN}http://${KALI_IP}/${NC}"
    echo -e "${YELLOW}==================================================================${NC}"
fi
