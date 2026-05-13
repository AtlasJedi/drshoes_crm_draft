# syntax=docker/dockerfile:1.7
#
# NOTE: temporarily single-stage — ships the locally-built jar to bypass
# BuildKit DNS issues. Re-introduce the maven build stage when the network
# in BuildKit is sorted out. Build the jar first with:
#   mvn -pl app -am -DskipTests clean package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY app/target/app-*.jar /app/app.jar
USER app
EXPOSE 8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75"
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
