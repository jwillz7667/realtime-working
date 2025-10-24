"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, ExternalLink } from "lucide-react";
import type { Call } from "@/lib/supabase";

export default function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");

  useEffect(() => {
    fetchCalls();
  }, [filter]);

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.append("direction", filter);
      }

      const response = await fetch(`/api/calls?${params}`);
      const data = await response.json();

      if (response.ok) {
        setCalls(data.calls || []);
      } else {
        console.error("Failed to fetch calls:", data.error);
      }
    } catch (error) {
      console.error("Error fetching calls:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call History
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === "inbound" ? "default" : "outline"}
              onClick={() => setFilter("inbound")}
            >
              <PhoneIncoming className="h-4 w-4 mr-1" />
              Inbound
            </Button>
            <Button
              size="sm"
              variant={filter === "outbound" ? "default" : "outline"}
              onClick={() => setFilter("outbound")}
            >
              <PhoneOutgoing className="h-4 w-4 mr-1" />
              Outbound
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : calls.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No calls found
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-600" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{call.phone_number}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(call.created_at)}
                        {call.duration !== null && (
                          <span>• Duration: {formatDuration(call.duration)}</span>
                        )}
                      </div>
                      {call.status && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Status: {call.status}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {call.recording_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(call.recording_url!, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Recording
                      </Button>
                    )}
                    {call.recording_sid && !call.recording_url && (
                      <div className="text-xs text-muted-foreground">
                        Recording: {call.recording_sid.substring(0, 10)}...
                      </div>
                    )}
                  </div>
                </div>
                {call.instructions_used && (
                  <div className="mt-2 text-xs text-muted-foreground bg-muted rounded p-2">
                    <strong>Instructions:</strong> {call.instructions_used.substring(0, 100)}
                    {call.instructions_used.length > 100 && "..."}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
