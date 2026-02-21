import Link from "next/link";
import {
  PlayCircle,
  Video,
  Users,
  MessageCircle,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const courses = [
  {
    id: "ai-augmented-engineering",
    title: "AI-Augmented Software Engineering",
    description:
      "Using AI tools in real production workflows — not toy demos, but actual engineering practices.",
    videoCount: 12,
  },
  {
    id: "deep-nodejs",
    title: "Deep Node.js",
    description:
      "Internals, event loop, streams, and production debugging. The stuff that separates juniors from seniors.",
    videoCount: 8,
  },
  {
    id: "software-architecture",
    title: "Software Architecture Fundamentals",
    description:
      "Design patterns, system design, and understanding trade-offs in real systems.",
    videoCount: 6,
    inProgress: true,
  },
];

const benefits = [
  {
    icon: PlayCircle,
    title: "Video Library",
    description:
      "A growing library of production-focused content. No filler, no fluff — just real engineering.",
  },
  {
    icon: Video,
    title: "Live Sessions",
    description:
      "Bi-weekly Friday sessions with real Q&A and screen sharing. Ask anything.",
  },
  {
    icon: Users,
    title: "Private Community",
    description:
      "Telegram group with topic threads per course. Learn alongside other serious engineers.",
  },
  {
    icon: MessageCircle,
    title: "Direct Access",
    description:
      "1:1 messaging with the mentor for career advice, code reviews, and support.",
  },
];

const faqs = [
  {
    question: "What exactly is Foyzul's Circle?",
    answer:
      "It's a small, membership-based mentoring community for Bangladeshi software engineers. You get access to a growing video library, bi-weekly live sessions, a private Telegram group, and direct messaging with a senior engineer. Think of it as having a mentor on retainer — not a course platform.",
  },
  {
    question: "How do I pay?",
    answer:
      "Payment is via bKash or Nagad. After signing in with Google, you'll message the admin directly to arrange payment. It's simple and personal — no complex payment gateway.",
  },
  {
    question: "What if I miss a live session?",
    answer:
      "All live sessions are recorded and added to the video library. You can watch them anytime. The Telegram group also has discussion threads for each session.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. There are no contracts, no lock-in periods. If you stop paying, your access pauses. If you come back, you pick up where you left off.",
  },
  {
    question: "What courses are available?",
    answer:
      "Currently: AI-Augmented Software Engineering (12 videos), Deep Node.js (8 videos), and Software Architecture Fundamentals (6 videos, in progress). New content is added regularly based on what members want to learn.",
  },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Foyzul&apos;s Circle
          </Link>
          <Button size="sm" asChild>
            <Link href="/dashboard">
              <GoogleIcon />
              Join with Google
            </Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Join my circle of
              <br />
              engineers who ship.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
              A mentoring community for Bangladeshi software engineers.
              Production-focused content, live sessions, and direct access to a
              senior engineer — not another course platform.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button size="lg" className="text-base" asChild>
                <Link href="/dashboard">
                  <GoogleIcon />
                  Join with Google
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              45+ engineers already learning together
            </p>
          </div>
        </section>

        {/* What Members Get */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What members get
            </h2>
            <p className="mt-2 text-muted-foreground">
              Everything you need to grow as an engineer, in one place.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <Card key={benefit.title} className="border-0 shadow-none bg-background">
                  <CardHeader>
                    <benefit.icon className="size-5 text-muted-foreground" />
                    <CardTitle className="text-base">{benefit.title}</CardTitle>
                    <CardDescription>{benefit.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Course Preview */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Course library
            </h2>
            <p className="mt-2 text-muted-foreground">
              Browse the courses. Sign in to start watching.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="group"
                >
                  <Card className="h-full transition-colors group-hover:border-foreground/20">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {course.title}
                        </CardTitle>
                        <Lock className="size-4 text-muted-foreground shrink-0" />
                      </div>
                      <CardDescription>{course.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <PlayCircle className="size-4" />
                        <span>
                          {course.videoCount} videos
                          {course.inProgress && " · In progress"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Lock className="mb-0.5 inline size-3" /> Sign in to watch
              videos
            </p>
          </div>
        </section>

        {/* About the Mentor */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              About the mentor
            </h2>
            <div className="mt-8 max-w-2xl">
              <p className="text-lg font-medium">Foyzul Karim</p>
              <p className="text-sm text-muted-foreground">
                Senior Software Engineer · 15+ years · Melbourne, Australia
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                I&apos;ve spent over 15 years building software — from startups
                in Dhaka to enterprise systems in Australia. I created this
                community because I wish I&apos;d had someone to learn from
                directly when I was starting out. No fluff, no gatekeeping —
                just honest, production-focused engineering knowledge shared
                with engineers who are serious about getting better.
              </p>
              <p className="mt-4 text-sm italic text-muted-foreground">
                &ldquo;The best way to learn engineering is to build with
                someone who&apos;s already built.&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-md text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Simple pricing
              </h2>
              <p className="mt-2 text-muted-foreground">
                One membership, everything included.
              </p>
              <Card className="mt-8">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">
                    ৳200–400
                    <span className="text-base font-normal text-muted-foreground">
                      /month
                    </span>
                  </CardTitle>
                  <CardDescription>via bKash or Nagad</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-left text-sm">
                    {[
                      "All courses and video content",
                      "Bi-weekly live sessions",
                      "Private Telegram community",
                      "Direct messaging with mentor",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Cancel anytime. No contracts.
                  </p>
                  <Button className="mt-6 w-full text-base" size="lg" asChild>
                    <Link href="/dashboard">
                      <GoogleIcon />
                      Join with Google
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="mt-8 max-w-2xl">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Foyzul&apos;s Circle
          </p>
          <div className="flex gap-4">
            <a
              href="https://t.me/foyzulkarim"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Telegram
            </a>
            <a
              href="https://linkedin.com/in/foyzulkarim"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
