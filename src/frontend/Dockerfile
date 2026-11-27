# syntax=docker/dockerfile:1
# Web image (SPEC 10.9): Vite build served by unprivileged nginx. Build context: src/frontend
#   docker build src/frontend

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS final
# Rendered by the image's envsubst at start-up (needs API_UPSTREAM) into /etc/nginx/conf.d/default.conf.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# Non-root (uid 101, the image default).
USER 101
