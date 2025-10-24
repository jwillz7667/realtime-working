"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Check, Edit2 } from "lucide-react";
import type { InstructionPrompt } from "@/lib/supabase";

interface SavedPromptsProps {
  onSelectPrompt?: (instructions: string) => void;
}

export default function SavedPrompts({ onSelectPrompt }: SavedPromptsProps) {
  const [prompts, setPrompts] = useState<InstructionPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<InstructionPrompt | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    instructions: "",
    is_default: false,
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/prompts");
      const data = await response.json();

      if (response.ok) {
        setPrompts(data.prompts || []);
      } else {
        console.error("Failed to fetch prompts:", data.error);
      }
    } catch (error) {
      console.error("Error fetching prompts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingPrompt ? "/api/prompts" : "/api/prompts";
      const method = editingPrompt ? "PATCH" : "POST";
      const body = editingPrompt
        ? { id: editingPrompt.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchPrompts();
        setIsDialogOpen(false);
        setEditingPrompt(null);
        setFormData({ name: "", instructions: "", is_default: false });
      } else {
        const data = await response.json();
        console.error("Failed to save prompt:", data.error);
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      alert("Failed to save prompt");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      const response = await fetch(`/api/prompts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPrompts();
      } else {
        const data = await response.json();
        console.error("Failed to delete prompt:", data.error);
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting prompt:", error);
      alert("Failed to delete prompt");
    }
  };

  const handleEdit = (prompt: InstructionPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      instructions: prompt.instructions,
      is_default: prompt.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingPrompt(null);
    setFormData({ name: "", instructions: "", is_default: false });
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Saved Prompts</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleNew}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPrompt ? "Edit Prompt" : "New Prompt"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Customer Service Agent"
                  />
                </div>
                <div>
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                    placeholder="Enter the system instructions..."
                    rows={8}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_default: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_default" className="cursor-pointer">
                    Set as default prompt
                  </Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </div>
        ) : prompts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No saved prompts
          </div>
        ) : (
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{prompt.name}</span>
                      {prompt.is_default && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {prompt.instructions}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {onSelectPrompt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectPrompt(prompt.instructions)}
                        title="Use this prompt"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(prompt)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(prompt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
