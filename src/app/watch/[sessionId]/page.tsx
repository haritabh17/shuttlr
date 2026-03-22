import { SpectatorView } from "./client";

export const metadata = {
  title: "Watch Session — shuttlrs",
};

export default async function WatchPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SpectatorView sessionId={sessionId} />;
}
