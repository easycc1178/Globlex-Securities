import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerStockChartRoutes } from "./stock-charts";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { initializeDatabase } from "./init-db";
import { createServer } from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// เพิ่ม CORS headers สำหรับ Vercel
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// สร้าง HTTP server
const server = createServer(app);

// ฟังก์ชัน main เพื่อเริ่มแอปพลิเคชัน
async function main() {
  try {
    // เริ่มต้นฐานข้อมูลก่อนเริ่ม server
    await initializeDatabase();
    log('Database initialized successfully', 'server');
  } catch (error) {
    log(`Error initializing database: ${error}`, 'server');
  }

  // Setup static files middleware before registering routes
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  // ลงทะเบียน routes
  const updatedServer = await registerRoutes(app, server);
  
  // ลงทะเบียน stock chart routes
  registerStockChartRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ตั้งค่า Vite หรือ Static files ตามสภาพแวดล้อม
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // เมื่อรันใน Vercel (Serverless) ไม่จำเป็นต้องเริ่ม server เอง
  if (process.env.VERCEL) {
    log('Running on Vercel, skipping server.listen()');
    return app;
  }

  // เริ่ม server สำหรับการรันในสภาพแวดล้อมอื่นๆ
  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
  
  return app;
}

// เริ่มแอปพลิเคชัน
const appPromise = main();

// Export สำหรับ Vercel Serverless Functions
export default async function handler(req: Request, res: Response) {
  const app = await appPromise;
  app(req, res);
}

// Export app สำหรับการใช้งานทั่วไป
export { app };
