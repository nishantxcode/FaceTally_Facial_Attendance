from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import generate_token, token_required

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT * FROM login WHERE username = %s AND password = %s',
                (data['username'], data['password'])
            )
            user = cur.fetchone()
            
            if user is None:
                return jsonify({'error': 'Invalid username or password'}), 401
            
            token = generate_token(data['username'])
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'username': data['username']
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@auth_bp.route('/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    """Change admin password."""
    data = request.get_json()
    
    if not data or not data.get('old_password') or not data.get('new_password') or not data.get('new_username'):
        return jsonify({'error': 'All fields are required'}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT * FROM login WHERE password = %s',
                (data['old_password'],)
            )
            user = cur.fetchone()
            
            if user is None:
                return jsonify({'error': 'Invalid old password'}), 401
            
            cur.execute(
                'UPDATE login SET username = %s, password = %s',
                (data['new_username'], data['new_password'])
            )
            conn.commit()
            return jsonify({'message': 'Credentials updated successfully'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
