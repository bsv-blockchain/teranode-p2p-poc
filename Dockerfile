# Build React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend-react
COPY frontend-react/package*.json ./
RUN npm ci
COPY frontend-react/ ./
RUN npm run build

# Build the manager binary
FROM golang:1.24.5 AS builder
ARG TARGETOS
ARG TARGETARCH

WORKDIR /workspace

# Copy the Go Modules manifests
COPY go.mod go.mod
COPY go.sum go.sum
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN go mod download

# Copy the go source
COPY cmd/ cmd/
COPY pkg/ pkg/

# Build
# the GOARCH has not a default value to allow the binary be built according to the host where the command
# was called. For example, if we call make docker-build in a local env which has the Apple Silicon M1 SO
# the docker BUILDPLATFORM arg will be linux/arm64 when for Apple x86 it will be linux/amd64. Therefore,
# by leaving it empty we can ensure that the container and binary shipped on it will have the same platform.
RUN CGO_ENABLED=1 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build -a -o teranode-p2p-poc cmd/main.go

# Use UBI9 so we have glibc
FROM registry.access.redhat.com/ubi9-minimal:9.3
WORKDIR /
RUN microdnf install -y sqlite
COPY --from=builder /workspace/teranode-p2p-poc .
COPY --from=frontend-builder /app/frontend-react/build ./frontend-react/build
COPY config.yaml .

# Expose the HTTP port
EXPOSE 8080

USER 65532:65532

ENTRYPOINT ["/teranode-p2p-poc"]
