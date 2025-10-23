// PhoneNumberChecklist.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle, Circle, Eye, EyeOff, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PhoneNumberChecklistProps = {
  selectedPhoneNumber: string;
  allConfigsReady: boolean;
  setAllConfigsReady: (ready: boolean) => void;
  callSid: string | null;
  setCallSid: (sid: string | null) => void;
  recordingSid: string | null;
  setRecordingSid: (sid: string | null) => void;
  recordingStatus: "idle" | "starting" | "recording" | "stopping" | "error";
  setRecordingStatus: (
    status: "idle" | "starting" | "recording" | "stopping" | "error"
  ) => void;
  setCallStatus: (status: string) => void;
};

const PhoneNumberChecklist: React.FC<PhoneNumberChecklistProps> = ({
  selectedPhoneNumber,
  allConfigsReady,
  setAllConfigsReady,
  callSid,
  setCallSid,
  recordingSid,
  setRecordingSid,
  recordingStatus,
  setRecordingStatus,
  setCallStatus,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [dialTarget, setDialTarget] = useState("");
  const [callError, setCallError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isDialing, setIsDialing] = useState(false);

  const initiateOutgoingCall = async () => {
    if (!dialTarget || !selectedPhoneNumber) {
      setCallError("Provide both target and source numbers.");
      return;
    }

    setIsDialing(true);
    setCallError(null);
    setCallSid(null);
    setCallStatus("dialing");

    try {
      const res = await fetch("/api/twilio/outgoing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: dialTarget, from: selectedPhoneNumber }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error || "Failed to start call");
      }

      const data = await res.json();
      setCallSid(data?.sid || null);
    } catch (err: any) {
      setCallError(err.message || "Call failed");
      setCallStatus("disconnected");
      setCallSid(null);
    } finally {
      setIsDialing(false);
    }
  };

  const startRecording = async () => {
    if (!callSid) {
      setRecordingError("No active call");
      return;
    }
    setRecordingStatus("starting");
    setRecordingError(null);
    try {
      const res = await fetch("/api/twilio/recordings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start", callSid }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to start recording");
      }
      setRecordingSid(data?.recordingSid || null);
      setRecordingStatus("recording");
    } catch (err: any) {
      setRecordingStatus("error");
      setRecordingError(err.message || "Recording failed");
    }
  };

  const stopRecording = async () => {
    if (!callSid || !recordingSid) {
      setRecordingError("Recording id missing");
      return;
    }
    setRecordingStatus("stopping");
    setRecordingError(null);
    try {
      const res = await fetch("/api/twilio/recordings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "stop",
          callSid,
          recordingSid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to stop recording");
      }
      setRecordingStatus("idle");
      setRecordingSid(null);
    } catch (err: any) {
      setRecordingStatus("error");
      setRecordingError(err.message || "Failed to stop recording");
    }
  };

  const resetCallState = () => {
    setCallSid(null);
    setRecordingSid(null);
    setRecordingStatus("idle");
    setRecordingError(null);
  };

  useEffect(() => {
    if (!callSid) {
      setRecordingSid(null);
      setRecordingStatus("idle");
      setRecordingError(null);
    }
  }, [callSid, setRecordingSid, setRecordingStatus, setRecordingError]);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500">Outbound Caller ID</span>
          <div className="flex items-center">
            <span className="font-medium w-36">
              {isVisible ? selectedPhoneNumber || "None" : "••••••••••"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsVisible(!isVisible)}
              className="h-8 w-8"
            >
              {isVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allConfigsReady ? (
            <CheckCircle className="text-green-500 w-4 h-4" />
          ) : (
            <Circle className="text-gray-400 w-4 h-4" />
          )}
          <span className="text-sm text-gray-700">
            {allConfigsReady ? "Setup Ready" : "Setup Not Ready"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAllConfigsReady(false);
              resetCallState();
            }}
          >
            Checklist
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] items-center">
        <div className="sm:col-span-1">
          <label className="text-sm text-gray-600">Dial Number</label>
          <Input
            value={dialTarget}
            onChange={(e) => setDialTarget(e.target.value)}
            placeholder="+1XXXXXXXXXX"
            type="tel"
          />
        </div>
        <div className="sm:col-span-1 text-sm text-gray-500">
          <p>Calls stream through the realtime server once the callee answers.</p>
        </div>
        <Button
          className="flex items-center gap-2"
          disabled={!allConfigsReady || isDialing || !selectedPhoneNumber}
          onClick={initiateOutgoingCall}
        >
          {isDialing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhoneCall className="h-4 w-4" />
          )}
          {isDialing ? "Dialing" : "Start Outgoing Call"}
        </Button>
      </div>

      {callSid && (
        <div className="text-xs text-green-600">
          Call started. SID: <code>{callSid}</code>
        </div>
      )}
      {callError && (
        <div className="text-xs text-red-500">{callError}</div>
      )}

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Recording</span>
            <p className="text-xs text-muted-foreground">
              Start a Twilio voice recording for the active call.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={startRecording}
              disabled={
                !callSid || recordingStatus === "recording" || recordingStatus === "starting"
              }
            >
              {recordingStatus === "starting" ? "Starting…" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={stopRecording}
              disabled={
                !callSid || !recordingSid || recordingStatus === "stopping" || recordingStatus === "idle"
              }
            >
              {recordingStatus === "stopping" ? "Stopping…" : "Stop"}
            </Button>
          </div>
        </div>
        <div className="text-xs text-gray-600">
          Status: {recordingStatus === "recording" ? "Recording" : recordingStatus}
          {recordingSid && (
            <span>
              {" · "}SID: <code>{recordingSid}</code>
            </span>
          )}
        </div>
        {recordingError && (
          <div className="text-xs text-red-500">{recordingError}</div>
        )}
      </div>
    </Card>
  );
};

export default PhoneNumberChecklist;
