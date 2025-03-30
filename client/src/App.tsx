import { AuthProvider } from "@/hooks/use-auth";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import LoanPage from "@/pages/loan-page";
import ChatPage from "@/pages/chat-page";
import ProfilePage from "@/pages/profile-page";
import WithdrawalPage from "@/pages/withdrawal-page";
import DepositPage from "@/pages/deposit-page";
import StockTradingPage from "@/pages/stock-trading-page";
import AdminDashboardPage from "@/pages/admin/dashboard-page";
import AdminChatPage from "@/pages/admin/chat-page";
import { ProtectedRoute, AdminRoute } from "@/lib/protected-route";
import { ChatProvider } from "@/context/chat-context";

function Router() {

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/loan" component={LoanPage} />
      <ProtectedRoute path="/chat" component={ChatPage} />
      <ProtectedRoute path="/chat/:userId" component={ChatPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/withdrawal" component={WithdrawalPage} />
      <ProtectedRoute path="/deposit" component={DepositPage} />
      <ProtectedRoute path="/stock-trading" component={StockTradingPage} />
      <AdminRoute path="/admin" component={AdminDashboardPage} />
      <AdminRoute path="/admin/chat" component={AdminChatPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChatProvider>
          <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen">
            <Router />
          </div>
          <Toaster />
        </ChatProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
