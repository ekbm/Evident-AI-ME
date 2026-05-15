import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Loader2, Play, Pause, SkipForward, AlertCircle } from "lucide-react";

interface VoiceGuideProps {
  sectionId: string;
  narrations: Record<string, string>;
  autoPlay?: boolean;
  onPlay?: () => void;
}

const audioCache = new Map<string, string>();

export function VoiceGuide({ sectionId, narrations, autoPlay = false, onPlay }: VoiceGuideProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPlayed, setHasPlayed] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSectionRef = useRef<string>(sectionId);

  const playNarration = useCallback(async (sectionKey: string) => {
    const text = narrations[sectionKey];
    if (isMuted || !text) return;
    
    setError(null);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    let audioUrl = audioCache.get(sectionKey);
    
    if (!audioUrl) {
      setIsLoading(true);
      
      try {
        const response = await fetch("/api/demo/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text, voice: "nova" }),
        });
        
        if (!response.ok) {
          throw new Error("Voice generation temporarily unavailable");
        }
        
        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        audioCache.set(sectionKey, audioUrl);
      } catch (err: any) {
        console.error("Voice playback error:", err);
        setError(err.message || "Voice unavailable");
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => {
      setIsPlaying(false);
    };
    
    audio.onerror = () => {
      setIsPlaying(false);
      setError("Audio playback failed");
    };
    
    try {
      await audio.play();
      setIsPlaying(true);
      setHasPlayed(prev => new Set(prev).add(sectionKey));
      onPlay?.();
    } catch (err) {
      setError("Browser blocked audio playback");
    }
  }, [isMuted, narrations, onPlay]);

  useEffect(() => {
    currentSectionRef.current = sectionId;
    
    if (autoPlay && narrations[sectionId] && !hasPlayed.has(sectionId) && !isMuted) {
      const timer = setTimeout(() => {
        playNarration(sectionId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sectionId, autoPlay, narrations, hasPlayed, isMuted, playNarration]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    setError(null);
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (narrations[sectionId]) {
      playNarration(sectionId);
    }
  };

  const toggleMute = () => {
    if (!isMuted && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setIsMuted(!isMuted);
    setError(null);
  };

  const skipSection = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
      <Badge variant="outline" className="text-xs border-primary/50">
        <Volume2 className="w-3 h-3 mr-1" />
        Voice Guide
      </Badge>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={togglePlay}
        disabled={isLoading || !narrations[sectionId]}
        aria-label={isPlaying ? "Pause narration" : "Play narration"}
        data-testid="button-voice-play"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>
      
      {isPlaying && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={skipSection}
          aria-label="Skip narration"
          data-testid="button-voice-skip"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        data-testid="button-voice-mute"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </Button>
      
      {isPlaying && (
        <span className="text-xs text-muted-foreground animate-pulse">
          Speaking...
        </span>
      )}
      
      {error && (
        <span className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </span>
      )}
    </div>
  );
}
