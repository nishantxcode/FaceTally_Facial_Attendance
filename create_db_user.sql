CREATE USER IF NOT EXISTS 'attendance_app'@'localhost' IDENTIFIED BY 'app_password_123';
GRANT ALL PRIVILEGES ON recognition.* TO 'attendance_app'@'localhost';
FLUSH PRIVILEGES;
