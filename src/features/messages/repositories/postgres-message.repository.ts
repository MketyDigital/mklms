import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { getPostgresPool } from "@/lib/postgres";

export interface MessageRecord {
  id: string;
  threadId: string;
  senderRole: "STUDENT" | "ADMIN";
  senderName: string;
  text: string;
  timestamp: string;
  contextType?: string | null;
  contextId?: string | null;
}

export interface MessageThreadRecord {
  id: string;
  studentId: string;
  studentName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export class PostgresMessageRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPostgresPool()) {
    this.pool = pool;
  }

  async getOrCreateThread(studentId: string): Promise<string> {
    const existing = await this.pool.query<{ id: string }>(
      `SELECT id FROM message_threads WHERE student_id = $1 LIMIT 1`,
      [studentId],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const id = randomUUID();
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO message_threads (id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [id, studentId],
    );
    return result.rows[0].id;
  }

  async listStudentMessages(studentId: string): Promise<MessageRecord[]> {
    const result = await this.pool.query<{
      id: string;
      thread_id: string;
      sender_role: "STUDENT" | "ADMIN";
      sender_name_snapshot: string;
      text: string;
      context_type: string | null;
      context_id: string | null;
      created_at: Date;
    }>(
      `SELECT message.id, message.thread_id, message.sender_role,
              message.sender_name_snapshot, message.text,
              message.context_type, message.context_id, message.created_at
       FROM messages message
       JOIN message_threads thread ON thread.id = message.thread_id
       WHERE thread.student_id = $1
       ORDER BY message.created_at ASC`,
      [studentId],
    );

    await this.pool.query(
      `UPDATE messages message
       SET read_by_student_at = COALESCE(read_by_student_at, NOW())
       FROM message_threads thread
       WHERE message.thread_id = thread.id
         AND thread.student_id = $1
         AND message.sender_role = 'ADMIN'`,
      [studentId],
    );

    return result.rows.map((row) => this.mapMessage(row));
  }

  async sendStudentMessage(
    studentId: string,
    senderName: string,
    text: string,
  ): Promise<MessageRecord> {
    const threadId = await this.getOrCreateThread(studentId);
    return this.insertMessage({
      threadId,
      senderRole: "STUDENT",
      senderName,
      text,
      readByStudent: true,
    });
  }

  async sendAdminMessage(
    studentId: string,
    senderName: string,
    text: string,
    context?: { type?: string | null; id?: string | null },
  ): Promise<MessageRecord> {
    const threadId = await this.getOrCreateThread(studentId);
    return this.insertMessage({
      threadId,
      senderRole: "ADMIN",
      senderName,
      text,
      contextType: context?.type ?? null,
      contextId: context?.id ?? null,
      readByAdmin: true,
    });
  }

  async listThreads(): Promise<MessageThreadRecord[]> {
    const result = await this.pool.query<{
      id: string;
      student_id: string;
      student_name: string;
      last_message: string | null;
      last_message_at: Date | null;
      unread: boolean;
    }>(
      `SELECT thread.id, thread.student_id,
              student.display_name AS student_name,
              last_message.text AS last_message,
              last_message.created_at AS last_message_at,
              EXISTS (
                SELECT 1 FROM messages unread
                WHERE unread.thread_id = thread.id
                  AND unread.sender_role = 'STUDENT'
                  AND unread.read_by_admin_at IS NULL
              ) AS unread
       FROM message_threads thread
       JOIN students student ON student.id = thread.student_id
       LEFT JOIN LATERAL (
         SELECT text, created_at
         FROM messages
         WHERE thread_id = thread.id
         ORDER BY created_at DESC
         LIMIT 1
       ) last_message ON TRUE
       ORDER BY COALESCE(last_message.created_at, thread.updated_at) DESC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      lastMessage: row.last_message ?? "No messages yet.",
      lastMessageAt: (row.last_message_at ?? new Date()).toISOString(),
      unread: row.unread,
    }));
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    const result = await this.pool.query<{
      id: string;
      thread_id: string;
      sender_role: "STUDENT" | "ADMIN";
      sender_name_snapshot: string;
      text: string;
      context_type: string | null;
      context_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, thread_id, sender_role, sender_name_snapshot,
              text, context_type, context_id, created_at
       FROM messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId],
    );

    await this.pool.query(
      `UPDATE messages
       SET read_by_admin_at = COALESCE(read_by_admin_at, NOW())
       WHERE thread_id = $1 AND sender_role = 'STUDENT'`,
      [threadId],
    );

    return result.rows.map((row) => this.mapMessage(row));
  }

  async sendAdminReply(
    threadId: string,
    senderName: string,
    text: string,
  ): Promise<MessageRecord> {
    return this.insertMessage({
      threadId,
      senderRole: "ADMIN",
      senderName,
      text,
      readByAdmin: true,
    });
  }

  async getStudentIdForThread(threadId: string): Promise<string | null> {
    const result = await this.pool.query<{ student_id: string }>(
      `SELECT student_id FROM message_threads WHERE id = $1 LIMIT 1`,
      [threadId],
    );
    return result.rows[0]?.student_id ?? null;
  }

  private async insertMessage(input: {
    threadId: string;
    senderRole: "STUDENT" | "ADMIN";
    senderName: string;
    text: string;
    contextType?: string | null;
    contextId?: string | null;
    readByStudent?: boolean;
    readByAdmin?: boolean;
  }): Promise<MessageRecord> {
    const result = await this.pool.query<{
      id: string;
      thread_id: string;
      sender_role: "STUDENT" | "ADMIN";
      sender_name_snapshot: string;
      text: string;
      context_type: string | null;
      context_id: string | null;
      created_at: Date;
    }>(
      `INSERT INTO messages (
         id, thread_id, sender_role, sender_name_snapshot, text,
         context_type, context_id, read_by_student_at, read_by_admin_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               CASE WHEN $8 THEN NOW() ELSE NULL END,
               CASE WHEN $9 THEN NOW() ELSE NULL END)
       RETURNING id, thread_id, sender_role, sender_name_snapshot,
                 text, context_type, context_id, created_at`,
      [
        randomUUID(),
        input.threadId,
        input.senderRole,
        input.senderName.trim(),
        input.text.trim(),
        input.contextType ?? null,
        input.contextId ?? null,
        input.readByStudent ?? false,
        input.readByAdmin ?? false,
      ],
    );
    return this.mapMessage(result.rows[0]);
  }

  private mapMessage(row: {
    id: string;
    thread_id: string;
    sender_role: "STUDENT" | "ADMIN";
    sender_name_snapshot: string;
    text: string;
    context_type: string | null;
    context_id: string | null;
    created_at: Date;
  }): MessageRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      senderRole: row.sender_role,
      senderName: row.sender_name_snapshot,
      text: row.text,
      timestamp: row.created_at.toISOString(),
      contextType: row.context_type,
      contextId: row.context_id,
    };
  }
}
