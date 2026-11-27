export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface NewUser {
  email: string;
  passwordHash: string;
}

/**
 * Thrown by a UserRepository when the email is already taken (the unique
 * constraint on User.email). The service maps it to the duplicate message.
 */
export class DuplicateEmailError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'DuplicateEmailError';
  }
}

export interface UserRepository {
  /** Finds a user by normalized email. Returns null when there is none. */
  findByEmail(email: string): Promise<UserRecord | null>;
  /** Saves a new user. Throws DuplicateEmailError when the email is taken. */
  create(user: NewUser): Promise<UserRecord>;
}
