from flask import Blueprint, request, jsonify
from database import get_db_connection
from auth import token_required
from datetime import datetime, timedelta

attendance_bp = Blueprint('attendance', __name__)

@attendance_bp.route('', methods=['GET'])
@token_required
def get_attendance(current_user):
    """Get attendance records with filters."""
    date = request.args.get('date', '')
    student_name = request.args.get('name', '')
    student_id = request.args.get('student_id', '')
    status = request.args.get('status', '')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    offset = (page - 1) * per_page
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT * FROM report WHERE 1=1"
            params = []
            
            if date:
                query += " AND date = %s"
                params.append(date)
            
            if student_name:
                query += " AND name LIKE %s"
                params.append(f"%{student_name}%")
            
            if student_id:
                query += " AND id = %s"
                params.append(student_id)
            
            if status:
                query += " AND status = %s"
                params.append(status)
            
            # Total count
            count_query = query.replace("SELECT *", "SELECT COUNT(*) as total")
            cur.execute(count_query, params)
            total = cur.fetchone()['total']
            
            # Paginated results
            query += " ORDER BY date DESC, time DESC LIMIT %s OFFSET %s"
            params.extend([per_page, offset])
            cur.execute(query, params)
            records = cur.fetchall()
            
            for r in records:
                if r.get('date'):
                    r['date'] = r['date'].strftime('%Y-%m-%d')
                if r.get('time'):
                    r['time'] = str(r['time'])
            
            return jsonify({
                'records': records,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@attendance_bp.route('', methods=['POST'])
@token_required
def mark_attendance(current_user):
    """Manually mark attendance for a student."""
    data = request.get_json()
    
    if not data.get('student_id') or not data.get('name'):
        return jsonify({'error': 'Student ID and name are required'}), 400
    
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    time_val = data.get('time', datetime.now().strftime('%H:%M:%S'))
    status = data.get('status', 'Present')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if already marked
            cur.execute(
                "SELECT * FROM report WHERE id = %s AND date = %s",
                (data['student_id'], date)
            )
            existing = cur.fetchone()
            
            if existing:
                return jsonify({'error': f"Attendance already marked for {data['name']} on {date}"}), 409
            
            cur.execute(
                "INSERT INTO report (id, name, date, time, status) VALUES (%s, %s, %s, %s, %s)",
                (data['student_id'], data['name'], date, time_val, status)
            )
            conn.commit()
            
            return jsonify({
                'message': f"Attendance marked for {data['name']}",
                'record_id': cur.lastrowid
            }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@attendance_bp.route('/<int:record_id>', methods=['PUT'])
@token_required
def edit_attendance(current_user, record_id):
    """Edit an attendance record."""
    data = request.get_json()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM report WHERE rid = %s", (record_id,))
            record = cur.fetchone()
            if record is None:
                return jsonify({'error': 'Record not found'}), 404
            
            status = data.get('status', record['status'])
            date = data.get('date', record['date'].strftime('%Y-%m-%d') if record.get('date') else None)
            time_val = data.get('time', str(record['time']) if record.get('time') else None)
            
            cur.execute(
                "UPDATE report SET status = %s, date = %s, time = %s WHERE rid = %s",
                (status, date, time_val, record_id)
            )
            conn.commit()
            
            return jsonify({'message': 'Attendance updated successfully'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@attendance_bp.route('/<int:record_id>', methods=['DELETE'])
@token_required
def delete_attendance(current_user, record_id):
    """Delete an attendance record."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM report WHERE rid = %s", (record_id,))
            if cur.rowcount == 0:
                return jsonify({'error': 'Record not found'}), 404
            conn.commit()
            return jsonify({'message': 'Record deleted successfully'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@attendance_bp.route('/bulk', methods=['POST'])
@token_required
def bulk_attendance(current_user):
    """Mark attendance for multiple students at once."""
    data = request.get_json()
    students = data.get('students', [])
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    status = data.get('status', 'Present')
    
    if not students:
        return jsonify({'error': 'No students provided'}), 400
    
    conn = get_db_connection()
    try:
        marked = 0
        skipped = 0
        with conn.cursor() as cur:
            for student in students:
                cur.execute(
                    "SELECT * FROM report WHERE id = %s AND date = %s",
                    (student['id'], date)
                )
                if cur.fetchone():
                    skipped += 1
                    continue
                
                cur.execute(
                    "INSERT INTO report (id, name, date, time, status) VALUES (%s, %s, %s, %s, %s)",
                    (student['id'], student['name'], date, datetime.now().strftime('%H:%M:%S'), status)
                )
                marked += 1
        
        conn.commit()
        return jsonify({
            'message': f'{marked} students marked, {skipped} skipped (already marked)',
            'marked': marked,
            'skipped': skipped
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@attendance_bp.route('/today', methods=['GET'])
@token_required
def today_attendance(current_user):
    """Get today's attendance summary."""
    today = datetime.now().strftime('%Y-%m-%d')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Total students
            cur.execute("SELECT COUNT(*) as total FROM attendance")
            total_students = cur.fetchone()['total']
            
            # Present today
            cur.execute(
                "SELECT COUNT(*) as present FROM report WHERE date = %s AND status = 'Present'",
                (today,)
            )
            present = cur.fetchone()['present']
            
            # Today's records
            cur.execute(
                "SELECT * FROM report WHERE date = %s ORDER BY time DESC",
                (today,)
            )
            records = cur.fetchall()
            for r in records:
                if r.get('date'):
                    r['date'] = r['date'].strftime('%Y-%m-%d')
                if r.get('time'):
                    r['time'] = str(r['time'])
            
            return jsonify({
                'total_students': total_students,
                'present': present,
                'absent': total_students - present,
                'percentage': round((present / total_students * 100), 1) if total_students > 0 else 0,
                'records': records
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
