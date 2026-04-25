import RoutePlanner from "@/components/RoutePlanner";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">
        Smart Ambulance Route
      </h1>
      <p className="mb-6 text-gray-500">
        Enter your current location and destination hospital to compute the optimal route.
      </p>
      <RoutePlanner />
    </div>
  );
}
