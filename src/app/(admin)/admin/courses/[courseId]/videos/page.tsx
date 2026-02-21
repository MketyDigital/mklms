"use client";

import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  GripVertical,
  Pencil,
  Trash2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CURRENT_USER = {
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  avatar: undefined,
};

const COURSE = {
  id: "ai-augmented-engineering",
  title: "AI-Augmented Software Engineering",
};

const VIDEOS = [
  {
    id: "1",
    number: 1,
    title: "Why AI-Augmented Engineering?",
    youtubeUrl: "https://youtube.com/watch?v=placeholder1",
    duration: "18 min",
  },
  {
    id: "2",
    number: 2,
    title: "Setting Up Your AI Toolkit",
    youtubeUrl: "https://youtube.com/watch?v=placeholder2",
    duration: "24 min",
  },
  {
    id: "3",
    number: 3,
    title: "AI-Assisted Debugging in Production",
    youtubeUrl: "https://youtube.com/watch?v=placeholder3",
    duration: "32 min",
  },
  {
    id: "4",
    number: 4,
    title: "Prompt Engineering for Code Review",
    youtubeUrl: "https://youtube.com/watch?v=placeholder4",
    duration: "28 min",
  },
  {
    id: "5",
    number: 5,
    title: "Generating Tests with AI",
    youtubeUrl: "https://youtube.com/watch?v=placeholder5",
    duration: "22 min",
  },
  {
    id: "6",
    number: 6,
    title: "AI for Documentation",
    youtubeUrl: "https://youtube.com/watch?v=placeholder6",
    duration: "19 min",
  },
  {
    id: "7",
    number: 7,
    title: "Code Refactoring with AI Assistance",
    youtubeUrl: "https://youtube.com/watch?v=placeholder7",
    duration: "26 min",
  },
  {
    id: "8",
    number: 8,
    title: "Building the Platform: Project Setup",
    youtubeUrl: "https://youtube.com/watch?v=placeholder8",
    duration: "35 min",
  },
  {
    id: "9",
    number: 9,
    title: "Building the Platform: Auth & User Model",
    youtubeUrl: "https://youtube.com/watch?v=placeholder9",
    duration: "41 min",
  },
  {
    id: "10",
    number: 10,
    title: "Building the Platform: Course Management",
    youtubeUrl: "https://youtube.com/watch?v=placeholder10",
    duration: "38 min",
  },
  {
    id: "11",
    number: 11,
    title: "Building the Platform: Video Pages & Q&A",
    youtubeUrl: "https://youtube.com/watch?v=placeholder11",
    duration: "44 min",
  },
  {
    id: "12",
    number: 12,
    title: "Retrospective: What AI Got Right and Wrong",
    youtubeUrl: "https://youtube.com/watch?v=placeholder12",
    duration: "30 min",
  },
];

function AddVideoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Add Video
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Video</DialogTitle>
          <DialogDescription>
            Add a new video to {COURSE.title}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-title">Title</Label>
            <Input id="video-title" placeholder="Video title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-url">YouTube URL</Label>
            <Input
              id="video-url"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-desc">Description</Label>
            <Textarea
              id="video-desc"
              placeholder="What does this video cover?"
              className="min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-resources">
              Resource links (one per line)
            </Label>
            <Textarea
              id="video-resources"
              placeholder={"GitHub Repo | https://github.com/...\nSlides | https://slides.com/..."}
              className="min-h-[60px] resize-none font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Add Video</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminVideoManagementPage() {
  return (
    <AppLayout user={CURRENT_USER} isAdmin={true} unreadMessages={5}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back */}
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
          <Link href="/admin/courses">
            <ArrowLeft className="size-4" />
            All Courses
          </Link>
        </Button>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {COURSE.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {VIDEOS.length} videos · Manage order and content
            </p>
          </div>
          <AddVideoDialog />
        </div>

        <div className="mt-8 space-y-2">
          {VIDEOS.map((video) => (
            <Card key={video.id} className="py-0">
              <CardContent className="flex items-center gap-3 px-3 py-3">
                <GripVertical className="size-4 shrink-0 text-muted-foreground cursor-grab" />
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {video.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{video.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {video.duration}
                  </p>
                </div>
                <a
                  href={video.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden text-muted-foreground hover:text-foreground sm:block"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <Trash2 />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
