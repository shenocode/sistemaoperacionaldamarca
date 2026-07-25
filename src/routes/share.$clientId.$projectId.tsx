import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DEFAULT_OG_IMAGE } from "@/lib/og";
import { getSharePreviewFn, type SharePreview } from "@/lib/share-preview.functions";

export type ShareSearch = {
  access?: string;
};

function validateShareSearch(search: Record<string, unknown>): ShareSearch {
  const result: ShareSearch = {};
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

function isUuid(value: string | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function loadSharePreview(input: {
  access?: string;
  clientId: string;
  projectId: string;
}): Promise<SharePreview | null> {
  if (!isUuid(input.access) || !isUuid(input.clientId) || !isUuid(input.projectId)) {
    return null;
  }

  try {
    return await getSharePreviewFn({
      data: {
        access: input.access,
        clientId: input.clientId,
        projectId: input.projectId,
      },
    });
  } catch {
    return null;
  }
}


export const Route = createFileRoute("/share/$clientId/$projectId")({
  validateSearch: validateShareSearch,
  loaderDeps: ({ search }) => ({ access: search.access }),
  loader: async ({ params, deps }) => {
    const preview = await loadSharePreview({
      access: deps.access,
      clientId: params.clientId,
      projectId: params.projectId,
    });
    return { preview, access: deps.access };
  },
  head: ({ loaderData }) => {
    const preview = loaderData?.preview;
    const title = preview
      ? `${preview.client_name} — ${preview.project_name}`
      : "SOM — Sistema Operacional da Marca";
    const description = preview
      ? `Revisão de conteúdo de ${preview.client_name} (${preview.project_name}).`
      : "Aprovações de conteúdo e gestão de produção para marcas e clientes, em um só lugar.";
    const image = preview?.logo_url?.trim() || DEFAULT_OG_IMAGE;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: ShareRedirectPage,
});

function ShareRedirectPage() {
  const { clientId, projectId } = Route.useParams();
  const { access } = Route.useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    const search = access ? { access } : {};
    void navigate({
      to: "/clients/$clientId/projects/$projectId/feed",
      params: { clientId, projectId },
      search,
      replace: true,
    });
  }, [access, clientId, navigate, projectId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Abrindo revisão…</p>
    </div>
  );
}
