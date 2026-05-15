export const comparisonPrompts = {
  product: {
    fullComparison: `IMPORTANT: I have selected MULTIPLE documents/brochures. Compare ACROSS these documents - treat each document as a separate product or brand to compare.

Compare the products from Document 1 vs Document 2 in a detailed comparison table. Include:
- Product name and brand from each document
- Price (if available)
- Key features side by side
- Specifications comparison
- Pros and cons of each

Do NOT compare products within the same brochure. Compare across the different documents I've selected.`,
    specsTable: `IMPORTANT: Compare ACROSS the selected documents, not within them.

Create a specifications comparison table where:
- Column 1: Feature/Spec name
- Column 2: Product from Document 1 (first brochure)
- Column 3: Product from Document 2 (second brochure)

If a brochure has multiple products, focus on the main/flagship product or ask me to specify which one.`,
    keyDifferences: `IMPORTANT: Compare ACROSS the selected documents/brochures, not within them.

What are the key differences between the product in Document 1 vs the product in Document 2? 
- Which product is better for what use case?
- What are the main advantages of each?
- Which offers better value?

Do NOT compare different models within the same brochure.`,
    specificModels: `Compare these specific models ACROSS my selected documents:

Model from Brochure 1: [ENTER MODEL NUMBER]
Model from Brochure 2: [ENTER MODEL NUMBER]

Create a detailed comparison table including:
- All specifications side by side
- Price comparison (if available)
- Key features and differences
- Pros and cons of each model
- Best use case for each`,
  },
  excel: {
    findDiscrepancies: "Compare these spreadsheets and find any discrepancies. Show differences in a table format.",
    compareStructure: "Compare the structure of these spreadsheets. What columns are different or missing?",
  },
  document: {
    findDifferences: `IMPORTANT: Compare ACROSS the selected documents, not within any single document.

Compare Document 1 vs Document 2:
- What are the key differences between them?
- How do they differ in scope, terms, or requirements?
- Which document is more favorable/comprehensive?`,
    compareTerms: `IMPORTANT: Compare terms ACROSS the selected documents, not within one document.

Compare the key terms and conditions in Document 1 vs Document 2:
- How do they differ?
- Which has more favorable terms?
- What are the risks in each?`,
  },
};
