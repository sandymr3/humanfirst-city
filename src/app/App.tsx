import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { devWorldBypass } from "@/framework/config/appConfig";
import { AuthProvider, useAuth } from "@/framework/auth/AuthProvider";
import { Login } from "@/ui/Login";
import { CityScreen } from "@/ui/CityScreen";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Root() {
  const { status } = useAuth();
  if (devWorldBypass) return <CityScreen />; // dev-only; eliminated from prod builds
  if (status === "loading") return <Splash />;
  if (status === "signedIn") return <CityScreen />;
  return <Login />;
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold text-gold">CEO CITY</h1>
        <p className="mt-2 text-sm text-muted">Entering…</p>
      </div>
    </div>
  );
}
