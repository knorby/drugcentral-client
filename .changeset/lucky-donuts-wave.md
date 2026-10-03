---
"@knorby/drugcentral-client": minor
---
Initial release: fully-typed, zero-dependency universal TypeScript client for the DrugCentral DRS API.

- Complete typed resource coverage (structures, synonyms, identifiers, id types, products, ATC, drug classes, struct2atc/struct2obprod, OMOP relationships, FAERS incl. male/female strata, act_table_full, target metadata cluster) with list/getAll pagination that handles the upstream unhonored-limit quirk, plus raw CSV/TSV exportText where offered.
- Guided domain layer with provenance envelopes: searchStructuresByName (ambiguity preserved), resolveIdentifier/resolveByRxcui/resolveByUnii (validated vocabularies; NDC resolution documented-unsupported), getStructureProfile, getConditionRelationships/getIndications/getOffLabelUses/getContraindications (exact-label filtering; upstream substring trap avoided), getFaersSignals (population-stamped signals, never incidence), getTargetActivity (drug-target, not DDI).
- Typed error taxonomy incl. DrugCentralNotFoundError for the no-match-as-404 behavior and DrugCentralInvalidResponseError for transient non-JSON bodies; opt-in bounded 5xx retry; injectable fetch; consumer-abort passthrough.
- Live fixture capture + OpenAPI snapshot, shape-snapshot drift tooling (drift:check/drift:capture), deterministic offline tests, and opt-in live smoke tests (test:live).
