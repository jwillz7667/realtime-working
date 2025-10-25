"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Trash2 } from "lucide-react";
import { getRealtimeWsUrl } from "@/lib/realtime-server";
import TopBar from "@/components/top-bar";

interface EventEntry {
  id: string;
  timestamp: number;
  type: string;
  payload: unknown;
}

const MAX_EVENTS = 500;

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >( "connecting");
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    const ws = new WebSocket(getRealtimeWsUrl("/logs"));
    socketRef.current = ws;
    setConnectionState("connecting");

    ws.onopen = () => {
      setConnectionState("connected");
      setError(null);
    };

    ws.onerror = (ev) => {
      console.error("Events websocket error", ev);
      setConnectionState("error");
      setError("WebSocket error. Check the relay server.");
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = typeof data?.type === "string" ? data.type : "unknown";
        const id = crypto?.randomUUID?.() ?? `${Date.now()}-${counterRef.current++}`;
        setEvents((prev) => {
          const next = [{ id, type, payload: data, timestamp: Date.now() }, ...prev];
          return next.slice(0, MAX_EVENTS);
        });
      } catch (err) {
        console.error("Failed to parse websocket event", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const filteredEvents = useMemo(() => {
    if (!typeFilter.trim()) return events;
    const needle = typeFilter.toLowerCase();
    return events.filter((entry) => entry.type.toLowerCase().includes(needle));
  }, [events, typeFilter]);

  const handleClear = () => {
    setEvents([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="/dashboard">← Back to Dashboard</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/recordings">View Recordings</a>
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Realtime Event Stream
            </h1>
            <p className="text-sm text-muted-foreground">
              Live feed of all event payloads delivered through the realtime websocket relay. Filter by event type or clear the log to inspect new traffic.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Status:
              <span
                className={
                  connectionState === "connected"
                    ? "text-green-600 ml-1"
                    : connectionState === "connecting"
                    ? "text-amber-500 ml-1"
                    : "text-red-600 ml-1"
                }
              >
                {connectionState}
              </span>
            </span>
            <span>Events captured: {events.length}</span>
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex flex-col gap-1 w-full sm:w-64">
                <span className="text-xs font-medium text-muted-foreground">
                  Event type contains
                </span>
                <Input
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  placeholder="e.g. response.output_text.delta"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleClear}
                className="w-full sm:w-auto"
                disabled={events.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">Clear events</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[70vh]">
              <div className="divide-y">
                {filteredEvents.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {connectionState === "connected"
                      ? "Waiting for realtime events..."
                      : connectionState === "connecting"
                      ? "Connecting to websocket..."
                      : "No events available."}
                  </div>
                ) : (
                  filteredEvents.map((entry) => (
                    <div key={entry.id} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-primary">
                          {entry.type}
                        </span>
                        <span>{formatTime(entry.timestamp)}</span>
                      </div>
                      <pre className="whitespace-pre-wrap break-all rounded-md bg-slate-950/5 p-3 text-[11px]">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EventsPage;
