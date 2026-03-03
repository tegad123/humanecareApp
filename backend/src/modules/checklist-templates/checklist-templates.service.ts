import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ChecklistTemplatesService {
  constructor(private prisma: PrismaService) {}

  private async getLatestPublishMetadata(
    organizationId: string,
    templateIds: string[],
  ) {
    if (templateIds.length === 0) return new Map<string, any>();
    const templateIdSet = new Set(templateIds);
    const rows = await this.prisma.$queryRaw<
      Array<{
        template_id: string;
        published_revision: number;
        published_at: Date;
        published_by_user_id: string;
      }>
    >`
      SELECT DISTINCT ON (template_id)
        template_id,
        published_revision,
        published_at,
        published_by_user_id
      FROM template_publish_attestations
      WHERE organization_id = ${organizationId}
      ORDER BY template_id, published_at DESC
    `;
    return new Map(
      rows
        .filter((row) => templateIdSet.has(row.template_id))
        .map((row) => [
          row.template_id,
          {
            publishedRevision: row.published_revision,
            lastPublishedAt: row.published_at?.toISOString() || null,
            lastPublishedById: row.published_by_user_id,
          },
        ]),
    );
  }

  /**
   * List templates visible to an organization:
   * - Global templates (organizationId IS NULL)
   * - Org-specific templates
   */
  async findAll(organizationId: string) {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: {
        OR: [
          { organizationId: null },
          { organizationId },
        ],
      },
      orderBy: [{ discipline: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { itemDefinitions: { where: { enabled: true } } } },
      },
    });

    const publishMeta = await this.getLatestPublishMetadata(
      organizationId,
      templates.map((template) => template.id),
    );

    return templates.map((template) => ({
      ...template,
      ...(publishMeta.get(template.id) || {}),
    }));
  }

  async findOne(id: string, organizationId: string) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: {
        id,
        OR: [
          { organizationId: null },
          { organizationId },
        ],
      },
      include: {
        itemDefinitions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!template) throw new NotFoundException('Template not found');

    const publishMeta = await this.getLatestPublishMetadata(organizationId, [
      template.id,
    ]);

    return {
      ...template,
      ...(publishMeta.get(template.id) || {}),
    };
  }

  /**
   * Get just the item definitions for a template (used when instantiating a checklist).
   */
  async getDefinitions(templateId: string, options?: { enabledOnly?: boolean }) {
    return this.prisma.checklistItemDefinition.findMany({
      where: {
        templateId,
        ...(options?.enabledOnly && { enabled: true }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
