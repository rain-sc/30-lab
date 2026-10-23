# Render 用這個檔案建置。本機開發仍用 mvnw spring-boot:run，不必經過 Docker。
# 建置階段下載 Maven（mvnw 是 only-script），執行階段只留 JRE。

FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
COPY src src
# Windows 取出的 mvnw 可能是 CRLF，Linux 會無法執行
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw \
    && ./mvnw -B -DskipTests package \
    && cp target/30-lab-backend-*.jar /src/app.jar

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /src/app.jar app.jar
# 免費方案 512 MB。堆疊用約六成，其餘留給 Metaspace 和執行緒
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8088
ENTRYPOINT ["java", "-jar", "app.jar"]
