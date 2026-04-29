FROM golang:1.24-alpine
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /usr/local/bin/grpc-client-backend ./cmd/server

EXPOSE 8089
CMD ["grpc-client-backend"]
