import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface FundSchemeDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  schemeCode: string;
  name: string;
  searchName: string;
  plan: string | null;
  option: string | null;
  fundHouse: string;
  category: string;
  isin: string | null;
  isinReinvest: string | null;
  nav: number;
  navDate: Date;
  updatedAt: Date;
}

const fundSchemeSchema = new Schema<FundSchemeDocument, Model<FundSchemeDocument>>(
  {
    schemeCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    searchName: { type: String, required: true, lowercase: true, index: true },
    plan: { type: String, default: null },
    option: { type: String, default: null },
    fundHouse: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    isin: { type: String, default: null, index: true },
    isinReinvest: { type: String, default: null, index: true },
    nav: { type: Number, required: true },
    navDate: { type: Date, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const FundScheme = model<FundSchemeDocument, Model<FundSchemeDocument>>('FundScheme', fundSchemeSchema);
