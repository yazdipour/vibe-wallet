# 1. Build frontend
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 2. Build Go binary with embedded frontend
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /web/dist ./web/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /vibe-badget .

# 3. Minimal runtime
FROM gcr.io/distroless/static-debian12
COPY --from=build /vibe-badget /vibe-badget
ENV DB_PATH=/data/vibe-badget.db ADDR=:8080
EXPOSE 8080
VOLUME /data
ENTRYPOINT ["/vibe-badget"]
