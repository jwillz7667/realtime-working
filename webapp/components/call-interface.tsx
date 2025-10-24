"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/top-bar";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import OutgoingCalls from "@/components/outgoing-calls";
import CallHistory from "@/components/call-history";
import SavedPrompts from "@/components/saved-prompts";
import { Item } from "@/components/types";
import handleRealtimeEvent from "@/lib/handle-realtime-event";
import { getRealtimeWsUrl } from "@/lib/realtime-server";

const CallInterface = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [callStatus, setCallStatus] = useState("disconnected");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [recordingSid, setRecordingSid] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<
    "idle" | "starting" | "recording" | "stopping" | "error"
  >("idle");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  const [currentInstructions, setCurrentInstructions] = useState<string>("");

  // Auto-start recording when call becomes active
  useEffect(() => {
    if (callSid && callStatus === "active" && !hasStartedRecording && recordingStatus === "idle") {
      console.log("Auto-starting recording for call:", callSid);
      setRecordingStatus("starting");
      setHasStartedRecording(true);

      fetch("/api/twilio/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          callSid,
          options: {
            recordingChannels: "dual",
            trim: "do-not-trim",
          },
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.recordingSid) {
            console.log("Recording started:", data.recordingSid);
            setRecordingSid(data.recordingSid);
            setRecordingStatus("recording");
          } else if (data.error) {
            console.error("Failed to start recording:", data.error);
            setRecordingStatus("error");
          }
        })
        .catch((err) => {
          console.error("Recording API error:", err);
          setRecordingStatus("error");
        });
    }
  }, [callSid, callStatus, hasStartedRecording, recordingStatus]);

  // Reset recording state when call ends
  useEffect(() => {
    if (callStatus === "disconnected") {
      setHasStartedRecording(false);
    }
  }, [callStatus]);

  useEffect(() => {
    if (!ws) {
      const newWs = new WebSocket(getRealtimeWsUrl("/logs"));

      newWs.onopen = () => {
        console.log("Connected to logs websocket");
        setCallStatus("connected");
      };

      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received logs event:", data);
        if (data?.type === "call.state" && typeof data.state === "string") {
          setCallStatus(data.state);
          if (Object.prototype.hasOwnProperty.call(data, "callSid")) {
            setCallSid(data.callSid || null);
          }
          if (data.recording) {
            const recStatus = data.recording.status;
            if (recStatus === "recording") {
              setRecordingStatus("recording");
            } else if (recStatus === "idle" || recStatus === "stopped") {
              setRecordingStatus("idle");
            }
            if (data.recording.recordingSid) {
              setRecordingSid(data.recording.recordingSid);
            } else if (recStatus === "idle") {
              setRecordingSid(null);
            }
          }
        }
        handleRealtimeEvent(data, setItems);
      };

      newWs.onclose = () => {
        console.log("Logs websocket disconnected");
        setWs(null);
        setCallStatus("disconnected");
        setCallSid(null);
        setRecordingSid(null);
        setRecordingStatus("idle");
      };

      setWs(newWs);
    }
  }, [ws]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      <div className="flex-grow p-2 sm:p-4 flex flex-col overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 h-full overflow-hidden">
          {/* Left Column - Controls & Configuration */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-3 sm:gap-4 overflow-y-auto max-h-[calc(100vh-5rem)] lg:h-full">
            <OutgoingCalls
              onCallStarted={(sid) => setActiveCallSid(sid)}
              activeCallSid={activeCallSid}
              onCallEnded={() => setActiveCallSid(null)}
              currentInstructions={currentInstructions}
            />
            <SavedPrompts onSelectPrompt={(instructions) => setCurrentInstructions(instructions)} />
            <SessionConfigurationPanel
              callStatus={callStatus}
              currentInstructions={currentInstructions}
              onInstructionsChange={setCurrentInstructions}
              onSave={(config) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                  const updateEvent = {
                    type: "session.update",
                    session: {
                      ...config,
                    },
                  };
                  console.log("Sending update event:", updateEvent);
                  ws.send(JSON.stringify(updateEvent));
                }
              }}
            />
          </div>

          {/* Middle Column: Transcript */}
          <div className="col-span-1 md:col-span-2 lg:col-span-6 flex flex-col gap-3 sm:gap-4 min-h-[400px] lg:h-full overflow-hidden">
            <Transcript items={items} />
          </div>

          {/* Right Column: Call History & Function Calls */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-3 sm:gap-4 overflow-hidden lg:h-full">
            <div className="min-h-[300px] lg:h-1/2 overflow-hidden">
              <CallHistory />
            </div>
            <div className="min-h-[300px] lg:h-1/2 overflow-hidden">
              <FunctionCallsPanel items={items} ws={ws} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
