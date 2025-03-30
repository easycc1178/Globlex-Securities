import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { log } from './vite';

// ตรวจสอบว่ามี DATABASE_URL หรือไม่
if (!process.env.DATABASE_URL) {
  log("Missing DATABASE_URL environment variable", "db");
  throw new Error("Missing DATABASE_URL environment variable");
}

// สร้าง postgres client
const queryClient = postgres(process.env.DATABASE_URL);

// สร้าง drizzle client
export const db = drizzle(queryClient);