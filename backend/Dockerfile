# ==========================================
# Stage 1: Build Spring Boot Application
# ==========================================
FROM gradle:8.12-jdk21-alpine AS builder
WORKDIR /app

# Copy gradle wrapper and config files first for caching
COPY build.gradle settings.gradle gradle.properties gradlew ./
COPY gradle ./gradle
RUN chmod +x gradlew

# Download dependencies
RUN ./gradlew dependencies --no-daemon || true

# Copy source code and build executable JAR
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# ==========================================
# Stage 2: Minimal Production Runtime
# ==========================================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Add curl and timezone support
RUN apk add --no-cache curl tzdata

# Set Cambodia Timezone
ENV TZ=Asia/Phnom_Penh

# Copy JAR from builder stage
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dfile.encoding=UTF-8"

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/api/kiosk-settings || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
