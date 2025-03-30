import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema, LoginCredentials } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2, User, Lock, Facebook, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const loginSchema = z.object({
  username: z.string().min(1, "กรุณากรอกชื่อผู้ใช้"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(true);
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");

  // Login form
  const loginForm = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      fullName: "",
      phone: "",
      isAdmin: false,
      isActive: true,
    },
  });

  // Splash screen simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Handle form submissions
  const onLoginSubmit = (data: LoginCredentials) => {
    console.log("Login form submitted:", data);
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: z.infer<typeof insertUserSchema>) => {
    registerMutation.mutate(data);
  };

  // If already logged in, redirect to home
  if (user) {
    return <Redirect to="/" />;
  }

  // Show splash screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#16a5a3] to-[#107e7c] flex flex-col items-center justify-center p-8 text-white">
        <div className="w-80 h-80 mb-8 flex items-center justify-center animate-scale-up">
          <img 
            src="/img/logo.png" 
            alt="GLOBLEX SECURITIES Logo" 
            className="w-full h-full object-contain" 
          />
        </div>
        <h1 className="text-5xl font-display font-bold mb-2 drop-shadow-md hero-animation">GLOBLEX SECURITIES</h1>
        <p className="text-lg opacity-90 mb-8 font-light tracking-wide hero-animation" style={{ animationDelay: "0.2s" }}>บริษัทหลักทรัพย์ โกลเบล็ก จำกัด ให้บริการด้านการเป็นตัวแทนนายหน้าซื้อขายหลักทรัพย์แก่ลูกค้า ทั้งลูกค้าบุคคลและลูกค้าสถาบัน ทั้งในประเทศและต่างประเทศ มีนโยบายมุ่งขยายฐานลูกค้าใหม่ทุกประเภท โดยเฉพาะลูกค้าสถาบันและลูกค้าต่างประเทศ</p>
        <div className="animate-pulse-effect w-10 h-10 rounded-full border-2 border-white flex items-center justify-center mt-12 shadow-md animate-wave">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col animate-fade-in">
      <Tabs
        defaultValue="login"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full flex-grow flex flex-col"
      >
        <div className="py-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-48 h-48 flex items-center justify-center animate-scale-up">
              <img 
                src="/img/logo.png" 
                alt="GLOBLEX SECURITIES Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-[#1a2942] animate-slide-down" style={{ animationDelay: "0.1s" }}>
            {activeTab === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </h1>
          <p className="text-gray-600 mt-2 animate-slide-down" style={{ animationDelay: "0.2s" }}>
            {activeTab === "login"
              ? "เข้าสู่ระบบเพื่อจัดการบัญชีของคุณ"
              : "สร้างบัญชีเพื่อเริ่มต้นใช้บริการของเรา"}
          </p>
        </div>

        <TabsContent value="login" className="flex-grow px-6 animate-slide-up">
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <FormField
                control={loginForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      ชื่อผู้ใช้หรืออีเมล
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      รหัสผ่าน
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          type="password"
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <button type="button" className="text-[#16a5a3] text-sm">
                  ลืมรหัสผ่าน?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full py-6 bg-gradient-to-r from-[#16a5a3] to-[#138e8c] hover:from-[#138e8c] hover:to-[#16a5a3] text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-[1.02] border border-white/10"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                เข้าสู่ระบบ
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">หรือเข้าสู่ระบบด้วย</p>
            <div className="flex justify-center gap-4 mt-4">
              <a 
                href="/api/auth/facebook"
                className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                aria-label="เข้าสู่ระบบด้วย Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href="/api/auth/google"
                className="w-12 h-12 rounded-full bg-white border border-gray-300 text-gray-700 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
                aria-label="เข้าสู่ระบบด้วย Google"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                    fill="#4285F4"
                  />
                  <path
                    d="M7.545,14.761l-1.988-1.539C6.493,10.571,9.283,8.513,12.545,8.513c1.559,0,2.974,0.572,4.069,1.51l-1.718,1.653c-0.665-0.448-1.498-0.714-2.351-0.714c-1.945,0-3.603,1.311-4.194,3.089L7.545,14.761z"
                    fill="#34A853"
                  />
                  <path
                    d="M12.545,17.521c-1.101,0-2.094-0.374-2.857-0.999l2.233-1.805c0.753,0.596,1.779,0.596,2.532,0l2.233,1.805c-1.398,1.147-3.488,1.398-5.17,0.624l-0.972,0.374L12.545,17.521z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.545,8.513c1.559,0,2.974,0.572,4.069,1.51l-1.718,1.653c-0.665-0.448-1.498-0.714-2.351-0.714c-1.945,0-3.603,1.311-4.194,3.089l-1.806-1.391C7.493,10.571,9.283,8.513,12.545,8.513"
                    fill="#EA4335"
                  />
                </svg>
              </a>
            </div>
          </div>

          <div className="py-6 text-center">
            <p className="text-gray-600">
              ยังไม่มีบัญชี?{" "}
              <button
                className="text-[#16a5a3] font-semibold"
                onClick={() => setActiveTab("register")}
              >
                สมัครสมาชิก
              </button>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="register" className="flex-grow px-6 animate-slide-up">
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <FormField
                control={registerForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      ชื่อ-นามสกุล
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      อีเมล
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          type="email"
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      เบอร์โทรศัพท์
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      ชื่อผู้ใช้
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      รหัสผ่าน
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          type="password"
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      ยืนยันรหัสผ่าน
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          type="password"
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center mt-4">
                <Checkbox id="terms" className="text-[#16a5a3]" />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                  ฉันยอมรับ
                  <a href="#" className="text-[#16a5a3]">
                    ข้อตกลงและเงื่อนไข
                  </a>
                  ของการใช้บริการ
                </label>
              </div>

              <Button
                type="submit"
                className="w-full py-6 bg-gradient-to-r from-[#16a5a3] to-[#138e8c] hover:from-[#138e8c] hover:to-[#16a5a3] text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-[1.02] border border-white/10"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                สมัครสมาชิก
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">หรือสมัครสมาชิกด้วย</p>
            <div className="flex justify-center gap-4 mt-4">
              <a 
                href="/api/auth/facebook"
                className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                aria-label="สมัครสมาชิกด้วย Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href="/api/auth/google"
                className="w-12 h-12 rounded-full bg-white border border-gray-300 text-gray-700 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
                aria-label="สมัครสมาชิกด้วย Google"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                    fill="#4285F4"
                  />
                  <path
                    d="M7.545,14.761l-1.988-1.539C6.493,10.571,9.283,8.513,12.545,8.513c1.559,0,2.974,0.572,4.069,1.51l-1.718,1.653c-0.665-0.448-1.498-0.714-2.351-0.714c-1.945,0-3.603,1.311-4.194,3.089L7.545,14.761z"
                    fill="#34A853"
                  />
                  <path
                    d="M12.545,17.521c-1.101,0-2.094-0.374-2.857-0.999l2.233-1.805c0.753,0.596,1.779,0.596,2.532,0l2.233,1.805c-1.398,1.147-3.488,1.398-5.17,0.624l-0.972,0.374L12.545,17.521z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.545,8.513c1.559,0,2.974,0.572,4.069,1.51l-1.718,1.653c-0.665-0.448-1.498-0.714-2.351-0.714c-1.945,0-3.603,1.311-4.194,3.089l-1.806-1.391C7.493,10.571,9.283,8.513,12.545,8.513"
                    fill="#EA4335"
                  />
                </svg>
              </a>
            </div>
          </div>

          <div className="py-6 text-center">
            <p className="text-gray-600">
              มีบัญชีอยู่แล้ว?{" "}
              <button
                className="text-[#16a5a3] font-semibold"
                onClick={() => setActiveTab("login")}
              >
                เข้าสู่ระบบ
              </button>
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}