# gRPC Client

A gRPC web client with a focus on ease of use, reflection support, and real-time validation.

[**View the Live Demo**](https://whiskeyjimbo.github.io/grpc-client/)

## Features

-   **Reflection Support**: Connect to any gRPC server that has reflection enabled.
-   **Proto Upload**: Upload `.proto` files directly to the browser to generate client definitions.
-   **Field Validation**: Visual feedback for required fields and complex validation rules (min/max, patterns, etc.).
-   **History & Workspaces**: Save request history and organize services into workspaces.
-   **Demo Mode**: A standalone frontend mode with mocked data for testing and demonstrations.

## Getting Started

### Local Development

1. **Install dependencies and start the frontend**:
   ```bash
   npm install
   npm run dev
   ```

2. **Start the Go backend**:
   ```bash
   cd backend
   go run ./cmd/server
   ```

By default, the frontend runs on `http://localhost:3000` and the backend on `http://localhost:8089`.

### Demo Mode

To run the frontend in an isolated mode with mocked data (no backend required):
```bash
npm run dev:demo
```

## Deployment

The project is configured for GitHub Pages via GitHub Actions.

1. Push your changes to the `main` branch.
2. The site will automatically build and deploy via the workflow in `.github/workflows/deploy.yml`.
3. When hosted on `*.github.io`, the app automatically enters **Demo Mode**.

## Docker

### Full Stack
```bash
docker compose up --build
```

### Frontend Only
```bash
docker build -t grpc-client .
docker run --rm -p 8080:80 grpc-client
```

## License

Apache-2.0
