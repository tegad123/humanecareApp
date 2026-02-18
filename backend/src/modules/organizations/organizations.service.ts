import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { PlanTier } from '../../../generated/prisma/client.js';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        planTier: (dto.planTier as PlanTier) || 'starter',
        planFlags: { ai_doc_intelligence: false, sms_reminders: false },
      },
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true, clinicians: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, clinicians: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.planTier && { planTier: dto.planTier as PlanTier }),
      },
    });
  }
}
