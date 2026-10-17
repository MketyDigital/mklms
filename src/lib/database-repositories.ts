import type { Pool } from "pg";
import { D1AccessRepository } from "@/features/access/repositories/d1-access.repository";
import { D1AdminAccessRepository } from "@/features/access/repositories/d1-admin-access.repository";
import { PostgresAccessRepository } from "@/features/access/repositories/postgres-access.repository";
import { PostgresAdminAccessRepository } from "@/features/access/repositories/postgres-admin-access.repository";
import { D1CertificateTemplateRepository } from "@/features/certificates/repositories/d1-certificate-template.repository";
import { D1CertificateRepository } from "@/features/certificates/repositories/d1-certificate.repository";
import { PostgresCertificateTemplateRepository } from "@/features/certificates/repositories/postgres-certificate-template.repository";
import { PostgresCertificateRepository } from "@/features/certificates/repositories/postgres-certificate.repository";
import { D1AdminLearningRepository } from "@/features/courses/repositories/d1-admin-learning.repository";
import { D1CourseAudienceRepository } from "@/features/courses/repositories/d1-course-audience.repository";
import { D1LearningRepository } from "@/features/courses/repositories/d1-learning.repository";
import { PostgresAdminLearningRepository } from "@/features/courses/repositories/postgres-admin-learning.repository";
import { PostgresCourseAudienceRepository } from "@/features/courses/repositories/postgres-course-audience.repository";
import { PostgresLearningRepository } from "@/features/courses/repositories/postgres-learning.repository";
import { D1ManagedHostingLedgerRepository } from "@/features/hosting/repositories/d1-managed-hosting-ledger.repository";
import { D1ManagedHostingRepository } from "@/features/hosting/repositories/d1-managed-hosting.repository";
import { PostgresManagedHostingLedgerRepository } from "@/features/hosting/repositories/postgres-managed-hosting-ledger.repository";
import { PostgresManagedHostingRepository } from "@/features/hosting/repositories/postgres-managed-hosting.repository";
import { D1AdminLiveClassRepository } from "@/features/live-classes/repositories/d1-admin-live-class.repository";
import { D1LiveClassRepository } from "@/features/live-classes/repositories/d1-live-class.repository";
import { PostgresAdminLiveClassRepository } from "@/features/live-classes/repositories/postgres-admin-live-class.repository";
import { PostgresLiveClassRepository } from "@/features/live-classes/repositories/postgres-live-class.repository";
import { D1AdminMediaRepository } from "@/features/media/repositories/d1-admin-media.repository";
import { D1MediaIngestRepository } from "@/features/media/repositories/d1-media-ingest.repository";
import { D1MediaPlaybackRepository } from "@/features/media/repositories/d1-media-playback.repository";
import { PostgresAdminMediaRepository } from "@/features/media/repositories/postgres-admin-media.repository";
import { PostgresMediaIngestRepository } from "@/features/media/repositories/postgres-media-ingest.repository";
import { PostgresMediaPlaybackRepository } from "@/features/media/repositories/postgres-media-playback.repository";
import { PostgresVideoProgressRepository } from "@/features/media/repositories/postgres-video-progress.repository";
import { D1MessageRepository } from "@/features/messages/repositories/d1-message.repository";
import { PostgresMessageRepository } from "@/features/messages/repositories/postgres-message.repository";
import { D1PaidLiveRepository } from "@/features/paid-live/repositories/d1-paid-live.repository";
import { PostgresPaidLiveRepository } from "@/features/paid-live/repositories/postgres-paid-live.repository";
import { D1QuizRepository } from "@/features/quizzes/repositories/d1-quiz.repository";
import { PostgresQuizRepository } from "@/features/quizzes/repositories/postgres-quiz.repository";
import { D1SettingsRepository } from "@/features/settings/repositories/d1-settings.repository";
import { PostgresSettingsRepository } from "@/features/settings/repositories/postgres-settings.repository";
import { withReplicationCaptureBatch, type D1DatabaseLike } from "@/lib/d1-query-adapter";
import { createRepositorySetForBackend, type RepositoryFactoryMap } from "@/lib/repository-composition";

const repositoryFactories = {
  access: { postgresql: (pool: Pool) => new PostgresAccessRepository(pool), d1: (db: D1DatabaseLike) => new D1AccessRepository(db) },
  adminAccess: { postgresql: (pool: Pool) => new PostgresAdminAccessRepository(pool), d1: (db: D1DatabaseLike) => new D1AdminAccessRepository(db) },
  certificateTemplates: { postgresql: (pool: Pool) => new PostgresCertificateTemplateRepository(pool), d1: (db: D1DatabaseLike) => new D1CertificateTemplateRepository(db) },
  certificates: { postgresql: (pool: Pool) => new PostgresCertificateRepository(pool), d1: (db: D1DatabaseLike) => new D1CertificateRepository(db) },
  adminLearning: { postgresql: (pool: Pool) => new PostgresAdminLearningRepository(pool), d1: (db: D1DatabaseLike) => new D1AdminLearningRepository(db) },
  courseAudience: { postgresql: (pool: Pool) => new PostgresCourseAudienceRepository(pool), d1: (db: D1DatabaseLike) => new D1CourseAudienceRepository(db) },
  learning: { postgresql: (pool: Pool) => new PostgresLearningRepository(pool), d1: (db: D1DatabaseLike) => new D1LearningRepository(db) },
  hosting: { postgresql: (pool: Pool) => new PostgresManagedHostingRepository(pool), d1: (db: D1DatabaseLike) => new D1ManagedHostingRepository(db) },
  hostingLedger: { postgresql: (pool: Pool) => new PostgresManagedHostingLedgerRepository(pool), d1: (db: D1DatabaseLike) => new D1ManagedHostingLedgerRepository(db) },
  adminLiveClass: { postgresql: (pool: Pool) => new PostgresAdminLiveClassRepository(pool), d1: (db: D1DatabaseLike) => new D1AdminLiveClassRepository(db) },
  liveClass: { postgresql: (pool: Pool) => new PostgresLiveClassRepository(pool), d1: (db: D1DatabaseLike) => new D1LiveClassRepository(db) },
  adminMedia: { postgresql: (pool: Pool) => new PostgresAdminMediaRepository(pool), d1: (db: D1DatabaseLike) => new D1AdminMediaRepository(db) },
  mediaIngest: { postgresql: (pool: Pool) => new PostgresMediaIngestRepository(pool), d1: (db: D1DatabaseLike) => new D1MediaIngestRepository(db) },
  mediaPlayback: { postgresql: (pool: Pool) => new PostgresMediaPlaybackRepository(pool), d1: (db: D1DatabaseLike) => new D1MediaPlaybackRepository(db) },
  videoProgress: { postgresql: (pool: Pool) => new PostgresVideoProgressRepository(pool), d1: (db: D1DatabaseLike) => new D1MediaPlaybackRepository(db) },
  messages: { postgresql: (pool: Pool) => new PostgresMessageRepository(pool), d1: (db: D1DatabaseLike) => new D1MessageRepository(db) },
  paidLive: { postgresql: (pool: Pool) => new PostgresPaidLiveRepository(pool), d1: (db: D1DatabaseLike) => new D1PaidLiveRepository(db) },
  quizzes: { postgresql: (pool: Pool) => new PostgresQuizRepository(pool), d1: (db: D1DatabaseLike) => new D1QuizRepository(db) },
  settings: { postgresql: (pool: Pool) => new PostgresSettingsRepository(pool), d1: (db: D1DatabaseLike) => new D1SettingsRepository(db) },
} satisfies RepositoryFactoryMap<Pool, D1DatabaseLike>;

export type DatabaseRepositories = {
  [Key in keyof typeof repositoryFactories]:
    | ReturnType<(typeof repositoryFactories)[Key]["postgresql"]>
    | ReturnType<(typeof repositoryFactories)[Key]["d1"]>;
};

/**
 * Constructs every repository against one explicitly selected backend.
 * This is a construction boundary only, not a writer-authority gate; keep it
 * out of runtime routes until installation authority and schema verification
 * are provided by the durable control plane.
 */
export function createDatabaseRepositories(
  backend: string,
  dependencies: { postgresPool?: Pool; d1?: D1DatabaseLike },
): DatabaseRepositories {
  const replicationAwareD1 = backend === "d1" && dependencies.d1
    ? withReplicationCaptureBatch(dependencies.d1, () => globalThis.crypto.randomUUID())
    : dependencies.d1;
  return createRepositorySetForBackend(
    backend,
    { ...dependencies, d1: replicationAwareD1 },
    repositoryFactories,
  ) as DatabaseRepositories;
}
