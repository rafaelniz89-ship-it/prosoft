
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function updateAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const password = '104898Niz$';
  const hash = await bcrypt.hash(password, 10);
  
  await pool.query(
    'UPDATE users SET password = $1 WHERE username = $2',
    [hash, 'admin']
  );
  
  console.log('Admin password updated!');
  await pool.end();
}

updateAdmin().catch(console.error);
