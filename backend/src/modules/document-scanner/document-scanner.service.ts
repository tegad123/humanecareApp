import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { ReadyToStaffService } from '../clinicians/ready-to-staff.service.js';
import { AiScannerService } from './ai-scanner.service.js';
import { CreateBulkUploadDto } from './dto/create-bulk-upload.dto.js';
import { UpdateDocumentMatchDto } from './dto/update-document-match.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentScannerService {
  private readonly logger = new Logger(DocumentScannerService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private auditLogs: AuditLogsService,
    private aiScanner: AiScannerService,
    @Inject(forwardRef(() => ReadyToStaffService))
    private readyToStaff: ReadyToStaffService,
  ) {}

  async createBulkUpload(dto: CreateBulkUploadDto, user: AuthenticatedUser) {
    const job = await this.prisma.bulkUploadJob.create({
      data: {
        organizationId: user.organizationId,
        createdByUserId: user.id,
        status: 'pending',
        totalFiles: dto.files.length,
      },
    });

    const documents: Array<{ docId: string; uploadUrl: string; key: string }> = [];

    for (const file of dto.files) {
      const docId = randomUUID();
      const key = `${user.organizationId}/bulk-uploads/${job.id}/${docId}-${file.fileName}`;

      const { url } = await this.storage.getUploadUrlForKey(key, file.contentType);

      await this.prisma.bulkUploadDocument.create({
        data: {
          id: docId,
          bulkUploadJobId: job.id,
          organizationId: user.organizationId,
          storagePath: key,
          originalFileName: file.fileName,
          mimeType: file.contentType,
          status: 'pending_upload',
        },
      });

      documents.push({ docId, uploadUrl: url, key });
    }

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'bulk_upload_job',
      entityId: job.id,
      action: 'bulk_upload_created',
      details: { totalFiles: dto.files.length },
    });

    return { jobId: job.id, documents };
  }

  async confirmUploads(jobId: string, user: AuthenticatedUser) {
    const job = await this.prisma.bulkUploadJob.findFirst({
      where: { id: jobId, organizationId: user.organizationId },
    });
    if (!job) throw new NotFoundException('Bulk upload job not found');
    if (job.status !== 'pending') {
      throw new BadRequestException(`Job is in '${job.status}' state, expected 'pending'`);
    }

    // Mark all pending_upload docs as uploaded
    await this.prisma.bulkUploadDocument.updateMany({
      where: { bulkUploadJobId: jobId, status: 'pending_upload' },
      data: { status: 'uploaded' },
    });

    await this.prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: { status: 'scanning' },
    });

    // Kick off async scanning
    this.processScanJob(jobId, user.organizationId).catch((err) => {
      this.logger.error(`Scan job ${jobId} failed: ${err.message}`);
    });

    return this.getJob(jobId, user);
  }

  async getJob(jobId: string, user: AuthenticatedUser) {
    const job = await this.prisma.bulkUploadJob.findFirst({
      where: { id: jobId, organizationId: user.organizationId },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!job) throw new NotFoundException('Bulk upload job not found');
    return job;
  }

  async listJobs(user: AuthenticatedUser) {
    return this.prisma.bulkUploadJob.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { documents: true } },
      },
    });
  }

  async updateDocumentMatch(
    jobId: string,
    docId: string,
    dto: UpdateDocumentMatchDto,
    user: AuthenticatedUser,
  ) {
    const doc = await this.prisma.bulkUploadDocument.findFirst({
      where: { id: docId, bulkUploadJobId: jobId, organizationId: user.organizationId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    // If clinician + item definition are both set, resolve the checklist item ID
    let matchedChecklistItemId: string | undefined;
    if (dto.matchedClinicianId && dto.matchedItemDefinitionId) {
      const item = await this.prisma.clinicianChecklistItem.findFirst({
        where: {
          clinicianId: dto.matchedClinicianId,
          itemDefinitionId: dto.matchedItemDefinitionId,
          organizationId: user.organizationId,
        },
      });
      if (item) matchedChecklistItemId = item.id;
    }

    const data: Record<string, any> = {};
    if (dto.matchedClinicianId !== undefined) data.matchedClinicianId = dto.matchedClinicianId;
    if (dto.matchedItemDefinitionId !== undefined) data.matchedItemDefinitionId = dto.matchedItemDefinitionId;
    if (dto.confirmedExpiration !== undefined) data.confirmedExpiration = new Date(dto.confirmedExpiration);
    if (dto.confirmedDocType !== undefined) data.confirmedDocType = dto.confirmedDocType;
    if (dto.status !== undefined) data.status = dto.status;
    if (matchedChecklistItemId) data.matchedChecklistItemId = matchedChecklistItemId;

    return this.prisma.bulkUploadDocument.update({
      where: { id: docId },
      data,
    });
  }

  async commitBulkUpload(jobId: string, user: AuthenticatedUser) {
    const job = await this.prisma.bulkUploadJob.findFirst({
      where: { id: jobId, organizationId: user.organizationId },
      include: { documents: true },
    });
    if (!job) throw new NotFoundException('Bulk upload job not found');

    const matchedDocs = job.documents.filter((d) => d.status === 'matched');
    if (matchedDocs.length === 0) {
      throw new BadRequestException('No matched documents to commit');
    }

    let committedCount = 0;
    let failedCount = 0;
    const affectedClinicianIds = new Set<string>();

    for (const doc of matchedDocs) {
      try {
        if (!doc.matchedChecklistItemId) {
          // Try to resolve from clinician + item definition
          if (doc.matchedClinicianId && doc.matchedItemDefinitionId) {
            const item = await this.prisma.clinicianChecklistItem.findFirst({
              where: {
                clinicianId: doc.matchedClinicianId,
                itemDefinitionId: doc.matchedItemDefinitionId,
                organizationId: user.organizationId,
              },
            });
            if (item) {
              doc.matchedChecklistItemId = item.id;
            }
          }
        }

        if (!doc.matchedChecklistItemId || !doc.matchedClinicianId) {
          await this.prisma.bulkUploadDocument.update({
            where: { id: doc.id },
            data: { status: 'failed', errorMessage: 'Missing clinician or checklist item match' },
          });
          failedCount++;
          continue;
        }

        // Update the checklist item
        await this.prisma.clinicianChecklistItem.update({
          where: { id: doc.matchedChecklistItemId },
          data: {
            docStoragePath: doc.storagePath,
            docOriginalName: doc.originalFileName,
            docMimeType: doc.mimeType,
            expiresAt: doc.confirmedExpiration || doc.aiExtractedExpiration,
            extractedExpirationDate: doc.aiExtractedExpiration,
            aiConfidence: doc.aiConfidence,
            docType: doc.confirmedDocType || doc.aiExtractedDocType,
            status: 'approved',
            reviewedById: user.id,
            reviewedAt: new Date(),
          },
        });

        await this.prisma.bulkUploadDocument.update({
          where: { id: doc.id },
          data: { status: 'committed' },
        });

        affectedClinicianIds.add(doc.matchedClinicianId);

        await this.auditLogs.log({
          organizationId: user.organizationId,
          actorUserId: user.id,
          actorRole: user.role,
          clinicianId: doc.matchedClinicianId,
          entityType: 'checklist_item',
          entityId: doc.matchedChecklistItemId,
          action: 'bulk_upload_committed',
          details: {
            bulkUploadJobId: jobId,
            documentId: doc.id,
            fileName: doc.originalFileName,
            docType: doc.confirmedDocType || doc.aiExtractedDocType,
            expiration: (doc.confirmedExpiration || doc.aiExtractedExpiration)?.toISOString() || null,
            aiConfidence: doc.aiConfidence ? Number(doc.aiConfidence) : null,
          },
        });

        committedCount++;
      } catch (err: any) {
        this.logger.error(`Failed to commit doc ${doc.id}: ${err.message}`);
        await this.prisma.bulkUploadDocument.update({
          where: { id: doc.id },
          data: { status: 'failed', errorMessage: err.message },
        });
        failedCount++;
      }
    }

    // Recompute ready-to-staff for all affected clinicians
    for (const clinicianId of affectedClinicianIds) {
      try {
        await this.readyToStaff.computeStatus(clinicianId, user.organizationId);
      } catch (err: any) {
        this.logger.error(`Failed to recompute status for clinician ${clinicianId}: ${err.message}`);
      }
    }

    await this.prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        committedFiles: committedCount,
        failedFiles: job.failedFiles + failedCount,
        completedAt: new Date(),
      },
    });

    return this.getJob(jobId, user);
  }

  // ── Async scan processing ────────────────────────────────

  private async processScanJob(jobId: string, organizationId: string) {
    this.logger.log(`Starting scan job ${jobId}`);

    // Fetch org context for matching
    const [clinicians, templates] = await Promise.all([
      this.prisma.clinician.findMany({
        where: { organizationId },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.checklistItemDefinition.findMany({
        where: {
          template: { organizationId },
          type: 'file_upload',
          hasExpiration: true,
          enabled: true,
        },
        select: { id: true, label: true, templateId: true },
      }),
    ]);

    const clinicianNames = clinicians.map((c) => `${c.firstName} ${c.lastName}`);
    const docTypeLabels = templates.map((t) => t.label);

    const docs = await this.prisma.bulkUploadDocument.findMany({
      where: { bulkUploadJobId: jobId, status: 'uploaded' },
    });

    let processedCount = 0;

    for (const doc of docs) {
      try {
        await this.prisma.bulkUploadDocument.update({
          where: { id: doc.id },
          data: { status: 'scanning' },
        });

        // Download file from S3
        const file = await this.storage.getFile(doc.storagePath);
        let fileBase64: string;
        let scanMimeType = doc.mimeType;

        // For PDFs, convert first page to image
        if (doc.mimeType === 'application/pdf') {
          const pdfImage = await this.convertPdfToImage(file.buffer);
          if (pdfImage) {
            fileBase64 = pdfImage.base64;
            scanMimeType = 'image/png';
          } else {
            // If conversion fails, mark as failed
            await this.prisma.bulkUploadDocument.update({
              where: { id: doc.id },
              data: { status: 'failed', errorMessage: 'PDF conversion failed' },
            });
            processedCount++;
            continue;
          }
        } else {
          fileBase64 = file.buffer.toString('base64');
        }

        const result = await this.aiScanner.analyzeDocument({
          fileBase64,
          mimeType: scanMimeType,
          fileName: doc.originalFileName,
          knownDocTypes: docTypeLabels,
          knownClinicianNames: clinicianNames,
        });

        // Auto-match clinician by name
        let matchedClinicianId: string | null = null;
        if (result.clinicianName) {
          const match = this.fuzzyMatchClinician(result.clinicianName, clinicians);
          if (match) matchedClinicianId = match.id;
        }

        // Auto-match item definition by doc type
        let matchedItemDefId: string | null = null;
        if (result.docType) {
          const match = this.fuzzyMatchDocType(result.docType, templates);
          if (match) matchedItemDefId = match.id;
        }

        // Resolve checklist item if both matched
        let matchedChecklistItemId: string | null = null;
        if (matchedClinicianId && matchedItemDefId) {
          const item = await this.prisma.clinicianChecklistItem.findFirst({
            where: {
              clinicianId: matchedClinicianId,
              itemDefinitionId: matchedItemDefId,
              organizationId,
            },
          });
          if (item) matchedChecklistItemId = item.id;
        }

        const autoMatched = result.confidence >= 0.85 && matchedClinicianId && matchedItemDefId;

        await this.prisma.bulkUploadDocument.update({
          where: { id: doc.id },
          data: {
            status: autoMatched ? 'matched' : 'scanned',
            aiExtractedDocType: result.docType,
            aiExtractedExpiration: result.expirationDate ? new Date(result.expirationDate) : null,
            aiConfidence: result.confidence,
            aiExtractedClinicianName: result.clinicianName,
            aiRawResponse: result.rawResponse,
            matchedClinicianId,
            matchedItemDefinitionId: matchedItemDefId,
            matchedChecklistItemId,
            confirmedExpiration: result.expirationDate ? new Date(result.expirationDate) : null,
            confirmedDocType: result.docType,
          },
        });
      } catch (err: any) {
        this.logger.error(`Scan failed for doc ${doc.id}: ${err.message}`);
        await this.prisma.bulkUploadDocument.update({
          where: { id: doc.id },
          data: { status: 'failed', errorMessage: err.message },
        });
      }

      processedCount++;
      await this.prisma.bulkUploadJob.update({
        where: { id: jobId },
        data: { processedFiles: processedCount },
      });
    }

    // Count matched
    const matchedCount = await this.prisma.bulkUploadDocument.count({
      where: { bulkUploadJobId: jobId, status: { in: ['matched', 'scanned'] } },
    });

    const failedCount = await this.prisma.bulkUploadDocument.count({
      where: { bulkUploadJobId: jobId, status: 'failed' },
    });

    await this.prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: 'review',
        processedFiles: processedCount,
        matchedFiles: matchedCount,
        failedFiles: failedCount,
      },
    });

    this.logger.log(`Scan job ${jobId} complete: ${processedCount} processed, ${matchedCount} matched`);
  }

  private async convertPdfToImage(
    pdfBuffer: Buffer,
  ): Promise<{ base64: string } | null> {
    try {
      const { pdf } = await import('pdf-to-img');
      const document = await pdf(pdfBuffer, { scale: 2 });
      // Get just the first page
      for await (const image of document) {
        return { base64: Buffer.from(image).toString('base64') };
      }
      return null;
    } catch (err: any) {
      this.logger.error(`PDF conversion error: ${err.message}`);
      return null;
    }
  }

  private fuzzyMatchClinician(
    name: string,
    clinicians: Array<{ id: string; firstName: string; lastName: string }>,
  ): { id: string } | null {
    const normalized = name.toLowerCase().trim();
    for (const c of clinicians) {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      if (
        fullName === normalized ||
        normalized.includes(c.lastName.toLowerCase()) && normalized.includes(c.firstName.toLowerCase())
      ) {
        return { id: c.id };
      }
    }
    // Fallback: check if last name matches
    for (const c of clinicians) {
      if (normalized.includes(c.lastName.toLowerCase()) && c.lastName.length > 2) {
        return { id: c.id };
      }
    }
    return null;
  }

  private fuzzyMatchDocType(
    docType: string,
    templates: Array<{ id: string; label: string }>,
  ): { id: string } | null {
    const normalized = docType.toLowerCase().trim();
    // Exact match first
    for (const t of templates) {
      if (t.label.toLowerCase() === normalized) return { id: t.id };
    }
    // Partial match
    for (const t of templates) {
      const label = t.label.toLowerCase();
      if (label.includes(normalized) || normalized.includes(label)) {
        return { id: t.id };
      }
    }
    return null;
  }
}
