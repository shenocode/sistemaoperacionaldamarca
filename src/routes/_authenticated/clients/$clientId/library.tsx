import { createFileRoute } from "@tanstack/react-router";
import { ClientLibraryView } from "@/components/client-library-view";

export const Route = createFileRoute("/_authenticated/clients/$clientId/library")({
  head: () => ({
    meta: [{ title: "Biblioteca — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { clientId } = Route.useParams();
  return <ClientLibraryView clientId={clientId} variant="standalone" />;
}
