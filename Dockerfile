FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    SIFT_EMBEDDER=minilm \
    SIFT_MODEL_CACHE=/app/model-cache \
    SIFT_SAMPLES=/app/samples \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/sift ./sift
COPY backend/models ./models
COPY samples /app/samples
RUN uv sync --frozen --no-dev

RUN .venv/bin/python -c "from sift.pipeline.embed import OnnxEmbedder; OnnxEmbedder().transform(['warm up'])" \
    && chmod -R a+rwX /app/model-cache

RUN useradd -m -u 1000 sift
USER sift

EXPOSE 7860
CMD [".venv/bin/uvicorn", "sift.main:app", "--host", "0.0.0.0", "--port", "7860", "--proxy-headers", "--forwarded-allow-ips", "*"]
