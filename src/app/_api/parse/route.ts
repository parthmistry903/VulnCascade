import { NextResponse } from "next/server";
import { RequestBodyParseError, errorResponse } from "@/lib/errors";
import { parseManifest } from "@/lib/parser";
import type { EcosystemInput } from "@/lib/types";

interface ParseRequestBody {
  manifest?: unknown;
  ecosystem?: unknown;
  includeDev?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await readRequestBody(request);
    const manifest = typeof body.manifest === "string" ? body.manifest : "";
    const ecosystem = normalizeEcosystem(body.ecosystem);
    const includeDev = typeof body.includeDev === "boolean" ? body.includeDev : true;
    return NextResponse.json(await parseManifest(manifest, ecosystem, includeDev));
  } catch (error) {
    return errorResponse(error);
  }
}

async function readRequestBody(request: Request): Promise<ParseRequestBody> {
  try {
    return (await request.json()) as ParseRequestBody;
  } catch {
    throw new RequestBodyParseError();
  }
}

function normalizeEcosystem(value: unknown): EcosystemInput {
  if (value === "npm" || value === "pip" || value === "auto") {
    return value;
  }
  return "auto";
}
