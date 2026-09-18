import { handleReorderRequest } from "@/lib/reorderRoute";

export async function PATCH(request: Request) {
  return handleReorderRequest(request, "product_collections");
}
