# DrugCentral fixture attribution

The sampled response JSON files in this directory contain **DrugCentral
data**, maintained by the University of New Mexico. They are provided under
**CC BY-SA 4.0**, not the Apache-2.0 license used for this client's code.

- Source: [DrugCentral](https://drugcentral.org) and its
  [about page](https://drugcentral.org/about).
- Data license: [Creative Commons Attribution-ShareAlike 4.0
  International](https://creativecommons.org/licenses/by-sa/4.0/).
- Citation: [DrugCentral: a drug–target interaction resource](https://pubmed.ncbi.nlm.nih.gov/27683582/),
  *Nucleic Acids Research*.
- Provenance: each response's `.meta.json` records its request URL, retrieval
  timestamp, and payload hash. The capture script selects API responses,
  formats their JSON, and caps large responses at 50 rows for testing;
  metadata records received/stored row counts and notes truncation. These
  fixtures are samples, not a complete DrugCentral database or an independent
  medical interpretation.

`openapi.json` is a separate snapshot of the upstream API description; its
source URL, API version, retrieval timestamp, and hash are recorded in
`openapi.meta.json`. It is not a sampled drug-data response.

Redistributing or adapting the response data requires attribution and
compliance with the data's share-alike terms. The npm package excludes this
directory and redistributes no DrugCentral data.

These samples are for client testing, **not medical advice**, clinical
decisions, or safety clearance. Empty or absent data never means a drug is
safe. Thank you to the DrugCentral team for making this resource available.
