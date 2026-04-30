from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import init_db
from routes.auth_routes import auth_bp
from routes.student_routes import student_bp
from routes.attendance_routes import attendance_bp
from routes.report_routes import report_bp
from routes.recognition_routes import recognition_bp, init_models

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # CORS
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(student_bp, url_prefix='/api/students')
    app.register_blueprint(attendance_bp, url_prefix='/api/attendance')
    app.register_blueprint(report_bp, url_prefix='/api/reports')
    app.register_blueprint(recognition_bp, url_prefix='/api')

    @app.route('/', methods=['GET'])
    def index():
        return jsonify({
            'status': 'ok',
            'message': 'FaceTally API is running',
            'health': '/api/health'
        }), 200
    
    # Health check
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({
            'status': 'ok',
            'message': 'FaceTally API is running'
        }), 200
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(413)
    def too_large(e):
        return jsonify({'error': 'File too large (max 16MB)'}), 413

    # Initialize services when Flask is created by either local Python or Gunicorn.
    print("[STARTUP] Initializing database...")
    init_db()

    print("[STARTUP] Loading ML models...")
    init_models()
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    print("[STARTUP] FaceTally API server starting...")
    print("[STARTUP] API docs: http://localhost:5000/api/health")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
