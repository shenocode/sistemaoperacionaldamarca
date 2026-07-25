import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/library",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/library",
      params: { clientId: params.clientId },
    });
  },
});
