import { Suspense } from "react";
import { ApplicationView } from "@/components/ApplicationView";

// Server wrapper: resolves the dynamic route param, then hands off to the interactive client view.
export default function Page(props: PageProps<"/a/[id]">) {
  return (
    <Suspense>
      <Resolved params={props.params} />
    </Suspense>
  );
}

async function Resolved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationView id={id} />;
}
