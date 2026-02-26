
import pymysql
import db_config

def try_connect(host, user, password, database):
    print(f"Trying {user}@{host} with password '{password}'...")
    try:
        conn = pymysql.connect(host=host, user=user, password=password, database=database)
        print(" -> SUCCESS!")
        conn.close()
        return True
    except Exception as e:
        print(f" -> Failed: {e}")
        return False

print("Testing database connections...")

# 1. Try what is currently in db_config
db_name = db_config.DB_NAME
if try_connect(db_config.DB_HOST, db_config.DB_USER, db_config.DB_PASSWORD, db_name):
    print("\nThe configuration in db_config.py WORKS.")
else:
    print("\nThe configuration in db_config.py FAILED.")
    
    # 2. Try Empty Password (common for XAMPP default)
    print("\nAttempting common defaults...")
    if try_connect("localhost", "root", "", db_name):
        print("\nSUCCESS with EMPTY password! Please update db_config.py to have an empty password.")
    
    # 3. Try 'root' as password (common for MAMP/MySQL installer)
    elif try_connect("localhost", "root", "root", db_name):
         print("\nSUCCESS with password 'root'! Please update db_config.py.")
    
    # 4. Try 'admin' as password
    elif try_connect("localhost", "root", "admin", db_name):
         print("\nSUCCESS with password 'admin'! Please update db_config.py.")

    else:
        print("\nCould not find working credentials. Please ensure your MySQL server is running and you know the 'root' password.")
