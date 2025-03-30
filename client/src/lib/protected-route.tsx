import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element | null;
}) {
  const { user, isLoading } = useAuth();
  
  console.log(`ProtectedRoute for path ${path}: User authenticated: ${!!user}, isLoading: ${isLoading}`);

  if (isLoading) {
    // แสดงหน้า loading ระหว่างตรวจสอบสถานะการเข้าสู่ระบบ
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // ถ้าไม่มีข้อมูลผู้ใช้ (ไม่ได้เข้าสู่ระบบ) ให้เปลี่ยนเส้นทางไปยังหน้าเข้าสู่ระบบ
  if (!user) {
    console.log(`User not authenticated, redirecting to /auth from ${path}`);
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log(`User authenticated as ${user.username}, rendering protected component for ${path}`);
  // ถ้ามีข้อมูลผู้ใช้ (เข้าสู่ระบบแล้ว) ให้แสดงหน้าที่ต้องการ
  return <Route path={path} component={Component} />;
}

export function AdminRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element | null;
}) {
  const { user, isLoading } = useAuth();
  
  console.log(`AdminRoute for path ${path}: User authenticated: ${!!user}, isAdmin: ${user?.isAdmin}, isLoading: ${isLoading}`);

  if (isLoading) {
    // แสดงหน้า loading ระหว่างตรวจสอบสถานะการเข้าสู่ระบบ
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // ตรวจสอบว่าเป็นผู้ใช้ที่มีสิทธิ์แอดมินหรือไม่
  if (!user || !user.isAdmin) {
    console.log(`Admin access denied for path ${path}: User not admin or not authenticated`);
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log(`Admin authenticated as ${user.username}, rendering admin component for ${path}`);
  // ถ้าเป็นแอดมิน ให้แสดงหน้าที่ต้องการ
  return <Route path={path} component={Component} />;
}
