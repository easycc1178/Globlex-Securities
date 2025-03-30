import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import ChatInterface from "@/components/chat-interface";
import BottomNavigation from "@/components/bottom-navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// LINE URL to redirect to
const LINE_URL = "https://line.me/ti/p/~oeasy2";

export default function ChatPage() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const params = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [timeLeft, setTimeLeft] = useState(10); // 10 seconds countdown
  
  // This useEffect will handle the redirection after 10 seconds
  useEffect(() => {
    // Set up timer for redirect
    const redirectTimer = setTimeout(() => {
      window.location.href = LINE_URL;
    }, 10000); // 10 seconds in milliseconds
    
    // Set up countdown timer
    const countdownInterval = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);
    
    // Clean up both timers when component unmounts
    return () => {
      clearTimeout(redirectTimer);
      clearInterval(countdownInterval);
    };
  }, []);

  // Get chat partners
  const {
    data: chatUsers,
    isLoading,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["/api/chat-users"],
    enabled: !!user,
  });

  // Find selected user when route parameter exists
  useEffect(() => {
    if (params.userId && chatUsers) {
      const userId = parseInt(params.userId);
      const user = chatUsers.find((u) => u.id === userId);
      if (user) {
        setSelectedUser(user);
      }
    }
  }, [params.userId, chatUsers]);

  const handleUserSelect = (chatUser: User) => {
    setSelectedUser(chatUser);
    navigate(`/chat/${chatUser.id}`);
  };

  const handleBack = () => {
    setSelectedUser(null);
    navigate("/chat");
  };

  const filteredUsers = chatUsers?.filter((chatUser) =>
    chatUser.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If no selected user and URL has userId, show chat interface
  if (params.userId && !selectedUser) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // If selected user, show chat interface
  if (selectedUser) {
    return (
      <div className="flex flex-col h-screen">
        {/* Redirect notification banner */}
        <div className="bg-gradient-to-r from-blue-600 to-green-500 text-white p-5 sticky top-0 z-10 shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="text-center md:text-left">
              <h3 className="font-bold text-xl mb-1">กำลังนำคุณไปยัง LINE</h3>
              <p className="text-white/90">เพื่อการสนทนาที่รวดเร็วและมีประสิทธิภาพมากขึ้น</p>
              <div className="mt-2 inline-flex items-center justify-center bg-white/20 px-3 py-1 rounded-full">
                <span className="font-mono font-bold text-lg animate-pulse">{timeLeft}</span>
                <span className="ml-2">วินาที</span>
              </div>
            </div>
            <a 
              href={LINE_URL} 
              className="bg-[#06C755] text-white hover:bg-[#05b54b] py-3 px-6 rounded-full flex items-center font-bold transition-all shadow-md hover:shadow-lg"
            >
              {/* LINE Logo SVG */}
              <svg className="w-6 h-6 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M19.952 14.795c.904-.859 2.047-2.142 2.047-3.866 0-3.843-3.855-6.969-8.594-6.969s-8.594 3.126-8.594 6.97c0 3.452 3.062 6.338 7.187 6.89.279.06.661.185.757.424.087.219.057.562.028.783l-.123.75c-.037.221-.173.864.762.472.935-.393 5.044-2.969 6.88-5.082l.001-.001c.869-.905 1.29-1.82 1.383-2.545l-.001-.001c.063-.49-.188-.003-.733.175zm-11.647-2.478h-1.296c-.189 0-.343-.154-.343-.343V9.435c0-.189.154-.343.343-.343h1.296c.189 0 .343.154.343.343v2.539c0 .189-.154.343-.343.343zm7.75 0h-1.296c-.189 0-.343-.154-.343-.343V9.435c0-.189.154-.343.343-.343h1.296c.189 0 .343.154.343.343v2.539c0 .189-.154.343-.343.343zm-3.091 0h-1.296c-.189 0-.343-.154-.343-.343V9.435c0-.189.154-.343.343-.343h1.296c.189 0 .343.154.343.343v2.539c0 .189-.154.343-.343.343z"/>
              </svg>
              <span>ไปที่ LINE ทันที</span>
            </a>
          </div>
        </div>
        <div className="flex-grow">
          <ChatInterface
            receiverId={selectedUser.id}
            receiver={selectedUser}
            onBack={handleBack}
          />
        </div>
      </div>
    );
  }

  // Otherwise show chat user list
  return (
    <div className="min-h-screen bg-light flex flex-col">
      <div className="bg-[#1a2942] text-white p-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 mr-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-semibold">การสนทนา</h1>
        </div>
      </div>
      
      {/* Redirect notification banner */}
      <div className="bg-gradient-to-r from-blue-600 to-green-500 text-white p-5 sticky top-0 z-10 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="text-center md:text-left">
            <h3 className="font-bold text-xl mb-1">กำลังนำคุณไปยัง LINE</h3>
            <p className="text-white/90">เพื่อการสนทนาที่รวดเร็วและมีประสิทธิภาพมากขึ้น</p>
            <div className="mt-2 inline-flex items-center justify-center bg-white/20 px-3 py-1 rounded-full">
              <span className="font-mono font-bold text-lg animate-pulse">{timeLeft}</span>
              <span className="ml-2">วินาที</span>
            </div>
          </div>
          <a 
            href={LINE_URL} 
            className="bg-[#06C755] text-white hover:bg-[#05b54b] py-3 px-6 rounded-full flex items-center font-bold transition-all shadow-md hover:shadow-lg"
          >
            {/* LINE Logo SVG */}
            <svg className="w-6 h-6 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M19.952 14.795c.904-.859 2.047-2.142 2.047-3.866 0-3.843-3.855-6.969-8.594-6.969s-8.594 3.126-8.594 6.97c0 3.452 3.062 6.338 7.187 6.89.279.06.661.185.757.424.087.219.057.562.028.783l-.123.75c-.037.221-.173.864.762.472.935-.393 5.044-2.969 6.88-5.082l.001-.001c.869-.905 1.29-1.82 1.383-2.545l-.001-.001c.063-.49-.188-.003-.733.175zm-11.647-2.478h-1.296c-.189 0-.343-.154-.343-.343V9.435c0-.189.154-.343.343-.343h1.296c.189 0 .343.154.343.343v2.539c0 .189-.154.343-.343.343zm7.75 0h-1.296c-.189 0-.343-.154-.343-.343V9.435c0-.189.154-.343.343-.343h1.296c.189 0 .343.154.343.343v2.539c0 .189-.154.343-.343.343zm-3.091 0h-1.296c-.189 0-.343-.154-.343-.343V9.435c0-.189.154-.343.343-.343h1.296c.189 0 .343.154.343.343v2.539c0 .189-.154.343-.343.343z"/>
            </svg>
            <span>ไปที่ LINE ทันที</span>
          </a>
        </div>
      </div>

      <div className="flex-grow flex flex-col pb-20">
        <div className="border-b">
          <div className="px-4 py-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="ค้นหา..."
                className="bg-gray-100 rounded-full py-1 px-4 text-sm pl-8 w-full"
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
                onClick={() => handleUserSelect(chatUser)}
              >
                <div className="flex items-center">
                  <Avatar className="w-12 h-12 mr-3">
                    <AvatarFallback className="bg-gray-200 text-gray-600">
                      {chatUser.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{chatUser.fullName}</h4>
                    <p className="text-xs text-gray-500">
                      {chatUser.isAdmin
                        ? "ฝ่ายบริการลูกค้า"
                        : chatUser.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {format(new Date(), "HH:mm", { locale: th })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 h-64">
              <p className="mb-2">ยังไม่มีการสนทนา</p>
              <p className="text-sm">
                เริ่มต้นสนทนากับฝ่ายบริการลูกค้าเพื่อสอบถามข้อมูลเกี่ยวกับการกู้เงิน
              </p>
              <button
                onClick={() => refetch()}
                className="mt-4 text-[#16a5a3] font-medium"
              >
                รีเฟรช
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
