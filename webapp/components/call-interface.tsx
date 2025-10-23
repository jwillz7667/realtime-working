"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/top-bar";
import ChecklistAndConfig from "@/components/checklist-and-config";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import { Item } from "@/components/types";
import handleRealtimeEvent from "@/lib/handle-realtime-event";
import PhoneNumberChecklist from "@/components/phone-number-checklist";
import { getRealtimeWsUrl } from "@/lib/realtime-server";

const CallInterface = () => {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");
  const [allConfigsReady, setAllConfigsReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [callStatus, setCallStatus] = useState("disconnected");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [recordingSid, setRecordingSid] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<
    "idle" | "starting" | "recording" | "stopping" | "error"
  >("idle");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (allConfigsReady && !ws) {
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
  }, [allConfigsReady, ws]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ChecklistAndConfig
        ready={allConfigsReady}
        setReady={setAllConfigsReady}
        selectedPhoneNumber={selectedPhoneNumber}
        setSelectedPhoneNumber={setSelectedPhoneNumber}
      />
      <TopBar />
      <div className="flex-grow p-4 flex flex-col">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column */}
          <div className="col-span-3 flex flex-col h-full">
            <SessionConfigurationPanel
              callStatus={callStatus}
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
          <div className="col-span-6 flex flex-col gap-4 h-full overflow-hidden">
            <PhoneNumberChecklist
              selectedPhoneNumber={selectedPhoneNumber}
              allConfigsReady={allConfigsReady}
              setAllConfigsReady={setAllConfigsReady}
              callSid={callSid}
              setCallSid={setCallSid}
              recordingSid={recordingSid}
              setRecordingSid={setRecordingSid}
              recordingStatus={recordingStatus}
              setRecordingStatus={setRecordingStatus}
              setCallStatus={setCallStatus}
            />
            <Transcript items={items} />
          </div>

          {/* Right Column: Function Calls */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <FunctionCallsPanel items={items} ws={ws} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
