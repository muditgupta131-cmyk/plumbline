import { Schema, model, type Document, type Types } from 'mongoose';

export interface SessionDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: 'rotated' | 'logout' | 'reuse-detected' | 'password-change';
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: {
      type: String,
      enum: ['rotated', 'logout', 'reuse-detected', 'password-change'],
    },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<SessionDocument>('Session', sessionSchema);
