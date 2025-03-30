import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { ArrowLeft, Search, RefreshCcw, Settings } from "lucide-react";
import ChatInterface from "@/components/chat-interface";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminChatPage() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Get all users for chat
  const {
    data: users,
    isLoading,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  // Filter users by search query
  const filteredUsers = users?.filter(
    (u) =>
      u.id !== user?.id && // Don't show current admin
      (u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // When user is selected, show chat interface
  if (selectedUser) {
    return (
      <ChatInterface
        receiverId={selectedUser.id}
        receiver={selectedUser}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-light flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1a2942] mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <Button onClick={() => navigate("/")}>กลับสู่หน้าหลัก</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light flex flex-col">
      <div className="bg-[#1a2942] text-white p-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/admin")}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 mr-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-semibold">การสนทนากับลูกค้า</h1>
        </div>
      </div>

      <div className="flex-grow flex flex-col">
        <div className="border-b">
          <div className="px-4 py-2 flex justify-between items-center">
            <h3 className="font-medium">แชททั้งหมด</h3>
            <div className="relative">
              <Input
                type="text"
                placeholder="ค้นหา..."
                className="bg-gray-100 rounded-full py-1 px-4 text-sm pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-2 text-gray-400 h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow">
          {isLoading ? (
            // Loading skeleton
            Array(4)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="p-4 border-b flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <Skeleton className="w-12 h-12 rounded-full mr-3" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              ))
          ) : filteredUsers && filteredUsers.length > 0 ? (
            filteredUsers.map((chatUser) => (
              <div
                key={chatUser.id}
                className="p-4 border-b flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedUser(chatUser)}
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3 relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gray-200 text-gray-600">
                        {chatUser.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 ${Math.random() > 0.5 ? 'bg-green-500' : 'bg-gray-300'} rounded-full border-2 border-white`}></div>
                  </div>
                  <div>
                    <h4 className="font-medium">{chatUser.fullName}</h4>
                    <p className="text-xs text-gray-500">
                      {chatUser.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 h-64">
              <p className="mb-2">ไม่พบผู้ใช้ที่ค้นหา</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  refetch();
                }}
                className="mt-4"
              >
                ดูผู้ใช้ทั้งหมด
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white shadow-md">
        <div className="flex justify-center space-x-4">
          <Button
            className="py-2 px-4 bg-[#1a2942] text-white rounded-lg flex items-center"
            onClick={() => refetch()}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            <span>รีเฟรช</span>
          </Button>
          <Button className="py-2 px-4 bg-[#e6b54a] text-white rounded-lg flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>ตั้งค่า</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
