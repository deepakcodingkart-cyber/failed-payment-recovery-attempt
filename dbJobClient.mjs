import pkg from 'pg';


const { Client } = pkg;
let client;

export async function getJObClient() {
  if (!client) {
    client = new Client({
      host: process.env.PG_HOST,
      port: process.env.PG_PORT,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.DRIFCHARGE_BILLING_DATABAE,
    });
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
  }
  return client;
}
