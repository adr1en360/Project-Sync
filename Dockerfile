# The image for Cloud Run.
#
# The build has two stages. The first stage makes the interface with Node. The
# second stage runs the service with Python. Node stays in the first stage, so
# the image that Cloud Run runs holds Python only.
#
# The interpreter is Python 3.12, which is the same version as the version on the
# development machine. A version-specific break must show in a test and not on
# the day of the deploy.
#
# `uv` installs the dependencies. It reads `uv.lock`, so the image gets the same
# versions as the development machine.

# Stage one. Make the interface.
#
# The two `COPY` lines are in this order for the cache. Docker keeps the
# `npm ci` layer while only the source files change.
FROM node:24-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage two. Run the service.
FROM python:3.12-slim

# Copy the `uv` binary from the official image. This is faster than a `pip
# install uv` step, and it needs no network call at build time.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/usr/local

# Install the dependencies before the source code. Docker then keeps this layer
# in the cache while only the source code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

COPY . .

# Take the interface from the first stage. The line above copied the source
# files of the interface, and this line adds the build output that the service
# sends to the browser.
COPY --from=web /web/dist ./web/dist

# Cloud Run gives the port in the PORT variable. The default is 8080.
ENV PORT=8080
EXPOSE 8080

# One worker for each container. Cloud Run makes more containers when the load
# goes up, so a second worker inside one container gives no benefit and uses more
# memory.
CMD ["sh", "-c", "uv run --no-sync uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
