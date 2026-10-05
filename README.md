Sift
====

Customer feedback intelligence. Drop in reviews, survey answers or support tickets and Sift scores the mood of every one, groups them into topics by meaning, flags the week something broke and writes a summary where every claim links to a real review.

No database, no accounts, no paid hosting. Files are analysed in memory and forgotten after 30 minutes, and reports are saved in the visitor's own browser.

Built and tested end to end: backend, machine learning, web app, browser tests and a deployable container.


What it does
------------

* **Sentiment** from a TF IDF and logistic regression classifier trained on 2,400 labelled sentences (UCI Sentiment Labelled Sentences, CC BY 4.0). 82.7% accuracy on held out data against 72% for VADER, and it finds 82% of negative sentences where VADER finds 51%.
* **Meaning** from the all MiniLM L6 v2 sentence model run on CPU through ONNX, with a TF IDF and SVD fallback.
* **Topics** from HDBSCAN (or KMeans chosen by silhouette score), with near duplicate topics merged, outliers placed in their nearest topic and names picked by class based TF IDF.
* **Trends and spikes**: weekly counts per topic, with any week 2.5 standard deviations above the previous eight flagged.
* **Search by meaning** over every review.
* **Cited summary** written by Claude when a key is set, with every citation checked against the reviews it was shown. An offline writer takes over otherwise.
* **Live progress** streamed to the browser over server sent events.
* **Exports** to CSV, JSON and PDF.


Stack
-----

* `frontend`: Next.js 16, React 19, Tailwind 4, GSAP, Motion, IndexedDB, Playwright
* `backend`: FastAPI, scikit learn, fastembed (ONNX), VADER, Anthropic SDK, pytest, ruff
* GitHub Actions: lint, unit tests and browser tests on every push; the sentiment model is retrained and the demo report rebuilt with MiniLM when the pipeline changes.


Run it locally
--------------

You need Python 3.12 with [uv](https://docs.astral.sh/uv/) and Node 22.

Backend, on port 8000 (API docs at http://localhost:8000/docs):

```
cd backend
uv sync
uv run uvicorn sift.main:app --reload
```

Frontend, on port 3000:

```
cd frontend
npm install
npm run dev
```

Optional settings for the backend, in `backend/.env` or the environment:

* `ANTHROPIC_API_KEY` turns on Claude summaries
* `SIFT_EMBEDDER` is `auto`, `minilm` or `lsa`
* `SIFT_ALLOWED_ORIGINS` lists the frontend origins, comma separated

The frontend reads `NEXT_PUBLIC_API_URL` (default http://localhost:8000).


Tests
-----

```
cd backend && uv run pytest
cd frontend && npm run e2e
```

The browser tests start both servers themselves and run on a desktop and a phone viewport.


Deploy for free
---------------

**API on a Hugging Face Space** (free Docker hardware, 2 CPUs and 16 GB):

1. On huggingface.co create a Space with the Docker SDK and the blank template, for example `yourname/sift-api`.
2. Create a Hugging Face access token with write access.
3. In this GitHub repo, under Settings, Secrets and variables, Actions: add the secret `HF_TOKEN` and the variable `HF_SPACE` set to `yourname/sift-api`.
4. Run the "API container" workflow. It builds the image, analyses the sample inside it, then publishes it to the Space.
5. In the Space settings add the variable `SIFT_ALLOWED_ORIGINS` with your Vercel address, and optionally the secret `ANTHROPIC_API_KEY`.

**Web app on Vercel** (free Hobby plan):

1. Import this repo and set the root directory to `frontend`.
2. Add the environment variable `NEXT_PUBLIC_API_URL`, for example `https://yourname-sift-api.hf.space`.
3. Deploy.

The demo report is built into the web app, so it opens instantly even while the free Space is asleep. The analyse page shows when the server is waking up.


Data
----

The demo uses Hearth & Oak, an invented furniture shop. `backend/ml/make_samples.py` generates its 1,400 reviews with a planted app crash spike in the week of 6 July 2026, so you can check that Sift finds it.
