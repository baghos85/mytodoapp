# syntax=docker/dockerfile:1
# API image (SPEC 10.9). Build context: src/backend
#   docker build -f src/backend/MyTodoApp.Api/Dockerfile src/backend

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Copy everything (see src/backend/.dockerignore), including src/backend/Directory.Build.props and
# Directory.Packages.props: the repo-root props files only import those and are outside this build context.
COPY . .
RUN dotnet restore MyTodoApp.Api/MyTodoApp.Api.csproj
RUN dotnet publish MyTodoApp.Api/MyTodoApp.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# Regular (non-chiseled) aspnet image: has ICU + tzdata for IANA time zones (SPEC 10.3).
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app/publish .
# Non-root user built into the .NET images.
USER $APP_UID
ENTRYPOINT ["dotnet", "MyTodoApp.Api.dll"]
