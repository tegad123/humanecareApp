import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateItemDefinitionDto } from './dto/create-item-definition.dto.js';
import { UpdateItemDefinitionDto } from './dto/update-item-definition.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces.js';
import { ChecklistItemType } from '../../../generated/prisma/client.js';

@Injectable()
export class TemplateCustomizationService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  /**
   * Clone a global template into an org-owned copy with all item definitions.
   */
  async cloneTemplate(
    templateId: string,
    user: AuthenticatedUser,
    customName?: string,
  ) {
    const source = await this.prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { organizationId: null },
          { organizationId: user.organizationId },
        ],
      },
      include: {
        itemDefinitions: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!source) throw new NotFoundException('Template not found');

    // Don't allow cloning an already-customized org template
    if (source.organizationId === user.organizationId && source.isCustomized) {
      throw new BadRequestException('Template is already customized for your organization');
    }

    const shortOrgId = user.organizationId.slice(0, 8);
    const slug = `${source.slug}_org_${shortOrgId}`;

    // Check if a clone already exists for this org + source
    const existing = await this.prisma.checklistTemplate.findFirst({
      where: {
        organizationId: user.organizationId,
        sourceTemplateId: templateId,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A customized version of this template already exists for your organization',
      );
    }

    const cloned = await this.prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.create({
        data: {
          organizationId: user.organizationId,
          name: customName || `${source.name} (Custom)`,
          slug,
          state: source.state,
          discipline: source.discipline,
          description: source.description,
          sourceTemplateId: templateId,
          isCustomized: true,
        },
      });

      if (source.itemDefinitions.length > 0) {
        await tx.checklistItemDefinition.createMany({
          data: source.itemDefinitions.map((def) => ({
            templateId: template.id,
            label: def.label,
            section: def.section,
            type: def.type,
            required: def.required,
            blocking: def.blocking,
            adminOnly: def.adminOnly,
            hasExpiration: def.hasExpiration,
            expirationFieldId: def.expirationFieldId,
            sortOrder: def.sortOrder,
            configJson: def.configJson ?? undefined,
            instructions: def.instructions,
            highRisk: def.highRisk,
            enabled: true,
          })),
        });
      }

      return tx.checklistTemplate.findUnique({
        where: { id: template.id },
        include: {
          itemDefinitions: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { itemDefinitions: true } },
        },
      });
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'checklist_template',
      entityId: cloned!.id,
      action: 'template_cloned',
      details: {
        sourceTemplateId: templateId,
        sourceName: source.name,
        clonedName: cloned!.name,
        itemCount: source.itemDefinitions.length,
      },
    });

    return cloned;
  }

  /**
   * Update an item definition on an org-owned template.
   */
  async updateItemDefinition(
    defId: string,
    dto: UpdateItemDefinitionDto,
    user: AuthenticatedUser,
  ) {
    const def = await this.prisma.checklistItemDefinition.findUnique({
      where: { id: defId },
      include: { template: true },
    });

    if (!def) throw new NotFoundException('Item definition not found');
    if (!def.template.isCustomized || def.template.organizationId !== user.organizationId) {
      throw new ForbiddenException('Can only modify items on your organization\'s customized templates');
    }

    const updated = await this.prisma.checklistItemDefinition.update({
      where: { id: defId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.section !== undefined && { section: dto.section }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.highRisk !== undefined && { highRisk: dto.highRisk }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.blocking !== undefined && { blocking: dto.blocking }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.configJson !== undefined && { configJson: dto.configJson }),
        ...(dto.linkedDocumentId !== undefined && { linkedDocumentId: dto.linkedDocumentId || null }),
      },
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'checklist_item_definition',
      entityId: defId,
      action: 'item_definition_updated',
      details: { fields: Object.keys(dto), templateId: def.templateId },
    });

    return updated;
  }

  /**
   * Add a custom item definition to an org-owned template.
   */
  async createItemDefinition(
    templateId: string,
    dto: CreateItemDefinitionDto,
    user: AuthenticatedUser,
  ) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId: user.organizationId, isCustomized: true },
    });

    if (!template) {
      throw new ForbiddenException('Can only add items to your organization\'s customized templates');
    }

    // Get next sort order
    const maxSort = await this.prisma.checklistItemDefinition.aggregate({
      where: { templateId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.checklistItemDefinition.create({
      data: {
        templateId,
        label: dto.label,
        section: dto.section,
        type: dto.type as ChecklistItemType,
        required: dto.required ?? true,
        blocking: dto.blocking ?? false,
        adminOnly: dto.adminOnly ?? false,
        hasExpiration: dto.hasExpiration ?? false,
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 10,
        configJson: dto.configJson ?? undefined,
        instructions: dto.instructions,
        highRisk: dto.highRisk ?? false,
        linkedDocumentId: dto.linkedDocumentId,
        enabled: true,
      },
    });

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'checklist_item_definition',
      entityId: created.id,
      action: 'item_definition_created',
      details: { label: dto.label, section: dto.section, templateId },
    });

    return created;
  }

  /**
   * Delete an item definition. Soft-delete if clinician items reference it, hard-delete otherwise.
   */
  async deleteItemDefinition(defId: string, user: AuthenticatedUser) {
    const def = await this.prisma.checklistItemDefinition.findUnique({
      where: { id: defId },
      include: {
        template: true,
        _count: { select: { clinicianItems: true } },
      },
    });

    if (!def) throw new NotFoundException('Item definition not found');
    if (!def.template.isCustomized || def.template.organizationId !== user.organizationId) {
      throw new ForbiddenException('Can only delete items on your organization\'s customized templates');
    }

    if (def._count.clinicianItems > 0) {
      // Soft-delete: disable the item so future clinicians won't get it
      await this.prisma.checklistItemDefinition.update({
        where: { id: defId },
        data: { enabled: false },
      });
    } else {
      await this.prisma.checklistItemDefinition.delete({
        where: { id: defId },
      });
    }

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'checklist_item_definition',
      entityId: defId,
      action: def._count.clinicianItems > 0 ? 'item_definition_disabled' : 'item_definition_deleted',
      details: { label: def.label, templateId: def.templateId },
    });

    return { success: true, softDeleted: def._count.clinicianItems > 0 };
  }

  /**
   * Reorder item definitions in a template.
   */
  async reorderItems(
    templateId: string,
    orderedIds: string[],
    user: AuthenticatedUser,
  ) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId: user.organizationId, isCustomized: true },
    });

    if (!template) {
      throw new ForbiddenException('Can only reorder items on your organization\'s customized templates');
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.checklistItemDefinition.update({
          where: { id },
          data: { sortOrder: index * 10 },
        }),
      ),
    );

    await this.auditLogs.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'checklist_template',
      entityId: templateId,
      action: 'items_reordered',
      details: { itemCount: orderedIds.length },
    });

    return { success: true };
  }
}
