"use client";

import Link from "next/link";
import { MoreHorizontal, Video, Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CourseWithProgress } from "@/types";

const statusVariant: Record<
  "published" | "draft" | "in_progress",
  "default" | "secondary"
> = {
  published: "default",
  draft: "secondary",
  in_progress: "secondary",
};

const statusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  in_progress: "In progress",
};

export function AdminCourseList({
  courses,
}: {
  courses: CourseWithProgress[];
}) {
  return (
    <div className="mt-8 space-y-4">
      {courses.map((course) => (
        <Card key={course.id}>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{course.title}</CardTitle>
                <Badge
                  variant={statusVariant[course.status] ?? "secondary"}
                  className="capitalize"
                >
                  {statusLabel[course.status] ?? course.status}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {course.description}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" className="shrink-0">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Pencil />
                  Edit course
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Archive />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {course.totalVideos} videos
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/courses/${course.id}/videos`}>
                  <Video className="size-3.5" />
                  Manage Videos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
