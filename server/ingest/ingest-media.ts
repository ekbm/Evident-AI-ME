import { createArtifactAsync, createChunkAsync, updateChunkEmbeddingAsync } from "../db";
import { transcribeAudio, createEmbeddings } from "../openai";
import { chunkText } from "./chunker";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit
const SEGMENT_DURATION = 600; // 10 minutes per segment (safe margin for 25MB at 64kbps)

async function extractAudioFromVideo(videoPath: string): Promise<string> {
  const audioPath = videoPath.replace(/\.[^.]+$/, '_audio.mp3');
  
  console.log(`[IngestMedia] Extracting audio from video: ${videoPath}`);
  console.log(`[IngestMedia] Output audio path: ${audioPath}`);
  
  try {
    // Extract audio using ffmpeg with compression for smaller file size
    // Using execFile with args array to prevent shell injection
    // -vn: no video, -acodec mp3: MP3 codec, -ab 64k: 64kbps bitrate (good for speech)
    await execFileAsync('ffmpeg', [
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ab', '64k',
      '-ar', '16000',
      '-ac', '1',
      audioPath,
      '-y'
    ], {
      timeout: 300000, // 5 minute timeout for large files
    });
    
    const stats = fs.statSync(audioPath);
    console.log(`[IngestMedia] Extracted audio size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    
    return audioPath;
  } catch (error) {
    console.error(`[IngestMedia] Failed to extract audio:`, error);
    throw new Error(`Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ], { timeout: 30000 });
    return parseFloat(stdout.trim());
  } catch (error) {
    console.error(`[IngestMedia] Failed to get audio duration:`, error);
    return 0;
  }
}

async function splitAudioIntoSegments(audioPath: string): Promise<string[]> {
  const duration = await getAudioDuration(audioPath);
  if (duration <= 0) {
    console.warn(`[IngestMedia] Could not determine duration, using single file`);
    return [audioPath];
  }
  
  const numSegments = Math.ceil(duration / SEGMENT_DURATION);
  if (numSegments <= 1) {
    return [audioPath];
  }
  
  console.log(`[IngestMedia] Splitting ${(duration/60).toFixed(1)} min audio into ${numSegments} segments`);
  
  const segmentPaths: string[] = [];
  const basePath = audioPath.replace(/\.[^.]+$/, '');
  
  for (let i = 0; i < numSegments; i++) {
    const startTime = i * SEGMENT_DURATION;
    const segmentPath = `${basePath}_segment${i}.mp3`;
    
    try {
      await execFileAsync('ffmpeg', [
        '-i', audioPath,
        '-ss', String(startTime),
        '-t', String(SEGMENT_DURATION),
        '-acodec', 'libmp3lame',
        '-ab', '64k',
        '-ar', '16000',
        '-ac', '1',
        segmentPath,
        '-y'
      ], { timeout: 120000 });
      
      if (fs.existsSync(segmentPath)) {
        const stats = fs.statSync(segmentPath);
        console.log(`[IngestMedia] Segment ${i+1}/${numSegments}: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        segmentPaths.push(segmentPath);
      }
    } catch (error) {
      console.error(`[IngestMedia] Failed to create segment ${i}:`, error);
    }
  }
  
  return segmentPaths.length > 0 ? segmentPaths : [audioPath];
}

function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv'].includes(ext);
}

// Formats that require conversion before sending to Whisper API
function requiresAudioExtraction(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  // Whisper only supports: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
  const unsupportedFormats = ['.wmv', '.avi', '.mkv', '.flv', '.mov'];
  return unsupportedFormats.includes(ext);
}

export async function ingestMedia(assetId: string, filePath: string, extractAudioOnly?: boolean): Promise<void> {
  let fileToTranscribe = filePath;
  let extractedAudioPath: string | null = null;
  let segmentPaths: string[] = [];
  
  // Check if we need to extract audio from a large video
  const fileStats = fs.statSync(filePath);
  const isLargeFile = fileStats.size > MAX_WHISPER_SIZE;
  const isVideo = isVideoFile(filePath);
  const needsConversion = requiresAudioExtraction(filePath);
  
  // Always extract audio for unsupported formats (WMV, AVI, MKV, etc.) or large files
  if (isVideo && (needsConversion || isLargeFile)) {
    console.log(`[IngestMedia] Video file requires audio extraction (${needsConversion ? 'unsupported format' : 'large file'}: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB)`);
    try {
      extractedAudioPath = await extractAudioFromVideo(filePath);
      fileToTranscribe = extractedAudioPath;
      
      // Check if extracted audio is still too large
      const audioStats = fs.statSync(extractedAudioPath);
      if (audioStats.size > MAX_WHISPER_SIZE) {
        console.log(`[IngestMedia] Extracted audio (${(audioStats.size / 1024 / 1024).toFixed(2)}MB) exceeds 25MB limit - splitting into segments`);
        segmentPaths = await splitAudioIntoSegments(extractedAudioPath);
      }
    } catch (error) {
      console.error(`[IngestMedia] Audio extraction failed:`, error);
      if (needsConversion) {
        throw new Error(`Cannot process ${path.extname(filePath).toUpperCase()} video: audio extraction failed. Try converting to MP4 format.`);
      }
      // Fall back to original file for supported formats
    }
  } else if (extractAudioOnly) {
    console.log(`[IngestMedia] Processing audio-only for: ${filePath}`);
  }
  
  let transcript: string;
  try {
    if (segmentPaths.length > 1) {
      // Transcribe each segment and combine
      console.log(`[IngestMedia] Transcribing ${segmentPaths.length} audio segments...`);
      const transcripts: string[] = [];
      
      for (let i = 0; i < segmentPaths.length; i++) {
        console.log(`[IngestMedia] Transcribing segment ${i + 1}/${segmentPaths.length}`);
        try {
          const segmentTranscript = await transcribeAudio(segmentPaths[i]);
          if (segmentTranscript && segmentTranscript.trim()) {
            transcripts.push(segmentTranscript.trim());
          }
        } catch (error) {
          console.error(`[IngestMedia] Failed to transcribe segment ${i + 1}:`, error);
          // Continue with other segments
        }
      }
      
      transcript = transcripts.join(' ');
      console.log(`[IngestMedia] Combined transcript from ${transcripts.length} segments: ${transcript.length} chars`);
    } else {
      transcript = await transcribeAudio(fileToTranscribe);
    }
  } finally {
    // Clean up all temporary files
    const filesToClean = [...segmentPaths];
    if (extractedAudioPath && !segmentPaths.includes(extractedAudioPath)) {
      filesToClean.push(extractedAudioPath);
    }
    
    for (const tempFile of filesToClean) {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
          console.log(`[IngestMedia] Cleaned up: ${path.basename(tempFile)}`);
        } catch (e) {
          console.warn(`[IngestMedia] Failed to clean up temp file:`, e);
        }
      }
    }
  }
  
  if (!transcript || transcript.trim().length === 0) {
    // Create fallback artifact
    await createArtifactAsync({
      assetId,
      kind: "fallback_note",
      metadataJson: JSON.stringify({ message: "No speech detected in audio/video file." }),
    });
    return;
  }
  
  // Create transcript artifact
  const artifact = await createArtifactAsync({
    assetId,
    kind: "transcript",
    metadataJson: JSON.stringify({ charCount: transcript.length }),
  });
  
  // Chunk the transcript
  const chunks = chunkText(transcript);
  
  if (chunks.length === 0) {
    return;
  }
  
  // Create chunks in database
  // Note: Whisper doesn't provide timestamps in basic mode, so we use chunk-based refs
  const chunkRecords: Awaited<ReturnType<typeof createChunkAsync>>[] = [];
  for (const chunk of chunks) {
    const record = await createChunkAsync({
      assetId,
      artifactId: artifact.id,
      sourceRef: `transcript:chunk=${chunk.index}`,
      text: chunk.text,
    });
    chunkRecords.push(record);
  }
  
  // Generate embeddings
  const texts = chunkRecords.map((c) => c.text);
  const embeddings = await createEmbeddings(texts);
  
  // Update chunks with embeddings
  for (let i = 0; i < chunkRecords.length; i++) {
    await updateChunkEmbeddingAsync(chunkRecords[i].id, JSON.stringify(embeddings[i]));
  }
}
