"""
Entry point for the PennyWise statement API (internal; called by Laravel only).

Required environment variables (put them in finance_model_api/.env, which must be git-ignored):
    INTERNAL_API_TOKEN   shared secret that Laravel sends in the X-Internal-Token header (16+ characters)
    STATEMENT_HASH_KEY   long random string used to key row ids and payee pseudonyms
Optional:
    API_HOST (default 127.0.0.1), API_PORT (default 5001), MAX_UPLOAD_MB (default 10),
    PARSE_DEBUG_TEMPLATES=1 to include anonymised templates of unreadable rows in the parse report

Development:   python statement_api.py
Windows prod:  waitress-serve --call --listen=127.0.0.1:5001 statement_api:create_app
"""
import os

from dotenv import load_dotenv
from flask import Flask

from api.v1 import bp as v1


def create_app(config=None):
    load_dotenv()
    app = Flask(__name__)
    app.config.update(
        INTERNAL_API_TOKEN=os.environ.get("INTERNAL_API_TOKEN", ""),
        MAX_CONTENT_LENGTH=int(os.environ.get("MAX_UPLOAD_MB", "10")) * 1024 * 1024,
        PARSE_DEBUG_TEMPLATES=os.environ.get("PARSE_DEBUG_TEMPLATES") == "1",
    )
    app.config.update(config or {})

    if len(app.config["INTERNAL_API_TOKEN"]) < 16:
        raise RuntimeError("Set INTERNAL_API_TOKEN to a random string of at least 16 characters.")
    if not os.environ.get("STATEMENT_HASH_KEY"):
        raise RuntimeError("Set STATEMENT_HASH_KEY to a long random string.")

    app.register_blueprint(v1)          # no CORS on purpose: browsers must never call this service directly
    return app


if __name__ == "__main__":
    create_app().run(host=os.environ.get("API_HOST", "127.0.0.1"),
                     port=int(os.environ.get("API_PORT", "5001")),
                     debug=False)
