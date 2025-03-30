import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { log } from "./vite";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    log(`Error comparing passwords: ${error}`, "auth");
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "cashluxe-lending-platform-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
      path: "/"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // LocalStrategy สำหรับการเข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่าน
  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        // ตรวจสอบว่ามีการส่ง username และ password มาหรือไม่
        if (!username || !password) {
          log(`Login attempt with missing credentials`, "auth");
          return done(null, false, { message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน" });
        }
        
        // ค้นหาผู้ใช้จากฐานข้อมูล
        const user = await storage.getUserByUsername(username);
        
        // ถ้าไม่พบผู้ใช้หรือข้อมูลรหัสผ่านไม่ถูกต้อง
        if (!user || !user.password) {
          log(`Login failed: User '${username}' not found or no password set`, "auth");
          return done(null, false, { message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }
        
        // ตรวจสอบรหัสผ่าน
        const passwordValid = await comparePasswords(password, user.password);
        
        if (!passwordValid) {
          log(`Login failed: Invalid password for user '${username}'`, "auth");
          return done(null, false, { message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }

        // ตรวจสอบสถานะบัญชี
        if (!user.isActive) {
          log(`Login blocked: Account '${username}' is deactivated`, "auth");
          return done(null, false, { message: "บัญชีนี้ถูกระงับการใช้งาน" });
        }

        if (user.status === "blocked_login") {
          log(`Login blocked: Account '${username}' is blocked`, "auth");
          return done(null, false, { message: "บัญชีนี้ถูกบล็อกการเข้าสู่ระบบ" });
        }

        // ผ่านการตรวจสอบทั้งหมด อนุญาตให้เข้าสู่ระบบ
        log(`Login successful for user '${username}'`, "auth");
        return done(null, user);
      } catch (error) {
        log(`Login error: ${error}`, "auth");
        return done(error);
      }
    }),
  );

  // GoogleStrategy สำหรับการเข้าสู่ระบบด้วย Google
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
        callbackURL: "/api/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // ตรวจสอบว่ามีผู้ใช้ที่มี googleId นี้แล้วหรือไม่
          let user = await storage.getUserByGoogleId(profile.id);

          // ถ้าไม่มีผู้ใช้ ตรวจสอบอีเมลก่อนว่ามีอยู่แล้วหรือไม่
          if (!user && profile.emails && profile.emails.length > 0) {
            const email = profile.emails[0].value;
            user = await storage.getUserByEmail(email);

            // ถ้ามีอีเมลอยู่แล้ว อัปเดตผู้ใช้ด้วย googleId
            if (user) {
              user = await storage.updateUser(user.id, {
                googleId: profile.id,
                authProvider: user.authProvider ? `${user.authProvider},google` : 'google'
              });
            }
          }

          // ถ้ายังไม่มีผู้ใช้ สร้างใหม่
          if (!user) {
            const displayName = profile.displayName || '';
            const names = displayName.split(' ');
            const firstName = names[0] || '';
            const lastName = names.length > 1 ? names[names.length - 1] : '';

            const email = profile.emails && profile.emails.length > 0 
              ? profile.emails[0].value 
              : `${profile.id}@gmail.com`;

            const photoUrl = profile.photos && profile.photos.length > 0 
              ? profile.photos[0].value 
              : '';

            const username = email.split('@')[0] + '_g';
            
            user = await storage.createUser({
              username,
              email,
              fullName: displayName,
              phone: '', // ต้องให้ผู้ใช้กรอกข้อมูลเพิ่ม
              googleId: profile.id,
              profilePicture: photoUrl,
              authProvider: 'google',
            });
          }

          return done(null, user);
        } catch (error) {
          log(`Google login error: ${error}`, "auth");
          return done(error as Error);
        }
      }
    )
  );

  // FacebookStrategy สำหรับการเข้าสู่ระบบด้วย Facebook
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID || "YOUR_APP_ID", 
        clientSecret: process.env.FACEBOOK_APP_SECRET || "YOUR_APP_SECRET",
        callbackURL: "/api/auth/facebook/callback",
        profileFields: ['id', 'displayName', 'photos', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // ตรวจสอบว่ามีผู้ใช้ที่มี facebookId นี้แล้วหรือไม่
          let user = await storage.getUserByFacebookId(profile.id);

          // ถ้าไม่มีผู้ใช้ ตรวจสอบอีเมลก่อนว่ามีอยู่แล้วหรือไม่
          if (!user && profile.emails && profile.emails.length > 0) {
            const email = profile.emails[0].value;
            user = await storage.getUserByEmail(email);

            // ถ้ามีอีเมลอยู่แล้ว อัปเดตผู้ใช้ด้วย facebookId
            if (user) {
              user = await storage.updateUser(user.id, {
                facebookId: profile.id,
                authProvider: user.authProvider ? `${user.authProvider},facebook` : 'facebook'
              });
            }
          }

          // ถ้ายังไม่มีผู้ใช้ สร้างใหม่
          if (!user) {
            const displayName = profile.displayName || '';
            const email = profile.emails && profile.emails.length > 0 
              ? profile.emails[0].value 
              : `${profile.id}@facebook.com`;

            const photoUrl = profile.photos && profile.photos.length > 0 
              ? profile.photos[0].value 
              : '';

            const username = email.split('@')[0] + '_fb';
            
            user = await storage.createUser({
              username,
              email,
              fullName: displayName,
              phone: '', // ต้องให้ผู้ใช้กรอกข้อมูลเพิ่ม
              facebookId: profile.id,
              profilePicture: photoUrl,
              authProvider: 'facebook',
            });
          }

          return done(null, user);
        } catch (error) {
          log(`Facebook login error: ${error}`, "auth");
          return done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        log(`User not found for ID: ${id} during deserialization`, "auth");
        return done(null, false); // ถ้าไม่พบผู้ใช้ ส่ง false แทน
      }
      log(`User deserialized successfully: ${id}`, "auth");
      done(null, user);
    } catch (error) {
      log(`Error deserializing user ${id}: ${error}`, "auth");
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const userInput = { ...req.body };
      delete userInput.confirmPassword;

      const user = await storage.createUser({
        ...userInput,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);

        // Remove password from response
        const userResponse = { ...user } as Partial<SelectUser>;
        delete userResponse.password;

        res.status(201).json(userResponse);
      });
    } catch (error) {
      log(`Registration error: ${error}`, "auth");
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    log(`Login attempt: ${req.body.username}`, "auth");
    
    // เพิ่มการตรวจสอบข้อมูลเบื้องต้น
    if (!req.body.username || !req.body.password) {
      log(`Login validation error: Missing username or password`, "auth");
      return res.status(400).json({ message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน" });
    }
    
    log(`Validating credentials for user: ${req.body.username}`, "auth");
    
    // ตรวจสอบอย่างชัดเจนว่ามีผู้ใช้นี้ในฐานข้อมูลหรือไม่
    storage.getUserByUsername(req.body.username)
      .then(dbUser => {
        if (!dbUser) {
          log(`Login failed: User '${req.body.username}' not found in database`, "auth");
          return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }
        
        log(`User '${req.body.username}' found in database, proceeding to password verification`, "auth");
        
        // ดำเนินการยืนยันผู้ใช้ด้วย passport
        passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
          if (err) {
            log(`Login error: ${err}`, "auth");
            return next(err);
          }
          
          if (!user) {
            log(`Login failed for user ${req.body.username}: ${info?.message}`, "auth");
            return res.status(401).json({ message: info?.message || "Invalid credentials" });
          }
          
          log(`User authenticated, setting up session: ${user.id}`, "auth");
          
          req.login(user, (loginErr) => {
            if (loginErr) {
              log(`Login session error: ${loginErr}`, "auth");
              return next(loginErr);
            }
            
            log(`Session established successfully for user ${user.id}`, "auth");
            log(`Session ID: ${req.sessionID}`, "auth");
            
            // Remove password from response
            const userResponse = { ...user } as Partial<SelectUser>;
            delete userResponse.password;
            
            return res.status(200).json(userResponse);
          });
        })(req, res, next);
      })
      .catch(error => {
        log(`Database error during login: ${error}`, "auth");
        return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ โปรดลองอีกครั้ง" });
      });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    log(`Get user session request, session ID: ${req.sessionID}`, "auth");
    
    if (!req.isAuthenticated()) {
      log(`User not authenticated for session ID: ${req.sessionID}`, "auth");
      return res.sendStatus(401);
    }
    
    log(`User authenticated, returning user data for: ${req.user?.id}`, "auth");
    
    // Remove password from response
    const userResponse = { ...req.user } as Partial<SelectUser>;
    delete userResponse.password;
    
    res.json(userResponse);
  });

  // Admin login
  app.post("/api/admin/login", (req, res, next) => {
    log(`Admin login attempt: ${req.body.username}`, "auth");
    
    // เพิ่มการตรวจสอบข้อมูลเบื้องต้น
    if (!req.body.username || !req.body.password) {
      log(`Admin login validation error: Missing username or password`, "auth");
      return res.status(400).json({ message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน" });
    }
    
    log(`Validating admin credentials for user: ${req.body.username}`, "auth");
    
    // ตรวจสอบอย่างชัดเจนว่ามีผู้ใช้นี้ในฐานข้อมูลหรือไม่
    storage.getUserByUsername(req.body.username)
      .then(dbUser => {
        if (!dbUser) {
          log(`Admin login failed: User '${req.body.username}' not found in database`, "auth");
          return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }
        
        log(`User '${req.body.username}' found in database, checking admin status and proceeding to password verification`, "auth");
        
        // ตรวจสอบสถานะแอดมินก่อนเพื่อเพิ่มความปลอดภัย
        if (!dbUser.isAdmin) {
          log(`Admin login rejected: User '${req.body.username}' is not an admin`, "auth");
          return res.status(403).json({ message: "Access denied: Admin privileges required" });
        }
        
        // ดำเนินการยืนยันผู้ใช้ด้วย passport
        passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
          if (err) {
            log(`Admin login error: ${err}`, "auth");
            return next(err);
          }
          
          if (!user) {
            log(`Admin login failed for user ${req.body.username}: ${info?.message}`, "auth");
            return res.status(401).json({ message: info?.message || "Invalid credentials" });
          }
          
          if (!user.isAdmin) {
            log(`Admin login rejected: User authenticated but is not an admin`, "auth");
            return res.status(403).json({ message: "Access denied: Admin privileges required" });
          }
          
          log(`Admin authenticated, setting up session: ${user.id}`, "auth");
          
          req.login(user, (loginErr) => {
            if (loginErr) {
              log(`Admin login session error: ${loginErr}`, "auth");
              return next(loginErr);
            }
            
            log(`Admin session established successfully for user ${user.id}`, "auth");
            log(`Admin session ID: ${req.sessionID}`, "auth");
            
            // Remove password from response
            const userResponse = { ...user } as Partial<SelectUser>;
            delete userResponse.password;
            
            return res.status(200).json(userResponse);
          });
        })(req, res, next);
      })
      .catch(error => {
        log(`Database error during admin login: ${error}`, "auth");
        return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ โปรดลองอีกครั้ง" });
      });
  });

  // Google OAuth routes
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth?error=google_auth_failed' }),
    (req, res) => {
      // ส่งกลับไปที่หน้าแอปหลังจากเข้าสู่ระบบสำเร็จ
      res.redirect('/');
    }
  );

  // Facebook OAuth routes
  app.get('/api/auth/facebook',
    passport.authenticate('facebook', { scope: ['email'] })
  );

  app.get('/api/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth?error=facebook_auth_failed' }),
    (req, res) => {
      // ส่งกลับไปที่หน้าแอปหลังจากเข้าสู่ระบบสำเร็จ
      res.redirect('/');
    }
  );
}