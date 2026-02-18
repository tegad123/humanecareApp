import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ChecklistTemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List templates visible to an organization:
   * - Global templates (organizationId IS NULL)
   * - Org-specific templates
   */
  async findAll(organizationId: string) {
    return this.prisma.checklistTemplate.findMany({
      where: {
        OR: [
          { organizationId: null },
          { organizationId },
        ],
      },
      orderBy: [{ discipline: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { itemDefinitions: true } },
      },
    });
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
    return template;
  }

  /**
   * Get just the item definitions for a template (used when instantiating a checklist).
   */
  async getDefinitions(templateId: string) {
    return this.prisma.checklistItemDefinition.findMany({
      where: { templateId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
