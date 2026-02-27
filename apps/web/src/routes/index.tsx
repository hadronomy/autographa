import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SignaturePad } from "@/components/signature-pad/react";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const trpc = useTRPC();
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <div className="flex flex-col col-start-2 border-x h-full py-2">
      <div className="flex flex-col my-10 px-10 justify-center">
        <h1 className="text-3xl text-foreground font-mono font-bold">autographa</h1>
        <h2>
          Create beautiful <strong>handwritten</strong> signatures
        </h2>
      </div>
      <SignaturePad className="rounded-none border-x-0 border-y" />
    </div>
  );
}
