import type { UserRepository } from "./user.repository.ts";
import type { CreateUserData, User } from "./user.entity.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

export class UserService {
  constructor(private repo: UserRepository) {}

  async findMany(params: PaginationParams): Promise<PaginatedResult<User>> {
    return await this.repo.findMany(params);
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound(`User with id ${id} not found`);
    return user;
  }

  async create(data: CreateUserData): Promise<User> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw AppError.conflict("Email already exists");
    return this.repo.create(data);
  }
}
