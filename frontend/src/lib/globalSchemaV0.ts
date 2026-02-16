import schemaContract from "../../../shared/global_schema_v0_contract.json";

export type GlobalSchemaField = {
  key: string;
  label: string;
  section: string;
  order: number;
  value_type: "string" | "number" | "boolean" | "date" | "unknown";
  repeatable: boolean;
  critical: boolean;
  optional: boolean;
};

type RawSchemaField = Omit<GlobalSchemaField, "order">;

type RawContract = {
  schema_version: string;
  fields: RawSchemaField[];
};

const parsedContract = schemaContract as RawContract;

export const GLOBAL_SCHEMA_V0_VERSION: string = parsedContract.schema_version;

export const GLOBAL_SCHEMA_V0: GlobalSchemaField[] = parsedContract.fields.map(
  (field, index) => ({
    ...field,
    order: index + 1,
  })
);

export const GLOBAL_SCHEMA_SECTION_ORDER: string[] = [
  ...new Set(GLOBAL_SCHEMA_V0.map((field) => field.section)),
];
