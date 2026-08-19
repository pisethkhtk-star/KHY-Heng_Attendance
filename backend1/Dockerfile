# Lightweight & Fast Dockerfile for backend1 (Spring Boot / Java 21)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Add curl and timezone support
RUN apk add --no-cache curl tzdata

# Set Cambodia Timezone
ENV TZ=Asia/Phnom_Penh

# Copy prebuilt executable Spring Boot JAR
COPY build/libs/backend1-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/api/kiosk-settings || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
