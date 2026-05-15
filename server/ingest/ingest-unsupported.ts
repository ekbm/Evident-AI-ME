import { createArtifactAsync, updateAssetStatusAsync } from "../db";

const APPLE_IWORK_TYPES = ["apple-iwork/pages", "apple-iwork/numbers", "apple-iwork/keynote"];

export async function ingestUnsupported(assetId: string, mime: string): Promise<void> {
  const isAppleFile = APPLE_IWORK_TYPES.includes(mime);
  const message = isAppleFile
    ? `Apple iWork files (.${mime.split("/")[1]}) are not directly supported. Please export the file as PDF from Pages/Numbers/Keynote and upload the PDF instead.`
    : `Unsupported file type: ${mime}. Please upload PDF, TXT, DOCX, PNG, JPG, MP3, WAV, or MP4 files.`;

  await createArtifactAsync({
    assetId,
    kind: "fallback_note",
    metadataJson: JSON.stringify({ message, mime }),
  });
  
  await updateAssetStatusAsync(assetId, "UNSUPPORTED", message);
}
