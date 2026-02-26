
import pymysql
import os

print("--- Database Configuration Setup ---")
print("The application cannot connect to your MySQL database.")
print("Please enter your MySQL 'root' password to fix the configuration.")
print("If you are using XAMPP default, just press Enter (empty password).")

new_pass = input("Enter MySQL Password: ")

print(f"\nTesting connection with password: '{new_pass}'...")

try:
    conn = pymysql.connect(host="localhost", user="root", password=new_pass, database="recognition")
    print("SUCCESS! Connection established.")
    conn.close()
    
    # Update db_config.py
    config_content = f"""# Database Configuration
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = "{new_pass}"
DB_NAME = "recognition"
"""
    with open("Face-Recognition-Based-Attendance/db_config.py", "w") as f:
        f.write(config_content)
    
    print("\nUpdated db_config.py successfully.")
    print("You can now run the application.")

except Exception as e:
    print(f"\nFAILED: {e}")
    print("Please check if your XAMPP MySQL server is running and the password is correct.")
