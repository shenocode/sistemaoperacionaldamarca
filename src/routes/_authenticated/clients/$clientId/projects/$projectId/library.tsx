import { createFileRoute } from "@tanstack/react-router";
import { ClientLibraryView } from "@/components/client-library-view";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/library",
)({
  head: () => ({
    meta: [{ title: "Biblioteca — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectLibraryPage,
});

function ProjectLibraryPage() {
  const { clientId, projectId } = Route.useParams();
  return <ClientLibraryView clientId={clientId} projectId={projectId} variant="embedded" />;
}
