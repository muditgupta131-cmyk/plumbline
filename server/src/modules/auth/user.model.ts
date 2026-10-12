import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { CURRENCIES, MARKETS, type Currency, type Market } from '../../types/market.js';

export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export type AuthProvider = 'email' | 'google';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  baseCurrency: Currency;
  defaultMarket: Market;
  emailAlerts: boolean;
  pushAlerts: boolean;
}

export interface UserDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  role: Role;
  providers: AuthProvider[];
  emailVerified: boolean;
  preferences: UserPreferences;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
}

const preferencesSchema = new Schema<UserPreferences>(
  {
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    baseCurrency: { type: String, enum: CURRENCIES, default: 'INR' },
    defaultMarket: { type: String, enum: MARKETS, default: 'IN' },
    emailAlerts: { type: Boolean, default: true },
    pushAlerts: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new Schema<UserDocument, UserModel>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, index: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    providers: { type: [String], enum: ['email', 'google'], default: ['email'] },
    emailVerified: { type: Boolean, default: false },
    preferences: { type: preferencesSchema, default: () => ({}) },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.findByEmail = function findByEmail(email: string) {
  return this.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
};

export const User = model<UserDocument, UserModel>('User', userSchema);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  providers: AuthProvider[];
  emailVerified: boolean;
  preferences: UserPreferences;
  createdAt: Date;
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    providers: user.providers,
    emailVerified: user.emailVerified,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}
