import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/clients/$clientId/projects/$projectId/calendar",
      params,
    });
  },
});
