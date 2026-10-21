export type Area = "Europe" | "Middle East" | "Americas" | "Pacific";

export type Region = {
  id: string;
  code: string;
  city: string;
  area: Area;
  aws: string;
};

export const AREAS: Area[] = ["Europe", "Middle East", "Americas", "Pacific"];

export const REGIONS: Region[] = [
  { id: "fra", code: "FRA", city: "Frankfurt", area: "Europe", aws: "eu-central-1" },
  { id: "lhr", code: "LHR", city: "London", area: "Europe", aws: "eu-west-2" },
  { id: "par", code: "PAR", city: "Paris", area: "Europe", aws: "eu-west-3" },
  { id: "arn", code: "ARN", city: "Stockholm", area: "Europe", aws: "eu-north-1" },
  { id: "mxp", code: "MXP", city: "Milan", area: "Europe", aws: "eu-south-1" },
  { id: "mad", code: "MAD", city: "Madrid", area: "Europe", aws: "eu-south-2" },
  { id: "bah", code: "BAH", city: "Bahrain", area: "Middle East", aws: "me-south-1" },
  { id: "dxb", code: "DXB", city: "UAE", area: "Middle East", aws: "me-central-1" },
  { id: "tlv", code: "TLV", city: "Tel Aviv", area: "Middle East", aws: "il-central-1" },
  { id: "iad", code: "IAD", city: "N. Virginia", area: "Americas", aws: "us-east-1" },
  { id: "cmh", code: "CMH", city: "Ohio", area: "Americas", aws: "us-east-2" },
  { id: "pdx", code: "PDX", city: "Oregon", area: "Americas", aws: "us-west-2" },
  { id: "yul", code: "YUL", city: "Montreal", area: "Americas", aws: "ca-central-1" },
  { id: "gru", code: "GRU", city: "São Paulo", area: "Americas", aws: "sa-east-1" },
  { id: "mex", code: "MEX", city: "Mexico City", area: "Americas", aws: "mx-central-1" },
  { id: "nrt", code: "NRT", city: "Tokyo", area: "Pacific", aws: "ap-northeast-1" },
  { id: "icn", code: "ICN", city: "Seoul", area: "Pacific", aws: "ap-northeast-2" },
  { id: "hkg", code: "HKG", city: "Hong Kong", area: "Pacific", aws: "ap-east-1" },
  { id: "sin", code: "SIN", city: "Singapore", area: "Pacific", aws: "ap-southeast-1" },
  { id: "bom", code: "BOM", city: "Mumbai", area: "Pacific", aws: "ap-south-1" },
  { id: "syd", code: "SYD", city: "Sydney", area: "Pacific", aws: "ap-southeast-2" },
];

export function regionUrl(region: Region): string {
  return `https://lambda.${region.aws}.amazonaws.com/ping`;
}
