"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCcw } from "lucide-react";
import TopBar from "@/components/top-bar";

interface Recording {
  sid: string;
  callSid: string;
  status: string;
  duration: string | null;
  channels?: string | null;
  format?: string | null;
  dateCreated: string | null;
  dateUpdated: string | null;
  mediaUrl: string | null;
}

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (duration?: string | null) => {
  if (!duration) return "—";
  const seconds = Number.parseInt(duration, 10);
  if (!Number.isFinite(seconds)) return duration;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const fetchRecordings = async (
  limit: number,
  callSid?: string
): Promise<Recording[]> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (callSid) params.set("callSid", callSid.trim());
  const res = await fetch(`/api/twilio/recordings?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load recordings");
  }
  const data = await res.json();
  return data?.recordings ?? [];
};

const RecordingsPage: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);
  const [callSidFilter, setCallSidFilter] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchRecordings(limit, callSidFilter || undefined);
      setRecordings(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    load();
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
              <a href="/events">View Events</a>
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Twilio Call Recordings</h1>
            <p className="text-sm text-muted-foreground">
              Browse recent recordings captured through the realtime call assistant. Use
              the filters below to narrow by call SID.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex flex-col gap-1 w-full sm:w-56">
                <span className="text-xs font-medium text-muted-foreground">
                  Call SID (optional)
                </span>
                <Input
                  value={callSidFilter}
                  onChange={(e) => setCallSidFilter(e.target.value)}
                  placeholder="CAxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-32">
                <span className="text-xs font-medium text-muted-foreground">
                  Limit
                </span>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={limit}
                  onChange={(e) =>
                    setLimit(Number.parseInt(e.target.value || "25", 10))
                  }
                />
              </div>
              <Button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                <span className="ml-2">{loading ? "Loading" : "Refresh"}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {error && (
              <div className="mb-4 text-sm text-red-500">{error}</div>
            )}
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4 font-medium">Recording SID</th>
                  <th className="py-2 pr-4 font-medium">Call SID</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Updated</th>
                  <th className="py-2 pr-4 font-medium">Media</th>
                </tr>
              </thead>
              <tbody>
                {recordings.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-muted-foreground"
                    >
                      No recordings found.
                    </td>
                  </tr>
                ) : (
                  recordings.map((recording) => (
                    <tr key={recording.sid} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-mono text-xs break-all">
                        {recording.sid}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs break-all">
                        {recording.callSid || "—"}
                      </td>
                      <td className="py-2 pr-4 capitalize">
                        {recording.status?.replace(/_/g, " ") || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {formatDuration(recording.duration)}
                      </td>
                      <td className="py-2 pr-4">{formatDate(recording.dateCreated)}</td>
                      <td className="py-2 pr-4">{formatDate(recording.dateUpdated)}</td>
                      <td className="py-2 pr-4">
                        {recording.mediaUrl ? (
                          <a
                            href={recording.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            Download
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RecordingsPage;
