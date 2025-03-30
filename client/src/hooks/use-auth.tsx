import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { LoginCredentials, User, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  adminLoginMutation: UseMutationResult<User, Error, LoginCredentials>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      
      // ตรวจสอบสถานะการตอบกลับว่าสำเร็จหรือไม่
      if (!res.ok) {
        console.error("Login failed:", await res.text());
        const errorData = await res.json().catch(() => ({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" }));
        throw new Error(errorData.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      }
      
      return await res.json();
    },
    onSuccess: (user: User) => {
      // บันทึกข้อมูลผู้ใช้ลงใน query cache
      queryClient.setQueryData(["/api/user"], user);
      console.log("Login successful, user data:", user);
      toast({
        title: "เข้าสู่ระบบสำเร็จ",
        description: `ยินดีต้อนรับ, ${user.fullName}`,
      });
    },
    onError: (error: Error) => {
      console.error("Login mutation error:", error);
      toast({
        title: "เข้าสู่ระบบล้มเหลว",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "ลงทะเบียนสำเร็จ",
        description: "บัญชีของคุณได้ถูกสร้างแล้ว",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "ลงทะเบียนล้มเหลว",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "ออกจากระบบสำเร็จ",
        description: "คุณได้ออกจากระบบแล้ว",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "ออกจากระบบล้มเหลว",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adminLoginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      
      // ตรวจสอบสถานะการตอบกลับว่าสำเร็จหรือไม่
      if (!res.ok) {
        console.error("Admin login failed:", await res.text());
        const errorData = await res.json().catch(() => ({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" }));
        throw new Error(errorData.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      }
      
      return await res.json();
    },
    onSuccess: (user: User) => {
      // ตรวจสอบสิทธิ์แอดมิน
      if (!user.isAdmin) {
        console.error("User is not an admin:", user);
        throw new Error("คุณไม่มีสิทธิ์แอดมิน");
      }
      
      // บันทึกข้อมูลผู้ใช้ลงใน query cache
      queryClient.setQueryData(["/api/user"], user);
      console.log("Admin login successful, user data:", user);
      toast({
        title: "เข้าสู่ระบบแอดมินสำเร็จ",
        description: `ยินดีต้อนรับแอดมิน, ${user.fullName}`,
      });
    },
    onError: (error: Error) => {
      console.error("Admin login mutation error:", error);
      toast({
        title: "เข้าสู่ระบบแอดมินล้มเหลว",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        adminLoginMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
