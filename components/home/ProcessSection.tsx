import { PerfectFinishProcess } from "@/components/home/animations/PerfectFinishProcess";

type Theme = "dark" | "light";

export function ProcessSection({ theme }: { theme: Theme }) {
  return <PerfectFinishProcess theme={theme} />;
}
