import { X, AlertCircle, CheckCircle2, Copy, Save, History, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useState, useMemo, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TrackingComparisonPanelProps {
  allTrackingNumbers: string[];
  onClose: () => void;
}

interface ScannedSession {
  id: string;
  timestamp: Date;
  sessionName: string | null;
  scannedNumbers: string[];
}

interface ParsedTrackingNumber {
  original: string;
  extracted: string;
  wasExtracted: boolean;
}

// Smart tracking number extraction: extracts last 12 digits from long barcode numbers
function extractTrackingNumber(input: string): ParsedTrackingNumber {
  const trimmed = input.trim();
  
  // If longer than 12 digits, extract the last 12 digits (FedEx tracking numbers are 12 digits)
  if (trimmed.length > 12 && /^\d+$/.test(trimmed)) {
    return {
      original: trimmed,
      extracted: trimmed.slice(-12),
      wasExtracted: true
    };
  }
  
  // Otherwise, use as-is
  return {
    original: trimmed,
    extracted: trimmed,
    wasExtracted: false
  };
}

const AUTOSAVE_KEY = "tracking_comparison_autosave";

export function TrackingComparisonPanel({ allTrackingNumbers, onClose }: TrackingComparisonPanelProps) {
  const [inputText, setInputText] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [showSavedSessions, setShowSavedSessions] = useState(false);
  const { toast } = useToast();
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved input from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        setInputText(saved);
      }
    }
  }, []);

  // Auto-save input to localStorage (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout to save after 500ms of no typing
    autoSaveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, inputText);
    }, 500);

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [inputText]);

  // Fetch saved sessions
  const { data: savedSessions = [] } = useQuery<ScannedSession[]>({
    queryKey: ["/api/scanned-sessions"],
  });

  // Parse input tracking numbers (with smart extraction)
  const parsedTrackingNumbers = useMemo(() => {
    return inputText
      .split(/[\n,\s]+/)
      .map(num => num.replace(/^\d+\.\s*/, "").trim()) // Remove numbering
      .filter(num => num.length > 0)
      .map(num => extractTrackingNumber(num));
  }, [inputText]);

  // Format input text with numbered outline (showing extracted numbers when applicable)
  const formattedInputText = useMemo(() => {
    return parsedTrackingNumbers
      .map((parsed, idx) => {
        if (parsed.wasExtracted) {
          return `${idx + 1}. ${parsed.original} → ${parsed.extracted}`;
        }
        return `${idx + 1}. ${parsed.original}`;
      })
      .join("\n");
  }, [parsedTrackingNumbers]);

  // Get just the extracted tracking numbers for comparison
  const inputTrackingNumbers = useMemo(() => {
    return parsedTrackingNumbers.map(p => p.extracted);
  }, [parsedTrackingNumbers]);

  const missingInDatabase = useMemo(() => {
    return parsedTrackingNumbers.filter(parsed => !allTrackingNumbers.includes(parsed.extracted));
  }, [parsedTrackingNumbers, allTrackingNumbers]);

  const missingInInput = useMemo(() => {
    if (inputTrackingNumbers.length === 0) return [];
    return allTrackingNumbers.filter(num => !inputTrackingNumbers.includes(num));
  }, [inputTrackingNumbers, allTrackingNumbers]);

  // Tracking numbers that are found (present in both database and input)
  const foundInInput = useMemo(() => {
    if (inputTrackingNumbers.length === 0) return [];
    return allTrackingNumbers.filter(num => inputTrackingNumbers.includes(num));
  }, [inputTrackingNumbers, allTrackingNumbers]);

  const saveSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/scanned-sessions", {
        sessionName: sessionName || null,
        scannedNumbers: inputTrackingNumbers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scanned-sessions"] });
      toast({
        title: "Saved!",
        description: "Scanned session saved successfully.",
      });
      setSessionName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save session",
        variant: "destructive",
      });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scanned-sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scanned-sessions"] });
      toast({
        title: "Deleted",
        description: "Session deleted successfully.",
      });
    },
  });

  const reportMissingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/shipments/mark-not-scanned", {
        trackingNumbers: missingInInput,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "Reported as Not Scanned",
        description: `${data.count} tracking number(s) marked as not scanned.`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to report missing tracking numbers",
        variant: "destructive",
      });
    },
  });

  // Silent mutation to mark tracking numbers as scanned (auto-triggered when found)
  const markScannedMutation = useMutation({
    mutationFn: async (trackingNumbers: string[]) => {
      if (trackingNumbers.length === 0) return { count: 0 };
      const response = await apiRequest("POST", "/api/shipments/mark-scanned", {
        trackingNumbers,
      });
      return await response.json();
    },
    onSuccess: () => {
      // Silently invalidate queries to update the dashboard counts
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
    },
    onError: (error: Error) => {
      // Silent error handling - don't interrupt user experience
      console.error("Failed to auto-mark as scanned:", error);
    },
  });

  // Auto-mark found tracking numbers as scanned when they match
  useEffect(() => {
    if (foundInInput.length > 0) {
      markScannedMutation.mutate(foundInInput);
    }
  }, [foundInInput.join(',')]); // Use join to create stable dependency

  // Mutation to mark tracking numbers as completed
  const markCompletedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/shipments/mark-completed", {
        trackingNumbers: foundInInput,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "Marked as Complete",
        description: `${data.count} shipment(s) marked as delivered/complete.`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark shipments as complete",
        variant: "destructive",
      });
    },
  });

  const handleMarkComplete = () => {
    if (foundInInput.length === 0) {
      toast({
        title: "Error",
        description: "No tracking numbers to mark as complete",
        variant: "destructive",
      });
      return;
    }
    markCompletedMutation.mutate();
  };

  const handleReportMissing = () => {
    if (missingInInput.length === 0) {
      toast({
        title: "Error",
        description: "No tracking numbers to report as missing",
        variant: "destructive",
      });
      return;
    }
    reportMissingMutation.mutate();
  };

  const handleCopyMissing = () => {
    const textToCopy = missingInDatabase.map(p => p.extracted).join("\n");
    navigator.clipboard.writeText(textToCopy);
    toast({
      title: "Copied!",
      description: `${missingInDatabase.length} missing tracking numbers copied to clipboard.`,
    });
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(allTrackingNumbers.join("\n"));
    toast({
      title: "Copied!",
      description: `All ${allTrackingNumbers.length} tracking numbers copied to clipboard.`,
    });
  };

  const handleCopyFormatted = () => {
    navigator.clipboard.writeText(formattedInputText);
    toast({
      title: "Copied!",
      description: "Formatted tracking numbers copied to clipboard.",
    });
  };

  const handleSaveSession = () => {
    if (inputTrackingNumbers.length === 0) {
      toast({
        title: "Error",
        description: "No tracking numbers to save",
        variant: "destructive",
      });
      return;
    }
    saveSessionMutation.mutate();
  };

  const handleLoadSession = (session: ScannedSession) => {
    setInputText(session.scannedNumbers.join("\n"));
    setShowSavedSessions(false);
    toast({
      title: "Loaded",
      description: `Session "${session.sessionName || new Date(session.timestamp).toLocaleString()}" loaded.`,
    });
  };

  const handleClear = () => {
    setInputText("");
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTOSAVE_KEY);
    }
    toast({
      title: "Cleared",
      description: "Input cleared and auto-save removed.",
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 flex-wrap p-4 border-b">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Tracking Number Comparison</h2>
              <p className="text-sm text-muted-foreground">
                Paste or scan tracking numbers on the left to compare with database • Auto-saves as you type
              </p>
            </div>
            {inputTrackingNumbers.length > 0 && missingInInput.length === 0 && (
              <Badge variant="default" className="bg-green-600 dark:bg-green-700" data-testid="badge-done">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Done
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSavedSessions(true)}
              data-testid="button-view-sessions"
            >
              <History className="h-4 w-4 mr-1" />
              Saved Sessions ({savedSessions.length})
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-comparison">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-2 gap-4 h-full p-4">
            {/* Left side - Input */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Scanned/Pasted Tracking Numbers</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{inputTrackingNumbers.length} numbers</Badge>
                  {inputTrackingNumbers.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleClear}
                      data-testid="button-clear-input"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              
              <Textarea
                placeholder="Paste or type tracking numbers here (one per line, comma-separated, or space-separated)&#10;Long barcode numbers will be automatically converted to FedEx tracking numbers (last 12 digits)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 font-mono text-sm resize-none"
                data-testid="input-tracking-numbers"
              />

              {inputTrackingNumbers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Numbered Outline</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyFormatted}
                      data-testid="button-copy-formatted"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Formatted
                    </Button>
                  </div>
                  <ScrollArea className="h-40 rounded-md border p-2 bg-muted/20">
                    <pre className="font-mono text-sm whitespace-pre-wrap" data-testid="text-formatted-list">
                      {formattedInputText}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {inputTrackingNumbers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Session name (optional)"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className="flex-1"
                      data-testid="input-session-name"
                    />
                    <Button
                      onClick={handleSaveSession}
                      disabled={saveSessionMutation.isPending}
                      size="sm"
                      variant="outline"
                      data-testid="button-save-session"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saveSessionMutation.isPending ? "Saving..." : "Save Session"}
                    </Button>
                    {foundInInput.length > 0 && missingInInput.length === 0 && (
                      <Button
                        onClick={handleMarkComplete}
                        disabled={markCompletedMutation.isPending}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-mark-complete"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {markCompletedMutation.isPending ? "Completing..." : "Mark Complete"}
                      </Button>
                    )}
                    {missingInInput.length > 0 && (
                      <Button
                        onClick={handleReportMissing}
                        disabled={reportMissingMutation.isPending}
                        size="sm"
                        variant="destructive"
                        data-testid="button-report-missing"
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {reportMissingMutation.isPending ? "Reporting..." : "Report Missing"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {missingInDatabase.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="font-semibold text-sm">Missing in Database ({missingInDatabase.length})</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyMissing}
                      data-testid="button-copy-missing"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Missing
                    </Button>
                  </div>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    <div className="space-y-1">
                      {missingInDatabase.map((parsed, idx) => (
                        <div key={idx} className="font-mono text-sm text-destructive" data-testid={`text-missing-${idx}`}>
                          {parsed.wasExtracted ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs opacity-70">{parsed.original}</span>
                              <span>→ {parsed.extracted}</span>
                            </div>
                          ) : (
                            parsed.extracted
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {inputTrackingNumbers.length > 0 && missingInDatabase.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All scanned tracking numbers found in database!</span>
                </div>
              )}
            </div>

            {/* Right side - Database */}
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold">Database Tracking Numbers</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{allTrackingNumbers.length} numbers</Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCopyAll}
                    data-testid="button-copy-all"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy All
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 rounded-md border p-2 overflow-auto">
                <div className="space-y-1">
                  {allTrackingNumbers.map((num, idx) => {
                    const isInInput = inputTrackingNumbers.includes(num);
                    const isMissingInInput = missingInInput.includes(num);
                    
                    return (
                      <div 
                        key={idx} 
                        className={`font-mono text-sm flex items-center justify-between p-1 rounded ${
                          isMissingInInput && inputTrackingNumbers.length > 0
                            ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-400" 
                            : isInInput 
                            ? "bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-400"
                            : ""
                        }`}
                        data-testid={`text-db-tracking-${idx}`}
                      >
                        <span>{num}</span>
                        {isInInput && inputTrackingNumbers.length > 0 && (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        )}
                        {isMissingInInput && inputTrackingNumbers.length > 0 && (
                          <AlertCircle className="h-3 w-3 text-yellow-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {missingInInput.length > 0 && inputTrackingNumbers.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-yellow-600 flex-shrink-0">
                  <AlertCircle className="h-4 w-4" />
                  <span>{missingInInput.length} tracking number(s) in database but not in your scan</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Saved Sessions Dialog */}
      <Dialog open={showSavedSessions} onOpenChange={setShowSavedSessions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved Scanned Sessions</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {savedSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No saved sessions yet</p>
            ) : (
              <div className="space-y-2">
                {savedSessions.map((session) => (
                  <Card key={session.id} className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {session.sessionName || "Unnamed Session"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.timestamp).toLocaleString()}
                        </p>
                        <Badge variant="secondary" className="mt-2">
                          {session.scannedNumbers.length} tracking numbers
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadSession(session)}
                          data-testid={`button-load-session-${session.id}`}
                        >
                          Load
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSessionMutation.mutate(session.id)}
                          disabled={deleteSessionMutation.isPending}
                          data-testid={`button-delete-session-${session.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
