"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export function CreateCourseDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New Course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Course</DialogTitle>
          <DialogDescription>
            Add a new course to the platform.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-title">Title</Label>
            <Input id="new-title" placeholder="Course title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-desc">Description</Label>
            <Textarea
              id="new-desc"
              placeholder="What will members learn?"
              className="min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
