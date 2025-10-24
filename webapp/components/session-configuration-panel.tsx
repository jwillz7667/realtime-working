import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check } from "lucide-react";

interface SessionConfigurationPanelProps {
  callStatus: string;
  currentInstructions: string;
  onInstructionsChange: (instructions: string) => void;
  onSave: (config: any) => Promise<void> | void;
}

const DEFAULT_INSTRUCTIONS =
  "You are a helpful realtime assistant that speaks clearly, listens carefully, and reacts quickly.";

const MODEL_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "gpt-realtime (GA)", value: "gpt-realtime-2025-08-28" },
  { label: "gpt-4o-realtime-preview (2024-12-17)", value: "gpt-4o-realtime-preview-2024-12-17" },
  { label: "gpt-4o-realtime-preview (2024-10-01)", value: "gpt-4o-realtime-preview-2024-10-01" },
];

const VOICE_OPTIONS = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
];

const TURN_DETECTION_OPTIONS = [
  { label: "Semantic VAD", value: "semantic_vad" },
  { label: "Server VAD", value: "server_vad" },
  { label: "Disabled", value: "none" },
  ] as const;

type TurnDetectionType = (typeof TURN_DETECTION_OPTIONS)[number]["value"];

type ServerVadSettings = {
  create_response: boolean;
  idle_timeout_ms: string;
  interrupt_response: boolean;
  prefix_padding_ms: string;
  silence_duration_ms: string;
  threshold: string;
};

const DEFAULT_SERVER_VAD_SETTINGS: ServerVadSettings = {
  create_response: true,
  idle_timeout_ms: "",
  interrupt_response: true,
  prefix_padding_ms: "300",
  silence_duration_ms: "500",
  threshold: "0.5",
};

type SemanticVadSettings = {
  create_response: boolean;
  eagerness: "low" | "medium" | "high" | "auto";
  interrupt_response: boolean;
};

const DEFAULT_SEMANTIC_VAD_SETTINGS: SemanticVadSettings = {
  create_response: true,
  eagerness: "auto",
  interrupt_response: true,
};

const parseIntegerWithDefault = (value: string, fallback: number) => {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseOptionalInteger = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseFloatWithDefault = (value: string, fallback: number) => {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const DEFAULT_AUDIO_FORMAT = {
  type: "g711_ulaw",
  rate: 8000,
};

const SessionConfigurationPanel: React.FC<SessionConfigurationPanelProps> = ({
  callStatus,
  currentInstructions,
  onInstructionsChange,
  onSave,
}) => {
  const [model, setModel] = useState(MODEL_OPTIONS[0]?.value ?? "gpt-realtime-2025-08-28");
  const [voice, setVoice] = useState<(typeof VOICE_OPTIONS)[number]>(VOICE_OPTIONS[0]);
  const [turnDetectionType, setTurnDetectionType] = useState<TurnDetectionType>("semantic_vad");
  const [serverVadSettings, setServerVadSettings] = useState<ServerVadSettings>({
    ...DEFAULT_SERVER_VAD_SETTINGS,
  });
  const [semanticVadSettings, setSemanticVadSettings] = useState<SemanticVadSettings>({
    ...DEFAULT_SEMANTIC_VAD_SETTINGS,
  });
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(true);
  const [transcriptionModel, setTranscriptionModel] = useState("whisper-1");

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (saveStatus === "saved") {
      const timer = setTimeout(() => setSaveStatus("idle"), 2500);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  useEffect(() => {
    setHasUnsavedChanges(true);
    setSaveStatus("idle");
  }, [
    currentInstructions,
    model,
    voice,
    turnDetectionType,
    transcriptionEnabled,
    transcriptionModel,
    serverVadSettings,
    semanticVadSettings,
  ]);

  const turnDetectionPayload = useMemo(() => {
    if (turnDetectionType === "none") {
      return null;
    }

    if (turnDetectionType === "server_vad") {
      const prefixPadding = Math.max(0, parseIntegerWithDefault(serverVadSettings.prefix_padding_ms, 300));
      const silenceDuration = Math.max(0, parseIntegerWithDefault(serverVadSettings.silence_duration_ms, 500));
      const normalizedThreshold = Math.min(
        Math.max(parseFloatWithDefault(serverVadSettings.threshold, 0.5), 0),
        1
      );

      const payload: any = {
        type: "server_vad",
        create_response: serverVadSettings.create_response,
        interrupt_response: serverVadSettings.interrupt_response,
        prefix_padding_ms: prefixPadding,
        silence_duration_ms: silenceDuration,
        threshold: normalizedThreshold,
      };

      const idleTimeout = parseOptionalInteger(serverVadSettings.idle_timeout_ms);
      if (idleTimeout !== undefined) {
        payload.idle_timeout_ms = Math.max(0, idleTimeout);
      }

      return payload;
    }

    return {
      type: "semantic_vad",
      create_response: semanticVadSettings.create_response,
      eagerness: semanticVadSettings.eagerness,
      interrupt_response: semanticVadSettings.interrupt_response,
    };
  }, [turnDetectionType, serverVadSettings, semanticVadSettings]);

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      const inputConfig: Record<string, any> = {
        format: { ...DEFAULT_AUDIO_FORMAT },
        turn_detection: turnDetectionPayload,
      };

      if (transcriptionEnabled) {
        const trimmedModel = transcriptionModel.trim();
        inputConfig.transcription = {
          model: trimmedModel || "whisper-1",
        };
      }

      const payload = {
        model,
        instructions: currentInstructions,
        audio: {
          input: inputConfig,
          output: {
            format: { ...DEFAULT_AUDIO_FORMAT },
            voice,
          },
        },
      };

      await Promise.resolve(onSave(payload));
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save session configuration", error);
      setSaveStatus("error");
    }
  };

  return (
    <Card className="flex flex-col h-full w-full mx-auto">
      <CardHeader className="pb-2 px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base font-semibold truncate">
            Session Config
            <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs font-normal capitalize text-muted-foreground">
              ({callStatus || "disconnected"})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
            {saveStatus === "error" ? (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3 w-3" /> <span className="hidden sm:inline">Save failed</span><span className="sm:hidden">Error</span>
              </span>
            ) : hasUnsavedChanges ? (
              <span className="hidden sm:inline">Not saved</span>
            ) : saveStatus === "saved" ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" /> <span className="hidden sm:inline">Saved</span>
              </span>
            ) : (
              <span className="hidden sm:inline">Up to date</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-2 sm:p-3 lg:p-5">
        <ScrollArea className="h-full">
          <div className="space-y-4 sm:space-y-5 lg:space-y-6 m-1">
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Enter instructions"
                className="min-h-[100px] resize-none"
                value={currentInstructions}
                onChange={(e) => onInstructionsChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model" className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use the realtime GA release or a dated preview alias published by OpenAI.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice">Output voice</Label>
              <Select
                value={voice}
                onValueChange={(value) => setVoice(value as (typeof VOICE_OPTIONS)[number])}
              >
                <SelectTrigger id="voice" className="w-full">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Voices follow the realtime catalog documented in the OpenAI platform reference for
                <code className="mx-1">voice</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="turn-detection">Turn detection</Label>
              <Select
                value={turnDetectionType}
                onValueChange={(value) => setTurnDetectionType(value as TurnDetectionType)}
              >
                <SelectTrigger id="turn-detection" className="w-full">
                  <SelectValue placeholder="Select turn detection" />
                </SelectTrigger>
                <SelectContent>
                  {TURN_DETECTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {turnDetectionType === "semantic_vad"
                  ? "Semantic VAD balances responsiveness with accuracy. Tune eagerness and interruption settings below."
                  : turnDetectionType === "server_vad"
                  ? "Server VAD detects speech using thresholds. Configure buffering, thresholds, and idle timeouts to match your call flow."
                  : "Disable turn detection to manually trigger model responses from your application."}
              </p>
              {turnDetectionType === "server_vad" && (
                <div className="space-y-4 rounded-md border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="server-vad-create-response">Automatically respond</Label>
                      <p className="text-xs text-muted-foreground">
                        Send a response as soon as VAD detects that the caller has finished speaking.
                      </p>
                    </div>
                    <Checkbox
                      id="server-vad-create-response"
                      checked={serverVadSettings.create_response}
                      onCheckedChange={(checked) =>
                        setServerVadSettings((prev) => ({
                          ...prev,
                          create_response: checked === true,
                        }))
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="server-vad-interrupt">Interrupt ongoing audio</Label>
                      <p className="text-xs text-muted-foreground">
                        Stops assistant audio playback when new speech is detected.
                      </p>
                    </div>
                    <Checkbox
                      id="server-vad-interrupt"
                      checked={serverVadSettings.interrupt_response}
                      onCheckedChange={(checked) =>
                        setServerVadSettings((prev) => ({
                          ...prev,
                          interrupt_response: checked === true,
                        }))
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="server-vad-idle-timeout">Idle timeout (ms)</Label>
                      <Input
                        id="server-vad-idle-timeout"
                        type="number"
                        min={0}
                        placeholder="Leave blank to disable"
                        value={serverVadSettings.idle_timeout_ms}
                        onChange={(e) =>
                          setServerVadSettings((prev) => ({
                            ...prev,
                            idle_timeout_ms: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Trigger a response automatically after a long pause.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="server-vad-threshold">Activation threshold</Label>
                      <Input
                        id="server-vad-threshold"
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={serverVadSettings.threshold}
                        onChange={(e) =>
                          setServerVadSettings((prev) => ({
                            ...prev,
                            threshold: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Higher values require louder audio to trigger the VAD.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="server-vad-prefix">Prefix padding (ms)</Label>
                      <Input
                        id="server-vad-prefix"
                        type="number"
                        min={0}
                        value={serverVadSettings.prefix_padding_ms}
                        onChange={(e) =>
                          setServerVadSettings((prev) => ({
                            ...prev,
                            prefix_padding_ms: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Audio buffered before speech is detected (default 300ms).
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="server-vad-silence">Silence duration (ms)</Label>
                      <Input
                        id="server-vad-silence"
                        type="number"
                        min={0}
                        value={serverVadSettings.silence_duration_ms}
                        onChange={(e) =>
                          setServerVadSettings((prev) => ({
                            ...prev,
                            silence_duration_ms: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Silence required before the model responds (default 500ms).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {turnDetectionType === "semantic_vad" && (
                <div className="space-y-4 rounded-md border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="semantic-vad-create-response">Automatically respond</Label>
                      <p className="text-xs text-muted-foreground">
                        Generate a reply whenever the turn detector thinks the user is done speaking.
                      </p>
                    </div>
                    <Checkbox
                      id="semantic-vad-create-response"
                      checked={semanticVadSettings.create_response}
                      onCheckedChange={(checked) =>
                        setSemanticVadSettings((prev) => ({
                          ...prev,
                          create_response: checked === true,
                        }))
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="semantic-vad-interrupt">Interrupt ongoing audio</Label>
                      <p className="text-xs text-muted-foreground">
                        Stops assistant speech if the caller starts talking again.
                      </p>
                    </div>
                    <Checkbox
                      id="semantic-vad-interrupt"
                      checked={semanticVadSettings.interrupt_response}
                      onCheckedChange={(checked) =>
                        setSemanticVadSettings((prev) => ({
                          ...prev,
                          interrupt_response: checked === true,
                        }))
                      }
                      className="h-5 w-5"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="semantic-vad-eagerness">Eagerness</Label>
                    <Select
                      value={semanticVadSettings.eagerness}
                      onValueChange={(value) =>
                        setSemanticVadSettings((prev) => ({
                          ...prev,
                          eagerness: value as SemanticVadSettings["eagerness"],
                        }))
                      }
                    >
                      <SelectTrigger id="semantic-vad-eagerness" className="w-full">
                        <SelectValue placeholder="Select eagerness" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">auto (default)</SelectItem>
                        <SelectItem value="low">low</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Low waits longer for the user, high responds quickly. Auto balances dynamically.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="transcription-toggle">Input transcription</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable Whisper to stream transcripts alongside audio.
                  </p>
                </div>
                <Checkbox
                  id="transcription-toggle"
                  checked={transcriptionEnabled}
                  onCheckedChange={(checked) => setTranscriptionEnabled(checked === true)}
                  className="h-5 w-5"
                />
              </div>

              {transcriptionEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="transcription-model">Transcription model</Label>
                  <Input
                    id="transcription-model"
                    value={transcriptionModel}
                    onChange={(e) => setTranscriptionModel(e.target.value)}
                    placeholder="whisper-1"
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
      <div className="border-t px-3 py-2 sm:px-4 sm:py-3 lg:px-6 flex items-center justify-end">
        <Button
          onClick={handleSave}
          disabled={saveStatus === "saving" || !hasUnsavedChanges}
          className="w-full sm:w-auto text-xs sm:text-sm"
        >
          {saveStatus === "saving" ? "Saving..." : <><span className="hidden sm:inline">Save configuration</span><span className="sm:hidden">Save</span></>}
        </Button>
      </div>
    </Card>
  );
};

export default SessionConfigurationPanel;
