"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneOff } from "lucide-react";

interface OutgoingCallsProps {
  onCallStarted?: (callSid: string) => void;
  onCallEnded?: () => void;
  activeCallSid: string | null;
}

export default function OutgoingCalls({ onCallStarted, onCallEnded, activeCallSid }: OutgoingCallsProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isDialing, setIsDialing] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [callStatus, setCallStatus] = useState("");

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      setCallStatus("Please enter a phone number");
      return;
    }

    setIsDialing(true);
    setCallStatus("Placing call...");

    try {
      const response = await fetch("/api/twilio/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phoneNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        setCallStatus(`Call initiated! SID: ${data.sid}`);
        if (onCallStarted) {
          onCallStarted(data.sid);
        }
      } else {
        setCallStatus(`Error: ${data.error || "Failed to place call"}`);
      }
    } catch (error) {
      setCallStatus(`Error: ${error}`);
    } finally {
      setIsDialing(false);
    }
  };

  const handleEndCall = async () => {
    if (!activeCallSid) return;

    setIsEndingCall(true);
    setCallStatus("Ending call...");

    try {
      const response = await fetch("/api/twilio/end-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSid: activeCallSid }),
      });

      const data = await response.json();

      if (response.ok) {
        setCallStatus("Call ended");
        if (onCallEnded) {
          onCallEnded();
        }
      } else {
        setCallStatus(`Error: ${data.error || "Failed to end call"}`);
      }
    } catch (error) {
      setCallStatus(`Error: ${error}`);
    } finally {
      setIsEndingCall(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Outgoing Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number (E.164 format)</label>
          <Input
            type="tel"
            placeholder="+15551234567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isDialing}
          />
          <p className="text-xs text-muted-foreground">
            Format: +[country code][number] (e.g., +15551234567)
          </p>
        </div>

        {!activeCallSid ? (
          <Button
            onClick={handleCall}
            disabled={isDialing || !phoneNumber.trim()}
            className="w-full"
          >
            {isDialing ? (
              <>
                <PhoneOff className="mr-2 h-4 w-4" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Place Call
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleEndCall}
            disabled={isEndingCall}
            variant="destructive"
            className="w-full"
          >
            {isEndingCall ? (
              <>
                <PhoneOff className="mr-2 h-4 w-4" />
                Ending Call...
              </>
            ) : (
              <>
                <PhoneOff className="mr-2 h-4 w-4" />
                End Call
              </>
            )}
          </Button>
        )}

        {callStatus && (
          <div className="text-sm text-center p-2 bg-muted rounded">
            {callStatus}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
