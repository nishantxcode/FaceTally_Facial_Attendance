from flask import Blueprint, request, jsonify, Response
from database import get_db_connection
from auth import token_required
from datetime import datetime, timedelta
import csv
import io

report_bp = Blueprint('reports', __name__)

@report_bp.route('/stats', methods=['GET'])
@token_required
def get_stats(current_user):
    """Get dashboard statistics."""
    today = datetime.now().strftime('%Y-%m-%d')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Total students
            cur.execute("SELECT COUNT(*) as total FROM attendance")
            total_students = cur.fetchone()['total']
            
            # Present today
            cur.execute(
                "SELECT COUNT(*) as cnt FROM report WHERE date = %s AND status = 'Present'",
                (today,)
            )
            present_today = cur.fetchone()['cnt']
            
            # Late today
            cur.execute(
                "SELECT COUNT(*) as cnt FROM report WHERE date = %s AND status = 'Late'",
                (today,)
            )
            late_today = cur.fetchone()['cnt']
            
            absent_today = total_students - present_today - late_today
            
            # This week's attendance data (last 7 days)
            weekly_data = []
            for i in range(6, -1, -1):
                date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
                day_name = (datetime.now() - timedelta(days=i)).strftime('%a')
                cur.execute(
                    "SELECT COUNT(*) as cnt FROM report WHERE date = %s",
                    (date,)
                )
                count = cur.fetchone()['cnt']
                weekly_data.append({
                    'date': date,
                    'day': day_name,
                    'count': count
                })
            
            # Recent activity (last 10 records)
            cur.execute(
                "SELECT * FROM report ORDER BY date DESC, time DESC LIMIT 10"
            )
            recent = cur.fetchall()
            for r in recent:
                if r.get('date'):
                    r['date'] = r['date'].strftime('%Y-%m-%d')
                if r.get('time'):
                    r['time'] = str(r['time'])
            
            # Department-wise stats
            cur.execute("""
                SELECT a.department, COUNT(DISTINCT a.eid) as total_students,
                COUNT(DISTINCT CASE WHEN r.date = %s THEN r.id END) as present_today
                FROM attendance a
                LEFT JOIN report r ON a.eid = r.id AND r.date = %s
                GROUP BY a.department
            """, (today, today))
            dept_stats = cur.fetchall()
            
            return jsonify({
                'total_students': total_students,
                'present_today': present_today,
                'absent_today': max(0, absent_today),
                'late_today': late_today,
                'attendance_percentage': round((present_today / total_students * 100), 1) if total_students > 0 else 0,
                'weekly_data': weekly_data,
                'recent_activity': recent,
                'department_stats': dept_stats
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@report_bp.route('/daily', methods=['GET'])
@token_required
def daily_report(current_user):
    """Get daily attendance report."""
    date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get all students
            cur.execute("SELECT eid, fname, department FROM attendance ORDER BY fname")
            students = cur.fetchall()
            
            # Get attendance for the date
            cur.execute("SELECT * FROM report WHERE date = %s", (date,))
            records = cur.fetchall()
            present_ids = {r['id'] for r in records}
            
            report_data = []
            for s in students:
                record = next((r for r in records if r['id'] == s['eid']), None)
                report_data.append({
                    'student_id': s['eid'],
                    'name': s['fname'],
                    'department': s['department'],
                    'status': record['status'] if record else 'Absent',
                    'time': str(record['time']) if record and record.get('time') else '-'
                })
            
            present = len([r for r in report_data if r['status'] == 'Present'])
            
            return jsonify({
                'date': date,
                'total': len(students),
                'present': present,
                'absent': len(students) - present,
                'percentage': round((present / len(students) * 100), 1) if students else 0,
                'data': report_data
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@report_bp.route('/monthly', methods=['GET'])
@token_required
def monthly_report(current_user):
    """Get monthly attendance report."""
    month = int(request.args.get('month', datetime.now().month))
    year = int(request.args.get('year', datetime.now().year))
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get all students
            cur.execute("SELECT eid, fname, department FROM attendance ORDER BY fname")
            students = cur.fetchall()
            
            # Get attendance for the month
            cur.execute(
                "SELECT id, COUNT(*) as days_present FROM report WHERE MONTH(date) = %s AND YEAR(date) = %s GROUP BY id",
                (month, year)
            )
            attendance_map = {r['id']: r['days_present'] for r in cur.fetchall()}
            
            # Calculate working days in the month
            import calendar
            _, num_days = calendar.monthrange(year, month)
            # Simple estimate: exclude weekends
            working_days = sum(1 for d in range(1, num_days + 1)
                             if datetime(year, month, d).weekday() < 5)
            
            report_data = []
            for s in students:
                days_present = attendance_map.get(s['eid'], 0)
                percentage = round((days_present / working_days * 100), 1) if working_days > 0 else 0
                report_data.append({
                    'student_id': s['eid'],
                    'name': s['fname'],
                    'department': s['department'],
                    'days_present': days_present,
                    'working_days': working_days,
                    'percentage': percentage,
                    'status': 'Good' if percentage >= 75 else 'Low' if percentage >= 50 else 'Critical'
                })
            
            return jsonify({
                'month': month,
                'year': year,
                'working_days': working_days,
                'total_students': len(students),
                'data': report_data
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@report_bp.route('/student/<int:student_id>', methods=['GET'])
@token_required
def student_report(current_user, student_id):
    """Get attendance report for a specific student."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM attendance WHERE eid = %s", (student_id,))
            student = cur.fetchone()
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            if student.get('date_of_join'):
                student['date_of_join'] = student['date_of_join'].strftime('%Y-%m-%d')
            
            # All attendance records
            cur.execute(
                "SELECT * FROM report WHERE id = %s ORDER BY date DESC",
                (student_id,)
            )
            records = cur.fetchall()
            for r in records:
                if r.get('date'):
                    r['date'] = r['date'].strftime('%Y-%m-%d')
                if r.get('time'):
                    r['time'] = str(r['time'])
            
            # Monthly breakdown
            cur.execute("""
                SELECT MONTH(date) as month, YEAR(date) as year, COUNT(*) as days_present
                FROM report WHERE id = %s
                GROUP BY YEAR(date), MONTH(date)
                ORDER BY YEAR(date) DESC, MONTH(date) DESC
            """, (student_id,))
            monthly = cur.fetchall()
            
            total_records = len(records)
            
            return jsonify({
                'student': student,
                'records': records,
                'total_days_present': total_records,
                'monthly_breakdown': monthly
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@report_bp.route('/export', methods=['GET'])
@token_required
def export_report(current_user):
    """Export attendance report as CSV."""
    report_type = request.args.get('type', 'daily')
    date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    month = int(request.args.get('month', datetime.now().month))
    year = int(request.args.get('year', datetime.now().year))
    
    conn = get_db_connection()
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        
        with conn.cursor() as cur:
            if report_type == 'daily':
                writer.writerow(['Student ID', 'Name', 'Department', 'Status', 'Time'])
                
                cur.execute("SELECT eid, fname, department FROM attendance ORDER BY fname")
                students = cur.fetchall()
                cur.execute("SELECT * FROM report WHERE date = %s", (date,))
                records = cur.fetchall()
                
                for s in students:
                    record = next((r for r in records if r['id'] == s['eid']), None)
                    writer.writerow([
                        s['eid'],
                        s['fname'],
                        s['department'],
                        record['status'] if record else 'Absent',
                        str(record['time']) if record and record.get('time') else '-'
                    ])
            
            elif report_type == 'monthly':
                import calendar
                _, num_days = calendar.monthrange(year, month)
                
                header = ['Student ID', 'Name', 'Department']
                for d in range(1, num_days + 1):
                    header.append(str(d))
                header.extend(['Total Present', 'Percentage'])
                writer.writerow(header)
                
                cur.execute("SELECT eid, fname, department FROM attendance ORDER BY fname")
                students = cur.fetchall()
                
                for s in students:
                    row = [s['eid'], s['fname'], s['department']]
                    cur.execute(
                        "SELECT DAY(date) as day FROM report WHERE id = %s AND MONTH(date) = %s AND YEAR(date) = %s",
                        (s['eid'], month, year)
                    )
                    present_days = {r['day'] for r in cur.fetchall()}
                    
                    total_present = 0
                    for d in range(1, num_days + 1):
                        if d in present_days:
                            row.append('P')
                            total_present += 1
                        else:
                            dt = datetime(year, month, d)
                            if dt.weekday() >= 5:
                                row.append('-')
                            else:
                                row.append('A')
                    
                    working_days = sum(1 for d in range(1, num_days + 1) if datetime(year, month, d).weekday() < 5)
                    pct = round((total_present / working_days * 100), 1) if working_days > 0 else 0
                    row.extend([total_present, f"{pct}%"])
                    writer.writerow(row)
        
        output.seek(0)
        filename = f"attendance_{report_type}_{date if report_type == 'daily' else f'{year}_{month:02d}'}.csv"
        
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
