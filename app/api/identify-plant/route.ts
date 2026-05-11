import { NextResponse } from "next/server";
import { identifyPlantFromPhoto } from "@/lib/aiPlantIdentify";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { imageDataUrl, plants } = body as {
    imageDataUrl?: string;
    plants?: {
      id: string;
      name: string;
      species?: string | null;
      memo?: string | null;
      latestPhotoUrl?: string | null;
    }[];
  };

  if (!imageDataUrl || !Array.isArray(plants) || plants.length === 0) {
    return NextResponse.json({ result: null });
  }

  const result = await identifyPlantFromPhoto({ imageUrl: imageDataUrl, plants });
  return NextResponse.json({ result: result ?? null });
}
