import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <Dashboard
      showMockIndicator={process.env.NODE_ENV !== "production"}
      usingMocks={process.env.USE_MOCKS !== "false"}
    />
  );
}
