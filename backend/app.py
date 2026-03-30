"""
ProjectPulse – Flask Backend
Entry point: app.py
"""
import os
from datetime import timedelta
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)

    # ── Config ────────────────────────────────────────────────────────────
    app.config["SECRET_KEY"]              = os.environ["SECRET_KEY"]
    app.config["JWT_SECRET_KEY"]          = os.environ["JWT_SECRET_KEY"]
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=30)

    # ── Extensions ────────────────────────────────────────────────────────
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    # ── Blueprints ────────────────────────────────────────────────────────
    from routes.auth import auth_bp
    from routes.employees import employees_bp
    from routes.groups import groups_bp
    from routes.projects import projects_bp
    from routes.timesheets import timesheets_bp
    from routes.reports import reports_bp
    from routes.leaves import leaves_bp
    from routes.expenses import expenses_bp
    from routes.payslips import payslips_bp
    from routes.company_expenses import company_expenses_bp
    from routes.invoices import invoices_bp
    from routes.documents import documents_bp
    from routes.clients import clients_bp
    from routes.accounts import accounts_bp
    from routes.subscriptions import subscriptions_bp
    from routes.onboarding import onboarding_bp
    from routes.assets import assets_bp
    from routes.performance import performance_bp
    from routes.helpdesk import helpdesk_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(employees_bp, url_prefix='/api/employees')
    app.register_blueprint(groups_bp, url_prefix='/api/groups')
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(timesheets_bp, url_prefix='/api/timesheets')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(leaves_bp, url_prefix='/api/leaves')
    app.register_blueprint(expenses_bp, url_prefix='/api/expenses')
    app.register_blueprint(payslips_bp, url_prefix='/api/payslips')
    app.register_blueprint(company_expenses_bp, url_prefix='/api/company-expenses')
    app.register_blueprint(invoices_bp, url_prefix='/api/invoices')
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(accounts_bp, url_prefix='/api/accounts')
    app.register_blueprint(subscriptions_bp, url_prefix='/api/subscriptions')
    app.register_blueprint(onboarding_bp, url_prefix='/api/onboarding')
    app.register_blueprint(assets_bp, url_prefix='/api/assets')
    app.register_blueprint(performance_bp, url_prefix='/api/performance')
    app.register_blueprint(helpdesk_bp, url_prefix='/api/helpdesk')
    
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "ProjectPulse API"}

    @app.route("/api/receipts/<path:filename>")
    def serve_receipt(filename):
        receipts_dir = os.path.join(os.path.dirname(__file__), "receipts")
        return send_from_directory(receipts_dir, filename)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "0") == "1")
