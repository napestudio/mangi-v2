import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import type { UserRole as PrismaUserRole } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  image: true,
  role: true,
  restaurantId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SafeUser = {
  id: string;
  name: string | null;
  username: string;
  email: string;
  image: string | null;
  role: string;
  restaurantId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const STAFF_ROSTER_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
} as const;

type StaffRosterItem = {
  id: string;
  name: string | null;
  username: string;
  role: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<SafeUser[]> {
    return this.prisma.user.findMany({ where: { restaurantId }, select: USER_SELECT });
  }

  findRoster(restaurantId: string): Promise<StaffRosterItem[]> {
    return this.prisma.user.findMany({ where: { restaurantId }, select: STAFF_ROSTER_SELECT });
  }

  async findOne(restaurantId: string, id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({ where: { id, restaurantId }, select: USER_SELECT });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async create(restaurantId: string, dto: CreateUserDto): Promise<SafeUser> {
    const [existingUsername, existingEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { username: dto.username } }),
      this.prisma.user.findUnique({ where: { email: dto.email } }),
    ]);
    if (existingUsername) throw new ConflictException("Username already in use");
    if (existingEmail) throw new ConflictException("Email already in use");

    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        email: dto.email,
        password,
        role: dto.role as unknown as PrismaUserRole,
        restaurantId,
      },
      select: USER_SELECT,
    });
  }

  async update(restaurantId: string, id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.findOne(restaurantId, id);
    const password = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        password,
        role: dto.role as unknown as PrismaUserRole | undefined,
      },
      select: USER_SELECT,
    });
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    await this.findOne(restaurantId, id);
    await this.prisma.user.delete({ where: { id } });
  }
}
