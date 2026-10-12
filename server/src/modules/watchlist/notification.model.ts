import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export const NOTIFICATION_KINDS = ['ALERT', 'SYSTEM'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: NotificationKind;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  readAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument, Model<NotificationDocument>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, required: true, enum: NOTIFICATION_KINDS, default: 'ALERT' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
    readAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = model<NotificationDocument, Model<NotificationDocument>>(
  'Notification',
  notificationSchema,
);
