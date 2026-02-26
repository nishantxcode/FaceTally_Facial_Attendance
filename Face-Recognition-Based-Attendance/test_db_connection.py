
import pymysql
import db_config
try:
    print(f"Attempting update to connect to {db_config.DB_HOST} with user {db_config.DB_USER}...")
    conn = pymysql.connect(host = db_config.DB_HOST, user = db_config.DB_USER, password = db_config.DB_PASSWORD, database = db_config.DB_NAME)
    print("Database connection successful!")
    
    cur = conn.cursor()
    cur.execute("SHOW TABLES LIKE 'login'")
    result = cur.fetchone()
    if result:
        print("Table 'login' exists.")
        cur.execute("SELECT * FROM login")
        users = cur.fetchall()
        print(f"Users found in 'login' table: {users}")
        if not users:
             print("No users found! creating default admin/admin user...")
             cur.execute("INSERT INTO login (username, password) VALUES ('admin', 'admin')")
             conn.commit()
             print("Created default user: admin / admin")
    else:
        print("Table 'login' DOES NOT exist!")
    
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
