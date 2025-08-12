import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'your_db_user',
  password: process.env.DB_PASS || 'your_db_password',
  database: process.env.DB_NAME || 'your_db_name',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;