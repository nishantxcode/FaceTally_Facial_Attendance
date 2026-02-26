import pymysql
from config import Config

def get_db_connection():
    """Create and return a database connection."""
    return pymysql.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        port=Config.DB_PORT,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False
    )

def init_db():
    """Initialize database tables if they don't exist."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Login table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS login (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    password VARCHAR(255) NOT NULL
                )
            """)
            
            # Check if default admin exists
            cur.execute("SELECT COUNT(*) as cnt FROM login")
            result = cur.fetchone()
            if result['cnt'] == 0:
                cur.execute(
                    "INSERT INTO login (username, password) VALUES (%s, %s)",
                    ('admin', 'admin')
                )
            
            # Attendance (students) table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    eid INT AUTO_INCREMENT PRIMARY KEY,
                    department VARCHAR(100),
                    fname VARCHAR(100),
                    gender VARCHAR(20),
                    contact_no VARCHAR(20),
                    email_address VARCHAR(100),
                    date_of_join DATE
                )
            """)
            
            # Report (attendance records) table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS report (
                    rid INT AUTO_INCREMENT PRIMARY KEY,
                    id INT,
                    name VARCHAR(100),
                    date DATE,
                    time TIME,
                    status VARCHAR(20) DEFAULT 'Present'
                )
            """)
            
            conn.commit()
            print("[DB] Database initialized successfully")
    except Exception as e:
        print(f"[DB] Error initializing database: {e}")
        conn.rollback()
    finally:
        conn.close()
