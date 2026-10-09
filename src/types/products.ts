/**
 * A DrugCentral pharmaceutical **product** record (`product` table): a
 * marketed formulation with route/form, distinct from its active-ingredient
 * structures. Ingredient-level facts do not automatically describe every
 * product.
 */
export interface Product {
  /** Product row id. */
  id: number;
  /** Product name as marketed. */
  product_name: string | null;
  /** Generic name, when supplied. */
  generic_name: string | null;
  /** NDC product code (labeler-product segment or full code). */
  ndc_product_code: string | null;
  /** Route of administration (e.g. `"ORAL"`). */
  route: string | null;
  /** Dosage form (e.g. `"TABLET"`). */
  form: string | null;
  /** Number of active ingredients in the product. */
  active_ingredient_count: number | null;
  /** Marketing status (e.g. `"ANDA"`, `"NDA"`), when supplied. */
  marketing_status: string | null;
}
