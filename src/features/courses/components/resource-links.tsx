import { ExternalLink } from "lucide-react";
import type { Resource } from "@/types";

export function ResourceLinks({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium">Resources</h3>
      <ul className="mt-2 space-y-1.5">
        {resources.map((resource) => (
          <li key={resource.url}>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              {resource.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
